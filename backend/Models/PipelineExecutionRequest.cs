namespace verilabelbackend.Models;

public class PipelineExecutionRequest
{
    public string PipelineId { get; set; } = string.Empty;

    public string ProjectId { get; set; } = string.Empty;

    public string? TaskId { get; set; }

    public string? RunId { get; set; }

    public List<Guid> FileIds { get; set; } = new();

    // Legacy single file support
    public Guid? FileId { get; set; }

    public List<PipelineNodeDto> Nodes { get; set; } = new();

    public List<object> Edges { get; set; } = new();
}