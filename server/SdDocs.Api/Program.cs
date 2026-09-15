using Microsoft.EntityFrameworkCore;
using SdDocs.Api;
using SdDocs.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// SQLite file: <repo-root>/data/docs.db by default (repo root = two levels above this project), same layout
// as timesheet-editor.
var dbPath = builder.Configuration["Docs:DbPath"]
    ?? Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "data", "docs.db"));
Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);

builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite($"Data Source={dbPath}"));
builder.Services.AddScoped<ExportService>();
builder.Services.AddScoped<DocService>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins("http://localhost:5183", "http://127.0.0.1:5183", "http://localhost:4183", "http://127.0.0.1:4183")
    .AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.Migrate();

app.UseCors();

// One place to turn a validation/conflict/not-found ApiException into the {error} JSON shape the web app's
// httpApi.ts (and the MCP client) already know how to read.
app.Use(async (ctx, next) =>
{
    try
    {
        await next();
    }
    catch (ApiException ex)
    {
        ctx.Response.StatusCode = ex.Status;
        await ctx.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
});

var api = app.MapGroup("/api");

api.MapGet("/docs", async (DocService svc) => await svc.ListDocsAsync());

api.MapGet("/doc", async (string id, int? rev, DocService svc) => await svc.GetDocAsync(id, rev));

api.MapPost("/doc/sections", async (string id, SectionsRequest req, DocService svc) => await svc.GetSectionsAsync(id, req.Headings));

api.MapGet("/search", async (string q, bool? headersOnly, int? limit, DocService svc) =>
    await svc.SearchAsync(q, headersOnly ?? false, limit ?? 20));

api.MapGet("/find", async (string type, string value, DocService svc) => await svc.FindAsync(type, value));

api.MapGet("/known-refs", async (DocService svc) => await svc.KnownRefsAsync());

api.MapGet("/graph", async (DocService svc) => await svc.GraphAsync());

api.MapGet("/links", async (string id, DocService svc) => await svc.LinksAsync(id));

api.MapGet("/history", async (string id, DocService svc) => await svc.HistoryAsync(id));

api.MapGet("/diff", async (string id, int from, int to, DocService svc) => await svc.DiffAsync(id, from, to));

api.MapPut("/doc", async (SaveRequest req, string? author, string? source, DocService svc) =>
    await svc.SaveAsync(req, author ?? "Vladyslav", source ?? "web"));

api.MapPost("/link", async (LinkRequest req, string? author, string? source, DocService svc) =>
    await svc.LinkAsync(req.From, req.To, req.Type, req.Message, author ?? "Vladyslav", source ?? "web"));

api.MapPost("/revert", async (string id, RevertRequest req, string? author, string? source, DocService svc) =>
    await svc.RevertAsync(id, req.To, req.Message, author ?? "Vladyslav", source ?? "web"));

api.MapGet("/changelog", async (int? sinceDays, string? ticket, bool? includeImports, DocService svc) =>
    await svc.ChangelogAsync(new ChangelogFilter(sinceDays, ticket, includeImports)));

api.MapGet("/gaps", async (DocService svc) => await svc.GapsAsync());

api.MapGet("/check", async (DocService svc) => await svc.CheckAsync());

api.MapGet("/source", async (DocService svc) => new { source = await svc.SourceAsync() });

api.MapPost("/import", async (List<ImportItem> items, DocService svc) => await svc.ImportAsync(items));

app.MapGet("/", () => Results.Redirect("/api/docs"));

app.Run();
