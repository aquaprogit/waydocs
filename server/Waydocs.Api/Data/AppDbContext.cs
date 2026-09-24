using Microsoft.EntityFrameworkCore;

namespace Waydocs.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Doc> Docs => Set<Doc>();
    public DbSet<Revision> Revisions => Set<Revision>();
    public DbSet<DocRef> DocRefs => Set<DocRef>();
    public DbSet<ExportState> ExportStates => Set<ExportState>();
    public DbSet<ToolUsage> ToolUsages => Set<ToolUsage>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Doc>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Domain);
        });

        b.Entity<Revision>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Doc).WithMany(d => d.Revisions)
                .HasForeignKey(x => x.DocId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.DocId, x.Number }).IsUnique();
        });

        b.Entity<DocRef>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasOne(x => x.Doc).WithMany(d => d.Refs)
                .HasForeignKey(x => x.DocId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.Type, x.Value });
        });

        b.Entity<ExportState>(e => e.HasKey(x => x.DocId));

        b.Entity<ToolUsage>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Tool);
            e.HasIndex(x => x.CreatedUtc);
        });
    }
}
