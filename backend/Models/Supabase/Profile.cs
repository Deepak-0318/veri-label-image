using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace verilabelbackend.Models.Supabase
{

    [Table("profiles")]
    public class Profile
    {
        [Key]
        public Guid Id { get; set; }

        public string? Email { get; set; }

        [Column("full_name")]
        public string? FullName { get; set; }

        [Column("avatar_url")]
        public string? AvatarUrl { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    }

    [Table("user_roles")]
    public class UserRole
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Column("user_id")]
        public Guid UserId { get; set; }

        public AppRole Role { get; set; }
    }
}