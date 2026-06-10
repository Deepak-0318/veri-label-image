namespace verilabelbackend.Models.Organization
{
    public class Organization
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = "";
        public Guid OwnerId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class CreateOrganizationRequest
    {
        public string Name { get; set; } = "";
    }
}
