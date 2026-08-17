using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AiRiser.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEnglishMeaningAndCefr : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""Vocabularies"" ADD COLUMN IF NOT EXISTS ""CefrLevel"" text NULL;
                ALTER TABLE ""Vocabularies"" ADD COLUMN IF NOT EXISTS ""EnglishMeaning"" text NULL;

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
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP TABLE IF EXISTS ""WordReviewLogs"";
                DROP TABLE IF EXISTS ""WordVectors"";
                ALTER TABLE ""Vocabularies"" DROP COLUMN IF EXISTS ""CefrLevel"";
                ALTER TABLE ""Vocabularies"" DROP COLUMN IF EXISTS ""EnglishMeaning"";
            ");
        }
    }
}
