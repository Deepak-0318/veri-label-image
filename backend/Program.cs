using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using verilabelbackend.Repositories;
using verilabelbackend.Services;
using verilabelbackend.Services.Azure;
using verilabelbackend.Services.Supabase;
using verilabelbackend.Services.AI;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpClient();
builder.Services.AddHttpContextAccessor();
builder.Services.AddMemoryCache();
builder.Services.AddTransient<Microsoft.AspNetCore.Authentication.IClaimsTransformation, SupabaseClaimsTransformation>();
builder.Services.AddScoped<PipelineExecutionService>();
builder.Services.AddScoped<ImageDetectionService>();
builder.Services.AddScoped<SupabaseAnnotationService>();
builder.Services.AddScoped<SupabaseTaskService>();
builder.Services.AddScoped<ImageFileResolverService>();
builder.Services.Configure<verilabelbackend.Models.YoloDetectionOptions>(builder.Configuration.GetSection("Yolo"));
builder.Services.AddSingleton<YoloV8OnnxService>();
builder.Services.AddSingleton<BertTokenizerService>();
builder.Services.AddSingleton<GroundingDinoOnnxService>();
builder.Services.AddSingleton<IDetectionService,
                              OpenVocabularyDetectionService>();

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "VeriLabel API", Version = "v1" });

    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter your Supabase JWT token"
    });

    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id   = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

string supabaseUrl = builder.Configuration["Supabase:Url"]!;
string supabaseAnonKey = builder.Configuration["Supabase:AnonKey"]!;

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
   .AddJwtBearer(options =>
{
    options.Authority = $"{supabaseUrl}/auth/v1";
    options.RequireHttpsMetadata = false;

    options.MapInboundClaims = false; 

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = $"{supabaseUrl}/auth/v1",
        ValidateAudience = true,
        ValidAudience = "authenticated",
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKeyResolver = (token, securityToken, kid, parameters) =>
        {
            var jwksUrl = $"{supabaseUrl}/auth/v1/.well-known/jwks.json";
            var handler = new HttpClient();
            var json = handler.GetStringAsync(jwksUrl).Result;
            var keys = new JsonWebKeySet(json);
            return keys.GetSigningKeys();
        }
    };
});
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddSingleton<AzureBlobStorageService>();
builder.Services.AddScoped<SupabaseFileService>();
builder.Services.AddScoped<ExportService>();
builder.Services.AddScoped<ImportService>();
builder.Services.AddScoped<SupabaseInvitationService>();
builder.Services.AddScoped<SupabaseTeamService>();
builder.Services.AddScoped<SupabaseDatasetService>();
builder.Services.AddScoped<SupabaseOrganizationService>();
builder.Services.AddSingleton<verilabelbackend.Repositories.IDocumentRepository,
                               verilabelbackend.Repositories.DocumentRepository>();

var app = builder.Build();

if (args.Contains("--run-yolo-test"))
{
    using (var scope = app.Services.CreateScope())
    {
        await YoloTestRunner.RunTestsAsync(scope.ServiceProvider);
    }
    return;
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider
        .GetRequiredService<IDetectionService>();
}

app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
