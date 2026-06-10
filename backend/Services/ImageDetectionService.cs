using verilabelbackend.Models;
using verilabelbackend.Services.AI;

namespace verilabelbackend.Services;

public class ImageDetectionService
{
    private readonly ImageFileResolverService _resolver;
    private readonly IDetectionService _detector;

    public ImageDetectionService(
        ImageFileResolverService resolver,
        IDetectionService detector)
    {
        _resolver = resolver;
        _detector = detector;
    }

    public async Task<List<AnnotationResult>> DetectAsync(
        Guid fileId,
        string jwt)
    {
        Console.WriteLine("========== IMAGE DETECTOR V2 ==========");
        Console.WriteLine($"FILE={fileId}");

        Console.WriteLine("BEFORE RESOLVER");

        using var stream =
            await _resolver.GetImageStreamAsync(jwt, fileId);

        using var memory = new MemoryStream();

        await stream.CopyToAsync(memory);

        Console.WriteLine(
            $"[ImageDetection] Downloaded {memory.Length} bytes");

        Console.WriteLine("BEFORE DETECTOR");
        Console.WriteLine(_detector.GetType().Name);
        Console.WriteLine("AFTER DETECTOR");

        var imageBytes = memory.ToArray();

        var detections =
            await _detector.DetectAsync(
                new MemoryStream(imageBytes));

        Console.WriteLine(
            $"[ImageDetection] GroundingDINO returned {detections.Count} detections");

        Console.WriteLine("AFTER RESOLVER");

        return detections;
    }
}