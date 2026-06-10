using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using verilabelbackend.Services.Supabase;
using verilabelbackend.Models.Supabase;

namespace verilabelbackend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class DatasetManagementController : ControllerBase
{
    private readonly SupabaseDatasetService _datasetService;
    private readonly ILogger<DatasetManagementController> _logger;

    public DatasetManagementController(SupabaseDatasetService datasetService, ILogger<DatasetManagementController> logger)
    {
        _datasetService = datasetService;
        _logger = logger;
    }

    //Get All Datasets
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        try
        {
            var datasets = await _datasetService.GetAllByUserAsync(GetJwt(), userId);
            return Ok(datasets);
        }
        // exposes internal errors - changed
        catch (Exception ex)
        {
            _logger.LogError(ex,"Dataset fetch failed");
            return StatusCode(500, new { error = "Internal Server Error"});
        }
    }

    //Create Dataset
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDatasetRequest body)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        if (string.IsNullOrWhiteSpace(body.Name))
        {
            return BadRequest("Dataset name required");
        }

        var dataset = new
        {
            id = Guid.NewGuid(),
            user_id = userId,
            name = body.Name,
            description = body.Description,
            project_id = body.ProjectId,
            created_at = DateTimeOffset.UtcNow,
            updated_at = DateTimeOffset.UtcNow
        };

        try
        {
            await _datasetService.InsertAsync(GetJwt(), dataset);
            return Ok(dataset);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    //Delete Dataset
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        try
        {
            await _datasetService.DeleteAsync(GetJwt(), id, userId);
            return Ok(new { deleted = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    //Assign Project
    [HttpPut("{id:guid}/assign-project")]
    public async Task<IActionResult> AssignProject(Guid id, [FromBody] AssignProjectRequest body)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        try
        {
            await _datasetService.AssignProjectAsync(GetJwt(), id, userId, body.ProjectId);
            return Ok(new { updated = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    //Add files to dataset
    [HttpPost("{id:guid}/files")]
    public async Task<IActionResult> AddFiles(Guid id, [FromBody] AddFilesRequest body)
    {
        try
        {
            await _datasetService.AddFilesAsync(GetJwt(), id, body.FileIds);
            return Ok();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    //Remove file from dataset
    [HttpDelete("{id:guid}/files/{fileId:guid}")]
    public async Task<IActionResult> RemoveFile(Guid id, Guid fileId)
    {
        try
        {
            await _datasetService.RemoveFileAsync(GetJwt(), id, fileId);
            return Ok();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }


//Get datasets by project
    [HttpGet("get-datasets-by-project/{projectId:guid}")]
    public async Task<IActionResult> GetDatasetsByProject(Guid projectId)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();
        //missing try-catch - changed
        try
        {
            var result = await _datasetService.GetDatasetIdsByProjectAsync(GetJwt(), userId, projectId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }


    //get files by dataset ids
    [HttpPost("get-files-by-dataset-ids")]
    public async Task<IActionResult> GetFilesByDatasetIds([FromBody] DatasetIdsRequest request)
    {
        if (request.DatasetIds == null || request.DatasetIds.Count == 0)
            return Ok(new List<Guid>());

        var result = await _datasetService.GetFileIdsByDatasetIdsAsync(GetJwt(), request.DatasetIds);
        return Ok(result);
    }


    [HttpGet("{id:guid}/files")]
    public async Task<IActionResult> GetDatasetFiles(Guid id)
    {
        try
        {
            var files = await _datasetService.GetDatasetFileIdsAsync(GetJwt(), id);
            return Ok(files);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("file-map")]
    public async Task<IActionResult> GetFileDatasetMap([FromBody] FileDatasetMapRequest body)
    {
        try
        {
            var result = await _datasetService.GetFileDatasetMapAsync(GetJwt(), body.DatasetIds);
            return Ok(result);
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
