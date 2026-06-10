using System.Text;
using System.Text.Json;
using verilabelbackend.Models.Supabase;

public class SupabaseTeamService
{
    private readonly IHttpClientFactory _http;
    private readonly string _url;
    private readonly string _anon;

    public SupabaseTeamService(IHttpClientFactory http, IConfiguration config)
    {
        _http = http;
        _url = config["Supabase:Url"];
        _anon = config["Supabase:AnonKey"];
    }

    private void AddHeaders(HttpRequestMessage req, string jwt)
    {
        req.Headers.Add("apikey", _anon);
        req.Headers.Add("Authorization", $"Bearer {jwt}");
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

        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });
    }

    private async Task Post(string jwt, string table, object body)
    {
        var client = _http.CreateClient();

        var req = new HttpRequestMessage(HttpMethod.Post, $"{_url}/rest/v1/{table}")
        {
            Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
        };

        AddHeaders(req, jwt);

        var res = await client.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode)
            throw new Exception(json);
    }

    private async Task Delete(string jwt, string table, string query)
    {
        var client = _http.CreateClient();

        var req = new HttpRequestMessage(HttpMethod.Delete, $"{_url}/rest/v1/{table}?{query}");
        AddHeaders(req, jwt);

        var res = await client.SendAsync(req);
        var json = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode)
            throw new Exception(json);
    }

    public async Task<List<Dictionary<string, object>>> GetTeam(string jwt, Guid organizationId)
    {
        var orgMembers = await GetAsync<List<OrgMember>>(
            jwt,
            $"{_url}/rest/v1/organization_members?organization_id=eq.{organizationId}"
        ) ?? new();

        Console.WriteLine("org mem : "+ Newtonsoft.Json.JsonConvert.SerializeObject(orgMembers));

        if (!orgMembers.Any()) return new();

        var userIds = orgMembers.Select(x => x.UserId).ToList();

        var ids = string.Join(",", userIds.Select(id => $"\"{id}\""));

        var profiles = await GetAsync<List<Profile>>(
            jwt,$"{_url}/rest/v1/profiles?id=in.({ids})"
        ) ?? new();

        var roles = await GetAsync<List<UserRoleDto>>(
            jwt,
            $"{_url}/rest/v1/user_roles?user_id=in.({ids})&organization_id=eq.{organizationId}"
        ) ?? new();

        var roleMap = roles
             .GroupBy(r => r.UserId)
             .ToDictionary(
                 g => g.Key,
                 g => g.Select(r => Enum.Parse<AppRole>(r.Role, true)).ToList()
             );

        var result = profiles.Select(p => ToSnakeCaseObject(new TeamMemberDto
        {
            Id = p.Id,
            Email = p.Email ?? "",
            FullName = p.FullName ?? p.Email?.Split("@")[0] ?? "Unknown",
            AvatarUrl = p.AvatarUrl,
            Roles = roleMap.ContainsKey(p.Id)
                ? roleMap[p.Id].Select(r => r.ToString().ToLower()).ToList()
                : new(),
            CreatedAt = orgMembers.First(x => x.UserId == p.Id).CreatedAt
        })).ToList();

        return result;
    }

    public static Dictionary<string, object?> ToSnakeCaseObject(object obj)
    {
        var dict = new Dictionary<string, object?>();

        foreach (var prop in obj.GetType().GetProperties())
        {
            var key = ToSnakeCase(prop.Name);
            var value = prop.GetValue(obj);

            dict[key] = value;
        }

        return dict;
    }

    public static string ToSnakeCase(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;

        var result = new System.Text.StringBuilder();

        for (int i = 0; i < name.Length; i++)
        {
            var c = name[i];

            if (char.IsUpper(c))
            {
                if (i > 0)
                    result.Append('_');

                result.Append(char.ToLowerInvariant(c));
            }
            else
            {
                result.Append(c);
            }
        }

        return result.ToString();
    }

    public async Task AddMember(string jwt, Guid orgId, Guid userId, Guid invitedBy)
    {
        await Post(jwt, "organization_members", new
        {
            organization_id = orgId,
            user_id = userId,
            invited_by = invitedBy
        });
    }

    public async Task RemoveMember(string jwt, Guid orgId, Guid userId)
    {
        await Delete(jwt, "organization_members",
            $"organization_id=eq.{orgId}&user_id=eq.{userId}");

        await Delete(jwt, "user_roles",
        $"user_id=eq.{userId}&organization_id=eq.{orgId}");
    }

    public async Task AssignRole(string jwt, Guid userId, Guid orgId, string role)
    {
        try
        {
            await Post(jwt, "user_roles", new
            {
                user_id = userId,
                role,
                organization_id = orgId
            });
        }
        catch (Exception ex)
        {
            if (!ex.Message.Contains("23505")) throw;
        }
    }

    public async Task RemoveRole(string jwt, Guid userId, Guid orgId, string role)
    {
        await Delete(jwt, "user_roles",
            $"user_id=eq.{userId}&organization_id=eq.{orgId}&role=eq.{role}");
    }
}