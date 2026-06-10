using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace verilabelbackend.Models.Supabase
{
    [Table("audit_logs")]
    public class AuditLog
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("organization_id")]
        public Guid? OrganizationId { get; set; }

        [Required]
        public string Action { get; set; } = string.Empty;

        /// <summary>general | security | data | admin</summary>
        public string Category { get; set; } = "general";

        [Column("entity_type")]
        public string? EntityType { get; set; }

        [Column("entity_id")]
        public Guid? EntityId { get; set; }

        [Column("entity_name")]
        public string? EntityName { get; set; }

        [Required]
        public string Description { get; set; } = string.Empty;

        [Column(TypeName = "jsonb")]
        public string Metadata { get; set; } = "{}";

        [Column("old_values", TypeName = "jsonb")]
        public string? OldValues { get; set; }

        [Column("new_values", TypeName = "jsonb")]
        public string? NewValues { get; set; }

        [Column("ip_address")]
        public string? IpAddress { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(OrganizationId))]
        public Organization? Organization { get; set; }
    }
}