using System;
using System.IO;
using System.Net.Http;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using verilabelbackend.Services.AI;
using verilabelbackend.Models;

namespace verilabelbackend.Services.AI;

public static class YoloTestRunner
{
    private static readonly Dictionary<string, string> TestImages = new Dictionary<string, string>();

    public static async Task RunTestsAsync(IServiceProvider services)
    {
        Console.WriteLine("\n========================================");
        Console.WriteLine("STARTING YOLOv8 ONNX INTEGRATION TESTS");
        Console.WriteLine("========================================\n");

        var detector = services.GetRequiredService<IDetectionService>();
        using var http = new HttpClient();

        var testDir = Path.Combine(Directory.GetCurrentDirectory(), "test_images");
        if (!Directory.Exists(testDir))
        {
            Directory.CreateDirectory(testDir);
        }

        foreach (var pair in TestImages)
        {
            var name = pair.Key;
            var url = pair.Value;
            var filePath = Path.Combine(testDir, $"{name}.jpg");

            if (!File.Exists(filePath))
            {
                Console.WriteLine($"Downloading {name} image from: {url}");
                try
                {
                    var bytes = await http.GetByteArrayAsync(url);
                    await File.WriteAllBytesAsync(filePath, bytes);
                    Console.WriteLine($"Saved to: {filePath}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Failed to download {name}: {ex.Message}");
                    continue;
                }
            }
        }

        // Test cases configuration:
        // format: (imageKey, labelsList, description)
        var testCases = new List<(string ImageKey, List<string> Labels, string Description)>
        {
            ("human.jpeg", new List<string> { "person" }, "Human Detection"),
            ("Human_testing.jpeg", new List<string> { "person" }, "Human Detection (Custom Image)"),

            ("human", new List<string> { "person" }, "YOLO Person Detection"),
            ("human", new List<string> { "person", "bus" }, "YOLO Multi-Class Detection"),

            ("dog", new List<string> { "dog" }, "YOLO Dog Detection"),

            ("single_cow", new List<string> { "cow" }, "YOLO Single Cow Detection"),
            ("multi_cow", new List<string> { "cow" }, "YOLO Multi Cow Detection"),

            ("single_car", new List<string> { "car" }, "YOLO Single Car Detection"),
            ("multi_car", new List<string> { "car" }, "YOLO Multi Car Detection"),
            ("multi_car", new List<string> { "vehicle" }, "YOLO Vehicle Alias Test"),

            ("human", new List<string> { "face" }, "GroundingDINO Face Test"),
            ("human", new List<string> { "helmet" }, "GroundingDINO Helmet Test"),
            ("human", new List<string> { "beard" }, "GroundingDINO Beard Test"),

            ("human", new List<string> { "face", "helmet" }, "GroundingDINO Multi Label Test")
};

        foreach (var tc in testCases)
        {
            var fileName = tc.ImageKey.Contains('.') ? tc.ImageKey : $"{tc.ImageKey}.jpg";
            var filePath = Path.Combine(testDir, fileName);
            if (!File.Exists(filePath))
            {
                Console.WriteLine($"Skipping test case {tc.Description} because file is missing: {filePath}");
                continue;
            }

            Console.WriteLine("\n----------------------------------------");
            Console.WriteLine($"RUNNING TEST CASE: {tc.Description}");
            Console.WriteLine($"Image Path: {filePath}");
            Console.WriteLine("----------------------------------------");

            try
            {
                using var stream = File.OpenRead(filePath);
                var configDict = new Dictionary<string, object>
                {
                    { "YoloDebugMode", true },
                    { "ConfidenceThreshold", 0.5f },
                    { "IoUThreshold", 0.45f }
                };
                var results = await detector.DetectAsync(stream, tc.Labels, configDict);

                Console.WriteLine("\n[TEST RESULTS SUMMARY]");
                Console.WriteLine($"Total Annotations Generated: {results.Count}");
                foreach (var ann in results)
                {
                    Console.WriteLine($"- Label: {ann.Label}, Confidence: {ann.Confidence:P1}, BBox: [x={ann.BoundingBox.X}, y={ann.BoundingBox.Y}, w={ann.BoundingBox.Width}, h={ann.BoundingBox.Height}]");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error during execution: {ex.Message}");
            }
        }

        // GroundingDINO Phase 3.1 verification test
        try
        {
            Console.WriteLine("\n----------------------------------------");
            Console.WriteLine("RUNNING GROUNDINGDINO PHASE 3.1 VERIFICATION");
            Console.WriteLine("----------------------------------------");
            var env = services.GetRequiredService<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>();
            var config = services.GetRequiredService<Microsoft.Extensions.Configuration.IConfiguration>();
            var dino = new GroundingDinoOnnxService(env, config);

            var testImgPath = Path.Combine(testDir, "human.jpeg");
            if (File.Exists(testImgPath))
            {
                await dino.DetectAsync(testImgPath, "face");
            }
            else
            {
                Console.WriteLine($"[GroundingDINO] Skip test: human.jpeg missing at {testImgPath}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GroundingDINO] Verification test failed: {ex.Message}");
        }

        Console.WriteLine("\n========================================");
        Console.WriteLine("YOLOv8 ONNX INTEGRATION TESTS COMPLETE");
        Console.WriteLine("========================================\n");
    }
}
