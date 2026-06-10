namespace verilabelbackend.Models;

public class AnnotationResult
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Label { get; set; } = string.Empty;

    public double Confidence { get; set; }

    public BoundingBox BoundingBox { get; set; } = new();

    public string AnnotationType { get; set; } = "bbox";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}