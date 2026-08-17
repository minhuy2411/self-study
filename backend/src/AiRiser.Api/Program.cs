using System.Text;
using AiRiser.Infrastructure.Data;
using AiRiser.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Configure EF Core with PostgreSQL (DefaultConnection) or InMemory fallback
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
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
        var conn = db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open)
        {
            conn.Open();
        }
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
        ALTER TABLE ""Vocabularies"" ADD COLUMN IF NOT EXISTS ""EnglishMeaning"" text NULL;
        ALTER TABLE ""Vocabularies"" ADD COLUMN IF NOT EXISTS ""CefrLevel"" text NULL;

        CREATE TABLE IF NOT EXISTS ""WordVectors"" (
            ""Id"" uuid PRIMARY KEY,
            ""WordId"" uuid NOT NULL REFERENCES ""Vocabularies""(""Id"") ON DELETE CASCADE,
            ""UserId"" uuid NOT NULL REFERENCES ""Users""(""Id"") ON DELETE CASCADE,
            ""EmbeddingJson"" text NOT NULL DEFAULT '[]',
            ""ContextPayload"" text NOT NULL DEFAULT '{}',
            ""Dimensions"" integer NOT NULL DEFAULT 1536,
            ""CreatedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ""UpdatedAt"" timestamp with time zone NULL
        );
        CREATE INDEX IF NOT EXISTS ""IX_WordVectors_UserId"" ON ""WordVectors""(""UserId"");
        CREATE INDEX IF NOT EXISTS ""IX_WordVectors_WordId"" ON ""WordVectors""(""WordId"");

        CREATE TABLE IF NOT EXISTS ""WordReviewLogs"" (
            ""Id"" uuid PRIMARY KEY,
            ""WordId"" uuid NOT NULL REFERENCES ""Vocabularies""(""Id"") ON DELETE CASCADE,
            ""UserId"" uuid NOT NULL REFERENCES ""Users""(""Id"") ON DELETE CASCADE,
            ""QualityRating"" integer NOT NULL DEFAULT 0,
            ""Score"" integer NOT NULL DEFAULT 0,
            ""WasCorrect"" boolean NOT NULL DEFAULT true,
            ""IntervalDays"" integer NOT NULL DEFAULT 0,
            ""EaseFactor"" double precision NOT NULL DEFAULT 2.5,
            ""ReviewSource"" text NULL,
            ""ReviewedAt"" timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ""IX_WordReviewLogs_UserId_ReviewedAt"" ON ""WordReviewLogs""(""UserId"", ""ReviewedAt"");
        CREATE INDEX IF NOT EXISTS ""IX_WordReviewLogs_WordId"" ON ""WordReviewLogs""(""WordId"");
        ";
        cmd.ExecuteNonQuery();
        Console.WriteLine("WordVectors and WordReviewLogs tables verified/created successfully in PostgreSQL.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database ensure created error: {ex.Message}");
    }
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
