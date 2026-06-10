

using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace verilabelbackend.Models.Supabase
{

    [Table("datasets")]
    public class Dataset
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("project_id")]
        public Guid? ProjectId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(ProjectId))]
        public Project? Project { get; set; }

        public ICollection<DatasetFile> DatasetFiles { get; set; } = new List<DatasetFile>();
           public int FileCount { get; set; }

    }

    [Table("dataset_files")]
    public class DatasetFile
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("dataset_id")]
        public Guid DatasetId { get; set; }

        [Column("file_id")]
        public Guid FileId { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(DatasetId))]
        public Dataset? Dataset { get; set; }

        [ForeignKey(nameof(FileId))]
        public FileEntity? File { get; set; }
    }
}
