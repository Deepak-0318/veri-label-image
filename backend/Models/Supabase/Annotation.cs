using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace verilabelbackend.Models.Supabase
{
 
    [Table("annotations")]
    public class Annotation
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("file_id")]
        public Guid FileId { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("project_id")]
        public Guid? ProjectId { get; set; }

        [Column("label_type_id")]
        public Guid? LabelTypeId { get; set; }

        [Column("group_type_id")]
        public Guid? GroupTypeId { get; set; }

        /// <summary>boundingBox | polygon | textHighlight | rowAnnotation | audioRegion | frameLabel | videoSegment</summary>
        [Required]
        public string Type { get; set; } = string.Empty;

        [Required]
        public string Label { get; set; } = string.Empty;

        [Required]
        public string Color { get; set; } = string.Empty;

        [Column(TypeName = "jsonb")]
        public string Data { get; set; } = "{}";

        public string? Comment { get; set; }

        [Column("qc_status")]
        public string? QcStatus { get; set; }

        [Column("qc_comment")]
        public string? QcComment { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(FileId))]
        public FileEntity? File { get; set; }

        [ForeignKey(nameof(ProjectId))]
        public Project? Project { get; set; }

        [ForeignKey(nameof(LabelTypeId))]
        public ProjectLabelType? LabelType { get; set; }

        [ForeignKey(nameof(GroupTypeId))]
        public ProjectGroupType? GroupType { get; set; }

        public ICollection<AnnotationFlag> AnnotationFlags { get; set; } = new List<AnnotationFlag>();
    }

    [Table("annotation_flags")]
    public class AnnotationFlag
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("annotation_id")]
        public Guid AnnotationId { get; set; }

        [Column("flag_id")]
        public Guid FlagId { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(AnnotationId))]
        public Annotation? Annotation { get; set; }

        [ForeignKey(nameof(FlagId))]
        public ProjectFlag? Flag { get; set; }
    }
}