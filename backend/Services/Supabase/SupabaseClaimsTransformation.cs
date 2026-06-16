using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Caching.Memory;

namespace verilabelbackend.Services.Supabase;

public sealed class SupabaseClaimsTransformation : IClaimsTransformation
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly string _supabaseUrl;
    private readonly string _anonKey;

    public SupabaseClaimsTransformation(
        IHttpContextAccessor httpContextAccessor,
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        IConfiguration configuration)
    {
        _httpContextAccessor = httpContextAccessor;
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _supabaseUrl = configuration["Supabase:Url"]!;
        _anonKey = configuration["Supabase:AnonKey"]!;
    }

    public async Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        var identity = principal.Identity as ClaimsIdentity;
        if (identity == null || !identity.IsAuthenticated)
            return principal;

        var sub = principal.FindFirst("sub")?.Value 
                  ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(sub) || !Guid.TryParse(sub, out var userId))
            return principal;

        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null)
            return principal;

        var authHeader = httpContext.Request.Headers["Authorization"].ToString();
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return principal;

        var jwt = authHeader["Bearer ".Length..].Trim();

        var cacheKey = $"user-roles-{userId}";
        if (!_cache.TryGetValue(cacheKey, out List<string>? roles) || roles == null)
        {
            roles = await FetchUserRolesAsync(jwt, userId);
            var cacheOptions = new MemoryCacheEntryOptions()
                .SetSlidingExpiration(TimeSpan.FromMinutes(5));
            _cache.Set(cacheKey, roles, cacheOptions);
        }

        foreach (var role in roles)
        {
            if (!identity.HasClaim(ClaimTypes.Role, role))
            {
                identity.AddClaim(new Claim(ClaimTypes.Role, role));
            }
        }

        return principal;
    }

    private async Task<List<string>> FetchUserRolesAsync(string jwt, Guid userId)
    {
        var url = $"{_supabaseUrl}/rest/v1/user_roles?user_id=eq.{userId}&select=role";
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Clear();
        client.DefaultRequestHeaders.Add("apikey", _anonKey);
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {jwt}");

        try
        {
            var response = await client.GetAsync(url);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"[ClaimsTransformation] Error fetching roles: {error}");
                return new List<string>();
            }

            var content = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(content);
            var roles = new List<string>();
            foreach (var element in doc.RootElement.EnumerateArray())
            {
                if (element.TryGetProperty("role", out var roleProp))
                {
                    var role = roleProp.GetString();
                    if (!string.IsNullOrEmpty(role))
                    {
                        roles.Add(role.ToLowerInvariant());
                    }
                }
            }
            return roles;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ClaimsTransformation] Exception fetching roles: {ex.Message}");
            return new List<string>();
        }
    }
}
