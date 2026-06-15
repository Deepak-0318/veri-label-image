namespace verilabelbackend.Models;

public class GroundingDinoDetection
{
    public float Confidence { get; set; }

    public int TokenIndex { get; set; }

    public float CenterX { get; set; }

    public float CenterY { get; set; }

    public float Width { get; set; }

    public float Height { get; set; }
}