using System.Text;
using System.Text.Json;
using verilabelbackend.Models.Invitations;

namespace verilabelbackend.Services.Supabase;

public class SupabaseInvitationService
{
    private readonly IHttpClientFactory _http;
    private readonly string _url;
    private readonly string _anon;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public SupabaseInvitationService(IHttpClientFactory http, IConfiguration config)
    {
        _http = http;
        _url = config["Supabase:Url"]!;
        _anon = config["Supabase:AnonKey"]!;
    }

    public async Task<List<PendingInvitationDto>> GetPending(string jwt, string email)
    {
        var url =
            $"{_url}/rest/v1/pending_invitations" +
            $"?status=eq.pending" +
            $"&email=eq.{email}" +
            $"&select=*,organizations(name)";

        var data = await GetAsync<List<PendingInvitationRaw>>(jwt, url) ?? new();

        return data.Select(inv => new PendingInvitationDto
        {
            Id = inv.Id,
            OrganizationId = inv.OrganizationId,
            Email = inv.Email,
            Role = inv.Role,
            InvitedBy = inv.InvitedBy,
            Status = inv.Status,
            CreatedAt = inv.CreatedAt,
            OrgName = inv.Organizations?.Name ?? "Unknown"
        }).ToList();
    }

    public async Task Accept(string jwt, Guid userId, Guid invitationId)
    {
        var invitation = await GetInvitationById(jwt, invitationId);
        if (invitation == null)
            throw new Exception("Invitation not found");

        try
        {
            await Post(jwt, "organization_members", new
            {
                organization_id = invitation.OrganizationId,
                user_id = userId,
                invited_by = invitation.InvitedBy
            });
        }
        catch (Exception ex)
        {

        }

        await PostWithUpsert(jwt, "user_roles", new
        {
            user_id = userId,
            role = invitation.Role,
            organization_id = invitation.OrganizationId
        }, "user_id,organization_id,role");

        await Patch(jwt, $"pending_invitations?id=eq.{invitationId}", new
        {
            status = "accepted"
        });
    }

    public async Task Decline(string jwt, Guid invitationId)
    {
        await Patch(jwt, $"pending_invitations?id=eq.{invitationId}", new
        {
            status = "declined"
        });
    }

    private async Task Post(string jwt, string table, object body)
    {
        var client = _http.CreateClient();

        var req = new HttpRequestMessage(
            HttpMethod.Post,
            $"{_url}/rest/v1/{table}"
        )
        {
            Content = new StringContent(
                JsonSerializer.Serialize(body, JsonOpts),
                Encoding.UTF8,
                "application/json"
            )
        };

        AddHeaders(req, jwt);

        req.Headers.Add("Prefer", "return=minimal");

        var res = await client.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode)
            throw new Exception(json);
    }


    private async Task<PendingInvitationRaw?> GetInvitationById(string jwt, Guid id)
    {
        var url = $"{_url}/rest/v1/pending_invitations?id=eq.{id}";
        var data = await GetAsync<List<PendingInvitationRaw>>(jwt, url);
        return data?.FirstOrDefault();
    }

    private async Task<T?> GetAsync<T>(string jwt, string url)
    {
        var client = _http.CreateClient();

        var req = new HttpRequestMessage(HttpMethod.Get, url);
        AddHeaders(req, jwt);

        var res = await client.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode)
            throw new Exception(json);

        return JsonSerializer.Deserialize<T>(json, JsonOpts);
    }

    private async Task PostWithUpsert(string jwt, string table, object body, string conflictColumns)
    {
        var client = _http.CreateClient();

        var url = $"{_url}/rest/v1/{table}?on_conflict={conflictColumns}";

        var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(body, JsonOpts),
                Encoding.UTF8,
                "application/json")
        };

        AddHeaders(req, jwt);
        req.Headers.Add("Prefer", "resolution=merge-duplicates");

        var res = await client.SendAsync(req);

        if (!res.IsSuccessStatusCode)
            throw new Exception(await res.Content.ReadAsStringAsync());
    }

    private async Task Patch(string jwt, string query, object body)
    {
        var client = _http.CreateClient();

        var req = new HttpRequestMessage(HttpMethod.Patch, $"{_url}/rest/v1/{query}")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(body, JsonOpts),
                Encoding.UTF8,
                "application/json")
        };

        AddHeaders(req, jwt);
        req.Headers.Add("Prefer", "return=minimal");

        var res = await client.SendAsync(req);

        if (!res.IsSuccessStatusCode)
            throw new Exception(await res.Content.ReadAsStringAsync());
    }

    public async Task<object> Invite(
    string jwt,
    Guid userId,
    Guid orgId,
    string email,
    string role)
    {
        var profileUrl = $"{_url}/rest/v1/profiles?email=eq.{email}&select=id";
        var existing = await GetAsync<List<ProfileId>>(jwt, profileUrl);

        if (existing?.Any() == true)
        {
            var existingUserId = existing[0].Id;

            var memberUrl = $"{_url}/rest/v1/organization_members?organization_id=eq.{orgId}&user_id=eq.{existingUserId}";
            var already = await GetAsync<List<object>>(jwt, memberUrl);

            if (already?.Any() == true)
                throw new Exception("already-member");

            await InsertInvitation(jwt, orgId, email, role, userId);
        }
        else
        {
            await InsertInvitation(jwt, orgId, email, role, userId);
        }

        return new { success = true };
    }

    private async Task InsertInvitation(string jwt, Guid orgId, string email, string role, Guid invitedBy)
    {
        await Delete(jwt, "pending_invitations",
            $"organization_id=eq.{orgId}&email=eq.{email}");

        await Post(jwt, "pending_invitations", new
        {
            organization_id = orgId,
            email = email.ToLower(),
            role,
            invited_by = invitedBy
        });
    }

    private async Task Delete(string jwt, string table, string query)
    {
        var client = _http.CreateClient();

        var req = new HttpRequestMessage(
            HttpMethod.Delete,
            $"{_url}/rest/v1/{table}?{query}"
        );

        AddHeaders(req, jwt);

        var res = await client.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode)
            throw new Exception(json);
    }

    private class ProfileId
    {
        public Guid Id { get; set; }
    }

    private void AddHeaders(HttpRequestMessage req, string jwt)
    {
        req.Headers.Add("apikey", _anon);
        req.Headers.Add("Authorization", $"Bearer {jwt}");
    }
}