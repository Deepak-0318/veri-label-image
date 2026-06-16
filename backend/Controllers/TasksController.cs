using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using verilabelbackend.Models.Requests;
using verilabelbackend.Services.Supabase;

namespace verilabelbackend.Controllers;

[ApiController]
[Route("api/tasks")]
[Authorize]
public sealed class TasksController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _supabaseUrl;
    private readonly string _anonKey;
    private readonly SupabaseTaskService _taskService;

    public TasksController(
    IHttpClientFactory httpClientFactory,
    IConfiguration configuration,
    SupabaseTaskService taskService)
    {
    _httpClientFactory = httpClientFactory;
    _supabaseUrl = configuration["Supabase:Url"]!;
    _anonKey = configuration["Supabase:AnonKey"]!;
    _taskService = taskService;
    }

    [HttpPost("{id:guid}/claim")]
    public async Task<IActionResult> Claim(Guid id)
    {
        var userId = GetUserId();

        if (userId == Guid.Empty)
            return Unauthorized();

        try
        {
            var client = _httpClientFactory.CreateClient();

            // Fetch task first
            var getUrl =
                $"{_supabaseUrl}/rest/v1/tasks?id=eq.{id}&select=id,assigned_to,status";

            using var getRequest =
                new HttpRequestMessage(HttpMethod.Get, getUrl);

            getRequest.Headers.Add("apikey", _anonKey);
            getRequest.Headers.Add("Authorization", $"Bearer {GetJwt()}");

            var getResponse = await client.SendAsync(getRequest);

            if (!getResponse.IsSuccessStatusCode)
            {
                var error = await getResponse.Content.ReadAsStringAsync();
                return StatusCode((int)getResponse.StatusCode, error);
            }

            var json = await getResponse.Content.ReadAsStringAsync();

            using var doc = JsonDocument.Parse(json);

            if (doc.RootElement.GetArrayLength() == 0)
                return NotFound(new { error = "Task not found" });

            var task = doc.RootElement[0];

            if (
                task.TryGetProperty("assigned_to", out var assignedTo)
                && assignedTo.ValueKind != JsonValueKind.Null
            )
            {
                return Conflict(
                    new { error = "Task already claimed" }
                );
            }

            // Claim task
            var updateUrl =
                $"{_supabaseUrl}/rest/v1/tasks?id=eq.{id}&assigned_to=is.null";

            var payload = JsonSerializer.Serialize(
                new
                {
                    assigned_to = userId,
                    status = "in_progress"
                }
            );

            var content =
                new StringContent(
                    payload,
                    Encoding.UTF8,
                    "application/json"
                );

            using var patchRequest =
                new HttpRequestMessage(
                    HttpMethod.Patch,
                    updateUrl
                )
                {
                    Content = content
                };

            patchRequest.Headers.Add("apikey", _anonKey);
            patchRequest.Headers.Add("Authorization", $"Bearer {GetJwt()}");
            patchRequest.Headers.Add("Prefer", "return=representation");

            var patchResponse =
                await client.SendAsync(patchRequest);

            var responseBody =
                await patchResponse.Content.ReadAsStringAsync();

            using var patchDoc = JsonDocument.Parse(responseBody);

            if(patchDoc.RootElement.GetArrayLength() == 0){
                return Conflict(
                    new{
                        error = "Task already claimed"
                    }
                );
            }

            if (!patchResponse.IsSuccessStatusCode)
            {
                var error =
                    await patchResponse.Content.ReadAsStringAsync();

                return StatusCode(
                    (int)patchResponse.StatusCode,
                    error
                );
            }

            return Ok(
                new
                {
                    success = true,
                    taskId = id,
                    assignedTo = userId
                }
            );
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                new { error = ex.Message }
            );
        }
    }

    private Guid GetUserId()
    {
        var sub =
            User.FindFirstValue("sub")
            ?? User.FindFirstValue(
                ClaimTypes.NameIdentifier
            );

        return Guid.TryParse(sub, out var id)
            ? id
            : Guid.Empty;
    }

    private string GetJwt()
    {
        var auth =
            HttpContext.Request.Headers["Authorization"]
                .ToString();

        return auth.StartsWith(
            "Bearer ",
            StringComparison.OrdinalIgnoreCase
        )
            ? auth["Bearer ".Length..]
            : auth;
    }

    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateTaskRequest request)
    {
        var userId = GetUserId();

        if (userId == Guid.Empty)
            return Unauthorized();

        try
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new
                {
                    error = "Task name is required"
                });

            if (request.ProjectId == Guid.Empty)
                return BadRequest(new
                    {
                    error = "ProjectId is required"
                });

            var taskPayload = new
            {
                name = request.Name,
                description = request.Description,
                project_id = request.ProjectId,
                assigned_to = request.AssignedTo,
                created_by = userId,
                total_items = request.FileIds.Count
            };

            var taskResponse =
                await _taskService.CreateTaskAsync(
                    GetJwt(),
                    taskPayload);

            using var doc =
                JsonDocument.Parse(taskResponse);

            if (doc.RootElement.GetArrayLength() == 0)
            {
                return StatusCode(
                    500,
                    new
                    {
                        error = "Task creation returned no data"
                    });
            }

            var createdTask =
                 doc.RootElement[0];

            var taskId =
                createdTask
                    .GetProperty("id")
                    .GetGuid();

            if (request.FileIds.Any())
            {
                var subTasks =
                    request.FileIds.Select(fileId => new
                    {
                        task_id = taskId,
                        file_id = fileId,
                        status = "pending"
                    });

                await _taskService.CreateSubTasksAsync(
                    GetJwt(),
                    subTasks);
            }

            return Ok(createdTask);
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                new
                {
                    error = ex.Message
                });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetTasks()
    {
        try
        {
            var result =
                await _taskService.GetTasksAsync(GetJwt());

            return Content(
                result,
                "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                new { error = ex.Message });
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetTask(Guid id)
    {
        try
        {
            var result =
                await _taskService.GetTaskAsync(
                    GetJwt(),
                    id);

            return Content(
                result,
                "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                new { error = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateTask(
        Guid id,
        [FromBody] UpdateTaskRequest request)
    {
        try
        {
            var payload = new
            {
                name = request.Name,
                description = request.Description,
                status = request.Status,
                assigned_to = request.AssignedTo,
                qa_assigned_to = request.QaAssignedTo,
                updated_at = DateTimeOffset.UtcNow
            };

            var result =
                await _taskService.UpdateTaskAsync(
                    GetJwt(),
                    id,
                    payload);

            return Content(
                result,
                "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                new { error = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteTask(Guid id)
    {
        try
        {
            await _taskService.DeleteTaskAsync(
                GetJwt(),
                id);

            return Ok(new
            {
                success = true
            });
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                new { error = ex.Message });
        }
    }
}