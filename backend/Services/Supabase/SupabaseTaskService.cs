using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace verilabelbackend.Services.Supabase;

public sealed class SupabaseTaskService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _supabaseUrl;
    private readonly string _anonKey;

    public SupabaseTaskService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _supabaseUrl = configuration["Supabase:Url"]!;
        _anonKey = configuration["Supabase:AnonKey"]!;
    }

    public async Task<string> CreateTaskAsync(
        string jwt,
        object taskPayload)
    {
        var client = _httpClientFactory.CreateClient();

        var url =
            $"{_supabaseUrl}/rest/v1/tasks";

        var json =
            JsonSerializer.Serialize(taskPayload);

        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                url);

        request.Content =
            new StringContent(
                json,
                Encoding.UTF8,
                "application/json");

        request.Headers.Add("apikey", _anonKey);
        request.Headers.Add("Authorization", $"Bearer {jwt}");
        request.Headers.Add("Prefer", "return=representation");

        var response =
            await client.SendAsync(request);

        var body =
            await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception(body);

        return body;
    }

    public async Task CreateSubTasksAsync(
        string jwt,
        object payload)
    {
        var client = _httpClientFactory.CreateClient();

        var url =
            $"{_supabaseUrl}/rest/v1/sub_tasks";

        var json =
            JsonSerializer.Serialize(payload);

        using var request =
            new HttpRequestMessage(
                HttpMethod.Post,
                url);

        request.Content =
            new StringContent(
                json,
                Encoding.UTF8,
                "application/json");

        request.Headers.Add("apikey", _anonKey);
        request.Headers.Add("Authorization", $"Bearer {jwt}");

        var response =
            await client.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var error =
                await response.Content.ReadAsStringAsync();

                Console.WriteLine($"CREATE SUB TASK FAILED: {error}");

            throw new Exception(error);
        }
    }

    public async Task<string> GetTasksAsync(string jwt)
    {
        var client = _httpClientFactory.CreateClient();

        var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"{_supabaseUrl}/rest/v1/tasks?select=*"
        );

        request.Headers.Add("apikey", _anonKey);
        request.Headers.Add("Authorization", $"Bearer {jwt}");

        var response = await client.SendAsync(request);

        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception(body);

        return body;
    }

    public async Task<string> GetTaskAsync(
        string jwt,
        Guid taskId)
    {
        var client = _httpClientFactory.CreateClient();

        var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"{_supabaseUrl}/rest/v1/tasks?id=eq.{taskId}&select=*"
        );

        request.Headers.Add("apikey", _anonKey);
        request.Headers.Add("Authorization", $"Bearer {jwt}");

        var response = await client.SendAsync(request);

        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception(body);

        return body;
    }

    public async Task<string> UpdateTaskAsync(
        string jwt,
        Guid taskId,
        object payload)
    {
        var client = _httpClientFactory.CreateClient();

        var request = new HttpRequestMessage(
            HttpMethod.Patch,
            $"{_supabaseUrl}/rest/v1/tasks?id=eq.{taskId}"
        );

        request.Content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json"
        );

        request.Headers.Add("apikey", _anonKey);
        request.Headers.Add("Authorization", $"Bearer {jwt}");
        request.Headers.Add("Prefer", "return=representation");

        var response = await client.SendAsync(request);

        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception(body);

        return body;
    }

    public async Task DeleteTaskAsync(
        string jwt,
        Guid taskId)
    {
        var client = _httpClientFactory.CreateClient();

        var request = new HttpRequestMessage(
            HttpMethod.Delete,
            $"{_supabaseUrl}/rest/v1/tasks?id=eq.{taskId}"
        );

        request.Headers.Add("apikey", _anonKey);
        request.Headers.Add("Authorization", $"Bearer {jwt}");

        var response = await client.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var body =
                await response.Content.ReadAsStringAsync();

             Console.WriteLine($"DELETE TASK FAILED: {body}");

            throw new Exception(body);
        }
    }

    public async Task<string> GetSubTasksAsync(
        string jwt,
        Guid taskId)
    {
        var client = _httpClientFactory.CreateClient();

        var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"{_supabaseUrl}/rest/v1/sub_tasks" +
        $"?task_id=eq.{taskId}" +
        "&select=*," +
        "file:files(" +
        "id," +
        "name," +
        "type," +
        "size," +
        "thumbnail_url," +
        "content" +
        ")"
        );

        request.Headers.Add("apikey", _anonKey);
        request.Headers.Add("Authorization", $"Bearer {jwt}");

        var response = await client.SendAsync(request);

        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception(body);

        return body;
    }

    public async Task<string> GetSubTaskAsync(
        string jwt,
        Guid subTaskId)
    {
        var client = _httpClientFactory.CreateClient();

        var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"{_supabaseUrl}/rest/v1/sub_tasks?id=eq.{subTaskId}&select=*"
        );

        request.Headers.Add("apikey", _anonKey);
        request.Headers.Add("Authorization", $"Bearer {jwt}");

        var response = await client.SendAsync(request);

        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception(body);

        return body;
    }

    public async Task<string> UpdateSubTaskAsync(
        string jwt,
        Guid subTaskId,
        object payload)
    {
        var client = _httpClientFactory.CreateClient();

        var request = new HttpRequestMessage(
            HttpMethod.Patch,
            $"{_supabaseUrl}/rest/v1/sub_tasks?id=eq.{subTaskId}"
        );

        request.Content = new StringContent(
            JsonSerializer.Serialize(payload),
            Encoding.UTF8,
            "application/json"
        );

        request.Headers.Add("apikey", _anonKey);
        request.Headers.Add("Authorization", $"Bearer {jwt}");
        request.Headers.Add("Prefer", "return=representation");

        var response = await client.SendAsync(request);

        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new Exception(body);

        return body;
    }

    public async Task DeleteSubTaskAsync(
        string jwt,
        Guid subTaskId)
    {
        var client = _httpClientFactory.CreateClient();

        var request = new HttpRequestMessage(
            HttpMethod.Delete,
            $"{_supabaseUrl}/rest/v1/sub_tasks?id=eq.{subTaskId}"
        );

        request.Headers.Add("apikey", _anonKey);
        request.Headers.Add("Authorization", $"Bearer {jwt}");

        var response = await client.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var body =
                await response.Content.ReadAsStringAsync();

            throw new Exception(body);
        }
    }
}