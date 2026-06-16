using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using verilabelbackend.Models;
using verilabelbackend.Services;

namespace verilabelbackend.Controllers;

[ApiController]
[Route("api/pipeline")]
[Authorize(Roles = "admin,manager")]
public class PipelineController : ControllerBase
{
    private readonly PipelineExecutionService _service;

    public PipelineController(PipelineExecutionService service)
    {
        _service = service;
    }

    [HttpPost("run")]
    public async Task<IActionResult> Run([FromBody] PipelineExecutionRequest request)
    {
        Console.WriteLine($"PipelineId: {request.PipelineId}");
        Console.WriteLine($"ProjectId:  {request.ProjectId}");
        Console.WriteLine($"RunId:      {request.RunId}");
        Console.WriteLine($"TaskId:     {request.TaskId}");
        Console.WriteLine($"FileIds ({request.FileIds.Count}): {string.Join(", ", request.FileIds)}");
        Console.WriteLine($"Node Count: {request.Nodes.Count}");
        Console.WriteLine($"Labels ({request.Labels.Count}): {string.Join(", ", request.Labels)}");

        var jwt = HttpContext.Request.Headers["Authorization"]
            .ToString()
            .Replace("Bearer ", "", StringComparison.OrdinalIgnoreCase)
            .Trim();

        var jwtOrNull = string.IsNullOrWhiteSpace(jwt) ? null : jwt;

        if (jwtOrNull == null)
            Console.WriteLine("[PipelineController] WARNING: No JWT — annotations will NOT be saved");

        try
        {
            var result = await _service.ExecuteAsync(request, jwtOrNull);
            return Ok(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PipelineController] FATAL: {ex.Message}");
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public IActionResult DeletePipeline(Guid id)
    {
        return Ok(new { success = true, message = "Pipeline deleted successfully" });
    }
}
