using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Waydocs.Api.Data;

namespace Waydocs.Api;

/// <summary>
/// Records how many tokens each MCP tool call actually returned versus how many the agent would have spent
/// reading the full current body of every doc that call touched instead — the "what Waydocs saves you" number.
/// Stored per project in the same SQLite file as the docs it measures (see AppDbContext), so it moves with the
/// project the same way .waydocs/docs.db already does.
/// </summary>
public class MetricsService(AppDbContext db)
{
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    /// <summary>BaselineTokens is computed here from each doc's live current revision, not from a number the
    /// caller supplies, so it stays correct even if the doc changed since the agent last fetched its header.
    /// Docs that no longer exist (e.g. deleted since the call) simply contribute 0.</summary>
    public async Task RecordAsync(string tool, List<string> docIds, int actualTokens)
    {
        var distinct = docIds.Distinct().ToList();
        var baseline = 0;
        foreach (var id in distinct)
        {
            var rev = await db.Revisions.Where(r => r.DocId == id).OrderByDescending(r => r.Number).FirstOrDefaultAsync();
            if (rev != null) baseline += rev.Tokens;
        }

        db.ToolUsages.Add(new ToolUsage
        {
            Tool = tool,
            DocIdsJson = JsonSerializer.Serialize(distinct, JsonOpts),
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
