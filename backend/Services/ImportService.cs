using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using SixLabors.ImageSharp;
using verilabelbackend.Models.Supabase;
using verilabelbackend.Services.Azure;
using verilabelbackend.Services.Supabase;

namespace verilabelbackend.Services
{
    public sealed class ImportService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly SupabaseFileService _fileService;
        private readonly AzureBlobStorageService _storageService;
        private readonly string _supabaseUrl;
        private readonly string _anonKey;

        public ImportService(
            IHttpClientFactory httpClientFactory,
            SupabaseFileService fileService,
            AzureBlobStorageService storageService,
            IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _fileService = fileService;
            _storageService = storageService;
            _supabaseUrl = configuration["Supabase:Url"]!;
            _anonKey = configuration["Supabase:AnonKey"]!;
        }

        private async Task PostAsync(string jwt, string table, object payload)
        {
            var client = _httpClientFactory.CreateClient();
            var url = $"{_supabaseUrl}/rest/v1/{table}";
            var body = JsonSerializer.Serialize(payload);
            var content = new StringContent(body, Encoding.UTF8, "application/json");

            using var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
            request.Headers.Add("apikey", _anonKey);
            request.Headers.Add("Authorization", $"Bearer {jwt}");
            request.Headers.Add("Prefer", "return=representation");

            var response = await client.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                throw new InvalidOperationException($"Supabase insert to '{table}' failed: {error}");
            }
        }

        private async Task<List<Dictionary<string, object>>> FetchProjectLabelTypesAsync(string jwt, Guid projectId)
        {
            var url = $"{_supabaseUrl}/rest/v1/project_label_types?project_id=eq.{projectId}";
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("apikey", _anonKey);
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {jwt}");
            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return new List<Dictionary<string, object>>();
            var stream = await response.Content.ReadAsStreamAsync();
            return await JsonSerializer.DeserializeAsync<List<Dictionary<string, object>>>(stream) ?? new List<Dictionary<string, object>>();
        }

        private async Task<List<Dictionary<string, object>>> FetchProjectLabelsAsync(string jwt, Guid projectId)
        {
            var url = $"{_supabaseUrl}/rest/v1/project_labels?project_id=eq.{projectId}";
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("apikey", _anonKey);
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {jwt}");
            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode) return new List<Dictionary<string, object>>();
            var stream = await response.Content.ReadAsStreamAsync();
            return await JsonSerializer.DeserializeAsync<List<Dictionary<string, object>>>(stream) ?? new List<Dictionary<string, object>>();
        }

        private async Task<Guid> GetOrCreateLabelTypeIdAsync(string jwt, Guid projectId, Guid userId)
        {
            var types = await FetchProjectLabelTypesAsync(jwt, projectId);
            var defaultType = types.FirstOrDefault();
            if (defaultType != null && defaultType.TryGetValue("id", out var idVal))
            {
                return Guid.Parse(idVal.ToString()!);
            }

            var newTypeId = Guid.NewGuid();
            var payload = new
            {
                id = newTypeId,
                project_id = projectId,
                name = "Annotations",
                description = "Default annotation label type",
                created_by = userId
            };
            await PostAsync(jwt, "project_label_types", payload);
            return newTypeId;
        }

        private async Task<Dictionary<string, (Guid id, string color)>> SyncLabelsAsync(
            string jwt,
            Guid projectId,
            Guid userId,
            Guid labelTypeId,
            List<string> labelNames)
        {
            var existing = await FetchProjectLabelsAsync(jwt, projectId);
            var map = new Dictionary<string, (Guid id, string color)>(StringComparer.OrdinalIgnoreCase);

            foreach (var label in existing)
            {
                if (label.TryGetValue("name", out var n) && label.TryGetValue("id", out var idVal))
                {
                    string name = n.ToString()!;
                    string color = label.TryGetValue("color", out var cVal) ? cVal.ToString()! : "blue";
                    map[name] = (Guid.Parse(idVal.ToString()!), color);
                }
            }

            var colors = new[] { "blue", "green", "red", "yellow", "purple", "pink", "indigo", "orange" };
            int colorIdx = 0;

            foreach (var name in labelNames)
            {
                if (!map.ContainsKey(name))
                {
                    var newLabelId = Guid.NewGuid();
                    var color = colors[colorIdx % colors.Length];
                    colorIdx++;

                    var payload = new
                    {
                        id = newLabelId,
                        project_id = projectId,
                        label_type_id = labelTypeId,
                        name = name,
                        color = color,
                        created_by = userId
                    };
                    await PostAsync(jwt, "project_labels", payload);
                    map[name] = (newLabelId, color);
                }
            }

            return map;
        }

        private async Task<(int width, int height)> GetImageDimensionsAsync(string? sasUrl)
        {
            if (string.IsNullOrEmpty(sasUrl)) return (0, 0);
            try
            {
                using var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(15);
                using var stream = await client.GetStreamAsync(sasUrl);
                var imageInfo = await Image.IdentifyAsync(stream);
                if (imageInfo != null)
                {
                    return (imageInfo.Width, imageInfo.Height);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ImportService] Error identifying image dimensions: {ex.Message}");
            }
            return (0, 0);
        }

        public async Task<int> ImportCocoAsync(string jwt, Guid projectId, Guid userId, Stream cocoStream)
        {
            using var jsonDoc = await JsonDocument.ParseAsync(cocoStream);
            var root = jsonDoc.RootElement;

            // 1. Parse categories
            var categoryIdMap = new Dictionary<int, string>();
            if (root.TryGetProperty("categories", out var categoriesProp))
            {
                foreach (var cat in categoriesProp.EnumerateArray())
                {
                    int id = cat.GetProperty("id").GetInt32();
                    string name = cat.GetProperty("name").GetString() ?? "unknown";
                    categoryIdMap[id] = name;
                }
            }

            // 2. Sync labels
            var labelTypeId = await GetOrCreateLabelTypeIdAsync(jwt, projectId, userId);
            var labelMap = await SyncLabelsAsync(jwt, projectId, userId, labelTypeId, categoryIdMap.Values.ToList());

            // 3. Match images in COCO to project files
            var files = await _fileService.GetFilesByProjectIdAsync(jwt, projectId);
            var fileMap = new Dictionary<int, FileEntity>();

            if (root.TryGetProperty("images", out var imagesProp))
            {
                foreach (var img in imagesProp.EnumerateArray())
                {
                    int id = img.GetProperty("id").GetInt32();
                    string name = img.GetProperty("file_name").GetString() ?? "";

                    var matchedFile = files.FirstOrDefault(f => f.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
                    if (matchedFile != null)
                    {
                        fileMap[id] = matchedFile;
                    }
                }
            }

            // 4. Parse annotations
            var dbAnnotations = new List<object>();

            if (root.TryGetProperty("annotations", out var annotationsProp))
            {
                foreach (var ann in annotationsProp.EnumerateArray())
                {
                    int imageId = ann.GetProperty("image_id").GetInt32();
                    if (!fileMap.TryGetValue(imageId, out var file)) continue;

                    int catId = ann.GetProperty("category_id").GetInt32();
                    if (!categoryIdMap.TryGetValue(catId, out string labelName)) continue;
                    if (!labelMap.TryGetValue(labelName, out var labelInfo)) continue;

                    string type = "boundingBox";
                    string dataJson = "{}";

                    // Check if it has segmentation array and treat as polygon if applicable
                    bool isPolygon = false;
                    if (ann.TryGetProperty("segmentation", out var segProp) && segProp.ValueKind == JsonValueKind.Array && segProp.GetArrayLength() > 0)
                    {
                        var firstSeg = segProp[0];
                        if (firstSeg.ValueKind == JsonValueKind.Array && firstSeg.GetArrayLength() >= 6)
                        {
                            isPolygon = true;
                            var points = new List<object>();
                            for (int i = 0; i < firstSeg.GetArrayLength() - 1; i += 2)
                            {
                                points.Add(new { x = firstSeg[i].GetDouble(), y = firstSeg[i + 1].GetDouble() });
                            }
                            type = "polygon";
                            dataJson = JsonSerializer.Serialize(new { points = points });
                        }
                    }

                    if (!isPolygon && ann.TryGetProperty("bbox", out var bboxProp) && bboxProp.ValueKind == JsonValueKind.Array && bboxProp.GetArrayLength() == 4)
                    {
                        double x = bboxProp[0].GetDouble();
                        double y = bboxProp[1].GetDouble();
                        double w = bboxProp[2].GetDouble();
                        double h = bboxProp[3].GetDouble();

                        type = "boundingBox";
                        dataJson = JsonSerializer.Serialize(new { x = x, y = y, width = w, height = h });
                    }

                    dbAnnotations.Add(new
                    {
                        id = Guid.NewGuid(),
                        file_id = file.Id,
                        project_id = projectId,
                        user_id = userId,
                        type = type,
                        label = labelName,
                        color = labelInfo.color.StartsWith("#") ? labelInfo.color : "#3b82f6",
                        label_type_id = labelTypeId,
                        data = dataJson,
                        comment = "Imported via COCO JSON",
                        created_at = DateTimeOffset.UtcNow,
                        updated_at = DateTimeOffset.UtcNow
                    });
                }
            }

            if (dbAnnotations.Count > 0)
            {
                // Push annotations in batches of 100
                const int batchSize = 100;
                for (int i = 0; i < dbAnnotations.Count; i += batchSize)
                {
                    var batch = dbAnnotations.Skip(i).Take(batchSize).ToList();
                    await PostAsync(jwt, "annotations", batch);
                }
            }

            return dbAnnotations.Count;
        }

        public async Task<int> ImportYoloAsync(string jwt, Guid projectId, Guid userId, Stream zipStream)
        {
            using var archive = new ZipArchive(zipStream, ZipArchiveMode.Read);
            
            // 1. Read classes.txt
            var classesEntry = archive.GetEntry("classes.txt");
            if (classesEntry == null)
            {
                throw new ArgumentException("YOLO zip must contain classes.txt mapping class indexes to names.");
            }

            var classes = new List<string>();
            using (var reader = new StreamReader(classesEntry.Open()))
            {
                string? line;
                while ((line = await reader.ReadLineAsync()) != null)
                {
                    if (!string.IsNullOrWhiteSpace(line))
                    {
                        classes.Add(line.Trim());
                    }
                }
            }

            // 2. Sync labels
            var labelTypeId = await GetOrCreateLabelTypeIdAsync(jwt, projectId, userId);
            var labelMap = await SyncLabelsAsync(jwt, projectId, userId, labelTypeId, classes);

            // 3. Find files in project to map txt files
            var files = await _fileService.GetFilesByProjectIdAsync(jwt, projectId);
            var fileDict = files.ToDictionary(f => Path.GetFileNameWithoutExtension(f.Name), f => f, StringComparer.OrdinalIgnoreCase);

            var dbAnnotations = new List<object>();

            // 4. Process all txt annotation files in zip
            foreach (var entry in archive.Entries)
            {
                if (entry.Name == "classes.txt" || !entry.Name.EndsWith(".txt", StringComparison.OrdinalIgnoreCase)) continue;

                var fileNameWithoutExt = Path.GetFileNameWithoutExtension(entry.Name);
                if (!fileDict.TryGetValue(fileNameWithoutExt, out var file)) continue;

                // Obtain dimensions
                string? sasUrl = string.IsNullOrEmpty(file.ThumbnailUrl) ? null : _storageService.GenerateSasUrl(file.ThumbnailUrl);
                var (width, height) = await GetImageDimensionsAsync(sasUrl);
                if (width == 0 || height == 0)
                {
                    width = 640;
                    height = 480;
                }

                using (var reader = new StreamReader(entry.Open()))
                {
                    string? line;
                    while ((line = await reader.ReadLineAsync()) != null)
                    {
                        if (string.IsNullOrWhiteSpace(line)) continue;
                        var parts = line.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
                        if (parts.Length < 5) continue;

                        if (!int.TryParse(parts[0], out int classIdx) || classIdx < 0 || classIdx >= classes.Count) continue;
                        if (!double.TryParse(parts[1], out double xCenterNorm) ||
                            !double.TryParse(parts[2], out double yCenterNorm) ||
                            !double.TryParse(parts[3], out double wNorm) ||
                            !double.TryParse(parts[4], out double hNorm)) continue;

                        string labelName = classes[classIdx];
                        if (!labelMap.TryGetValue(labelName, out var labelInfo)) continue;

                        // Calculate absolute coordinates
                        double w = wNorm * width;
                        double h = hNorm * height;
                        double x = (xCenterNorm - wNorm / 2.0) * width;
                        double y = (yCenterNorm - hNorm / 2.0) * height;

                        var dataJson = JsonSerializer.Serialize(new { x = x, y = y, width = w, height = h });

                        dbAnnotations.Add(new
                        {
                            id = Guid.NewGuid(),
                            file_id = file.Id,
                            project_id = projectId,
                            user_id = userId,
                            type = "boundingBox",
                            label = labelName,
                            color = labelInfo.color.StartsWith("#") ? labelInfo.color : "#3b82f6",
                            label_type_id = labelTypeId,
                            data = dataJson,
                            comment = "Imported via YOLO TXT",
                            created_at = DateTimeOffset.UtcNow,
                            updated_at = DateTimeOffset.UtcNow
                        });
                    }
                }
            }

            if (dbAnnotations.Count > 0)
            {
                // Push annotations in batches of 100
                const int batchSize = 100;
                for (int i = 0; i < dbAnnotations.Count; i += batchSize)
                {
                    var batch = dbAnnotations.Skip(i).Take(batchSize).ToList();
                    await PostAsync(jwt, "annotations", batch);
                }
            }

            return dbAnnotations.Count;
        }
    }
}
