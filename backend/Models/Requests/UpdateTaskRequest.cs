namespace verilabelbackend.Models.Requests;

public sealed class UpdateTaskRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
    public Guid? AssignedTo { get; set; }
    public Guid? QaAssignedTo { get; set; }
}