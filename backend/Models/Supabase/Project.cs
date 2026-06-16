using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Data;

namespace verilabelbackend.Models.Supabase
{



    [Table("projects")]
    public class Project
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Column("data_type")]
        public string DataType { get; set; } = "text";

        [Column("annotation_type")]
        public string AnnotationType { get; set; } = "classification";

        public string? Guidelines { get; set; }

        [Column("is_archived")]
        public bool IsArchived { get; set; } = false;

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        // Navigation
        public ICollection<FileEntity> Files { get; set; } = new List<FileEntity>();
        public ICollection<TaskEntity> Tasks { get; set; } = new List<TaskEntity>();
        public ICollection<ProjectObjective> Objectives { get; set; } = new List<ProjectObjective>();
        public ICollection<Pipeline> Pipelines { get; set; } = new List<Pipeline>();
        public ICollection<Dataset> Datasets { get; set; } = new List<Dataset>();
        public ICollection<ProjectLabelType> LabelTypes { get; set; } = new List<ProjectLabelType>();
        public ICollection<ProjectGroupType> GroupTypes { get; set; } = new List<ProjectGroupType>();
        public ICollection<ProjectFlag> Flags { get; set; } = new List<ProjectFlag>();
    }

    [Table("project_objectives")]
    public class ProjectObjective
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("project_id")]
        public Guid ProjectId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        /// <summary>classification | detection | segmentation</summary>
        [Column("objective_type")]
        public string ObjectiveType { get; set; } = "classification";

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(ProjectId))]
        public Project? Project { get; set; }
    }

    [Table("project_label_types")]
    public class ProjectLabelType
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("project_id")]
        public Guid ProjectId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Column("created_by")]
        public Guid CreatedBy { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(ProjectId))]
        public Project? Project { get; set; }

        public ICollection<ProjectLabel> Labels { get; set; } = new List<ProjectLabel>();
    }

    [Table("project_labels")]
    public class ProjectLabel
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("project_id")]
        public Guid ProjectId { get; set; }

        [Column("label_type_id")]
        public Guid LabelTypeId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string Color { get; set; } = "blue";

        [Column("created_by")]
        public Guid CreatedBy { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(ProjectId))]
        public Project? Project { get; set; }

        [ForeignKey(nameof(LabelTypeId))]
        public ProjectLabelType? LabelType { get; set; }
    }

    [Table("project_group_types")]
    public class ProjectGroupType
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("project_id")]
        public Guid ProjectId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        [Column("is_default")]
        public bool IsDefault { get; set; } = false;

        [Column("created_by")]
        public Guid CreatedBy { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(ProjectId))]
        public Project? Project { get; set; }
    }

    [Table("project_flags")]
    public class ProjectFlag
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("project_id")]
        public Guid ProjectId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        [Column("created_by")]
        public Guid CreatedBy { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(ProjectId))]
        public Project? Project { get; set; }

        public ICollection<AnnotationFlag> AnnotationFlags { get; set; } = new List<AnnotationFlag>();
    }
}