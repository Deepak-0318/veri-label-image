using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using verilabelbackend.Services.Supabase;

namespace verilabelbackend.Controllers;

[ApiController]
[Route("api/annotations")]
[Authorize]
public sealed class AnnotationsController : ControllerBase
{
    private readonly SupabaseAnnotationService _annotationService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public AnnotationsController(
        SupabaseAnnotationService annotationService,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _annotationService = annotationService;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    [HttpGet]
    public async Task<IActionResult> GetAnnotations([FromQuery] Guid fileId)
    {
        if (fileId == Guid.Empty)
            return BadRequest("File ID is required");

        try
        {
            var annotations = await _annotationService.GetAnnotationsByFileAsync(GetJwt(), fileId);
            return Ok(annotations);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        try
        {
            var annotation = await _annotationService.GetAnnotationByIdAsync(GetJwt(), id);
            if (annotation == null)
                return NotFound("Annotation not found");

            return Ok(annotation);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Dictionary<string, object> annotation)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        // Validate type & data
        if (!annotation.TryGetValue("type", out var typeObj) || string.IsNullOrWhiteSpace(typeObj?.ToString()))
            return BadRequest("Annotation type is required");

        var type = typeObj.ToString();

        if (!annotation.TryGetValue("label", out var labelObj) || string.IsNullOrWhiteSpace(labelObj?.ToString()))
            return BadRequest("Annotation label is required");

        if (!annotation.TryGetValue("color", out var colorObj) || string.IsNullOrWhiteSpace(colorObj?.ToString()))
            return BadRequest("Annotation color is required");

        if (!annotation.TryGetValue("data", out var dataObj) || dataObj == null)
            return BadRequest("Annotation data is required");

        // Coordinates validation
        var dataStr = dataObj.ToString();
        try
        {
            using var doc = JsonDocument.Parse(dataStr!);
            var root = doc.RootElement;
            if (type == "boundingBox")
            {
                if (!root.TryGetProperty("x", out _) || !root.TryGetProperty("y", out _) ||
                    !root.TryGetProperty("width", out var wProp) || !root.TryGetProperty("height", out var hProp))
                {
                    return BadRequest("Bounding box annotations must contain x, y, width, and height");
                }
                if (wProp.GetDouble() < 0 || hProp.GetDouble() < 0)
                {
                    return BadRequest("Bounding box width and height must be non-negative");
                }
            }
            else if (type == "polygon")
            {
                if (!root.TryGetProperty("points", out var pointsProp) || pointsProp.ValueKind != JsonValueKind.Array || pointsProp.GetArrayLength() < 3)
                {
                    return BadRequest("Polygon annotations must contain at least 3 points");
                }
            }
            else if (type == "polyline")
            {
                if (!root.TryGetProperty("points", out var pointsProp) || pointsProp.ValueKind != JsonValueKind.Array || pointsProp.GetArrayLength() < 2)
                {
                    return BadRequest("Polyline annotations must contain at least 2 points");
                }
            }
            else if (type == "point" || type == "keypoint")
            {
                if (!root.TryGetProperty("x", out _) || !root.TryGetProperty("y", out _))
                {
                    return BadRequest("Point/Keypoint annotations must contain x and y coordinates");
                }
            }
        }
        catch (JsonException)
        {
            return BadRequest("Invalid JSON structure in annotation data");
        }

        // Set user_id and generate GUID ID if not provided
        annotation["user_id"] = userId;
        if (!annotation.TryGetValue("id", out var idObj) || string.IsNullOrWhiteSpace(idObj?.ToString()))
        {
            annotation["id"] = Guid.NewGuid();
        }

        try
        {
            var result = await _annotationService.InsertAnnotationAsync(GetJwt(), annotation);
            
            // Log creation audit trail
            _ = LogAuditEventAsync(
                GetJwt(),
                userId,
                "create_annotation",
                $"created \"{annotation["label"]}\" {type} annotation",
                Guid.Parse(result["id"].ToString()!),
                annotation["label"].ToString()!,
                null,
                result
            );

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] Dictionary<string, object> patch)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        try
        {
            var oldAnnotation = await _annotationService.GetAnnotationByIdAsync(GetJwt(), id);
            if (oldAnnotation == null)
                return NotFound("Annotation not found");

            var result = await _annotationService.UpdateAnnotationAsync(GetJwt(), id, patch);

            // Log update audit trail
            _ = LogAuditEventAsync(
                GetJwt(),
                userId,
                "update_annotation",
                $"updated annotation \"{result["label"]}\"",
                id,
                result["label"].ToString()!,
                oldAnnotation,
                result
            );

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
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        try
        {
            var oldAnnotation = await _annotationService.GetAnnotationByIdAsync(GetJwt(), id);
            if (oldAnnotation == null)
                return NotFound("Annotation not found");

            await _annotationService.DeleteAnnotationAsync(GetJwt(), id);

            // Log deletion audit trail
            _ = LogAuditEventAsync(
                GetJwt(),
                userId,
                "delete_annotation",
                $"deleted annotation \"{oldAnnotation["label"]}\"",
                id,
                oldAnnotation["label"].ToString()!,
                oldAnnotation,
                null
            );

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("batch-delete")]
    public async Task<IActionResult> BatchDelete([FromBody] BatchDeleteRequest req)
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        if (req.Ids == null || req.Ids.Count == 0)
            return BadRequest("IDs list is required");

        try
        {
            await _annotationService.BatchDeleteAnnotationsAsync(GetJwt(), req.Ids);
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("/api/tasks/{taskId:guid}/annotations")]
    public async Task<IActionResult> GetTaskAnnotations(Guid taskId)
    {
        try
        {
            var annotations = await _annotationService.GetAnnotationsByTaskAsync(GetJwt(), taskId);
            return Ok(annotations);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("{id:guid}/history")]
    public async Task<IActionResult> GetHistory(Guid id)
    {
        try
        {
            var logUrl = $"{_configuration["Supabase:Url"]}/rest/v1/audit_logs?entity_type=eq.annotation&entity_id=eq.{id}&order=created_at.desc";
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("apikey", _configuration["Supabase:AnonKey"]);
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {GetJwt()}");
            
            var response = await client.GetAsync(logUrl);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                return StatusCode((int)response.StatusCode, new { error });
            }

            var content = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(content);
            var history = new List<object>();
            foreach (var element in doc.RootElement.EnumerateArray())
            {
                history.Add(new
                {
                    userId = element.TryGetProperty("user_id", out var u) ? u.GetString() : null,
                    action = element.TryGetProperty("action", out var a) ? a.GetString() : null,
                    description = element.TryGetProperty("description", out var d) ? d.GetString() : null,
                    oldValues = element.TryGetProperty("old_values", out var ov) ? (ov.ValueKind == JsonValueKind.String ? ov.GetString() : ov.GetRawText()) : null,
                    newValues = element.TryGetProperty("new_values", out var nv) ? (nv.ValueKind == JsonValueKind.String ? nv.GetString() : nv.GetRawText()) : null,
                    createdAt = element.TryGetProperty("created_at", out var ca) ? ca.GetString() : null
                });
            }

            return Ok(history);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private async Task LogAuditEventAsync(
        string jwt,
        Guid userId,
        string action,
        string description,
        Guid entityId,
        string entityName,
        object? oldValues = null,
        object? newValues = null)
    {
        Guid? orgId = null;
        try
        {
            var orgUrl = $"{_configuration["Supabase:Url"]}/rest/v1/rpc/get_user_org_id";
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("apikey", _configuration["Supabase:AnonKey"]);
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {jwt}");
            var body = JsonSerializer.Serialize(new { _user_id = userId });
            var response = await client.PostAsync(orgUrl, new StringContent(body, Encoding.UTF8, "application/json"));
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                if (Guid.TryParse(content.Trim('"'), out var parsedOrgId))
                {
                    orgId = parsedOrgId;
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AnnotationsController] Warning: failed to fetch user org id: {ex.Message}");
        }

        try
        {
            var logUrl = $"{_configuration["Supabase:Url"]}/rest/v1/audit_logs";
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("apikey", _configuration["Supabase:AnonKey"]);
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {jwt}");

            var auditLog = new
            {
                user_id = userId,
                organization_id = orgId,
                action,
                category = "annotation",
                entity_type = "annotation",
                entity_id = entityId.ToString(),
                entity_name = entityName,
                description,
                old_values = oldValues != null ? JsonSerializer.Serialize(oldValues) : null,
                new_values = newValues != null ? JsonSerializer.Serialize(newValues) : null,
                created_at = DateTimeOffset.UtcNow
            };

            var payload = JsonSerializer.Serialize(auditLog);
            var content = new StringContent(payload, Encoding.UTF8, "application/json");
            await client.PostAsync(logUrl, content);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AnnotationsController] Warning: failed to insert audit log: {ex.Message}");
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

    public class BatchDeleteRequest
    {
        public List<Guid> Ids { get; set; } = new();
    }
}
