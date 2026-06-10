using System.Text;
using System.Text.Json;
using verilabelbackend.Models.Supabase;

namespace verilabelbackend.Services.Supabase
{
    public class SupabaseFileService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _supabaseUrl;
        private readonly string _anonKey;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
        };

        public SupabaseFileService(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _supabaseUrl = configuration["Supabase:Url"]
                ?? throw new InvalidOperationException("Supabase:Url is missing.");
            _anonKey = configuration["Supabase:AnonKey"]
                ?? throw new InvalidOperationException("Supabase:AnonKey is missing.");
        }

        public async Task InsertFileAsync(string jwt, FileEntity file)
        {
            var payload = new
            {
                id = file.Id,
                user_id = file.UserId,
                name = file.Name,
                type = file.Type,
                size = file.Size,
                thumbnail_url =  file.ThumbnailUrl,
                content = file.Content,
                project_id = file.ProjectId,
                created_at = file.CreatedAt,
                updated_at = file.UpdatedAt
            };

            await PostAsync(jwt, "files", payload);
        }

        private async Task PostAsync(string jwt, string table, object payload)
        {
            var client = _httpClientFactory.CreateClient();
            var url = $"{_supabaseUrl}/rest/v1/{table}";
            var body = JsonSerializer.Serialize(payload, JsonOptions);
            var content = new StringContent(body, Encoding.UTF8, "application/json");

            using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
            request.Headers.Add("apikey", _anonKey);
            request.Headers.Add("Authorization", $"Bearer {jwt}");
            request.Headers.Add("Prefer", "return=minimal");

            var response = await client.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                throw new InvalidOperationException(
                    $"Supabase insert to '{table}' failed [{(int)response.StatusCode}]: {error}");
            }
        }


        //file fetching 
        public async Task<List<FileEntity>> GetFilesByUserAsync(string jwt, Guid userId)
        {
            var client = _httpClientFactory.CreateClient();

            var url = $"{_supabaseUrl}/rest/v1/files?user_id=eq.{userId}";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", _anonKey);
            request.Headers.Add("Authorization", $"Bearer {jwt}");
            var response = await client.SendAsync(request);
            var json = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"[ERROR] {json}");
            }

            var result = JsonSerializer.Deserialize<List<FileEntity>>(json, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
            });

            return result ?? new List<FileEntity>();
        }


        public async Task<FileEntity?> GetFileByIdAsync(string jwt, Guid id)
        {
            var client = _httpClientFactory.CreateClient();
            var url = $"{_supabaseUrl}/rest/v1/files?id=eq.{id}";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", _anonKey);
            request.Headers.Add("Authorization", $"Bearer {jwt}");
            var response = await client.SendAsync(request);
            var json = await response.Content.ReadAsStringAsync();
            var list = JsonSerializer.Deserialize<List<FileEntity>>(json, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
            });
            return list?.FirstOrDefault();
        }

        public async Task<List<FileEntity>> GetFilesByProjectIdAsync(string jwt, Guid projectId)
        {
            var client = _httpClientFactory.CreateClient();

            var url = $"{_supabaseUrl}/rest/v1/files?project_id=eq.{projectId}";

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("apikey", _anonKey);
            request.Headers.Add("Authorization", $"Bearer {jwt}");

            var response = await client.SendAsync(request);
            var json = await response.Content.ReadAsStringAsync();

            var list = JsonSerializer.Deserialize<List<FileEntity>>(json, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
            });

            return list ?? new List<FileEntity>();
        }

        public async Task DeleteFileAsync(string jwt, Guid id)
        {
            var client = _httpClientFactory.CreateClient();
            var url = $"{_supabaseUrl}/rest/v1/files?id=eq.{id}";
            using var request = new HttpRequestMessage(HttpMethod.Delete, url);
            request.Headers.Add("apikey", _anonKey);
            request.Headers.Add("Authorization", $"Bearer {jwt}");
            await client.SendAsync(request);
        }

        public async Task MoveFilesAsync(string jwt, List<string> fileIds, string? folder)
        {
            if (fileIds == null || fileIds.Count == 0)
                throw new ArgumentException("fileIds cannot be empty");

            var client = _httpClientFactory.CreateClient();

            var ids = string.Join(",", fileIds);
            var url = $"{_supabaseUrl}/rest/v1/files?id=in.({ids})";

            using var request = new HttpRequestMessage(HttpMethod.Patch, url);

            request.Headers.Add("apikey", _anonKey);
            request.Headers.Add("Authorization", $"Bearer {jwt}");
            request.Headers.Add("Prefer", "return=minimal");

            var payload = JsonSerializer.Serialize(new
            {
                folder = folder
            });

            request.Content = new StringContent(payload, Encoding.UTF8, "application/json");

            var response = await client.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync();
                throw new Exception($"MoveFiles failed: {err}");
            }
        }

        public async Task RenameFolderAsync(string jwt, Guid userId, string oldName, string newName)
        {
            if (string.IsNullOrWhiteSpace(oldName) || string.IsNullOrWhiteSpace(newName))
                throw new ArgumentException("Folder names cannot be empty");

            var client = _httpClientFactory.CreateClient();

            var encodedOld = Uri.EscapeDataString(oldName);

            var url = $"{_supabaseUrl}/rest/v1/files?folder=eq.{encodedOld}&user_id=eq.{userId}";

            using var request = new HttpRequestMessage(HttpMethod.Patch, url);

            request.Headers.Add("apikey", _anonKey);
            request.Headers.Add("Authorization", $"Bearer {jwt}");
            request.Headers.Add("Prefer", "return=minimal");

            var payload = JsonSerializer.Serialize(new
            {
                folder = newName
            });

            request.Content = new StringContent(payload, Encoding.UTF8, "application/json");

            var response = await client.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync();
                throw new Exception($"RenameFolder failed: {err}");
            }
        }
    }
}