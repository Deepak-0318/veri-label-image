using Microsoft.AspNetCore.Mvc;
using System.Text.Json.Serialization;

namespace verilabelbackend.Models.Supabase
{
    public class TeamMemberDto
    {
        public Guid Id { get; set; }
        public string Email { get; set; } = "";
        public string FullName { get; set; } = "";
        public string? AvatarUrl { get; set; }
        public List<string> Roles { get; set; } = new(); 
        public DateTime CreatedAt { get; set; }
    }
    public class RoleRequest
    {
        public Guid UserId { get; set; }
        public Guid OrgId { get; set; }
        public string Role { get; set; } = string.Empty;
    }

    public class RemoveMemberRequest
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
    }

    public class AddMemberRequest
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid InvitedBy { get; set; }
    }

    public class OrgMember
    {
        [JsonPropertyName("organization_id")]
        public Guid OrganizationId { get; set; }

        [JsonPropertyName("user_id")]
        public Guid UserId { get; set; }

        [JsonPropertyName("invited_by")]
        public Guid? InvitedBy { get; set; }

        [JsonPropertyName("created_at")]
        public DateTime CreatedAt { get; set; }
    }

    public class UserRoleDto
    {
        [JsonPropertyName("user_id")]
        public Guid UserId { get; set; }

        [JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;
    }
}