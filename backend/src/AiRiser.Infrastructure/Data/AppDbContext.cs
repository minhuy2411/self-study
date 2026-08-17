using Microsoft.EntityFrameworkCore;
using AiRiser.Core.Entities;

namespace AiRiser.Infrastructure.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users => Set<User>();
        public DbSet<Vocabulary> Vocabularies => Set<Vocabulary>();
        public DbSet<WordMemory> WordMemories => Set<WordMemory>();
        public DbSet<WordVector> WordVectors => Set<WordVector>();
        public DbSet<WordReviewLog> WordReviewLogs => Set<WordReviewLog>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(u => u.Id);
                entity.HasIndex(u => u.Email).IsUnique();
                entity.Property(u => u.Email).IsRequired().HasMaxLength(256);
                entity.Property(u => u.Name).IsRequired().HasMaxLength(128);
            });

            modelBuilder.Entity<Vocabulary>(entity =>
            {
                entity.HasKey(v => v.Id);
                entity.Property(v => v.Word).IsRequired().HasMaxLength(128);
                entity.Property(v => v.Meaning).IsRequired();

                entity.HasOne(v => v.User)
                      .WithMany(u => u.Vocabularies)
                      .HasForeignKey(v => v.UserId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<WordMemory>(entity =>
            {
                entity.HasKey(wm => wm.Id);
                entity.HasOne(wm => wm.Vocabulary)
                      .WithOne(v => v.WordMemory)
                      .HasForeignKey<WordMemory>(wm => wm.WordId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<WordVector>(entity =>
            {
                entity.HasKey(wv => wv.Id);
                entity.HasOne(wv => wv.Vocabulary)
                      .WithMany()
                      .HasForeignKey(wv => wv.WordId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(wv => wv.User)
                      .WithMany()
                      .HasForeignKey(wv => wv.UserId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<WordReviewLog>(entity =>
            {
                entity.HasKey(rl => rl.Id);
                entity.HasIndex(rl => new { rl.UserId, rl.ReviewedAt });
                entity.HasOne(rl => rl.Vocabulary)
                      .WithMany()
                      .HasForeignKey(rl => rl.WordId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(rl => rl.User)
                      .WithMany()
                      .HasForeignKey(rl => rl.UserId)
                      .OnDelete(DeleteBehavior.Cascade);
            });
        }
    }
}
