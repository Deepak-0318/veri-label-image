namespace verilabelbackend.Models;

public class YoloDetectionOptions
{
    public float ConfidenceThreshold { get; set; } = 0.50f;
    public float IoUThreshold { get; set; } = 0.35f;
    public int MinBoxWidth { get; set; } = 40;
    public int MinBoxHeight { get; set; } = 40;
    public bool YoloDebugMode { get; set; } = true;
}
