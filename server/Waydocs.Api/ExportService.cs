using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Waydocs.Api.Data;

namespace Waydocs.Api;

/// <summary>
/// Mirrors each doc's current revision to a markdown file under the configured export path (Docs:ExportPath),
/// with a YAML frontmatter header, so existing skills/CLAUDE.md paths that `Read` those files keep working.
/// Refuses to overwrite a file that was hand-edited since the last export — check_docs reports the drift instead.
/// </summary>
public class ExportService(AppDbContext db, IConfiguration config, ILogger<ExportService> logger)
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    public async Task ExportAsync(string id)
    {
        var exportRoot = config["Docs:ExportPath"];
        if (string.IsNullOrEmpty(exportRoot)) return;

        var doc = await db.Docs.FindAsync(id);
        if (doc == null) return;
        var rev = await db.Revisions.Where(r => r.DocId == id).OrderByDescending(r => r.Number).FirstOrDefaultAsync();
        if (rev == null) return;

        var relPath = MarkdownUtil.IdToPath(id);
        var fullPath = Path.Combine(exportRoot, relPath.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        var existing = await db.ExportStates.FindAsync(id);
        if (existing != null && File.Exists(fullPath))
        {
            var onDisk = await File.ReadAllTextAsync(fullPath);
            if (MarkdownUtil.Sha256(onDisk) != existing.ExportedHash)
            {
                logger.LogWarning("Export skipped for {Id}: {Path} changed on disk since the last export (hand edit?).", id, fullPath);
                return;
            }
        }

        var full = BuildFrontmatter(id, rev) + $"# {rev.Title}\n\n{rev.Content}";
        await File.WriteAllTextAsync(fullPath, full);
        var hash = MarkdownUtil.Sha256(full);

        if (existing == null) db.ExportStates.Add(new ExportState { DocId = id, Path = relPath, ExportedHash = hash });
        else existing.ExportedHash = hash;
        await db.SaveChangesAsync();
    }

    /// <summary>Removes the exported markdown file (if any) along with its export-tracking row. Best-effort:
    /// a missing export path or file is not an error, since not every deployment exports to disk at all.</summary>
    public async Task DeleteAsync(string id)
    {
        var exportRoot = config["Docs:ExportPath"];
        if (!string.IsNullOrEmpty(exportRoot))
        {
            var fullPath = Path.Combine(exportRoot, MarkdownUtil.IdToPath(id).Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(fullPath)) File.Delete(fullPath);
        }

        var existing = await db.ExportStates.FindAsync(id);
        if (existing != null)
        {
            db.ExportStates.Remove(existing);
            await db.SaveChangesAsync();
        }
    }

    private static string BuildFrontmatter(string id, Revision r)
    {
        var refs = JsonSerializer.Deserialize<List<DocRefDto>>(r.RefsJson, JsonOpts) ?? [];
        var lines = new List<string> { "---", $"id: {id}", $"status: {r.Status}", $"revision: {r.Number}", $"updated: {r.CreatedUtc}" };
        foreach (var g in refs.GroupBy(x => x.Type))
            lines.Add($"{g.Key}s: [{string.Join(", ", g.Select(x => x.Value))}]");
        lines.Add("---");
        return string.Join('\n', lines) + "\n\n";
    }
}
