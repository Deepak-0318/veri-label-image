namespace verilabelbackend.Models
{

    public sealed class CreateExportRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Format { get; set; }
        public int FileCount { get; set; }
        public int AnnotationCount { get; set; }
        public string? DownloadUrl { get; set; }
    }

    public sealed class CreateScriptRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string? OutputFormat { get; set; }
    }

    public sealed class UpdateScriptRequest
    {
        public string Code { get; set; } = string.Empty;
        public string? OutputFormat { get; set; }
    }

    public sealed class CreateActivityRequest
    {
        public string EventType { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public Guid? EntityId { get; set; }
        public Guid? ProjectId { get; set; }
        public string Description { get; set; } = string.Empty;
        public string? Metadata { get; set; }
    }
}
