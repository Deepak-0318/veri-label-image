namespace verilabelbackend.Models
{

    public sealed class CreateProjectRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? DataType { get; set; }
        public string? AnnotationType { get; set; }
        public string? Guidelines { get; set; }
    }

    public sealed class UpdateProjectRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? DataType { get; set; }
        public string? AnnotationType { get; set; }
        public string? Guidelines { get; set; }
    }
}
