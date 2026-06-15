using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using verilabelbackend.Models;

namespace verilabelbackend.Services.AI;

public sealed class OpenVocabularyDetectionService : IDetectionService
{
    private readonly YoloV8OnnxService _yolo;
    private readonly GroundingDinoOnnxService _groundingDino;

    public OpenVocabularyDetectionService(
        YoloV8OnnxService yolo,
        GroundingDinoOnnxService groundingDino)
    {
        _yolo = yolo;
        _groundingDino = groundingDino;
    }

    public async Task<List<AnnotationResult>> DetectAsync(
    Stream imageStream,
    List<string> projectLabels,
    Dictionary<string, object>? config = null)
    {
        var yoloLabels = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
        "person",
        "car",
        "dog",
        "cow",
        "bus",
        "truck",
        "vehicle"
    };

    bool useYolo = projectLabels.All(label =>
        yoloLabels.Contains(label));

    if (useYolo)
    {
        Console.WriteLine("[Resolver] Routing to YOLO");

        var yoloResults = await _yolo.DetectAsync(
            imageStream,
            projectLabels,
            config);

        foreach (var det in yoloResults)
        {
            det.ModelUsed = "yolov8";
        }

        return yoloResults;
    }

    Console.WriteLine("[Resolver] Routing to GroundingDINO");

    float confidenceThreshold = 0.50f;
    float iouThreshold = 0.45f;
    if (config != null)
    {
        if (config.TryGetValue("ConfidenceThreshold", out var cVal) && cVal is float fConf)
            confidenceThreshold = fConf;
        else if (config.TryGetValue("ConfidenceThreshold", out var dVal) && dVal is double dConf)
            confidenceThreshold = (float)dConf;

        if (config.TryGetValue("IoUThreshold", out var iVal) && iVal is float fIoU)
            iouThreshold = fIoU;
        else if (config.TryGetValue("IoUThreshold", out var diVal) && diVal is double dIoU)
            iouThreshold = (float)dIoU;
    }

    string tempFile =
        Path.Combine(
            Path.GetTempPath(),
            $"{Guid.NewGuid()}.jpg");

    using (var fileStream = File.Create(tempFile))
    {
        imageStream.Position = 0;
        await imageStream.CopyToAsync(fileStream);
    }

    var annotations =
        new List<AnnotationResult>();

    foreach (var label in projectLabels)
    {
        Console.WriteLine(
            $"[GroundingDINO] Detecting label: {label}");

        var detections =
            await _groundingDino.DetectAsync(
                tempFile,
                label,
                confidenceThreshold,
                iouThreshold);

        foreach (var detection in detections)
        {
            annotations.Add(
                new AnnotationResult
                {
                    Label = label,

                    Confidence = detection.Confidence,

                    BoundingBox = new BoundingBox
                    {
                        X = (int)detection.CenterX,
                        Y = (int)detection.CenterY,
                        Width = (int)detection.Width,
                        Height = (int)detection.Height
                    },
                    ModelUsed = "grounding_dino"
                });
        }
    }

    annotations = ApplyCrossLabelNms(annotations, 0.90f);

    File.Delete(tempFile);

    Console.WriteLine($"Final Annotation Count = {annotations.Count}");
    foreach(var a in annotations){
        Console.WriteLine(
            $"{a.Label} " +
            $"[{a.BoundingBox.X}," +
            $"{a.BoundingBox.Y}," +
            $"{a.BoundingBox.Width}," +
            $"{a.BoundingBox.Height}]");
    }

    return annotations;
    }

    private static List<AnnotationResult> ApplyCrossLabelNms(
        List<AnnotationResult> detections,
        float iouThreshold)
    {
        var sorted = detections
            .OrderByDescending(x => x.Confidence)
            .ToList();

        var results = new List<AnnotationResult>();

        while (sorted.Count > 0)
        {
            var best = sorted[0];
            results.Add(best);
            sorted.RemoveAt(0);

            sorted = sorted
                .Where(x => CalculateIoU(best.BoundingBox, x.BoundingBox) < iouThreshold)
                .ToList();
        }

        return results;
    }

    private static float CalculateIoU(BoundingBox a, BoundingBox b)
    {
        float ax1 = a.X;
        float ay1 = a.Y;
        float ax2 = a.X + a.Width;
        float ay2 = a.Y + a.Height;

        float bx1 = b.X;
        float by1 = b.Y;
        float bx2 = b.X + b.Width;
        float by2 = b.Y + b.Height;

        float interX1 = Math.Max(ax1, bx1);
        float interY1 = Math.Max(ay1, by1);
        float interX2 = Math.Min(ax2, bx2);
        float interY2 = Math.Min(ay2, by2);

        float interWidth = Math.Max(0, interX2 - interX1);
        float interHeight = Math.Max(0, interY2 - interY1);

        float intersection = interWidth * interHeight;

        float areaA = a.Width * a.Height;
        float areaB = b.Width * b.Height;

        float union = areaA + areaB - intersection;

        if (union <= 0)
            return 0;

        return intersection / union;
    }
}