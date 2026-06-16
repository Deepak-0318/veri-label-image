using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using verilabelbackend.Services;

namespace verilabelbackend.Controllers
{
    [ApiController]
    [Route("api/projects")]
    [Authorize]
    public sealed class ProjectsController : ControllerBase
    {
        private readonly ExportService _exportService;
        private readonly ImportService _importService;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _supabaseUrl;
        private readonly string _anonKey;

        public ProjectsController(
            ExportService exportService,
            ImportService importService,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration)
        {
            _exportService = exportService;
            _importService = importService;
            _httpClientFactory = httpClientFactory;
            _supabaseUrl = configuration["Supabase:Url"]!;
            _anonKey = configuration["Supabase:AnonKey"]!;
        }

        [HttpPost("{id:guid}/archive")]
        [Authorize(Roles = "admin,manager")]
        public async Task<IActionResult> Archive(Guid id)
        {
            var userId = GetUserId();
            if (userId == Guid.Empty) return Unauthorized();

            try
            {
                var client = _httpClientFactory.CreateClient();
                var url = $"{_supabaseUrl}/rest/v1/projects?id=eq.{id}";
                var payload = JsonSerializer.Serialize(new { is_archived = true });
                var content = new StringContent(payload, Encoding.UTF8, "application/json");

                using var request = new HttpRequestMessage(HttpMethod.Patch, url) { Content = content };
                request.Headers.Add("apikey", _anonKey);
                request.Headers.Add("Authorization", $"Bearer {GetJwt()}");
                request.Headers.Add("Prefer", "return=minimal");

                var response = await client.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    return StatusCode((int)response.StatusCode, new { error = $"Failed to archive project in database: {error}" });
                }

                // Log audit event
                _ = LogProjectAuditEventAsync(GetJwt(), userId, id, "archive_project", $"Archived project {id}");

                return Ok(new { success = true, isArchived = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("{id:guid}/reopen")]
        [Authorize(Roles = "admin,manager")]
        public async Task<IActionResult> Reopen(Guid id)
        {
            var userId = GetUserId();
            if (userId == Guid.Empty) return Unauthorized();

            try
            {
                var client = _httpClientFactory.CreateClient();
                var url = $"{_supabaseUrl}/rest/v1/projects?id=eq.{id}";
                var payload = JsonSerializer.Serialize(new { is_archived = false });
                var content = new StringContent(payload, Encoding.UTF8, "application/json");

                using var request = new HttpRequestMessage(HttpMethod.Patch, url) { Content = content };
                request.Headers.Add("apikey", _anonKey);
                request.Headers.Add("Authorization", $"Bearer {GetJwt()}");
                request.Headers.Add("Prefer", "return=minimal");

                var response = await client.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    return StatusCode((int)response.StatusCode, new { error = $"Failed to reopen project in database: {error}" });
                }

                // Log audit event
                _ = LogProjectAuditEventAsync(GetJwt(), userId, id, "reopen_project", $"Reopened project {id}");

                return Ok(new { success = true, isArchived = false });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("{id:guid}/export")]
        public async Task<IActionResult> Export(Guid id, [FromQuery] string format)
        {
            if (string.IsNullOrWhiteSpace(format))
                return BadRequest("Format is required (coco or yolo)");

            try
            {
                if (format.Equals("coco", StringComparison.OrdinalIgnoreCase))
                {
                    var data = await _exportService.ExportToCocoAsync(GetJwt(), id);
                    return File(data, "application/json", $"project_{id}_coco.json");
                }
                else if (format.Equals("yolo", StringComparison.OrdinalIgnoreCase))
                {
                    var data = await _exportService.ExportToYoloAsync(GetJwt(), id);
                    return File(data, "application/zip", $"project_{id}_yolo.zip");
                }
                else
                {
                    return BadRequest("Unsupported export format. Supported formats: coco, yolo");
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("{id:guid}/import")]
        [Authorize(Roles = "admin,manager")]
        public async Task<IActionResult> Import(Guid id, [FromQuery] string format, IFormFile file)
        {
            if (string.IsNullOrWhiteSpace(format))
                return BadRequest("Format is required (coco or yolo)");

            if (file == null || file.Length == 0)
                return BadRequest("No file provided");

            var userId = GetUserId();
            if (userId == Guid.Empty) return Unauthorized();

            try
            {
                int importedCount = 0;
                using var stream = file.OpenReadStream();

                if (format.Equals("coco", StringComparison.OrdinalIgnoreCase))
                {
                    importedCount = await _importService.ImportCocoAsync(GetJwt(), id, userId, stream);
                }
                else if (format.Equals("yolo", StringComparison.OrdinalIgnoreCase))
                {
                    importedCount = await _importService.ImportYoloAsync(GetJwt(), id, userId, stream);
                }
                else
                {
                    return BadRequest("Unsupported import format. Supported formats: coco, yolo");
                }

                // Log audit event
                _ = LogProjectAuditEventAsync(GetJwt(), userId, id, "import_annotations", $"Imported {importedCount} annotations via {format.ToUpper()} file {file.FileName}");

                return Ok(new { success = true, count = importedCount });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private async Task LogProjectAuditEventAsync(string jwt, Guid userId, Guid projectId, string action, string description)
        {
            try
            {
                var logUrl = $"{_supabaseUrl}/rest/v1/audit_logs";
                var client = _httpClientFactory.CreateClient();
                client.DefaultRequestHeaders.Add("apikey", _anonKey);
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {jwt}");

                var auditLog = new
                {
                    user_id = userId,
                    action,
                    category = "project",
                    entity_type = "project",
                    entity_id = projectId.ToString(),
                    entity_name = projectId.ToString(),
                    description,
                    created_at = DateTimeOffset.UtcNow
                };

                var payload = JsonSerializer.Serialize(auditLog);
                var content = new StringContent(payload, Encoding.UTF8, "application/json");
                await client.PostAsync(logUrl, content);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ProjectsController] Warning: failed to log project audit event: {ex.Message}");
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
}
