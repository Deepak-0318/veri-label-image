using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace verilabelbackend.Models.Supabase
{
    [Table("annotation_variable_values")]
    public class AnnotationVariableValue
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("annotation_id")]
        public Guid AnnotationId { get; set; }

        [Column("variable_id")]
        public Guid VariableId { get; set; }

        [Column(TypeName = "jsonb")]
        public string? Value { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }
}
