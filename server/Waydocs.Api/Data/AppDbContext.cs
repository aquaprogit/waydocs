using Microsoft.EntityFrameworkCore;

namespace Waydocs.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Doc> Docs => Set<Doc>();
    public DbSet<Revision> Revisions => Set<Revision>();
    public DbSet<DocRef> DocRefs => Set<DocRef>();
    public DbSet<DocLink> DocLinks => Set<DocLink>();
    public DbSet<ExportState> ExportStates => Set<ExportState>();

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

        b.Entity<DocLink>(e =>
        {
            e.HasKey(x => x.Id);
            // Both FKs point at Doc — SQL Server would reject two cascade paths to the same table; keep both
            // Restrict (harmless here since docs are never hard-deleted) so the model is portable either way.
            e.HasOne<Doc>().WithMany().HasForeignKey(x => x.FromDocId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Doc>().WithMany().HasForeignKey(x => x.ToDocId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.FromDocId);
            e.HasIndex(x => x.ToDocId);
        });

        b.Entity<ExportState>(e => e.HasKey(x => x.DocId));
    }
}
