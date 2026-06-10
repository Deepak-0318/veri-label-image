using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;
using verilabelbackend.Models.Supabase;
using verilabelbackend.Repositories;
using verilabelbackend.Services.Azure;
using verilabelbackend.Services.Supabase;
using DocumentModel = verilabelbackend.Models.Document;

namespace verilabelbackend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class FilesController : ControllerBase
{
    private readonly AzureBlobStorageService _storage;
    private readonly IDocumentRepository _docs;
  private readonly SupabaseFileService _supabaseFile;

    private const long MaxBytes = 500L * 1024 * 1024;

    public FilesController(
        AzureBlobStorageService storage,
        IDocumentRepository docs,
        SupabaseFileService supabaseFile)
    {
        _storage = storage;
        _docs = docs;
        _supabaseFile = supabaseFile;
    }

[HttpPost("upload")]
[RequestSizeLimit(500 * 1024 * 1024)]
[RequestFormLimits(MultipartBodyLengthLimit = 500 * 1024 * 1024)]
public async Task<IActionResult> Upload(
    IFormFile file,
    [FromQuery] Guid? projectId,
    [FromForm] string? folder,
    [FromForm] string? content)
{
    if (file is null || file.Length == 0)
        return BadRequest(new { error = "No file provided." });

    if (file.Length > MaxBytes)
        return BadRequest(new { error = "File exceeds the 500 MB size limit." });

    var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
    if (!AzureBlobStorageService.IsSupportedExtension(ext))
        return BadRequest(new
        {
            error = $"'{ext}' is not supported.",
            supportedTypes = AzureBlobStorageService.SupportedExtensions()
        });

    var userId = GetUserId();
    if (userId == Guid.Empty)
        return Unauthorized();

    var jwt = GetJwt();

    //Upload to Azure
    await using var stream = file.OpenReadStream();
    var (blobPath, path) = await _storage.SaveAsync(stream, file.FileName, userId);

    //Save document metadata
    var doc = await _docs.CreateAsync(new DocumentModel
    {
        UserId = userId,
        OriginalName = file.FileName,
        BlobPath = blobPath,
        ContentType = AzureBlobStorageService.ResolveMime(ext),
        SizeBytes = file.Length
    });

    var now = DateTimeOffset.UtcNow;

    var fileEntity = new FileEntity
    {
        Id = doc.Id,
        UserId = userId,
        ProjectId = projectId,
        Name = file.FileName,
        Type = AzureBlobStorageService.ResolveMime(ext),
        ThumbnailUrl = path,
        Size = file.Length,
        StorageMode = "copy",
        Folder = folder,
        Content = content, 
        CreatedAt = now,
        UpdatedAt = now
    };

    await _supabaseFile.InsertFileAsync(jwt, fileEntity);

    return Ok(new
    {
        id = fileEntity.Id,
        name = fileEntity.Name,
        type = fileEntity.Type,
        size = fileEntity.Size,
        createdAt = fileEntity.CreatedAt,
        sasUrl = string.IsNullOrEmpty(fileEntity.ThumbnailUrl)
            ? null
            : _storage.GenerateSasUrl(fileEntity.ThumbnailUrl)
    });
}
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var jwt = GetJwt();
        var file = await _supabaseFile.GetFileByIdAsync(jwt, id);
        if (file is null) return NotFound();

        return Ok(new
        {
            file.Id,
            file.Name,
            file.Type,
            file.Size,
            file.CreatedAt,
            sasUrl = string.IsNullOrEmpty(file.ThumbnailUrl) ? null : _storage.GenerateSasUrl(file.ThumbnailUrl),
            expiresAt = DateTimeOffset.UtcNow.AddMinutes(180)
        });
    }

    [HttpGet("get-files-by-project-id")]
    public async Task<IActionResult> GetFilesByProjectId([FromQuery] Guid projectId)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var jwt = GetJwt();

        try
        {
            var files = await _supabaseFile.GetFilesByProjectIdAsync(jwt, projectId);

            var result = files.Select(f => new
            {
                id = f.Id,
                name = f.Name,
                type = f.Type,
                size = f.Size,
                createdAt = f.CreatedAt,
                projectId = f.ProjectId,
                folder = f.Folder,
                content = f.Content,
                sasUrl = string.IsNullOrEmpty(f.ThumbnailUrl)
                    ? null
                    : _storage.GenerateSasUrl(f.ThumbnailUrl)
            });

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var jwt = GetJwt();
        var file = await _supabaseFile.GetFileByIdAsync(jwt, id);
        if (file is null) return NotFound();

        var blobPath = file.ThumbnailUrl;
        await _storage.DeleteAsync(blobPath);
        await _supabaseFile.DeleteFileAsync(jwt, id);

        return Ok(new { deleted = true, id });
    }

    [HttpGet]
    public async Task<IActionResult> GetByUser()
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var jwt = GetJwt();

        try
        {
            var files = await _supabaseFile.GetFilesByUserAsync(jwt, userId);

            var result = files
                .OrderByDescending(f => f.CreatedAt)
                .Select(f => new
                {
                    id = f.Id,
                    name = f.Name,
                    type = f.Type,
                    size = f.Size,
                    createdAt = f.CreatedAt,
                    projectId = f.ProjectId,
                    folder = f.Folder,
                    content = f.Content,
                    sasUrl = string.IsNullOrEmpty(f.ThumbnailUrl)
                        ? null
                        : _storage.GenerateSasUrl(f.ThumbnailUrl)
                });

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private object ToResponse(DocumentModel doc) => new
    {
        doc.Id,
        doc.UserId,
        doc.OriginalName,
        doc.ContentType,
        doc.SizeBytes,
        doc.UploadedAt,
        sasUrl = _storage.GenerateSasUrl(doc.BlobPath),
        expiresAt = DateTimeOffset.UtcNow.AddMinutes(15)
    };

    [HttpPut("move")]
    public async Task<IActionResult> MoveFiles([FromBody] MoveFilesRequest req)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        if (req.FileIds == null || !req.FileIds.Any())
            return BadRequest(new { error = "No fileIds provided" });

        var jwt = GetJwt();

        try
        {
            await _supabaseFile.MoveFilesAsync(jwt, req.FileIds, req.Folder);
            return Ok(new { moved = true, count = req.FileIds.Count });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPut("rename-folder")]
    public async Task<IActionResult> RenameFolder([FromBody] RenameFolderRequest req)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        if (string.IsNullOrWhiteSpace(req.OldName) || string.IsNullOrWhiteSpace(req.NewName))
            return BadRequest(new { error = "Invalid folder names" });

        if (req.OldName == req.NewName)
            return Ok(new { renamed = false, message = "No change" });

        var jwt = GetJwt();

        try
        {
            await _supabaseFile.RenameFolderAsync(jwt, userId, req.OldName, req.NewName);
            return Ok(new { renamed = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue("sub")
               ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
    }

    private string GetJwt()
    {
        var auth = HttpContext.Request.Headers["Authorization"].ToString();
        return auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? auth["Bearer ".Length..]
            : auth;
    }
}

public class MoveFilesRequest
{
    public List<string> FileIds { get; set; } = new();
    public string? Folder { get; set; }
}

public class RenameFolderRequest
{
    public string OldName { get; set; } = string.Empty;
    public string NewName { get; set; } = string.Empty;
}