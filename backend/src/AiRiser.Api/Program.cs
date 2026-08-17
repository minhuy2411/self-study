using System.Text;
using AiRiser.Infrastructure.Data;
using AiRiser.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

Environment.SetEnvironmentVariable("DOTNET_USE_POLLING_FILE_WATCHER", "true");

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args
});

// Add services to the container.
builder.Services.AddControllers();

// Configure EF Core with PostgreSQL (DefaultConnection or DATABASE_URL) or InMemory fallback
var rawConnStr = builder.Configuration["DATABASE_URL"] ?? builder.Configuration.GetConnectionString("DefaultConnection");
var connectionString = NormalizePostgresConnectionString(rawConnStr);

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (!string.IsNullOrEmpty(connectionString))
    {
        options.UseNpgsql(connectionString, b => b.MigrationsAssembly("AiRiser.Infrastructure"));
    }
    else
    {
        options.UseInMemoryDatabase("AiRiserDb");
    }
});

// Dependency Injection
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<VocabularyService>();
builder.Services.AddHttpClient<ExternalDictionaryService>(c => c.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddHttpClient<ICambridgeDictionaryService, CambridgeDictionaryService>(c => c.Timeout = TimeSpan.FromMinutes(3));
builder.Services.AddHttpClient<IDocumentScannerService, DocumentScannerService>(c => c.Timeout = TimeSpan.FromMinutes(3));
builder.Services.AddHttpClient<IVectorService, VectorService>(c => c.Timeout = TimeSpan.FromMinutes(2));
builder.Services.AddScoped<IRagPipelineService, RagPipelineService>();
builder.Services.AddHttpClient<IAiService, AiService>(c => c.Timeout = TimeSpan.FromMinutes(2));
builder.Services.AddScoped<IQuizService, QuizService>();
builder.Services.AddScoped<ISrsEngineService, SrsEngineService>();
builder.Services.AddHttpClient<IMemoryAiService, MemoryAiService>(c => c.Timeout = TimeSpan.FromMinutes(2));

// Configure JWT Authentication
var secretKey = builder.Configuration["Jwt:SecretKey"] ?? "SUPER_SECRET_KEY_AI_RISER_PROJECT_2026_DEFAULT_SECRET_KEY";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "AiRiser",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "AiRiserApp",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey))
        };
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        if (db.Database.IsRelational())
        {
            db.Database.Migrate();
            Console.WriteLine("Database migrations applied successfully to PostgreSQL.");
        }
        else
        {
            db.Database.EnsureCreated();
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database migration error: {ex.Message}");
        try
        {
            db.Database.EnsureCreated();
            Console.WriteLine("Database EnsureCreated applied as fallback.");
        }
        catch (Exception ex2)
        {
            Console.WriteLine($"Database EnsureCreated fallback error: {ex2.Message}");
        }
    }
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

static string NormalizePostgresConnectionString(string? connStr)
{
    if (string.IsNullOrWhiteSpace(connStr)) return string.Empty;
    
    connStr = connStr.Trim();
    if (connStr.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
        connStr.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        try
        {
            var uri = new Uri(connStr);
            var userInfo = uri.UserInfo.Split(':');
            var user = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "";
            var pass = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
            var host = uri.Host;
            var port = uri.Port > 0 ? uri.Port : 5432;
            var database = uri.AbsolutePath.TrimStart('/');

            var builder = new Npgsql.NpgsqlConnectionStringBuilder
            {
                Host = host,
                Port = port,
                Database = database,
                Username = user,
                Password = pass,
                SslMode = Npgsql.SslMode.Require,
                TrustServerCertificate = true
            };
            return builder.ConnectionString;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error parsing postgres URI: {ex.Message}");
        }
    }
    return connStr;
}
