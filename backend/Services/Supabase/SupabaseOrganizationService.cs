using System.Text;
using System.Text.Json;
using verilabelbackend.Models.Organization;

namespace verilabelbackend.Services.Supabase;

public class SupabaseOrganizationService
{
    private readonly IHttpClientFactory _http;
    private readonly string _url;
    private readonly string _anon;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public SupabaseOrganizationService(IHttpClientFactory http, IConfiguration config)
    {
        _http = http;
        _url = config["Supabase:Url"]!;
        _anon = config["Supabase:AnonKey"]!;
    }

    public async Task<Organization?> GetUserOrganization(string jwt, Guid userId)
    {
        var memUrl = $"{_url}/rest/v1/organization_members?user_id=eq.{userId}&select=organization_id&limit=1";
        var membership = await GetAsync<List<MemberOnly>>(jwt, memUrl);

        if (membership == null || membership.Count == 0)
            return null;

        var orgId = membership[0].OrganizationId;

        var orgUrl = $"{_url}/rest/v1/organizations?id=eq.{orgId}";
        var orgs = await GetAsync<List<Organization>>(jwt, orgUrl);

        return orgs?.FirstOrDefault();
    }

    public async Task<Organization?> Create(string jwt, Guid userId, string name)
    {
        var org = await PostReturning<Organization>(jwt, "organizations", new
        {
            name,
            owner_id = userId
        });

        var created = org.FirstOrDefault();
        if (created == null) return null;

        await Post(jwt, "organization_members", new
        {
            organization_id = created.Id,
            user_id = userId
        });

        await PostWithUpsert(jwt, "user_roles", new
        {
            user_id = userId,
            role = "admin",
            organization_id = created.Id
        });

        return created;
    }

    private async Task PostWithUpsert(string jwt, string table, object body)
    {
        var client = _http.CreateClient();

        var url = $"{_url}/rest/v1/{table}?on_conflict=user_id,organization_id,role";

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

    private async Task<T?> GetAsync<T>(string jwt, string url)
    {
        var client = _http.CreateClient();
        var req = new HttpRequestMessage(HttpMethod.Get, url);
        AddHeaders(req, jwt);

        var res = await client.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode) throw new Exception(json);

        return JsonSerializer.Deserialize<T>(json, JsonOpts);
    }

    private async Task<List<T>> PostReturning<T>(string jwt, string table, object body)
    {
        var client = _http.CreateClient();
        var req = new HttpRequestMessage(HttpMethod.Post, $"{_url}/rest/v1/{table}")
        {
            Content = new StringContent(JsonSerializer.Serialize(body, JsonOpts), Encoding.UTF8, "application/json")
        };

        AddHeaders(req, jwt);
        req.Headers.Add("Prefer", "return=representation");

        var res = await client.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode) throw new Exception(json);

        return JsonSerializer.Deserialize<List<T>>(json, JsonOpts) ?? new();
    }

    private async Task Post(string jwt, string table, object body)
    {
        var client = _http.CreateClient();
        var req = new HttpRequestMessage(HttpMethod.Post, $"{_url}/rest/v1/{table}")
        {
            Content = new StringContent(JsonSerializer.Serialize(body, JsonOpts), Encoding.UTF8, "application/json")
        };

        AddHeaders(req, jwt);
        req.Headers.Add("Prefer", "return=minimal");

        var res = await client.SendAsync(req);
        if (!res.IsSuccessStatusCode)
            throw new Exception(await res.Content.ReadAsStringAsync());
    }

    private void AddHeaders(HttpRequestMessage req, string jwt)
    {
        req.Headers.Add("apikey", _anon);
        req.Headers.Add("Authorization", $"Bearer {jwt}");
    }

    private class MemberOnly
    {
        public Guid OrganizationId { get; set; }
    }
}