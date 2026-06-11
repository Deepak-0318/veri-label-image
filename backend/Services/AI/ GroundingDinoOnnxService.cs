using System.Linq;
using System.IO;
using Microsoft.ML.OnnxRuntime;
using verilabelbackend.Models;
using Microsoft.ML.OnnxRuntime.Tensors;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using Microsoft.Extensions.Configuration;

namespace verilabelbackend.Services.AI;

public sealed class GroundingDinoOnnxService : IDetectionService
{
    private readonly InferenceSession _session;
    private readonly float _confidenceThreshold;

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

        Console.WriteLine(
            $"[GroundingDINO ONNX] Loading model: {modelPath}"
        );

        _session = new InferenceSession(modelPath);

        Console.WriteLine(
            "[GroundingDINO ONNX] Model loaded successfully"
        );

        var thresholdStr = config["GroundingDINO:ConfidenceThreshold"];
        _confidenceThreshold = float.TryParse(thresholdStr, out var val) ? val : 0.3f;
        Console.WriteLine($"[GroundingDINO ONNX] Configured Confidence Threshold = {_confidenceThreshold}");

        Console.WriteLine("[GroundingDINO ONNX] Inputs:");

        Console.WriteLine("========== INPUTS ==========");
        foreach (var input in _session.InputMetadata)
        {
            Console.WriteLine(
                $"{input.Key} | " +
                $"{input.Value.ElementType} | " +
                $"{string.Join(",", input.Value.Dimensions)}"
            );
        }

        Console.WriteLine("\n========== OUTPUTS ==========");

        foreach (var output in _session.OutputMetadata)
        {
            Console.WriteLine(
                $"{output.Key} | " +
                $"{output.Value.ElementType} | " +
                $"{string.Join(",", output.Value.Dimensions)}"
            );
            
            if (output.Key == "pred_logits")
            {
                Console.WriteLine("EXPLANATION: Classification logits for 900 queries across 256 text tokens/classes (shape: [batch, queries, classes])");
            }
            else if (output.Key == "pred_boxes")
            {
                Console.WriteLine("EXPLANATION: Normalized bounding box coordinates [cx, cy, w, h] for 900 queries (shape: [batch, queries, 4])");
            }
        }
    }

    public async Task<List<AnnotationResult>> DetectAsync(
        Stream imageStream,
        List<string> labels)
    {
        Console.WriteLine(
            $"[GroundingDINO ONNX] Labels: {string.Join(", ", labels)}"
        );

        var uniqueLabels =
            labels
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct()
                .ToList();
        
        var prompt =
            string.Join(" . ", uniqueLabels);

        Console.WriteLine($"[GroundingDINO OONX ]Prompt = {prompt}");

        Console.WriteLine(
            "[GroundingDINO ONNX] DetectAsync CALLED"
        );

        imageStream.Position = 0;
        using var image = await Image.LoadAsync<Rgb24>(imageStream);
        Console.WriteLine($"IMAGE SIZE = {image.Width} x {image.Height}");

        var originalWidth = image.Width;
        var originalHeight = image.Height;

        var targetWidth = 1200;
        var targetHeight = 800;
        Console.WriteLine($"TARGET SIZE = {targetWidth} x {targetHeight}");

        image.Mutate(x =>
        {
            x.Resize(
                targetWidth,
                targetHeight
            );
        });

        Console.WriteLine($"RESIZED = {image.Width} x {image.Height}");
        
        var inputTensor =
            new DenseTensor<float>(
                new[] { 1, 3, targetHeight, targetWidth }
            );

        // Preprocessing & Normalization (Task 1)
        float[] mean = { 0.485f, 0.456f, 0.406f };
        float[] std = { 0.229f, 0.224f, 0.225f };

        image.ProcessPixelRows(accessor =>
        {
            for (int y = 0; y < targetHeight; y++)
            {
                Span<Rgb24> row = accessor.GetRowSpan(y);

                for (int x = 0; x < targetWidth; x++)
                {
                    var pixel = row[x];

                    inputTensor[0, 0, y, x] = ((pixel.R / 255.0f) - mean[0]) / std[0];
                    inputTensor[0, 1, y, x] = ((pixel.G / 255.0f) - mean[1]) / std[1];
                    inputTensor[0, 2, y, x] = ((pixel.B / 255.0f) - mean[2]) / std[2];
                }
            }
        });

        Console.WriteLine($"Tensor Shape = {string.Join(", ", inputTensor.Dimensions.ToArray())}");
        Console.WriteLine($"Pixel[0,0] RGB Normalized = " + $"{inputTensor[0,0,0,0]}, " + $"{inputTensor[0,1,0,0]}, " + $"{inputTensor[0,2,0,0]}");
        
        var inputs = 
            new List<NamedOnnxValue>
            {
                NamedOnnxValue.CreateFromTensor(
                    "image",
                    inputTensor
                )
            };

        using var results = _session.Run(inputs);

        // Task 2: Output Decoding
        var predLogitsResult = results.FirstOrDefault(r => r.Name == "pred_logits");
        var predBoxesResult = results.FirstOrDefault(r => r.Name == "pred_boxes");

        if (predLogitsResult == null || predBoxesResult == null)
        {
            Console.WriteLine("[GroundingDINO ONNX] Error: Model output tensors 'pred_logits' or 'pred_boxes' not found.");
            return new List<AnnotationResult>();
        }

        var logitsTensor = predLogitsResult.AsTensor<float>();
        var boxesTensor = predBoxesResult.AsTensor<float>();

        var numQueries = logitsTensor.Dimensions[1];
        var numClasses = logitsTensor.Dimensions[2];

        var annotations = new List<AnnotationResult>();
        AnnotationResult? bestAnnotation = null;
        float bestScore = 0;

        for (int i = 0; i < numQueries; i++)
        {
            var maxLogit = float.NegativeInfinity;
            var maxTokenIdx = -1;

            for (int c = 0; c < numClasses; c++)
            {
                var logit = logitsTensor[0, i, c];
                if (logit > maxLogit)
                {
                    maxLogit = logit;
                    maxTokenIdx = c;
                }
            }

            var score = 1.0f / (1.0f + MathF.Exp(-maxLogit));

            if (score >= _confidenceThreshold)
            {
                var cx = boxesTensor[0, i, 0];
                var cy = boxesTensor[0, i, 1];
                var w = boxesTensor[0, i, 2];
                var h = boxesTensor[0, i, 3];

                // Scale to original image coordinates
                var widthPixel = w * originalWidth;
                var heightPixel = h * originalHeight;
                var xMinPixel = (cx - (w / 2.0f)) * originalWidth;
                var yMinPixel = (cy - (h / 2.0f)) * originalHeight;

                // Clamp values to valid pixel coordinates within the image bounds
                var x = Math.Clamp((int)Math.Round(xMinPixel), 0, originalWidth);
                var y = Math.Clamp((int)Math.Round(yMinPixel), 0, originalHeight);
                var width = Math.Clamp((int)Math.Round(widthPixel), 0, originalWidth - x);
                var height = Math.Clamp((int)Math.Round(heightPixel), 0, originalHeight - y);

                var label = "AI Detection";

                Console.WriteLine(
                    $"[GroundingDINO ONNX] Query {i} detected: " +
                    $"Label={label}, " +
                    $"Token={maxTokenIdx}, " +
                    $"Score={score:F4}, " +
                    $"Box=[{x}, {y}, {width}, {height}]"
                );

                // Task 3: Save Annotations
                var annotation = new AnnotationResult
                {
                    Id = Guid.NewGuid(),
                    Label = label,
                    Confidence = score,
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

                if (score > bestScore)
                {
                    bestScore = score;
                    bestAnnotation = annotation;
                }
            }
        }

        if (bestAnnotation != null)
        {
            annotations.Add(bestAnnotation);
        }

        Console.WriteLine(
            $"[GroundingDINO ONNX] Returning {annotations.Count} best detection(s)"
        );

        return annotations;
    }
}