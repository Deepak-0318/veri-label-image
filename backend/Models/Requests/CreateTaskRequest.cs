namespace verilabelbackend.Models.Requests;

public sealed class CreateTaskRequest
{
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public Guid ProjectId { get; set; }

    public Guid? AssignedTo { get; set; }

    public Guid? QaAssignedTo { get; set; }

    public List<Guid> FileIds { get; set; } = new();
}