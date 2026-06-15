using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using verilabelbackend.Models;

namespace verilabelbackend.Services.AI;

public sealed class YoloV8OnnxService : IDetectionService
{
    private readonly InferenceSession _session;
    private readonly YoloDetectionOptions _options;

    private static readonly string[] CocoClasses = new[]
    {
        "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat", "traffic light",
        "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse", "sheep", "cow",
        "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
        "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
        "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
        "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch", "potted plant", "bed",
        "dining table", "toilet", "tv", "laptop", "mouse", "remote", "keyboard", "cell phone", "microwave", "oven",
        "toaster", "sink", "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
    };

    public YoloV8OnnxService(
        IWebHostEnvironment env,
        IConfiguration config,
        IOptions<YoloDetectionOptions> options)
    {
        var modelPath = Path.Combine(
            env.ContentRootPath,
            "Models",
            "ONNX",
            "yolov8s.onnx");

        Console.WriteLine($"[YOLOv8 ONNX] Loading model: {modelPath}");
        _session = new InferenceSession(modelPath);
        Console.WriteLine("[YOLOv8 ONNX] Model loaded successfully");

        _options = options?.Value ?? new YoloDetectionOptions();
        Console.WriteLine($"[YOLOv8 ONNX] Configured Confidence Threshold = {_options.ConfidenceThreshold}");
        Console.WriteLine($"[YOLOv8 ONNX] Configured NMS IoU Threshold = {_options.IoUThreshold}");
        Console.WriteLine($"[YOLOv8 ONNX] Configured Min Box = {_options.MinBoxWidth}x{_options.MinBoxHeight}");

        Console.WriteLine("========== INPUTS ==========");
        foreach(var input in _session.InputMetadata)
        {
            Console.WriteLine(
                $"{input.Key} | " +
                $"{input.Value.ElementType} | " +
                $"{string.Join(",", input.Value.Dimensions)}"
            );
        }

        Console.WriteLine("========== OUTPUTS ==========");
        foreach(var output in _session.OutputMetadata)
        {
            Console.WriteLine(
                $"{output.Key} | " +
                $"{output.Value.ElementType} | " +
                $"{string.Join(",", output.Value.Dimensions)}"
            );
        }
    }

    public async Task<List<AnnotationResult>> DetectAsync(
        Stream imageStream,
        List<string> labels,
        Dictionary<string, object>? config = null)
    {
        // Phase 1 — Image Preprocessing (Letterbox)
        imageStream.Position = 0;
        using var image = await Image.LoadAsync<Rgb24>(imageStream);

        var originalWidth = image.Width;
        var originalHeight = image.Height;

        // Calculate letterbox dimensions
        float scale = Math.Min(640f / originalWidth, 640f / originalHeight);
        int scaledWidth = (int)Math.Round(originalWidth * scale);
        int scaledHeight = (int)Math.Round(originalHeight * scale);

        float padX = (640f - scaledWidth) / 2f;
        float padY = (640f - scaledHeight) / 2f;

        // Resize image preserving aspect ratio
        image.Mutate(x => x.Resize(scaledWidth, scaledHeight));

        // Create 640x640 canvas filled with grey (114, 114, 114)
        using var canvas = new Image<Rgb24>(640, 640, new Rgb24(114, 114, 114));

        // Draw resized image onto canvas
        canvas.Mutate(ctx => ctx.DrawImage(image, new Point((int)Math.Round(padX), (int)Math.Round(padY)), 1f));

        var inputTensor = new DenseTensor<float>(new[] { 1, 3, 640, 640 });

        canvas.ProcessPixelRows(accessor =>
        {
            for (int y = 0; y < 640; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (int x = 0; x < 640; x++)
                {
                    var pixel = row[x];
                    inputTensor[0, 0, y, x] = pixel.R / 255.0f;
                    inputTensor[0, 1, y, x] = pixel.G / 255.0f;
                    inputTensor[0, 2, y, x] = pixel.B / 255.0f;
                }
            }
        });

        Console.WriteLine($"Tensor Shape = {string.Join(',', inputTensor.Dimensions.ToArray())}");

        // Phase 2 — ONNX Inference
        var inputs = new List<NamedOnnxValue>
        {
            NamedOnnxValue.CreateFromTensor("images", inputTensor)
        };

        using var results = _session.Run(inputs);

        var outputResult = results.FirstOrDefault(r => r.Name == "output0");
        if (outputResult == null)
        {
            Console.WriteLine("[YOLOv8 ONNX] Error: Model output tensor 'output0' not found.");
            return new List<AnnotationResult>();
        }

        var outputTensor = outputResult.AsTensor<float>();
        Console.WriteLine($"Output Shape = {string.Join(',', outputTensor.Dimensions.ToArray())}");

        // Phase 3 & 4 — Decode YOLO Output & COCO Label Mapping
        var rawAnnotations = new List<AnnotationResult>();
        int printedCount = 0;

        float confidenceThreshold = _options.ConfidenceThreshold;
        float iouThreshold = _options.IoUThreshold;
        int minBoxWidth = _options.MinBoxWidth;
        int minBoxHeight = _options.MinBoxHeight;
        bool yoloDebugMode = _options.YoloDebugMode;

        if (config != null)
        {
            if (TryGetFloatValue(config, "ConfidenceThreshold", out var cVal) ||
                TryGetFloatValue(config, "confidenceThreshold", out cVal) ||
                TryGetFloatValue(config, "confidence_threshold", out cVal))
            {
                confidenceThreshold = cVal;
            }

            if (TryGetFloatValue(config, "IoUThreshold", out var iVal) ||
                TryGetFloatValue(config, "iouThreshold", out iVal) ||
                TryGetFloatValue(config, "iou_threshold", out iVal))
            {
                iouThreshold = iVal;
            }

            if (TryGetIntValue(config, "MinBoxWidth", out var wVal) ||
                TryGetIntValue(config, "minBoxWidth", out wVal) ||
                TryGetIntValue(config, "min_box_width", out wVal))
            {
                minBoxWidth = wVal;
            }

            if (TryGetIntValue(config, "MinBoxHeight", out var hVal) ||
                TryGetIntValue(config, "minBoxHeight", out hVal) ||
                TryGetIntValue(config, "min_box_height", out hVal))
            {
                minBoxHeight = hVal;
            }

            if (config.TryGetValue("YoloDebugMode", out var dVal) ||
                config.TryGetValue("yoloDebugMode", out dVal) ||
                config.TryGetValue("yolo_debug_mode", out dVal))
            {
                if (dVal is bool b) yoloDebugMode = b;
                else if (bool.TryParse(dVal.ToString(), out var parsed)) yoloDebugMode = parsed;
            }
        }

        for (int i = 0; i < 8400; i++)
        {
            float maxScore = 0f;
            int classId = -1;

            for (int c = 0; c < 80; c++)
            {
                float score = outputTensor[0, 4 + c, i];
                if (score > maxScore)
                {
                    maxScore = score;
                    classId = c;
                }
            }

            if (classId >= 0 && classId < CocoClasses.Length)
            {
                var cocoLabel = CocoClasses[classId];
                float thresholdForClass = cocoLabel == "person" ? 0.35f : confidenceThreshold;

                if (maxScore >= thresholdForClass)
                {
                    if (printedCount < 100)
                    {
                        Console.WriteLine($"ClassId: {classId}");
                        Console.WriteLine($"ClassName: {cocoLabel}");
                        Console.WriteLine($"Confidence: {maxScore}");
                        printedCount++;
                    }

                    // Phase 3 — Bounding Box Coordinates (cx, cy, w, h)
                    float cx = outputTensor[0, 0, i];
                    float cy = outputTensor[0, 1, i];
                    float w = outputTensor[0, 2, i];
                    float h = outputTensor[0, 3, i];

                    // Phase 6 — Letterbox Bounding Box Conversion
                    float x1_640 = cx - w / 2.0f;
                    float y1_640 = cy - h / 2.0f;
                    float x2_640 = cx + w / 2.0f;
                    float y2_640 = cy + h / 2.0f;

                    // Reverse padding
                    float x1_scaled = x1_640 - padX;
                    float y1_scaled = y1_640 - padY;
                    float x2_scaled = x2_640 - padX;
                    float y2_scaled = y2_640 - padY;

                    // Reverse scaling
                    float x1_orig = x1_scaled / scale;
                    float y1_orig = y1_scaled / scale;
                    float x2_orig = x2_scaled / scale;
                    float y2_orig = y2_scaled / scale;

                    // Clamp to original image bounds
                    int x = Math.Clamp((int)Math.Round(x1_orig), 0, originalWidth);
                    int y = Math.Clamp((int)Math.Round(y1_orig), 0, originalHeight);
                    int x2 = Math.Clamp((int)Math.Round(x2_orig), 0, originalWidth);
                    int y2 = Math.Clamp((int)Math.Round(y2_orig), 0, originalHeight);

                    int width = Math.Max(0, x2 - x);
                    int height = Math.Max(0, y2 - y);

                    // Task 4: Filter Small False Positives
                    if (width < minBoxWidth || height < minBoxHeight)
                    {
                        continue;
                    }

                    // Task 1: Bounding Box Coordinate Scaling Logs
                    Console.WriteLine($"Original Size: {originalWidth}x{originalHeight}");
                    Console.WriteLine($"Scaled Box: x={x}, y={y}, w={width}, h={height}");

                    // Phase 7 — AnnotationResult Creation
                    var annotation = new AnnotationResult
                    {
                        Id = Guid.NewGuid(),
                        Label = cocoLabel,
                        Confidence = maxScore,
                        BoundingBox = new BoundingBox
                        {
                            X = x,
                            Y = y,
                            Width = width,
                            Height = height
                        },
                        AnnotationType = "bbox",
                        CreatedAt = DateTime.UtcNow
                    };

                    rawAnnotations.Add(annotation);
                }
            }
        }

        // Task 1: Log candidate count
        Console.WriteLine($"Candidate count: {rawAnnotations.Count}");

        // Task 1: Log details for the first 20 detections
        int logLimit = Math.Min(20, rawAnnotations.Count);
        for (int k = 0; k < logLimit; k++)
        {
            var ann = rawAnnotations[k];
            var classId = Array.IndexOf(CocoClasses, ann.Label);
            Console.WriteLine($"Detection {k}: Class id={classId}, Confidence={ann.Confidence:F4}, Box=[x={ann.BoundingBox.X}, y={ann.BoundingBox.Y}, w={ann.BoundingBox.Width}, h={ann.BoundingBox.Height}]");
        }

        // Task 6 / Task 3 / Task 4 Debug Log: all raw detections
        if (yoloDebugMode)
        {
            Console.WriteLine("[DEBUG] All Person Detections Before NMS:");
            foreach (var ann in rawAnnotations.Where(a => a.Label == "person"))
            {
                Console.WriteLine($"  - Person candidate: confidence={ann.Confidence:F4}, x={ann.BoundingBox.X}, y={ann.BoundingBox.Y}, w={ann.BoundingBox.Width}, h={ann.BoundingBox.Height}");
            }

            Console.WriteLine("[DEBUG] All Detections Before NMS:");
            foreach (var ann in rawAnnotations)
            {
                Console.WriteLine($"  - Candidate: label={ann.Label}, confidence={ann.Confidence:F4}, x={ann.BoundingBox.X}, y={ann.BoundingBox.Y}, w={ann.BoundingBox.Width}, h={ann.BoundingBox.Height}");
            }
        }

        // Phase 8 — NMS (Done BEFORE Ontology Filter to preserve proper spatial suppression)
        var nmsAnnotations = ApplyNMS(rawAnnotations, iouThreshold);

        if (yoloDebugMode)
        {
            Console.WriteLine("[DEBUG] All Detections After NMS:");
            foreach (var ann in nmsAnnotations)
            {
                Console.WriteLine($"  - Survived: label={ann.Label}, confidence={ann.Confidence:F4}, x={ann.BoundingBox.X}, y={ann.BoundingBox.Y}, w={ann.BoundingBox.Width}, h={ann.BoundingBox.Height}");
            }
        }

        // Phase 5 & 9 — Ontology Filter and Matching to User Labels
        var finalAnnotations = new List<AnnotationResult>();
        foreach (var detection in nmsAnnotations)
        {
            var cocoLabel = detection.Label;
            var matchedProjectLabel = FindMatchingProjectLabel(labels, cocoLabel);

            if (matchedProjectLabel != null)
            {
                detection.Label = matchedProjectLabel; // Map to the exact project label (casing/whitespace)
                Console.WriteLine("[ONTOLOGY]");
                Console.WriteLine($"Accepted detection: {matchedProjectLabel}");
                Console.WriteLine("[YOLO]");
                Console.WriteLine($"Detected: {detection.Label}");
                finalAnnotations.Add(detection);
            }
            else
            {
                Console.WriteLine("[ONTOLOGY]");
                Console.WriteLine($"Rejected detection: {cocoLabel}");
            }
        }

        Console.WriteLine($"[YOLOv8 ONNX] Returning {finalAnnotations.Count} detection(s)");
        return finalAnnotations;
    }

    private string? FindMatchingProjectLabel(List<string> projectLabels, string cocoLabel)
    {
        if (projectLabels == null || projectLabels.Count == 0)
            return null;

        var cleanCoco = cocoLabel.Trim().ToLower();

        foreach (var pl in projectLabels)
        {
            if (string.IsNullOrWhiteSpace(pl)) continue;

            var cleanProjectLabel = pl.Trim().ToLower();

            // 1. Direct match
            if (cleanProjectLabel == cleanCoco)
            {
                return pl;
            }

            // 2. Alias match
            if (IsAliasMatch(cleanCoco, cleanProjectLabel))
            {
                return pl;
            }
        }

        return null;
    }

    private bool IsAliasMatch(string cocoLabel, string projectLabel)
    {
        if (cocoLabel == "person")
        {
            return projectLabel == "human" || projectLabel == "man" || projectLabel == "woman" || projectLabel == "child" || projectLabel == "people";
        }
        if (cocoLabel == "car")
        {
            return projectLabel == "automobile" || projectLabel == "vehicle";
        }
        if (cocoLabel == "bus" || cocoLabel == "truck" || cocoLabel == "motorcycle" || cocoLabel == "bicycle")
        {
            return projectLabel == "vehicle";
        }
        if (cocoLabel == "dog")
        {
            return projectLabel == "canine" || projectLabel == "puppy";
        }
        if (cocoLabel == "cow")
        {
            return projectLabel == "cattle" || projectLabel == "bull" || projectLabel == "livestock";
        }

        return false;
    }

    private List<AnnotationResult> ApplyNMS(List<AnnotationResult> rawDetections, float iouThreshold)
    {
        Console.WriteLine($"Before NMS: {rawDetections.Count}");

        var filtered = new List<AnnotationResult>();

        // Group by label so NMS is class-wise (standard detection behavior)
        var grouped = rawDetections.GroupBy(a => a.Label);

        foreach (var group in grouped)
        {
            var sorted = group.OrderByDescending(a => a.Confidence).ToList();
            while (sorted.Count > 0)
            {
                var best = sorted[0];
                filtered.Add(best);
                sorted.RemoveAt(0);

                // Remove any box that overlaps too much with 'best'
                sorted.RemoveAll(item => CalculateIoU(best.BoundingBox, item.BoundingBox) >= iouThreshold);
            }
        }

        Console.WriteLine($"After NMS: {filtered.Count}");

        return filtered;
    }

    private float CalculateIoU(BoundingBox a, BoundingBox b)
    {
        var x1 = Math.Max(a.X, b.X);
        var y1 = Math.Max(a.Y, b.Y);
        var x2 = Math.Min(a.X + a.Width, b.X + b.Width);
        var y2 = Math.Min(a.Y + a.Height, b.Y + b.Height);

        var intersectionWidth = Math.Max(0, x2 - x1);
        var intersectionHeight = Math.Max(0, y2 - y1);
        var intersectionArea = intersectionWidth * intersectionHeight;

        var areaA = a.Width * a.Height;
        var areaB = b.Width * b.Height;
        var unionArea = areaA + areaB - intersectionArea;

        if (unionArea <= 0) return 0;
        return (float)intersectionArea / unionArea;
    }

    private static bool TryGetFloatValue(Dictionary<string, object> dict, string key, out float value)
    {
        value = 0f;
        if (!dict.TryGetValue(key, out var raw) || raw == null)
            return false;

        if (raw is float f) { value = f; return true; }
        if (raw is double d) { value = (float)d; return true; }
        if (raw is int i) { value = i; return true; }
        if (raw is JsonElement elem)
        {
            if (elem.ValueKind == JsonValueKind.Number && elem.TryGetSingle(out var val))
            {
                value = val;
                return true;
            }
        }

        var str = raw.ToString();
        if (float.TryParse(str, out var parsed))
        {
            value = parsed;
            return true;
        }

        return false;
    }

    private static bool TryGetIntValue(Dictionary<string, object> dict, string key, out int value)
    {
        value = 0;
        if (!dict.TryGetValue(key, out var raw) || raw == null)
            return false;

        if (raw is int i) { value = i; return true; }
        if (raw is double d) { value = (int)d; return true; }
        if (raw is float f) { value = (int)f; return true; }
        if (raw is JsonElement elem)
        {
            if (elem.ValueKind == JsonValueKind.Number && elem.TryGetInt32(out var val))
            {
                value = val;
                return true;
            }
        }

        var str = raw.ToString();
        if (int.TryParse(str, out var parsed))
        {
            value = parsed;
            return true;
        }

        return false;
    }
}