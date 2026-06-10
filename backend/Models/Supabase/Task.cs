using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace verilabelbackend.Models.Supabase
{
  

    [Table("tasks")]
    public class TaskEntity
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("project_id")]
        public Guid ProjectId { get; set; }

        [Column("created_by")]
        public Guid CreatedBy { get; set; }

        [Column("assigned_to")]
        public Guid? AssignedTo { get; set; }

        [Column("qa_assigned_to")]
        public Guid? QaAssignedTo { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        /// <summary>pending | in_progress | completed | rejected</summary>
        public string Status { get; set; } = "pending";

        [Column("qa_status")]
        public string? QaStatus { get; set; }

        [Column("total_items")]
        public int TotalItems { get; set; } = 0;

        [Column("completed_items")]
        public int CompletedItems { get; set; } = 0;

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(ProjectId))]
        public Project? Project { get; set; }

        public ICollection<SubTask> SubTasks { get; set; } = new List<SubTask>();
    }

    [Table("sub_tasks")]
    public class SubTask
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("task_id")]
        public Guid TaskId { get; set; }

        [Column("file_id")]
        public Guid FileId { get; set; }

        /// <summary>pending | in_progress | completed</summary>
        public string Status { get; set; } = "pending";

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(TaskId))]
        public TaskEntity? Task { get; set; }

        [ForeignKey(nameof(FileId))]
        public FileEntity? File { get; set; }
    }
}
