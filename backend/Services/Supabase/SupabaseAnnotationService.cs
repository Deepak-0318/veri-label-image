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

    private static readonly JsonSerializerOptions PayloadOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    public SupabaseAnnotationService(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _supabaseUrl = configuration["Supabase:Url"]!;
        _anonKey = configuration["Supabase:AnonKey"]!;
    }

    private class ProjectLabelDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public Guid LabelTypeId { get; set; }
    }

    private class ProjectLabelTypeDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    private class ProjectGroupTypeDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsDefault { get; set; }
    }

    private class OntologyMetadata
    {
        public string? LabelType { get; set; }
        public string? GroupName { get; set; }
        public Guid? LabelTypeId { get; set; }
        public Guid? GroupTypeId { get; set; }
    }

    private async Task<List<ProjectLabelDto>> FetchProjectLabelsAsync(string jwt, Guid projectId)
    {
        var url = $"{_supabaseUrl}/rest/v1/project_labels?project_id=eq.{projectId}";
        var client = BuildClient(jwt);
        var response = await client.GetAsync(url);
        if (!response.IsSuccessStatusCode) return new List<ProjectLabelDto>();
        return await JsonSerializer.DeserializeAsync<List<ProjectLabelDto>>(
            await response.Content.ReadAsStreamAsync(), SnakeCase) ?? new List<ProjectLabelDto>();
    }

    private async Task<List<ProjectLabelTypeDto>> FetchProjectLabelTypesAsync(string jwt, Guid projectId)
    {
        var url = $"{_supabaseUrl}/rest/v1/project_label_types?project_id=eq.{projectId}";
        var client = BuildClient(jwt);
        var response = await client.GetAsync(url);
        if (!response.IsSuccessStatusCode) return new List<ProjectLabelTypeDto>();
        return await JsonSerializer.DeserializeAsync<List<ProjectLabelTypeDto>>(
            await response.Content.ReadAsStreamAsync(), SnakeCase) ?? new List<ProjectLabelTypeDto>();
    }

    private async Task<List<ProjectGroupTypeDto>> FetchProjectGroupTypesAsync(string jwt, Guid projectId)
    {
        var url = $"{_supabaseUrl}/rest/v1/project_group_types?project_id=eq.{projectId}";
        var client = BuildClient(jwt);
        var response = await client.GetAsync(url);
        if (!response.IsSuccessStatusCode) return new List<ProjectGroupTypeDto>();
        return await JsonSerializer.DeserializeAsync<List<ProjectGroupTypeDto>>(
            await response.Content.ReadAsStreamAsync(), SnakeCase) ?? new List<ProjectGroupTypeDto>();
    }

    private OntologyMetadata GetOntologyMetadata(
        List<ProjectLabelDto> labels,
        List<ProjectLabelTypeDto> labelTypes,
        List<ProjectGroupTypeDto> groupTypes,
        string labelName)
    {
        var metadata = new OntologyMetadata();

        // 1. Find the label row
        var labelRow = labels.FirstOrDefault(l => l.Name.Equals(labelName, StringComparison.OrdinalIgnoreCase));
        if (labelRow != null)
        {
            metadata.LabelTypeId = labelRow.LabelTypeId;
            
            // Find the label type name
            var labelTypeRow = labelTypes.FirstOrDefault(lt => lt.Id == labelRow.LabelTypeId);
            if (labelTypeRow != null)
            {
                metadata.LabelType = labelTypeRow.Name;
            }
        }

        // 2. Find group type by matching group ontology definitions
        // Define ontology relations
        var groupOntology = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            { "Faces", new[] { "face", "eyes", "nose", "beard", "mouth", "hair", "eye", "ear" } },
            { "People", new[] { "person", "human", "man", "woman", "child" } }
        };

        ProjectGroupTypeDto? matchedGroup = null;

        // Try to match using ontology dictionary definitions
        foreach (var groupType in groupTypes)
        {
            if (groupOntology.TryGetValue(groupType.Name, out var matchingLabels))
            {
                if (matchingLabels.Contains(labelName.Trim().ToLower()))
                {
                    matchedGroup = groupType;
                    break;
                }
            }
        }

        // Fallback to substring matching if no dictionary match
        if (matchedGroup == null)
        {
            matchedGroup = groupTypes.FirstOrDefault(gt => 
                gt.Name.Contains(labelName, StringComparison.OrdinalIgnoreCase) ||
                labelName.Contains(gt.Name, StringComparison.OrdinalIgnoreCase));
        }

        // If still null, fallback to the default group
        if (matchedGroup == null)
        {
            matchedGroup = groupTypes.FirstOrDefault(gt => gt.IsDefault) 
                           ?? groupTypes.FirstOrDefault(gt => gt.Name.Equals("Default", StringComparison.OrdinalIgnoreCase));
        }

        if (matchedGroup != null)
        {
            metadata.GroupTypeId = matchedGroup.Id;
            metadata.GroupName = matchedGroup.Name;
        }

        return metadata;
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

        // Fetch project ontology details
        List<ProjectLabelDto> projectLabels = new();
        List<ProjectLabelTypeDto> projectLabelTypes = new();
        List<ProjectGroupTypeDto> projectGroupTypes = new();
        try
        {
            projectLabels = await FetchProjectLabelsAsync(jwt, projectId);
            projectLabelTypes = await FetchProjectLabelTypesAsync(jwt, projectId);
            projectGroupTypes = await FetchProjectGroupTypesAsync(jwt, projectId);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AnnotationService] Warning: Failed to fetch ontology metadata: {ex.Message}");
        }

        Console.WriteLine("[AnnotationService] Response: Created");
        Console.WriteLine($"DEBUG FILE_ID={fileId}");
        Console.WriteLine($"DEBUG PROJECT_ID={projectId}");
        Console.WriteLine($"DEBUG USER_ID={userId}");

        foreach (var a in annotations)
        {
            Console.WriteLine("[SAVE]");
            Console.WriteLine($"Saving: {a.Label}");
            var meta = GetOntologyMetadata(projectLabels, projectLabelTypes, projectGroupTypes, a.Label);
            a.LabelType = meta.LabelType;
            a.GroupName = meta.GroupName;
            a.LabelTypeId = meta.LabelTypeId;
            a.GroupTypeId = meta.GroupTypeId;

            Console.WriteLine($"Label={a.Label}");
            Console.WriteLine($"GroupTypeId={a.GroupTypeId}");

            if (!string.IsNullOrEmpty(meta.GroupName))
            {
                Console.WriteLine($"Group Assigned: {meta.GroupName}");
            }
        }

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

        var records = annotations.Select(a => new
        {
            file_id = fileId,
            project_id = projectId,
            user_id = userId,
            type = "boundingBox",
            label = a.Label,
            color = "#f59e0b",
            label_type_id = a.LabelTypeId,
            group_type_id = a.GroupTypeId,
            data = JsonSerializer.Serialize(new
            {
                x = a.BoundingBox.X,
                y = a.BoundingBox.Y,
                width = a.BoundingBox.Width,
                height = a.BoundingBox.Height,
                confidence = a.Confidence,
                @class = a.Label,
                model = a.ModelUsed ?? "unknown"
            }),
            comment = $"AI Generated Annotation. Confidence: {a.Confidence:P0}",
            created_at = DateTime.UtcNow,
        }).ToList();

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

        var url = $"{_supabaseUrl}/rest/v1/annotations";
        var payload = JsonSerializer.Serialize(records, PayloadOptions);
        var content = new StringContent(payload, Encoding.UTF8, "application/json");
        client.DefaultRequestHeaders.Add("Prefer", "return=minimal");

        Console.WriteLine("[AnnotationService] URL:");
        Console.WriteLine(url);
        Console.WriteLine("[AnnotationService] PAYLOAD:");
        Console.WriteLine(payload);

        var response = await client.PostAsync(url, content);
        Console.WriteLine($"[AnnotationService] Response: {response.StatusCode}");
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            
            // ROLLBACK / RESTORE: If insert fails, push back the annotations we just deleted
            if (existingAnnotations.Count > 0)
            {
                Console.WriteLine("[AnnotationService] POST failed. Initiating rollback of deleted annotations...");
                var rollbackJson = JsonSerializer.Serialize(existingAnnotations, SnakeCase);
                var rollbackContent = new StringContent(rollbackJson, Encoding.UTF8, "application/json");
                await client.PostAsync(url, rollbackContent);
            }
            
            throw new InvalidOperationException($"Supabase annotations insert failed ({response.StatusCode}): {error}");
        }

        foreach (var a in annotations)
        {
            Console.WriteLine("[DB]");
            Console.WriteLine($"Stored: {a.Label}");
        }

        Console.WriteLine($"[AnnotationService] New annotations inserted count: {annotations.Count}");
        return annotations.Count;
    }

    public async Task UpdateTaskStatusAsync(string jwt, Guid taskId, string status)
    {
        if (taskId == Guid.Empty) return;

        var client = BuildClient(jwt);
        var url = $"{_supabaseUrl}/rest/v1/tasks?id=eq.{taskId}";
        Console.WriteLine("===== RECORDS =====");
        Console.WriteLine(JsonSerializer.Serialize(new { status }, SnakeCase));
        var payload = JsonSerializer.Serialize(
            new { status }, SnakeCase);
        var content = new StringContent(payload, Encoding.UTF8, "application/json");
        client.DefaultRequestHeaders.Add("Prefer", "return=minimal");

        var response = await client.PatchAsync(url, content);
        var responseBody = await response.Content.ReadAsStringAsync();

        Console.WriteLine($"[AnnotationService] UpdateTaskStatus {taskId} → {status}: {response.StatusCode}");
        Console.WriteLine($"[AnnotationService] TaskStatus Response: {responseBody}");
    }

    public async Task UpdateSubtaskStatusAsync(string jwt, Guid subtaskId, string status)
    {
        if (subtaskId == Guid.Empty) return;

        var client = BuildClient(jwt);
        var url = $"{_supabaseUrl}/rest/v1/sub_tasks?id=eq.{subtaskId}";
        Console.WriteLine("===== RECORDS =====");
        Console.WriteLine(JsonSerializer.Serialize(new { status }, SnakeCase));
        var payload = JsonSerializer.Serialize(new { status }, SnakeCase);
        var content = new StringContent(payload, Encoding.UTF8, "application/json");
        client.DefaultRequestHeaders.Add("Prefer", "return=minimal");

        var response = await client.PatchAsync(url, content);
        var responseBody = await response.Content.ReadAsStringAsync();

        Console.WriteLine($"[AnnotationService] UpdateSubtaskStatus {subtaskId} → {status}: {response.StatusCode}");
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

        Console.WriteLine("===== RECORDS =====");
        Console.WriteLine(JsonSerializer.Serialize(update, SnakeCase));
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
