using verilabelbackend.Models;

namespace verilabelbackend.Services.AI;

public interface IDetectionService
{
    Task<List<AnnotationResult>> DetectAsync(Stream imageStream);
}