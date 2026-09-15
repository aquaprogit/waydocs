namespace SdDocs.Api.Data;

public class Doc
{
    public string Id { get; set; } = "";           // e.g. "order/discount-reference", "README"
    public string Domain { get; set; } = "";
    public string CreatedUtc { get; set; } = "";

    public List<Revision> Revisions { get; set; } = new();
    public List<DocRef> Refs { get; set; } = new();
}

/// <summary>
/// One append-only save. "Current" is simply the row with the highest Number for a DocId — there is no
/// separate current-pointer column, which avoids a cyclic FK between Doc and Revision.
/// </summary>
public class Revision
{
    public int Id { get; set; }
    public string DocId { get; set; } = "";
    public int Number { get; set; }

    // header
    public string Title { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Kind { get; set; } = "Feature";
    public string Status { get; set; } = "Current";
    public string AnswersJson { get; set; } = "[]";
    public string NotCoveredJson { get; set; } = "[]";
    public string RefsJson { get; set; } = "[]";       // [{type,value}]
    public string LinksJson { get; set; } = "[]";      // [{to,type}] — manual links only

    public string Content { get; set; } = "";
    public string ContentHash { get; set; } = "";

    // computed once at save time (see MarkdownUtil) — never recomputed on read
    public int Tokens { get; set; }
    public int HeaderTokens { get; set; }
    public int MapTokens { get; set; }
    public string SectionsJson { get; set; } = "[]";
    public int OpenGaps { get; set; }

    public string Message { get; set; } = "";
    public string? Ticket { get; set; }
    public string Author { get; set; } = "Vladyslav"; // Claude | Vladyslav
    public string Source { get; set; } = "web";       // mcp | web | import
    public string? BackendCommit { get; set; }
    public string CreatedUtc { get; set; } = "";

    public Doc Doc { get; set; } = null!;
}

/// <summary>Materialized from the current revision's RefsJson on every save — powers find/search/graph without
/// deserializing JSON for every doc on every request.</summary>
public class DocRef
{
    public int Id { get; set; }
    public string DocId { get; set; } = "";
    public string Type { get; set; } = "";
    public string Value { get; set; } = "";

    public Doc Doc { get; set; } = null!;
}

/// <summary>Materialized manual (author-set) links only — related/depends-on/supersedes/conflicts-with.
/// part-of and mentions are never stored: they're recomputed at read time from Doc.Domain and Content.</summary>
public class DocLink
{
    public int Id { get; set; }
    public string FromDocId { get; set; } = "";
    public string ToDocId { get; set; } = "";
    public string Type { get; set; } = "";
}

/// <summary>Tracks what was last written to SD-Backend/docs so a hand-edit there is detected instead of
/// silently overwritten on the next export.</summary>
public class ExportState
{
    public string DocId { get; set; } = "";
    public string Path { get; set; } = "";
    public string ExportedHash { get; set; } = "";
}
