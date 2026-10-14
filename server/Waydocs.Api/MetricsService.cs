using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Waydocs.Api.Data;

namespace Waydocs.Api;

/// <summary>
/// Records how many tokens each MCP tool call actually returned versus how many the agent would have spent
/// reading, once per session, the full body of every doc it actually opened — the "what Waydocs saves you"
/// number. Discovery calls (map, search, header, history…) count as pure cost; writes aren't metered at all.
/// Stored per project in the same SQLite file as the docs it measures (see AppDbContext), so it moves with the
/// project the same way .waydocs/docs.db already does.
/// </summary>
public class MetricsService(AppDbContext db)
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    /// <summary>BaselineTokens is computed here from each doc's live current revision, not from a number the
    /// caller supplies, so it stays correct even if the doc changed since the agent last fetched its header.
    /// A doc already credited earlier in the same session contributes 0 — a raw-file agent would still have it
    /// in context — and docs that no longer exist (e.g. deleted since the call) contribute 0 too.</summary>
    public async Task RecordAsync(string tool, string sessionId, List<string> docIds, int actualTokens)
    {
        var alreadyRead = new HashSet<string>();
        if (sessionId != "")
        {
            var prior = await db.ToolUsages.AsNoTracking().Where(u => u.SessionId == sessionId).Select(u => u.DocIdsJson).ToListAsync();
            foreach (var json in prior) alreadyRead.UnionWith(JsonSerializer.Deserialize<List<string>>(json, JsonOpts) ?? []);
        }

        var credited = new List<string>();
        var baseline = 0;
        foreach (var id in docIds.Distinct().Where(alreadyRead.Add))
        {
            var rev = await db.Revisions.Where(r => r.DocId == id).OrderByDescending(r => r.Number).FirstOrDefaultAsync();
            if (rev == null) continue;
            credited.Add(id);
            baseline += rev.Tokens;
        }

        db.ToolUsages.Add(new ToolUsage
        {
            Tool = tool,
            SessionId = sessionId,
            DocIdsJson = JsonSerializer.Serialize(credited, JsonOpts),
            BaselineTokens = baseline,
            ActualTokens = actualTokens,
            CreatedUtc = DateTime.UtcNow.ToString("o"),
        });
        await db.SaveChangesAsync();
    }

    public async Task<ToolUsageSummaryDto> SummaryAsync(int? sinceDays)
    {
        var query = db.ToolUsages.AsNoTracking().AsQueryable();
        string? since = null;
        if (sinceDays.HasValue)
        {
            since = DateTime.UtcNow.AddDays(-sinceDays.Value).ToString("o");
            query = query.Where(u => string.Compare(u.CreatedUtc, since) >= 0);
        }
        var rows = await query.ToListAsync();

        var byTool = rows.GroupBy(r => r.Tool)
            .Select(g => new ToolUsageByToolDto(g.Key, g.Count(), g.Sum(x => x.BaselineTokens), g.Sum(x => x.ActualTokens),
                g.Sum(x => x.BaselineTokens) - g.Sum(x => x.ActualTokens)))
            .OrderByDescending(t => t.SavedTokens)
            .ToList();

        // CreatedUtc is always "o"-formatted ("2026-09-24T00:47:01...Z"), so its first 10 chars are the UTC date.
        var daily = rows.GroupBy(r => r.CreatedUtc[..10])
            .Select(g => new ToolUsageDailyDto(g.Key, g.Count(), g.Sum(x => x.BaselineTokens), g.Sum(x => x.ActualTokens),
                g.Sum(x => x.BaselineTokens) - g.Sum(x => x.ActualTokens)))
            .OrderBy(d => d.Date, StringComparer.Ordinal)
            .ToList();

        var baselineTotal = rows.Sum(r => r.BaselineTokens);
        var actualTotal = rows.Sum(r => r.ActualTokens);
        return new ToolUsageSummaryDto(
            rows.Count, baselineTotal, actualTotal, baselineTotal - actualTotal, byTool, daily, since,
            rows.Count > 0 ? rows.Min(r => r.CreatedUtc) : null,
            rows.Count > 0 ? rows.Max(r => r.CreatedUtc) : null);
    }
}
