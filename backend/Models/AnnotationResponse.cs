namespace verilabelbackend.Models;

public class AnnotationResponse
{
    public Guid PipelineId { get; set; }

    public List<AnnotationResult> Annotations { get; set; } = new();
}