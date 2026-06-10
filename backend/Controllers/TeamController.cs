using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;
using verilabelbackend.Models.Supabase;
using verilabelbackend.Services.Supabase;


[ApiController]
[Route("api/team")]
public class TeamController : ControllerBase
{
    private readonly SupabaseTeamService _service;

    public TeamController(SupabaseTeamService service)
    {
        _service = service;
    }

    private string GetJwt() =>
        Request.Headers["Authorization"].ToString().Replace("Bearer ", "");

    [HttpGet("{organizationId}")]
    public async Task<IActionResult> GetTeam(Guid organizationId)
    {
        var jwt = GetJwt();
        var result = await _service.GetTeam(jwt, organizationId);
        return Ok(result);
    }

    [HttpPost("add")]
    public async Task<IActionResult> AddMember(AddMemberRequest req)
    {
        var jwt = GetJwt();
        await _service.AddMember(jwt, req.OrganizationId, req.UserId, req.InvitedBy);
        return Ok();
    }

    [HttpPost("remove")]
    public async Task<IActionResult> RemoveMember(RemoveMemberRequest req)
    {
        var jwt = GetJwt();
        await _service.RemoveMember(jwt, req.OrganizationId, req.UserId);
        return Ok();
    }

    [HttpPost("assign-role")]
    public async Task<IActionResult> AssignRole(RoleRequest req)
    {
        var jwt = GetJwt();
        await _service.AssignRole(jwt, req.UserId,req.OrgId, req.Role);
        return Ok();
    }

    [HttpPost("remove-role")]
    public async Task<IActionResult> RemoveRole(RoleRequest req)
    {
        var jwt = GetJwt();
        await _service.RemoveRole(jwt, req.UserId,req.OrgId, req.Role);
        return Ok();
    }
}