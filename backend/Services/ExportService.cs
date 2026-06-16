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
    public sealed class ExportService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly SupabaseFileService _fileService;
        private readonly SupabaseAnnotationService _annotationService;
        private readonly AzureBlobStorageService _storageService;
        private readonly string _supabaseUrl;
        private readonly string _anonKey;

        public ExportService(
            IHttpClientFactory httpClientFactory,
            SupabaseFileService fileService,
            SupabaseAnnotationService annotationService,
            AzureBlobStorageService storageService,
            IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _fileService = fileService;
            _annotationService = annotationService;
            _storageService = storageService;
            _supabaseUrl = configuration["Supabase:Url"]!;
            _anonKey = configuration["Supabase:AnonKey"]!;
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
                Console.WriteLine($"[ExportService] Error identifying image dimensions: {ex.Message}");
            }
            return (0, 0);
        }

        public async Task<byte[]> ExportToCocoAsync(string jwt, Guid projectId)
        {
            // 1. Fetch files in the project
            var files = await _fileService.GetFilesByProjectIdAsync(jwt, projectId);

            // 2. Fetch project labels
            var labels = await FetchProjectLabelsAsync(jwt, projectId);
            var categoryMap = labels
                .Select((l, idx) => new { Name = l.TryGetValue("name", out var n) ? n.ToString() : "", Id = idx + 1 })
                .Where(x => !string.IsNullOrEmpty(x.Name))
                .ToDictionary(x => x.Name!, x => x.Id, StringComparer.OrdinalIgnoreCase);

            // 3. Setup categories for COCO
            var cocoCategories = labels
                .Select((l, idx) => new
                {
                    id = idx + 1,
                    name = l.TryGetValue("name", out var n) ? n.ToString() : "unknown",
                    supercategory = "none"
                }).ToList();

            var cocoImages = new List<object>();
            var cocoAnnotations = new List<object>();
            int annIdCounter = 1;
            int fileIdCounter = 1;

            foreach (var file in files)
            {
                // Generate SAS URL for image dimensions resolution
                string? sasUrl = string.IsNullOrEmpty(file.ThumbnailUrl)
                    ? null
                    : _storageService.GenerateSasUrl(file.ThumbnailUrl);

                var (width, height) = await GetImageDimensionsAsync(sasUrl);
                if (width == 0 || height == 0)
                {
                    width = 640; // Default fallback dimensions
                    height = 480;
                }

                int currentFileId = fileIdCounter++;
                cocoImages.Add(new
                {
                    id = currentFileId,
                    width = width,
                    height = height,
                    file_name = file.Name,
                    license = 1,
                    date_captured = file.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")
                });

                // Fetch annotations for this file
                var annotations = await _annotationService.GetAnnotationsByFileAsync(jwt, file.Id);
                foreach (var ann in annotations)
                {
                    string label = ann.TryGetValue("label", out var lVal) ? lVal.ToString() ?? "unknown" : "unknown";
                    if (!categoryMap.TryGetValue(label, out int categoryId))
                    {
                        // Dynamic registration in case a label doesn't exist
                        categoryId = categoryMap.Count + 1;
                        categoryMap[label] = categoryId;
                        cocoCategories.Add(new
                        {
                            id = categoryId,
                            name = label,
                            supercategory = "none"
                        });
                    }

                    string type = ann.TryGetValue("type", out var tVal) ? tVal.ToString() ?? "boundingBox" : "boundingBox";
                    var dataStr = ann.TryGetValue("data", out var dVal) ? dVal.ToString() : null;

                    if (string.IsNullOrEmpty(dataStr)) continue;

                    double[] bbox = new double[4];
                    List<List<double>> segmentation = new List<List<double>>();
                    double area = 0;

                    try
                    {
                        using var doc = JsonDocument.Parse(dataStr);
                        var root = doc.RootElement;

                        if (type == "boundingBox")
                        {
                            double x = root.TryGetProperty("x", out var xp) ? xp.GetDouble() : 0;
                            double y = root.TryGetProperty("y", out var yp) ? yp.GetDouble() : 0;
                            double w = root.TryGetProperty("width", out var wp) ? wp.GetDouble() : 0;
                            double h = root.TryGetProperty("height", out var hp) ? hp.GetDouble() : 0;

                            bbox = new[] { x, y, w, h };
                            area = w * h;
                            segmentation.Add(new List<double> { x, y, x + w, y, x + w, y + h, x, y + h });
                        }
                        else if (type == "polygon" || type == "polyline")
                        {
                            if (root.TryGetProperty("points", out var pointsProp) && pointsProp.ValueKind == JsonValueKind.Array)
                            {
                                var ptsList = new List<double>();
                                double minX = double.MaxValue, maxX = double.MinValue;
                                double minY = double.MaxValue, maxY = double.MinValue;

                                foreach (var pt in pointsProp.EnumerateArray())
                                {
                                    double px = pt.GetProperty("x").GetDouble();
                                    double py = pt.GetProperty("y").GetDouble();
                                    ptsList.Add(px);
                                    ptsList.Add(py);

                                    if (px < minX) minX = px;
                                    if (px > maxX) maxX = px;
                                    if (py < minY) minY = py;
                                    if (py > maxY) maxY = py;
                                }

                                segmentation.Add(ptsList);
                                double w = maxX - minX;
                                double h = maxY - minY;
                                bbox = new[] { minX, minY, w, h };
                                area = w * h; // Bounding box area fallback, or Shoelace if polygon
                            }
                        }
                        else if (type == "point" || type == "keypoint")
                        {
                            double x = root.TryGetProperty("x", out var xp) ? xp.GetDouble() : 0;
                            double y = root.TryGetProperty("y", out var yp) ? yp.GetDouble() : 0;

                            bbox = new[] { x - 1, y - 1, 2, 2 };
                            area = 4;
                            segmentation.Add(new List<double> { x, y });
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[ExportService] Error parsing annotation data: {ex.Message}");
                        continue;
                    }

                    cocoAnnotations.Add(new
                    {
                        id = annIdCounter++,
                        image_id = currentFileId,
                        category_id = categoryId,
                        segmentation = segmentation,
                        area = area,
                        bbox = bbox,
                        iscrowd = 0
                    });
                }
            }

            var cocoObj = new
            {
                info = new
                {
                    description = "Veri Label Dataset Export",
                    url = "",
                    version = "1.0",
                    year = DateTime.UtcNow.Year,
                    contributor = "Veri Label",
                    date_created = DateTime.UtcNow.ToString("yyyy-MM-dd")
                },
                images = cocoImages,
                annotations = cocoAnnotations,
                categories = cocoCategories
            };

            var jsonBytes = JsonSerializer.SerializeToUtf8Bytes(cocoObj, new JsonSerializerOptions
            {
                WriteIndented = true
            });

            return jsonBytes;
        }

        public async Task<byte[]> ExportToYoloAsync(string jwt, Guid projectId)
        {
            // 1. Fetch files in the project
            var files = await _fileService.GetFilesByProjectIdAsync(jwt, projectId);

            // 2. Fetch project labels
            var labels = await FetchProjectLabelsAsync(jwt, projectId);
            var labelList = labels
                .Select(l => l.TryGetValue("name", out var n) ? n.ToString() ?? "" : "")
                .Where(n => !string.IsNullOrEmpty(n))
                .ToList();

            var labelToIndex = labelList
                .Select((name, idx) => new { name, idx })
                .ToDictionary(x => x.name, x => x.idx, StringComparer.OrdinalIgnoreCase);

            using var memoryStream = new MemoryStream();
            using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
            {
                // Write classes.txt
                var classesEntry = archive.CreateEntry("classes.txt");
                using (var writer = new StreamWriter(classesEntry.Open(), Encoding.UTF8))
                {
                    foreach (var lName in labelList)
                    {
                        await writer.WriteLineAsync(lName);
                    }
                }

                // Write coordinate txt files
                foreach (var file in files)
                {
                    string? sasUrl = string.IsNullOrEmpty(file.ThumbnailUrl)
                        ? null
                        : _storageService.GenerateSasUrl(file.ThumbnailUrl);

                    var (width, height) = await GetImageDimensionsAsync(sasUrl);
                    if (width == 0 || height == 0)
                    {
                        width = 640;
                        height = 480;
                    }

                    var annotations = await _annotationService.GetAnnotationsByFileAsync(jwt, file.Id);
                    var txtFileName = Path.ChangeExtension(file.Name, ".txt");
                    var textEntry = archive.CreateEntry(txtFileName);

                    using (var writer = new StreamWriter(textEntry.Open(), Encoding.UTF8))
                    {
                        foreach (var ann in annotations)
                        {
                            string label = ann.TryGetValue("label", out var lVal) ? lVal.ToString() ?? "unknown" : "unknown";
                            if (!labelToIndex.TryGetValue(label, out int classIdx))
                            {
                                classIdx = labelList.Count;
                                labelList.Add(label);
                                labelToIndex[label] = classIdx;
                            }

                            string type = ann.TryGetValue("type", out var tVal) ? tVal.ToString() ?? "boundingBox" : "boundingBox";
                            var dataStr = ann.TryGetValue("data", out var dVal) ? dVal.ToString() : null;

                            if (string.IsNullOrEmpty(dataStr)) continue;

                            try
                            {
                                using var doc = JsonDocument.Parse(dataStr);
                                var root = doc.RootElement;

                                double x = 0, y = 0, w = 0, h = 0;

                                if (type == "boundingBox")
                                {
                                    x = root.TryGetProperty("x", out var xp) ? xp.GetDouble() : 0;
                                    y = root.TryGetProperty("y", out var yp) ? yp.GetDouble() : 0;
                                    w = root.TryGetProperty("width", out var wp) ? wp.GetDouble() : 0;
                                    h = root.TryGetProperty("height", out var hp) ? hp.GetDouble() : 0;
                                }
                                else if (type == "polygon" || type == "polyline")
                                {
                                    if (root.TryGetProperty("points", out var pointsProp) && pointsProp.ValueKind == JsonValueKind.Array)
                                    {
                                        double minX = double.MaxValue, maxX = double.MinValue;
                                        double minY = double.MaxValue, maxY = double.MinValue;

                                        foreach (var pt in pointsProp.EnumerateArray())
                                        {
                                            double px = pt.GetProperty("x").GetDouble();
                                            double py = pt.GetProperty("y").GetDouble();

                                            if (px < minX) minX = px;
                                            if (px > maxX) maxX = px;
                                            if (py < minY) minY = py;
                                            if (py > maxY) maxY = py;
                                        }
                                        x = minX;
                                        y = minY;
                                        w = maxX - minX;
                                        h = maxY - minY;
                                    }
                                }
                                else if (type == "point" || type == "keypoint")
                                {
                                    x = (root.TryGetProperty("x", out var xp) ? xp.GetDouble() : 0) - 5;
                                    y = (root.TryGetProperty("y", out var yp) ? yp.GetDouble() : 0) - 5;
                                    w = 10;
                                    h = 10;
                                }

                                // YOLO expects: <class_idx> <x_center_norm> <y_center_norm> <width_norm> <height_norm>
                                double xCenterNorm = (x + w / 2.0) / width;
                                double yCenterNorm = (y + h / 2.0) / height;
                                double wNorm = w / width;
                                double hNorm = h / height;

                                await writer.WriteLineAsync($"{classIdx} {xCenterNorm:F6} {yCenterNorm:F6} {wNorm:F6} {hNorm:F6}");
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"[ExportService] Error parsing YOLO coords: {ex.Message}");
                            }
                        }
                    }
                }
            }

            return memoryStream.ToArray();
        }
    }
}
