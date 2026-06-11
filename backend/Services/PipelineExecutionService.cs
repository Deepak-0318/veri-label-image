using System.IdentityModel.Tokens.Jwt;
using verilabelbackend.Models;
using verilabelbackend.Services.Supabase;

namespace verilabelbackend.Services;

public class PipelineExecutionService
{
    private readonly ImageDetectionService _imageDetection;
    private readonly SupabaseAnnotationService _annotationService;

    public PipelineExecutionService(
        ImageDetectionService imageDetection,
        SupabaseAnnotationService annotationService)
    {
        _imageDetection = imageDetection;
        _annotationService = annotationService;
    }

    public async Task<object> ExecuteAsync(
        PipelineExecutionRequest request,
        string? jwt = null)
    {
        // ── Resolve file list ─────────────────────────────────────────────
        var fileIds = request.FileIds.Count > 0
            ? request.FileIds
            : request.FileId.HasValue
                ? new List<Guid> { request.FileId.Value }
                : new List<Guid> { Guid.Empty };

        Guid.TryParse(request.ProjectId, out var projectId);
        Guid.TryParse(request.TaskId, out var taskId);
        Guid.TryParse(request.RunId, out var runId);

        // Extract userId from JWT sub claim
        var userId = Guid.Empty;
        if (jwt != null)
        {
            try
            {
                var handler = new JwtSecurityTokenHandler();
                var token = handler.ReadJwtToken(jwt);
                var sub = token.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;
                Guid.TryParse(sub, out userId);
            }
            catch { /* userId stays Empty */ }
        }

        Console.WriteLine($"[Pipeline] START — Files: {fileIds.Count}, Project: {projectId}, Task: {taskId}, Run: {runId}, User: {userId}");

        var fileResults = new List<object>();
        var totalAnnotations = 0;

        foreach (var fileId in fileIds)
        {
            Console.WriteLine($"[Pipeline] Processing file: {fileId}");
            var nodeResults = new List<object>();
            var fileAnnotations = new List<AnnotationResult>();

            foreach (var node in request.Nodes)
            {
                Console.WriteLine($"[Pipeline]   Node: {node.Label} (type={node.Type})");

                switch (node.Type.ToLower())
                {
                    case "input":
                    case "io":
                        nodeResults.Add(new { Node = node.Label, Status = "Executed" });
                        break;

                    case "ai":
                        Console.WriteLine("========== IMAGE DETECTOR V2 ==========");
                        Console.WriteLine($"FILE={fileId}");
                        Console.WriteLine("BEFORE RESOLVER");
                        
                        Console.WriteLine("===== PROJECT LABELS =====");
                        foreach(var label in request.Labels)
                        {
                            Console.WriteLine(label);
                        }

                        var detections =
                            await _imageDetection.DetectAsync(
                                fileId,
                                jwt!,
                                request.Labels);
                        Console.WriteLine("AFTER RESOLVER");
                        fileAnnotations.AddRange(detections);
                        nodeResults.Add(new { Node = node.Label, Annotations = detections });
                        Console.WriteLine($"[Pipeline]   AI node returned {detections.Count} annotation(s)");
                        break;

                    default:
                        nodeResults.Add(new { Node = node.Label, Status = "Skipped" });
                        break;
                }
            }

            // ── Save annotations ──────────────────────────────────────────
            Console.WriteLine("[Pipeline] ABOUT TO SAVE ANNOTATIONS");
            Console.WriteLine($"[Pipeline] JWT Present: {jwt != null}");
            Console.WriteLine($"[Pipeline] ProjectId: {projectId}");
            Console.WriteLine($"[Pipeline] FileId: {fileId}");
            Console.WriteLine($"[Pipeline] Annotation Count: {fileAnnotations.Count}");

            if (jwt != null && fileAnnotations.Count > 0 && projectId != Guid.Empty)
            {
                Console.WriteLine("[Pipeline] SAVE CONDITION PASSED");
                foreach (var annotation in fileAnnotations)
                {
                    Console.WriteLine($"FINAL CLASS={annotation.Label}");
                    Console.WriteLine($"FINAL LABEL={annotation.Label}");
                }
                try
                {
                    Console.WriteLine("===== FINAL SAVE =====");

                    foreach(var annotation in fileAnnotations)
                    {
                        Console.WriteLine(
                            $"LABEL={annotation.Label}"
                        );
                    }

                    var saved = await _annotationService.SaveAnnotationsAsync(
                        jwt, fileId, projectId, userId, fileAnnotations);
                    totalAnnotations += saved;
                    Console.WriteLine($"[Pipeline] ANNOTATIONS SAVED: {saved} for file {fileId}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Pipeline] ERROR saving annotations for {fileId}: {ex.Message}");
                }
            }
            else
            {
                Console.WriteLine(
                    $"[Pipeline] SAVE SKIPPED jwt={jwt != null} annotations={fileAnnotations.Count} project={projectId}"
                );
            }

            fileResults.Add(new
            {
                FileId = fileId,
                Results = nodeResults,
                AnnotationCount = fileAnnotations.Count
            });
        }

        // ── Update PipelineRun → completed ────────────────────────────────
        if (jwt != null && runId != Guid.Empty)
        {
            try
            {
                Console.WriteLine($"RunId={runId}");
                var status =
                    totalAnnotations > 0
                        ? "completed"
                        : "completed_with_no_annotations";

                await _annotationService.UpdatePipelineRunAsync(
                    jwt,
                    runId,
                    status,
                    fileIds.Count);
                Console.WriteLine("[Pipeline] PipelineRun update skipped");
                Console.WriteLine($"[Pipeline] PIPELINE RUN COMPLETED: {runId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Pipeline] ERROR updating run {runId}: {ex.Message}");
            }
        }

        // ── Update Task → review (ready for QC) ───────────────────────────
        if (jwt != null && taskId != Guid.Empty)
        {
            try
            {
                await _annotationService.UpdateTaskStatusAsync(jwt, taskId, "review");
                Console.WriteLine($"[Pipeline] TASK STATUS → review: {taskId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Pipeline] ERROR updating task {taskId}: {ex.Message}");
            }
        }

        Console.WriteLine($"[Pipeline] PIPELINE COMPLETED — Total annotations saved: {totalAnnotations}");

        return new
        {
            Success = true,
            FileResults = fileResults,
            TotalAnnotations = totalAnnotations
        };
    }
}
