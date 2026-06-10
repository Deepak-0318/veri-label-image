using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using verilabelbackend.Models.Organization;
using verilabelbackend.Services.Supabase;

namespace verilabelbackend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrganizationController : ControllerBase
{
    private readonly SupabaseOrganizationService _service;

    public OrganizationController(SupabaseOrganizationService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = GetUserId();
        if (userId == Guid.Empty) return Unauthorized();

        var org = await _service.GetUserOrganization(GetJwt(), userId);
        return Ok(org);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOrganizationRequest req)
    {
        var userId = GetUserId();
        var org = await _service.Create(GetJwt(), userId, req.Name);
        return Ok(org);
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
    }

    private string GetJwt()
    {
        var auth = HttpContext.Request.Headers["Authorization"].ToString();
        return auth.StartsWith("Bearer ") ? auth["Bearer ".Length..] : auth;
    }
}