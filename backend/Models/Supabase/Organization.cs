using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace verilabelbackend.Models.Supabase
{

    [Table("organizations")]
    public class Organization
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        public string Name { get; set; } = string.Empty;

        [Column("owner_id")]
        public Guid OwnerId { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

        // Navigation
        public ICollection<OrganizationMember> Members { get; set; } = new List<OrganizationMember>();
        public ICollection<PendingInvitation> PendingInvitations { get; set; } = new List<PendingInvitation>();
        public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
    }

    [Table("organization_members")]
    public class OrganizationMember
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("organization_id")]
        public Guid OrganizationId { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("invited_by")]
        public Guid? InvitedBy { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(OrganizationId))]
        public Organization? Organization { get; set; }
    }

    [Table("pending_invitations")]
    public class PendingInvitation
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("organization_id")]
        public Guid OrganizationId { get; set; }

        [Required]
        public string Email { get; set; } = string.Empty;

        public AppRole Role { get; set; } = AppRole.annotator;

        [Column("invited_by")]
        public Guid InvitedBy { get; set; }

        /// <summary>pending | accepted | declined</summary>
        public string Status { get; set; } = "pending";

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [ForeignKey(nameof(OrganizationId))]
        public Organization? Organization { get; set; }
    }
}