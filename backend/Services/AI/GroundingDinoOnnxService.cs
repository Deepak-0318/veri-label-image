using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using verilabelbackend.Models;

namespace verilabelbackend.Services.AI;

public sealed class GroundingDinoOnnxService
{
    private readonly InferenceSession _session;

    public GroundingDinoOnnxService(
        IWebHostEnvironment env,
        IConfiguration config)
    {
        var modelPath = Path.Combine(
            env.ContentRootPath,
            "Models",
            "ONNX",
            "groundingdino_test.onnx"
        );

        Console.WriteLine($"[GroundingDINO] Loading model: {modelPath}");
        _session = new InferenceSession(modelPath);
        Console.WriteLine("[GroundingDINO] Model loaded");
    }

    
    public async Task<List<GroundingDinoDetection>> DetectAsync(
        string imagePath,
        string prompt,
        float confidenceThreshold = 0.50f,
        float iouThreshold = 0.45f)
    {
        Console.WriteLine($"[GroundingDINO] Prompt={prompt}");

        if (!File.Exists(imagePath))
        {
            Console.WriteLine($"[GroundingDINO] Error: Image file not found at {imagePath}");
            return new List<GroundingDinoDetection>();
        }

        Console.WriteLine("========== GROUNDING DINO INPUTS ==========");

        foreach (var input in _session.InputMetadata)
        {
            Console.WriteLine($"{input.Key} | {input.Value.ElementType} | {string.Join(",", input.Value.Dimensions)}");
        }

        Console.WriteLine("========== GROUNDING DINO OUTPUTS ==========");

        foreach (var output in _session.OutputMetadata)
        {
            Console.WriteLine(
                $"{output.Key} | {output.Value.ElementType} | {string.Join(",", output.Value.Dimensions)}"
            );
        }

        // Image Preprocessing (Task 3.1)
        using var image = await Image.LoadAsync<Rgb24>(imagePath);
        
        int originalWidth = image.Width;
        int originalHeight = image.Height;

        int targetWidth = 1200;
        int targetHeight = 800;
        int imageWidth = originalWidth;
        int imageHeight = originalHeight;

        // Resize image to GroundingDINO standard shape [1, 3, 800, 1200]
        image.Mutate(x => x.Resize(targetWidth, targetHeight));

        var inputTensor = new DenseTensor<float>(new[] { 1, 3, targetHeight, targetWidth });

        // ImageNet Normalization statistics
        float[] mean = { 0.485f, 0.456f, 0.406f };
        float[] std = { 0.229f, 0.224f, 0.225f };

        image.ProcessPixelRows(accessor =>
        {
            for (int y = 0; y < targetHeight; y++)
            {
                var row = accessor.GetRowSpan(y);
                for (int x = 0; x < targetWidth; x++)
                {
                    var pixel = row[x];
                    inputTensor[0, 0, y, x] = ((pixel.R / 255.0f) - mean[0]) / std[0];
                    inputTensor[0, 1, y, x] = ((pixel.G / 255.0f) - mean[1]) / std[1];
                    inputTensor[0, 2, y, x] = ((pixel.B / 255.0f) - mean[2]) / std[2];
                }
            }
        });

        // Prepare ONNX Inputs
        var inputs = new List<NamedOnnxValue>
        {
            NamedOnnxValue.CreateFromTensor("image", inputTensor)
        };

        // Run ONNX Inference
        Console.WriteLine("[GroundingDINO] Running inference...");
using var results = _session.Run(inputs);

var logitsTensor = results
    .First(x => x.Name == "pred_logits")
    .AsTensor<float>();

var boxesTensor = results
    .First(x => x.Name == "pred_boxes")
    .AsTensor<float>();

Console.WriteLine(
    $"[GroundingDINO] Logits Shape = {string.Join(",", logitsTensor.Dimensions.ToArray())}");

Console.WriteLine(
    $"[GroundingDINO] Boxes Shape = {string.Join(",", boxesTensor.Dimensions.ToArray())}");

var detections = new List<GroundingDinoDetection>();

int numQueries = logitsTensor.Dimensions[1];
int numTokens = logitsTensor.Dimensions[2];

Console.WriteLine($"[GroundingDINO] Queries = {numQueries}");
Console.WriteLine($"[GroundingDINO] Tokens = {numTokens}");

for (int query = 0; query < numQueries; query++)
{
    float bestScore = float.MinValue;
    int bestToken = -1;

    for (int token = 0; token < numTokens; token++)
    {
        float logit = logitsTensor[0, query, token];
        float score = Sigmoid(logit);

        if (score > bestScore)
        {
            bestScore = score;
            bestToken = token;
        }
    }

        if (bestScore < confidenceThreshold)
            continue;

        float cx = boxesTensor[0, query, 0];
        float cy = boxesTensor[0, query, 1];
        float w = boxesTensor[0, query, 2];
        float h = boxesTensor[0, query, 3];

        float boxWidth = w * imageWidth;
        float boxHeight = h * imageHeight;

        float x = (cx * imageWidth) - (boxWidth / 2f);
        float y = (cy * imageHeight) - (boxHeight / 2f);

        // Clamp to original image bounds
        float x2 = x + boxWidth;
        float y2 = y + boxHeight;

        x = Math.Clamp(x, 0f, (float)imageWidth);
        y = Math.Clamp(y, 0f, (float)imageHeight);
        x2 = Math.Clamp(x2, 0f, (float)imageWidth);
        y2 = Math.Clamp(y2, 0f, (float)imageHeight);

        float finalWidth = Math.Max(0f, x2 - x);
        float finalHeight = Math.Max(0f, y2 - y);

        if (finalWidth <= 0 || finalHeight <= 0)
            continue;

        Console.WriteLine($"ORIGINAL={originalWidth}x{originalHeight} " + $"RESIZED={targetWidth}x{targetHeight}");
        Console.WriteLine( $"cx={cx:F4} cy={cy:F4} w={w:F4} h={h:F4}");
        
        detections.Add(new GroundingDinoDetection
        {
            Confidence = bestScore,
            TokenIndex = bestToken,

            CenterX = x,
            CenterY = y,
            Width = finalWidth,
            Height = finalHeight
        });
}

Console.WriteLine(
    $"[GroundingDINO] Decoded Detections = {detections.Count}");

foreach (var detection in detections.Take(10))
{
    Console.WriteLine(
        $"Confidence={(detection.Confidence * 100):F1}% " +
        $"Token={detection.TokenIndex} " +
        $"Box=[x={detection.CenterX:F0},y={detection.CenterY:F0}," +
        $"w={detection.Width:F0},h={detection.Height:F0}]");
}

    detections = ApplyNms(detections, iouThreshold);
    Console.WriteLine($"[GroundingDINO] After NMS = {detections.Count}");
    return detections;
    }

private static float Sigmoid(float x)
{
    return 1f / (1f + MathF.Exp(-x));
}

private static List<GroundingDinoDetection> ApplyNms(
    List<GroundingDinoDetection> detections,
    float iouThreshold)
{
    var sorted = detections
        .OrderByDescending(x => x.Confidence)
        .ToList();

    var results = new List<GroundingDinoDetection>();

    while (sorted.Count > 0)
    {
        var best = sorted[0];
        results.Add(best);

        sorted.RemoveAt(0);

        sorted = sorted
            .Where(x => CalculateIoU(best, x) < iouThreshold)
            .ToList();
    }

    return results;
}

private static float CalculateIoU(
    GroundingDinoDetection a,
    GroundingDinoDetection b)
{
    float ax1 = a.CenterX;
    float ay1 = a.CenterY;
    float ax2 = a.CenterX + a.Width;
    float ay2 = a.CenterY + a.Height;

    float bx1 = b.CenterX;
    float by1 = b.CenterY;
    float bx2 = b.CenterX + b.Width;
    float by2 = b.CenterY + b.Height;

    float interX1 = MathF.Max(ax1, bx1);
    float interY1 = MathF.Max(ay1, by1);
    float interX2 = MathF.Min(ax2, bx2);
    float interY2 = MathF.Min(ay2, by2);

    float interWidth = MathF.Max(0, interX2 - interX1);
    float interHeight = MathF.Max(0, interY2 - interY1);

    float intersection = interWidth * interHeight;

    float areaA = a.Width * a.Height;
    float areaB = b.Width * b.Height;

    float union = areaA + areaB - intersection;

    if (union <= 0)
        return 0;

    return intersection / union;
}

}