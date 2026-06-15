using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using verilabelbackend.Models;

namespace verilabelbackend.Services.AI;

public interface IDetectionService
{
    Task<List<AnnotationResult>> DetectAsync(
        Stream imageStream,
        List<string> labels,
        Dictionary<string, object>? config = null);
}