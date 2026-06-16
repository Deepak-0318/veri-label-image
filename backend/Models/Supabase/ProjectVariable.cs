using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace verilabelbackend.Models.Supabase
{
    [Table("project_variables")]
    public class ProjectVariable
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("project_id")]
        public Guid ProjectId { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Column("variable_type")]
        [Required]
        public string VariableType { get; set; } = "text"; // number | text | single_select | multi_select

        [Column(TypeName = "jsonb")]
        public string Options { get; set; } = "[]";

        [Column("is_required")]
        public bool IsRequired { get; set; } = false;

        [Column("min_value")]
        public decimal? MinValue { get; set; }

        [Column("max_value")]
        public decimal? MaxValue { get; set; }

        [Column("display_order")]
        public int DisplayOrder { get; set; } = 0;

        [Column("created_by")]
        public Guid CreatedBy { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
