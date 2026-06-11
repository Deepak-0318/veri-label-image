using System.Text;
using System.Text.Json;
using verilabelbackend.Models;

namespace verilabelbackend.Services.Supabase;

public sealed class SupabaseAnnotationService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _supabaseUrl;
    private readonly string _anonKey;

    private static readonly JsonSerializerOptions SnakeCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    public SupabaseAnnotationService(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _supabaseUrl = configuration["Supabase:Url"]!;
        _anonKey = configuration["Supabase:AnonKey"]!;
    }

    // Only use columns confirmed to exist in the annotations table:
    // id, file_id, user_id, project_id, type, label, color, data, comment, created_at, updated_at
    public async Task<int> SaveAnnotationsAsync(
        string jwt,
        Guid fileId,
        Guid projectId,
        Guid userId,
        List<AnnotationResult> annotations)
    {
        Console.WriteLine("[AnnotationService] SaveAnnotationsAsync CALLED");
        if (annotations.Count == 0) return 0;

        var pipelineCommentFilter = Uri.EscapeDataString("Pipeline auto-annotation.%");
        var query = $"file_id=eq.{fileId}";
        var fetchUrl = $"{_supabaseUrl}/rest/v1/annotations?{query}&select=id";

        var client = BuildClient(jwt);
        var fetchResponse = await client.GetAsync(fetchUrl);
        if (!fetchResponse.IsSuccessStatusCode)
        {
            var error = await fetchResponse.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Supabase annotation cleanup failed ({fetchResponse.StatusCode}): {error}");
        }

        var existingAnnotations = await JsonSerializer.DeserializeAsync<List<Dictionary<string, JsonElement>>>(
            await fetchResponse.Content.ReadAsStreamAsync(), SnakeCase) ?? new List<Dictionary<string, JsonElement>>();
        var deletedCount = existingAnnotations.Count;
        Console.WriteLine($"[AnnotationService] Existing annotations deleted count: {deletedCount}");

        Console.WriteLine($"DELETE QUERY = {query}");
        Console.WriteLine($"FOUND {existingAnnotations.Count} ANNOTATIONS");

        if (deletedCount > 0)
        {
            var deleteClient = BuildClient(jwt);
            deleteClient.DefaultRequestHeaders.Add("Prefer", "return=minimal");
            var deleteUrl = $"{_supabaseUrl}/rest/v1/annotations?{query}";
            var deleteResponse = await deleteClient.DeleteAsync(deleteUrl);
            if (!deleteResponse.IsSuccessStatusCode)
            {
                var error = await deleteResponse.Content.ReadAsStringAsync();
                throw new InvalidOperationException($"Supabase annotation delete failed ({deleteResponse.StatusCode}): {error}");
            }
        }

        var records = annotations.Select(a => new
        {
            file_id = fileId,
            project_id = projectId,
            user_id = userId,
            type = "boundingBox",
            label = a.Label,
            color = "#f59e0b",
            data = JsonSerializer.Serialize(new
            {
                x = a.BoundingBox.X,
                y = a.BoundingBox.Y,
                width = a.BoundingBox.Width,
                height = a.BoundingBox.Height,
                confidence = a.Confidence
            }),
            comment = $"AI Generated Annotation. Confidence: {a.Confidence:P0}",
            created_at = DateTime.UtcNow,
        }).ToList();

        var url = $"{_supabaseUrl}/rest/v1/annotations";
        var json = JsonSerializer.Serialize(records, SnakeCase);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        client.DefaultRequestHeaders.Add("Prefer", "return=minimal");

        Console.WriteLine("[AnnotationService] URL:");
        Console.WriteLine(url);
        Console.WriteLine("[AnnotationService] PAYLOAD:");
        Console.WriteLine(json);

        var response = await client.PostAsync(url, content);
        Console.WriteLine($"[AnnotationService] Response: {response.StatusCode}");
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Supabase annotations insert failed ({response.StatusCode}): {error}");
        }

        Console.WriteLine($"[AnnotationService] New annotations inserted count: {annotations.Count}");
        return annotations.Count;
    }

    public async Task UpdateTaskStatusAsync(string jwt, Guid taskId, string status)
    {
        if (taskId == Guid.Empty) return;

        var client = BuildClient(jwt);
        var url = $"{_supabaseUrl}/rest/v1/tasks?id=eq.{taskId}";
        var payload = JsonSerializer.Serialize(
            new { status }, SnakeCase);
        var content = new StringContent(payload, Encoding.UTF8, "application/json");
        client.DefaultRequestHeaders.Add("Prefer", "return=minimal");

        var response = await client.PatchAsync(url, content);
        var responseBody = await response.Content.ReadAsStringAsync();

        Console.WriteLine($"[AnnotationService] UpdateTaskStatus {taskId} → {status}: {response.StatusCode}");
        Console.WriteLine($"[AnnotationService] TaskStatus Response: {responseBody}");
    }

    public async Task UpdatePipelineRunAsync(
        string jwt,
        Guid runId,
        string status,
        int completedItems,
        string? errorMessage = null)
    {
        if (runId == Guid.Empty) return;

        var client = BuildClient(jwt);
        var url = $"{_supabaseUrl}/rest/v1/pipeline_runs?id=eq.{runId}";

        var update = new Dictionary<string, object?>
        {
            ["status"] = status,
            ["completed_items"] = completedItems,
            ["progress"] = 100,
        };
        if (status is "completed" or "failed")
            update["completed_at"] = DateTime.UtcNow;
        if (errorMessage != null)
            update["error_message"] = errorMessage;

        var payload = JsonSerializer.Serialize(update, SnakeCase);
        var content = new StringContent(payload, Encoding.UTF8, "application/json");
        client.DefaultRequestHeaders.Add("Prefer", "return=minimal");

        Console.WriteLine($"[PipelineRun] URL = {url}");
        Console.WriteLine($"[PipelineRun] Payload = {payload}");

        var response = await client.PatchAsync(url, content);
        var responseBody = await response.Content.ReadAsStringAsync();

        Console.WriteLine($"[AnnotationService] UpdatePipelineRun {runId} → {status}: {response.StatusCode}");

        Console.WriteLine($"[AnnotationService] Response Body: {responseBody}");
    }

    private HttpClient BuildClient(string jwt)
    {
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Clear();
        client.DefaultRequestHeaders.Add("apikey", _anonKey);
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {jwt}");
        return client;
    }
}
