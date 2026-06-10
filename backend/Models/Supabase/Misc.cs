using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace verilabelbackend.Models.Supabase
{
  

    [Table("exports")]
    public class ExportEntity
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string Format { get; set; } = "json";

        public string Status { get; set; } = "completed";

        [Column("file_count")]
        public int FileCount { get; set; } = 0;

        [Column("annotation_count")]
        public int AnnotationCount { get; set; } = 0;

        [Column("download_url")]
        public string? DownloadUrl { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    }

    [Table("activity_events")]
    public class ActivityEvent
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("event_type")]
        [Required]
        public string EventType { get; set; } = string.Empty;

        [Column("entity_type")]
        [Required]
        public string EntityType { get; set; } = string.Empty;

        [Column("entity_id")]
        public Guid? EntityId { get; set; }

        [Column("project_id")]
        public Guid? ProjectId { get; set; }

        [Required]
        public string Description { get; set; } = string.Empty;

        [Column(TypeName = "jsonb")]
        public string Metadata { get; set; } = "{}";

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    }

    [Table("transform_scripts")]
    public class TransformScript
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string Code { get; set; } = string.Empty;

        [Column("output_format")]
        public string OutputFormat { get; set; } = "json";

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
