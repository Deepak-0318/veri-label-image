namespace verilabelbackend.Models.Invitations
{
    public class AcceptInvitationRequest
    {
        public Guid InvitationId { get; set; }
    }

    public class DeclineInvitationRequest
    {
        public Guid InvitationId { get; set; }
    }

    public class PendingInvitationDto
    {
        public Guid Id { get; set; }
        public Guid OrganizationId { get; set; }
        public string Email { get; set; } = "";
        public string Role { get; set; } = "";
        public Guid InvitedBy { get; set; }
        public string Status { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public string OrgName { get; set; } = "";
    }

    public class PendingInvitationRaw
    {
        public Guid Id { get; set; }
        public Guid OrganizationId { get; set; }
        public string Email { get; set; } = "";
        public string Role { get; set; } = "";
        public Guid InvitedBy { get; set; }
        public string Status { get; set; } = "";
        public DateTime CreatedAt { get; set; }

        public OrganizationNameWrapper? Organizations { get; set; }
    }

    public class OrganizationNameWrapper
    {
        public string Name { get; set; } = "";
    }

    public class InviteRequest
    {
        public Guid OrganizationId { get; set; }
        public string Email { get; set; } = "";
        public string Role { get; set; } = "";
    }
}
