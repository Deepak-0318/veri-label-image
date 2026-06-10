

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace verilabelbackend.Models.Supabase


{
   

    [Table("pipelines")]
    public class Pipeline
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("project_id")]
        public Guid? ProjectId { get; set; }

        [Column("created_by")]
        public Guid CreatedBy { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        /// <summary>auto_tagging | pre_label | post_process</summary>
        [Column("pipeline_type")]
        public string PipelineType { get; set; } = "auto_tagging";

        [Column(TypeName = "jsonb")]
        public string Config { get; set; } = "[]";

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(ProjectId))]
        public Project? Project { get; set; }

        public ICollection<PipelineRun> Runs { get; set; } = new List<PipelineRun>();
    }

    [Table("pipeline_runs")]
    public class PipelineRun
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("pipeline_id")]
        public Guid PipelineId { get; set; }

        [Column("project_id")]
        public Guid? ProjectId { get; set; }

        [Column("started_by")]
        public Guid StartedBy { get; set; }

        /// <summary>queued | running | completed | failed</summary>
        public string Status { get; set; } = "queued";

        public int Progress { get; set; } = 0;

        [Column("total_items")]
        public int TotalItems { get; set; } = 0;

        [Column("completed_items")]
        public int CompletedItems { get; set; } = 0;

        [Column("error_message")]
        public string? ErrorMessage { get; set; }

        [Column("started_at")]
        public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("completed_at")]
        public DateTimeOffset? CompletedAt { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(PipelineId))]
        public Pipeline? Pipeline { get; set; }

        [ForeignKey(nameof(ProjectId))]
        public Project? Project { get; set; }
    }

    [Table("pipeline_block_templates")]
    public class PipelineBlockTemplate
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public string Name { get; set; } = string.Empty;

        public string Category { get; set; } = "custom";

        [Column("block_type")]
        public string BlockType { get; set; } = "custom";

        public string? Description { get; set; }

        public string Icon { get; set; } = "Zap";

        [Column("default_config", TypeName = "jsonb")]
        public string DefaultConfig { get; set; } = "{}";

        public string? Script { get; set; }

        /// <summary>python | javascript</summary>
        public string Language { get; set; } = "python";

        [Column("is_system")]
        public bool IsSystem { get; set; } = false;

        [Column("created_by")]
        public Guid? CreatedBy { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
