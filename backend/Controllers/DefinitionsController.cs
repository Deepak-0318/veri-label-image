using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace verilabelbackend.Controllers
{
    [ApiController]
    [Route("api/definitions")]
    [Authorize]
    public sealed class DefinitionsController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _supabaseUrl;
        private readonly string _anonKey;

        public DefinitionsController(
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _supabaseUrl = configuration["Supabase:Url"]!;
            _anonKey = configuration["Supabase:AnonKey"]!;
        }

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] Guid projectId, [FromQuery] string type)
        {
            if (projectId == Guid.Empty)
                return BadRequest("Project ID is required");
            if (string.IsNullOrWhiteSpace(type))
                return BadRequest("Type is required");

            var table = MapTypeToTable(type);
            if (table == null)
                return BadRequest($"Unsupported definition type: {type}");

            try
            {
                var client = BuildClient();
                // order by display_order if type is variable, else order by created_at.asc
                var order = type.Equals("variable", StringComparison.OrdinalIgnoreCase)
                    ? "display_order=asc,created_at=asc"
                    : "created_at=asc";
                var url = $"{_supabaseUrl}/rest/v1/{table}?project_id=eq.{projectId}&order={order}";

                var response = await client.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    return StatusCode((int)response.StatusCode, new { error });
                }

                var content = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(content);
                return Ok(doc.RootElement);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid id, [FromQuery] string type)
        {
            if (string.IsNullOrWhiteSpace(type))
                return BadRequest("Type is required");

            var table = MapTypeToTable(type);
            if (table == null)
                return BadRequest($"Unsupported definition type: {type}");

            try
            {
                var client = BuildClient();
                var url = $"{_supabaseUrl}/rest/v1/{table}?id=eq.{id}";

                var response = await client.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    return StatusCode((int)response.StatusCode, new { error });
                }

                var content = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(content);
                if (doc.RootElement.GetArrayLength() == 0)
                    return NotFound("Definition not found");

                return Ok(doc.RootElement[0]);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromQuery] string type, [FromBody] Dictionary<string, object> payload)
        {
            var userId = GetUserId();
            if (userId == Guid.Empty) return Unauthorized();

            if (string.IsNullOrWhiteSpace(type))
                return BadRequest("Type is required");

            var table = MapTypeToTable(type);
            if (table == null)
                return BadRequest($"Unsupported definition type: {type}");

            if (!payload.TryGetValue("project_id", out var projIdObj) || !Guid.TryParse(projIdObj?.ToString(), out var projectId))
                return BadRequest("project_id is required and must be a valid Guid");

            if (!payload.TryGetValue("name", out var nameObj) || string.IsNullOrWhiteSpace(nameObj?.ToString()))
                return BadRequest("name is required");

            var name = nameObj.ToString()!.Trim();

            // 1. Check duplicate names in the project
            var hasDuplicate = await CheckDuplicateNameAsync(projectId, table, name, null);
            if (hasDuplicate)
                return BadRequest($"A definition with the name '{name}' already exists in this project.");

            // 2. Perform validations specific to variables
            if (type.Equals("variable", StringComparison.OrdinalIgnoreCase))
            {
                var valError = ValidateVariablePayload(payload);
                if (valError != null) return BadRequest(valError);
            }

            // Set audit tracking columns
            payload["created_by"] = userId;
            if (!payload.ContainsKey("id"))
            {
                payload["id"] = Guid.NewGuid();
            }

            try
            {
                var client = BuildClient();
                var url = $"{_supabaseUrl}/rest/v1/{table}";
                var stringContent = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = stringContent };
                request.Headers.Add("Prefer", "return=representation");

                var response = await client.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    return StatusCode((int)response.StatusCode, new { error });
                }

                var content = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(content);
                var createdObj = doc.RootElement[0];

                // Log audit log
                _ = LogAuditAsync("create_definition", $"Created {type} definition: {name}", Guid.Parse(createdObj.GetProperty("id").GetString()!), name, type, null, createdObj);

                return Ok(createdObj);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPut("{id:guid}")]
        public async Task<IActionResult> Update(Guid id, [FromQuery] string type, [FromBody] Dictionary<string, object> payload)
        {
            var userId = GetUserId();
            if (userId == Guid.Empty) return Unauthorized();

            if (string.IsNullOrWhiteSpace(type))
                return BadRequest("Type is required");

            var table = MapTypeToTable(type);
            if (table == null)
                return BadRequest($"Unsupported definition type: {type}");

            try
            {
                var client = BuildClient();
                
                // Fetch the existing record to get projectId and old values
                var getUrl = $"{_supabaseUrl}/rest/v1/{table}?id=eq.{id}";
                var getResponse = await client.GetAsync(getUrl);
                if (!getResponse.IsSuccessStatusCode)
                    return NotFound("Definition not found");

                var getContent = await getResponse.Content.ReadAsStringAsync();
                using var getDoc = JsonDocument.Parse(getContent);
                if (getDoc.RootElement.GetArrayLength() == 0)
                    return NotFound("Definition not found");

                var oldRecord = getDoc.RootElement[0];
                var projectIdStr = oldRecord.GetProperty("project_id").GetString();
                var projectId = Guid.Parse(projectIdStr!);

                // If name is changing, check for duplicates
                if (payload.TryGetValue("name", out var nameObj) && nameObj != null)
                {
                    var name = nameObj.ToString()!.Trim();
                    var oldName = oldRecord.GetProperty("name").GetString();
                    if (!name.Equals(oldName, StringComparison.OrdinalIgnoreCase))
                    {
                        var hasDuplicate = await CheckDuplicateNameAsync(projectId, table, name, id);
                        if (hasDuplicate)
                            return BadRequest($"A definition with the name '{name}' already exists in this project.");
                    }
                }

                // If variable, validate it
                if (type.Equals("variable", StringComparison.OrdinalIgnoreCase))
                {
                    // Merge fields for validation
                    var mergedPayload = new Dictionary<string, object>();
                    foreach (var prop in oldRecord.EnumerateObject())
                    {
                        // JSON elements mapped appropriately
                        mergedPayload[prop.Name] = prop.Value.ValueKind switch
                        {
                            JsonValueKind.String => prop.Value.GetString()!,
                            JsonValueKind.Number => prop.Value.GetDecimal(),
                            JsonValueKind.True => true,
                            JsonValueKind.False => false,
                            JsonValueKind.Null => null!,
                            _ => prop.Value.GetRawText()
                        };
                    }
                    foreach (var key in payload.Keys)
                    {
                        mergedPayload[key] = payload[key];
                    }

                    var valError = ValidateVariablePayload(mergedPayload);
                    if (valError != null) return BadRequest(valError);
                }

                // Call Supabase PATCH
                var patchUrl = $"{_supabaseUrl}/rest/v1/{table}?id=eq.{id}";
                var stringContent = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                using var request = new HttpRequestMessage(HttpMethod.Patch, patchUrl) { Content = stringContent };
                request.Headers.Add("Prefer", "return=representation");

                var patchResponse = await client.SendAsync(request);
                if (!patchResponse.IsSuccessStatusCode)
                {
                    var error = await patchResponse.Content.ReadAsStringAsync();
                    return StatusCode((int)patchResponse.StatusCode, new { error });
                }

                var patchContent = await patchResponse.Content.ReadAsStringAsync();
                using var patchDoc = JsonDocument.Parse(patchContent);
                var updatedObj = patchDoc.RootElement[0];

                // Log audit
                var entityName = updatedObj.GetProperty("name").GetString()!;
                _ = LogAuditAsync("update_definition", $"Updated {type} definition: {entityName}", id, entityName, type, oldRecord, updatedObj);

                return Ok(updatedObj);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpDelete("{id:guid}")]
        public async Task<IActionResult> Delete(Guid id, [FromQuery] string type)
        {
            var userId = GetUserId();
            if (userId == Guid.Empty) return Unauthorized();

            if (string.IsNullOrWhiteSpace(type))
                return BadRequest("Type is required");

            var table = MapTypeToTable(type);
            if (table == null)
                return BadRequest($"Unsupported definition type: {type}");

            try
            {
                var client = BuildClient();

                // Fetch the existing record to get project ID and name
                var getUrl = $"{_supabaseUrl}/rest/v1/{table}?id=eq.{id}";
                var getResponse = await client.GetAsync(getUrl);
                if (!getResponse.IsSuccessStatusCode)
                    return NotFound("Definition not found");

                var getContent = await getResponse.Content.ReadAsStringAsync();
                using var getDoc = JsonDocument.Parse(getContent);
                if (getDoc.RootElement.GetArrayLength() == 0)
                    return NotFound("Definition not found");

                var oldRecord = getDoc.RootElement[0];
                var name = oldRecord.GetProperty("name").GetString()!;

                // Delete the record
                var deleteUrl = $"{_supabaseUrl}/rest/v1/{table}?id=eq.{id}";
                using var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, deleteUrl);
                var deleteResponse = await client.SendAsync(deleteRequest);

                if (!deleteResponse.IsSuccessStatusCode)
                {
                    var error = await deleteResponse.Content.ReadAsStringAsync();
                    return StatusCode((int)deleteResponse.StatusCode, new { error });
                }

                // Log audit
                _ = LogAuditAsync("delete_definition", $"Deleted {type} definition: {name}", id, name, type, oldRecord, null);

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private static string? MapTypeToTable(string type)
        {
            return type.ToLower() switch
            {
                "variable" => "project_variables",
                "label" => "project_labels",
                "label_type" => "project_label_types",
                "flag" => "project_flags",
                "group_type" => "project_group_types",
                _ => null
            };
        }

        private string? ValidateVariablePayload(Dictionary<string, object> payload)
        {
            if (!payload.TryGetValue("variable_type", out var typeObj) || typeObj == null)
                return "variable_type is required";

            var varType = typeObj.ToString()!;
            if (varType != "number" && varType != "text" && varType != "single_select" && varType != "multi_select")
                return "Invalid variable_type. Supported values: number, text, single_select, multi_select";

            if (varType == "single_select" || varType == "multi_select")
            {
                if (!payload.TryGetValue("options", out var optionsObj) || optionsObj == null)
                    return "options array is required for select type variables";

                try
                {
                    using var optionsDoc = JsonDocument.Parse(optionsObj.ToString()!);
                    if (optionsDoc.RootElement.ValueKind != JsonValueKind.Array || optionsDoc.RootElement.GetArrayLength() == 0)
                        return "options must be a non-empty array of strings";
                }
                catch
                {
                    return "Invalid JSON format in options field";
                }
            }

            if (varType == "number")
            {
                decimal? min = null;
                decimal? max = null;

                if (payload.TryGetValue("min_value", out var minObj) && minObj != null && !string.IsNullOrWhiteSpace(minObj.ToString()))
                {
                    if (decimal.TryParse(minObj.ToString(), out var m)) min = m;
                    else return "min_value must be a valid number";
                }

                if (payload.TryGetValue("max_value", out var maxObj) && maxObj != null && !string.IsNullOrWhiteSpace(maxObj.ToString()))
                {
                    if (decimal.TryParse(maxObj.ToString(), out var mx)) max = mx;
                    else return "max_value must be a valid number";
                }

                if (min.HasValue && max.HasValue && min.Value > max.Value)
                    return "min_value cannot be greater than max_value";
            }

            return null;
        }

        private async Task<bool> CheckDuplicateNameAsync(Guid projectId, string table, string name, Guid? excludeId)
        {
            var client = BuildClient();
            var url = $"{_supabaseUrl}/rest/v1/{table}?project_id=eq.{projectId}&name=ilike.{name}";
            if (excludeId.HasValue)
            {
                url += $"&id=ne.{excludeId.Value}";
            }

            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return false;

            var content = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(content);
            return doc.RootElement.GetArrayLength() > 0;
        }

        private async Task LogAuditAsync(
            string action,
            string description,
            Guid entityId,
            string entityName,
            string type,
            object? oldValues = null,
            object? newValues = null)
        {
            var userId = GetUserId();
            if (userId == Guid.Empty) return;

            try
            {
                var logUrl = $"{_supabaseUrl}/rest/v1/audit_logs";
                var client = BuildClient();

                var auditLog = new
                {
                    user_id = userId,
                    action,
                    category = "project",
                    entity_type = $"{type}_definition",
                    entity_id = entityId.ToString(),
                    entity_name = entityName,
                    description,
                    old_values = oldValues != null ? (oldValues is JsonElement ? ((JsonElement)oldValues).GetRawText() : JsonSerializer.Serialize(oldValues)) : null,
                    new_values = newValues != null ? (newValues is JsonElement ? ((JsonElement)newValues).GetRawText() : JsonSerializer.Serialize(newValues)) : null,
                    created_at = DateTimeOffset.UtcNow
                };

                var payload = JsonSerializer.Serialize(auditLog);
                var content = new StringContent(payload, Encoding.UTF8, "application/json");
                await client.PostAsync(logUrl, content);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DefinitionsController] Warning: failed to write audit log: {ex.Message}");
            }
        }

        private HttpClient BuildClient()
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Clear();
            client.DefaultRequestHeaders.Add("apikey", _anonKey);
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {GetJwt()}");
            return client;
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
