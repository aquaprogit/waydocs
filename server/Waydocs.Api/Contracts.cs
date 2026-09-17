namespace Waydocs.Api;

// Mirrors web/src/types.ts exactly (camelCase is the ASP.NET Core minimal-API JSON default) so the web app's
// httpApi.ts is a thin fetch wrapper with no reshaping.

public record DocRefDto(string Type, string Value);

public record DocLinkDto(string To, string Type);

public record SectionInfoDto(string Heading, string Slug, int Level, int Tokens);

public record DocHeaderDto(
    string Id, string Domain, string Title, string Summary, string Kind, string Status,
    List<string> Answers, List<string> NotCovered, List<DocRefDto> Refs, List<DocLinkDto> Links,
    int Revision, int CurrentRevision, string Updated, string UpdatedBy,
    int Tokens, int HeaderTokens, int MapTokens, List<SectionInfoDto> Sections, int OpenGaps);

public record DocFullDto(DocHeaderDto Header, string Content);

public record DocHeaderInput(
    string Title, string Summary, string Kind, string Status,
    List<string> Answers, List<string> NotCovered, List<DocRefDto> Refs, List<DocLinkDto> Links);

public record SaveRequest(
    string Id, DocHeaderInput Header, string Content, string Message, string? Ticket, int? BaseRevision);

public record SaveResult(bool Changed, int Revision, int Added, int Removed);

public record SectionsRequest(List<string> Headings);
public record SectionsResult(string Content, int Tokens);

public record HistoryItemDto(
    int Number, int? Parent, string Title, int Tokens, string Message, string? Ticket,
    string Author, string Source, string CreatedUtc);

public record DiffResult(string Before, string After);

public record SearchHitDto(DocHeaderDto Header, double Score, string Field, string Snippet);

public record GraphEdgeDto(string From, string To, string Type, bool Auto);
public record GraphDataDto(List<DocHeaderDto> Nodes, List<GraphEdgeDto> Edges);

public record TitledEdgeDto(string From, string To, string Type, bool Auto, string Title);
public record DocStubDto(string Id, string Title);
public record SharedRefDto(DocRefDto Ref, List<DocStubDto> Docs);
public record DocLinksDto(List<TitledEdgeDto> Outgoing, List<TitledEdgeDto> Incoming, List<SharedRefDto> SharedRefs);

public record ChangelogItemDto(
    string DocId, string Title, int Number, string Message, string? Ticket,
    string Author, string Source, string CreatedUtc);

public record ChangelogFilter(int? SinceDays, string? Ticket, bool? IncludeImports);

public record GapItemDto(string DocId, string Title, string Text);

public record CheckIssueDto(string DocId, string Severity, string Kind, string Detail);

public record LinkRequest(string From, string To, string Type, string Message);
public record RevertRequest(int To, string Message);

public record ImportItem(
    string Id, string Title, string Summary, string Kind, List<DocRefDto> Refs, string Content, string SourcePath);
public record ImportResult(int Imported, int Skipped);

public class ApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
