namespace verilabelbackend.Models;

public class PipelineNodeDto
{
    public string Id { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public Dictionary<string, object> Config { get; set; } = new();

    public int MaxDetections { get; set; } = 10;
}