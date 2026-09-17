using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Waydocs.Api;

/// <summary>
/// Port of web/src/docmodel.ts's pure markdown helpers, kept in the API so save-time computation (sections,
/// gaps, token counts, auto edges) happens once per revision instead of being re-derived on every read.
/// </summary>
public static partial class MarkdownUtil
{
    public static int EstimateTokens(string s) => (int)Math.Ceiling(s.Length / 4.0);

    public static string Slugify(string s)
    {
        var lower = s.ToLowerInvariant();
        lower = TicksAndStars().Replace(lower, "");
        lower = NonSlug().Replace(lower, "-");
        return lower.Trim('-');
    }

    /// <summary>Blanks out fenced code blocks so heading/link/gap scans ignore their contents.</summary>
    public static string StripFences(string content)
    {
        var inFence = false;
        var lines = content.Split('\n');
        for (var i = 0; i < lines.Length; i++)
        {
            if (FenceLine().IsMatch(lines[i]))
            {
                inFence = !inFence;
                lines[i] = "";
            }
            else if (inFence)
            {
                lines[i] = "";
            }
        }
        return string.Join('\n', lines);
    }

    public sealed record SectionInfo(string Heading, string Slug, int Level, int Tokens);

    public static List<SectionInfo> ParseSections(string content)
    {
        var raw = content.Split('\n');
        var stripped = StripFences(content).Split('\n');
        var marks = new List<(int I, int Level, string Heading)>();
        for (var i = 0; i < stripped.Length; i++)
        {
            var m = Heading().Match(stripped[i]);
            if (m.Success) marks.Add((i, m.Groups[1].Value.Length, TicksStars().Replace(m.Groups[2].Value, "")));
        }
        var result = new List<SectionInfo>();
        for (var k = 0; k < marks.Count; k++)
        {
            var (i, level, heading) = marks[k];
            var end = raw.Length;
            for (var j = k + 1; j < marks.Count; j++)
            {
                if (marks[j].Level <= level)
                {
                    end = marks[j].I;
                    break;
                }
            }
            var slice = string.Join('\n', raw.Skip(i).Take(end - i));
            result.Add(new SectionInfo(heading, Slugify(heading), level, EstimateTokens(slice)));
        }
        return result;
    }

    /// <summary>Markdown of the named sections (matched by heading or slug), each including its sub-sections.</summary>
    public static string ExtractSections(string content, IEnumerable<string> names)
    {
        var wanted = new HashSet<string>(names.Select(Slugify));
        var stripped = StripFences(content).Split('\n');
        var raw = content.Split('\n');
        var outParts = new List<string>();
        for (var i = 0; i < stripped.Length; i++)
        {
            var m = Heading().Match(stripped[i]);
            if (!m.Success || !wanted.Contains(Slugify(m.Groups[2].Value))) continue;
            var level = m.Groups[1].Value.Length;
            var end = raw.Length;
            for (var j = i + 1; j < stripped.Length; j++)
            {
                var n = Heading().Match(stripped[j]);
                if (n.Success && n.Groups[1].Value.Length <= level)
                {
                    end = j;
                    break;
                }
            }
            outParts.Add(string.Join('\n', raw.Skip(i).Take(end - i)).TrimEnd());
        }
        return string.Join("\n\n", outParts);
    }

    public static List<string> ExtractGaps(string content)
    {
        var lines = StripFences(content).Split('\n');
        var gaps = new List<string>();
        for (var i = 0; i < lines.Length; i++)
        {
            if (!lines[i].Contains("[DOC GAP]")) continue;
            var block = new List<string> { lines[i] };
            while (i + 1 < lines.Length && lines[i + 1].TrimStart().StartsWith('>')) block.Add(lines[++i]);
            var text = string.Join(' ', block.Select(l => BlockquotePrefix().Replace(l, "")));
            text = GapTag().Replace(text, "");
            text = TicksStars().Replace(text, "");
            text = Whitespace().Replace(text, " ").Trim();
            gaps.Add(text);
        }
        return gaps;
    }

    public static List<string> MarkdownLinks(string content)
    {
        var links = new List<string>();
        foreach (Match m in MdLink().Matches(StripFences(content))) links.Add(m.Groups[1].Value);
        return links;
    }

    public sealed record Resolved(string Kind, string? Id, string? Anchor, string? Path);

    public static string IdToPath(string id) => id == "README" ? "README.md" : $"domains/{id}.md";

    public static string DomainOf(string id) => id == "README" ? "root" : id.Split('/')[0];

    public static bool IsIndex(string id) => id == "README" || id.EndsWith("/README");

    /// <summary>Folder index a doc belongs to: order/x -&gt; order/README, order/README -&gt; README.</summary>
    public static string? ParentIndex(string id)
    {
        if (id == "README") return null;
        var segs = id.Split('/').ToList();
        if (segs[^1] == "README") segs.RemoveAt(segs.Count - 1);
        segs.RemoveAt(segs.Count - 1);
        return segs.Count == 0 ? "README" : $"{string.Join('/', segs)}/README";
    }

    public static Resolved ResolveHref(string fromId, string href)
    {
        if (ExternalOrHash().IsMatch(href)) return new Resolved("external", null, null, null);
        var parts = href.Split('#', 2);
        var pathPart = parts[0];
        var anchor = parts.Length > 1 ? parts[1] : null;
        var segs = IdToPath(fromId).Split('/').ToList();
        segs.RemoveAt(segs.Count - 1);
        foreach (var seg in pathPart.Split('/'))
        {
            if (seg is "" or ".") continue;
            if (seg == "..")
            {
                if (segs.Count == 0) return new Resolved("outside", null, null, pathPart);
                segs.RemoveAt(segs.Count - 1);
            }
            else segs.Add(seg);
        }
        var joined = string.Join('/', segs);
        string? id = null;
        if (pathPart.EndsWith(".md"))
        {
            if (joined == "README.md") id = "README";
            else if (joined.StartsWith("domains/")) id = joined["domains/".Length..^3];
        }
        return id != null ? new Resolved("doc", id, anchor, null) : new Resolved("outside", null, null, pathPart);
    }

    public sealed record GraphEdge(string From, string To, string Type);

    /// <summary>part-of (folder membership) + mentions (inline links) — the two automatically-derived edge types.
    /// Never stored: recomputed from Doc.Domain and Content at read time, same as the mock prototype.</summary>
    public static List<GraphEdge> AutoEdges(string id, string content, HashSet<string> ids)
    {
        var edges = new List<GraphEdge>();
        var parent = ParentIndex(id);
        if (parent != null && ids.Contains(parent)) edges.Add(new GraphEdge(id, parent, "part-of"));
        var seen = new HashSet<string>();
        foreach (var href in MarkdownLinks(content))
        {
            var r = ResolveHref(id, href);
            if (r.Kind != "doc" || r.Id == id || r.Id == null || !ids.Contains(r.Id) || !seen.Add(r.Id)) continue;
            edges.Add(new GraphEdge(id, r.Id, "mentions"));
        }
        return edges;
    }

    public static string Sha256(string s) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s))).ToLowerInvariant();

    [GeneratedRegex(@"[`*_~]")]
    private static partial Regex TicksAndStars();
    [GeneratedRegex(@"[^a-z0-9æøå]+")]
    private static partial Regex NonSlug();
    [GeneratedRegex(@"^\s*```")]
    private static partial Regex FenceLine();
    [GeneratedRegex(@"^(#{2,3})\s+(.+?)\s*#*\s*$")]
    private static partial Regex Heading();
    [GeneratedRegex(@"[`*]")]
    private static partial Regex TicksStars();
    [GeneratedRegex(@"^\s*>\s?")]
    private static partial Regex BlockquotePrefix();
    [GeneratedRegex(@"\*\*\[DOC GAP\]\*\*|\[DOC GAP\]")]
    private static partial Regex GapTag();
    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
    [GeneratedRegex(@"(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+""[^""]*"")?\)")]
    private static partial Regex MdLink();
    [GeneratedRegex(@"^[a-z][a-z0-9+.\-]*:|^#|^/", RegexOptions.IgnoreCase)]
    private static partial Regex ExternalOrHash();
}
