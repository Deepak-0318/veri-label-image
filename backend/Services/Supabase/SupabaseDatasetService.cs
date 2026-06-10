using System.Text;
using System.Text.Json;
using verilabelbackend.Models.Supabase;

namespace verilabelbackend.Services.Supabase;

public sealed class SupabaseDatasetService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _supabaseUrl;
    private readonly string _anonKey;

    private static readonly JsonSerializerOptions SnakeCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    private static readonly JsonSerializerOptions CaseInsensitive = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public SupabaseDatasetService(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _supabaseUrl = configuration["Supabase:Url"]!;
        _anonKey = configuration["Supabase:AnonKey"]!;
    }

    public async Task<List<Dataset>> GetAllByUserAsync(string jwt, Guid userId)
    {
        var datasetsUrl = $"{_supabaseUrl}/rest/v1/datasets?user_id=eq.{userId}&order=created_at.desc";
        var datasets = await GetAsync<List<Dataset>>(jwt, datasetsUrl) ?? new();

        if (datasets.Count == 0) return datasets;

        var ids = string.Join(",", datasets.Select(d => d.Id));
        var filesUrl = $"{_supabaseUrl}/rest/v1/dataset_files?dataset_id=in.({ids})";

        var datasetFiles = await GetAsync<List<DatasetFile>>(jwt, filesUrl) ?? new();

        var counts = datasetFiles
            .GroupBy(df => df.DatasetId)
            .ToDictionary(g => g.Key, g => g.Count());

        foreach (var d in datasets)
        {
            d.FileCount = counts.ContainsKey(d.Id) ? counts[d.Id] : 0;
        }

        return datasets;
    }

    public async Task<Dataset?> InsertAsync(string jwt, object dataset)
    {
        var result = await PostReturningAsync<Dataset>(jwt, "datasets", dataset);
        return result.FirstOrDefault();
    }

    public async Task DeleteAsync(string jwt, Guid datasetId, Guid userId)
    {
        await DeleteSafeAsync(jwt, $"datasets?id=eq.{datasetId}&user_id=eq.{userId}");
    }

    public async Task<Dataset?> AssignProjectAsync(string jwt, Guid datasetId, Guid userId, Guid? projectId)
    {
        var updated = await PatchReturningAsync<Dataset>(
            jwt,
            $"datasets?id=eq.{datasetId}&user_id=eq.{userId}",
            new { project_id = projectId }
        );

        var filesUrl = $"{_supabaseUrl}/rest/v1/dataset_files?dataset_id=eq.{datasetId}&select=file_id";
        var dfRows = await GetAsync<List<DatasetFileIdOnly>>(jwt, filesUrl);

        if (dfRows != null && dfRows.Count > 0)
        {
            var fileIds = string.Join(",", dfRows.Select(r => r.FileId));

            await PatchAsync(jwt,
                $"files?id=in.({fileIds})",
                new { project_id = projectId });
        }

        return updated?.FirstOrDefault();
    }

    public async Task AddFilesAsync(string jwt, Guid datasetId, List<Guid> fileIds)
    {
        var rows = fileIds.Select(fid => new
        {
            dataset_id = datasetId,
            file_id = fid
        });

        await PostAsyncWithUpsert(jwt, "dataset_files", rows);
    }

    public async Task RemoveFileAsync(string jwt, Guid datasetId, Guid fileId)
    {
        await DeleteSafeAsync(jwt,
            $"dataset_files?dataset_id=eq.{datasetId}&file_id=eq.{fileId}");
    }

    private async Task PostAsyncWithUpsert(string jwt, string table, object payload)
    {
        var client = _httpClientFactory.CreateClient();

        var url = $"{_supabaseUrl}/rest/v1/{table}?on_conflict=dataset_id,file_id";

        var body = JsonSerializer.Serialize(payload, SnakeCase);

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        AddHeaders(request, jwt);

        request.Headers.Add("Prefer", "resolution=merge-duplicates");

        var response = await client.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception(content);
    }

    public async Task<List<Guid>> GetDatasetFileIdsAsync(string jwt, Guid datasetId)
    {
        var url = $"{_supabaseUrl}/rest/v1/dataset_files?dataset_id=eq.{datasetId}&select=file_id";
        var data = await GetAsync<List<DatasetFileIdOnly>>(jwt, url) ?? new();

        return data.Select(d => d.FileId).ToList();
    }

    public async Task<Dictionary<string, List<string>>> GetFileDatasetMapAsync(string jwt, List<Guid> datasetIds)
    {
        if (datasetIds.Count == 0) return new();

        var ids = string.Join(",", datasetIds);

        var dfUrl = $"{_supabaseUrl}/rest/v1/dataset_files?dataset_id=in.({ids})";
        var datasetFiles = await GetAsync<List<DatasetFile>>(jwt, dfUrl) ?? new();

        var dsUrl = $"{_supabaseUrl}/rest/v1/datasets?id=in.({ids})";
        var datasets = await GetAsync<List<Dataset>>(jwt, dsUrl) ?? new();

        var nameMap = datasets.ToDictionary(d => d.Id, d => d.Name);

        var result = new Dictionary<string, List<string>>();

        foreach (var row in datasetFiles)
        {
            var fileId = row.FileId.ToString();

            if (!result.ContainsKey(fileId))
                result[fileId] = new List<string>();

            result[fileId].Add(
                nameMap.ContainsKey(row.DatasetId)
                    ? nameMap[row.DatasetId]
                    : "Unknown"
            );
        }

        return result;
    }


    private async Task<T?> GetAsync<T>(string jwt, string url)
    {
        var client = _httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        AddHeaders(request, jwt);

        var response = await client.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception(json);

        return JsonSerializer.Deserialize<T>(json, CaseInsensitive);
    }

    private async Task PostAsync(string jwt, string table, object payload)
    {
        var client = _httpClientFactory.CreateClient();
        var url = $"{_supabaseUrl}/rest/v1/{table}";
        var body = JsonSerializer.Serialize(payload, SnakeCase);

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        AddHeaders(request, jwt);
        request.Headers.Add("Prefer", "return=minimal");

        var response = await client.SendAsync(request);

        if (!response.IsSuccessStatusCode)
            throw new Exception(await response.Content.ReadAsStringAsync());
    }

    private async Task<List<T>> PostReturningAsync<T>(string jwt, string table, object payload)
    {
        var client = _httpClientFactory.CreateClient();
        var url = $"{_supabaseUrl}/rest/v1/{table}";
        var body = JsonSerializer.Serialize(payload, SnakeCase);

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        AddHeaders(request, jwt);
        request.Headers.Add("Prefer", "return=representation");

        var response = await client.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception(json);

        return JsonSerializer.Deserialize<List<T>>(json, CaseInsensitive) ?? new();
    }

    private async Task<List<T>> PatchReturningAsync<T>(string jwt, string tableQuery, object payload)
    {
        var client = _httpClientFactory.CreateClient();
        var url = $"{_supabaseUrl}/rest/v1/{tableQuery}";
        var body = JsonSerializer.Serialize(payload, SnakeCase);

        using var request = new HttpRequestMessage(HttpMethod.Patch, url)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        AddHeaders(request, jwt);
        request.Headers.Add("Prefer", "return=representation");

        var response = await client.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception(json);

        return JsonSerializer.Deserialize<List<T>>(json, CaseInsensitive) ?? new();
    }

    private async Task PatchAsync(string jwt, string tableQuery, object payload)
    {
        var client = _httpClientFactory.CreateClient();
        var url = $"{_supabaseUrl}/rest/v1/{tableQuery}";
        var body = JsonSerializer.Serialize(payload, SnakeCase);

        using var request = new HttpRequestMessage(HttpMethod.Patch, url)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        AddHeaders(request, jwt);
        request.Headers.Add("Prefer", "return=minimal");

        var response = await client.SendAsync(request);

        if (!response.IsSuccessStatusCode)
            throw new Exception(await response.Content.ReadAsStringAsync());
    }

    private async Task<bool> DeleteSafeAsync(string jwt, string tableQuery)
    {
        var client = _httpClientFactory.CreateClient();
        var url = $"{_supabaseUrl}/rest/v1/{tableQuery}";

        using var request = new HttpRequestMessage(HttpMethod.Delete, url);
        AddHeaders(request, jwt);

        var response = await client.SendAsync(request);

        return response.IsSuccessStatusCode;
    }

    public async Task<List<Guid>> GetDatasetIdsByProjectAsync(string jwt, Guid userId, Guid projectId)
    {
        var url = $"{_supabaseUrl}/rest/v1/datasets?project_id=eq.{projectId}&user_id=eq.{userId}&select=id";

        var data = await GetAsync<List<Dataset>>(jwt, url) ?? new();

        return data.Select(d => d.Id).ToList();
    }

    public async Task<List<Guid>> GetFileIdsByDatasetIdsAsync(string jwt, List<Guid> datasetIds)
    {
        var ids = string.Join(",", datasetIds);

        var url = $"{_supabaseUrl}/rest/v1/dataset_files?dataset_id=in.({ids})&select=file_id";

        var data = await GetAsync<List<DatasetFileIdOnly>>(jwt, url) ?? new();

        return data.Select(d => d.FileId).ToList();
    }
    private void AddHeaders(HttpRequestMessage request, string jwt)
    {
        request.Headers.Add("apikey", _anonKey);
        request.Headers.Add("Authorization", $"Bearer {jwt}");
    }
}