
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace verilabelbackend.Models.Supabase
{
   


    [Table("labels")]
    public class Label
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        [Required]
        public string Color { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    }

    [Table("segments")]
    public class Segment
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("file_id")]
        public Guid FileId { get; set; }

        public string Layer { get; set; } = "default";

        public string? Label { get; set; }

        [Column("start_time")]
        public double? StartTime { get; set; }

        [Column("end_time")]
        public double? EndTime { get; set; }

        [Column("start_offset")]
        public int? StartOffset { get; set; }

        [Column("end_offset")]
        public int? EndOffset { get; set; }

        [Column(TypeName = "jsonb")]
        public string Metadata { get; set; } = "{}";

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(FileId))]
        public FileEntity? File { get; set; }
    }
}