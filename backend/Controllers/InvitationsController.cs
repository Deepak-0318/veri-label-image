using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text.Json;
using verilabelbackend.Repositories;
using verilabelbackend.Services;
using verilabelbackend.Models.Invitations;
using verilabelbackend.Services.Supabase;

[ApiController]
[Route("api/invitations")]
[Authorize]
public class InvitationsController : ControllerBase
{
    private readonly SupabaseInvitationService _invitationService;

    public InvitationsController(SupabaseInvitationService service)
    {
        _invitationService = service;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string email)
    {
        var res = await _invitationService.GetPending(GetJwt(), email);
        return Ok(res);
    }

    [HttpPost("accept")]
    public async Task<IActionResult> Accept([FromBody] AcceptInvitationRequest req)
    {
        var userId = GetUserId();
        await _invitationService.Accept(GetJwt(), userId, req.InvitationId);
        return Ok();
    }

    [HttpPost("decline")]
    public async Task<IActionResult> Decline([FromBody] DeclineInvitationRequest req)
    {
        await _invitationService.Decline(GetJwt(), req.InvitationId);
        return Ok();
    }

    [HttpPost("invite")]
    public async Task<IActionResult> Invite([FromBody] InviteRequest req)
    {
        var userId = GetUserId();

        var result = await _invitationService.Invite(
            GetJwt(),
            userId,
            req.OrganizationId,
            req.Email.ToLower(),
            req.Role
        );

        return Ok(result);
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirst("sub")?.Value;
        return Guid.Parse(sub!);
    }

    private string GetJwt()
    {
        var auth = Request.Headers["Authorization"].ToString();
        return auth.Replace("Bearer ", "");
    }
}