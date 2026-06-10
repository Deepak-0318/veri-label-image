namespace verilabelbackend.Models;

public class DetectionResult
{
    public string Label { get; set; } = string.Empty;

    public double Confidence { get; set; }

    public BoundingBox BoundingBox { get; set; } = new();
}