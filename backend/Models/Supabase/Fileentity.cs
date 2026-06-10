using Microsoft.EntityFrameworkCore.Infrastructure;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace verilabelbackend.Models.Supabase
{

    [Table("files")]
    public class FileEntity
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("project_id")]
        public Guid? ProjectId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string Type { get; set; } = string.Empty;

        public long? Size { get; set; }

        [Column("thumbnail_url")]
        public string? ThumbnailUrl { get; set; }

        public string? Content { get; set; }


        /// <summary>copy | reference</summary>
        [Column("storage_mode")]
        public string StorageMode { get; set; } = "copy";

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(ProjectId))]
        public Project? Project { get; set; }

        [Column("folder")]
        public string? Folder { get; set; }

        public ICollection<Annotation> Annotations { get; set; } = new List<Annotation>();
        public ICollection<Segment> Segments { get; set; } = new List<Segment>();
        public ICollection<DatasetFile> DatasetFiles { get; set; } = new List<DatasetFile>();
        public ICollection<SubTask> SubTasks { get; set; } = new List<SubTask>();
    }
}