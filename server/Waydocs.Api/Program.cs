using Microsoft.EntityFrameworkCore;
using Waydocs.Api;
using Waydocs.Api.Data;

// ContentRootPath is pinned to the exe's own directory (not cwd) so wwwroot — the bundled web UI, when
// present — resolves regardless of where the process is launched from. --path (below) is unrelated: it picks
// which project's docs to serve, not where this binary's own static assets live.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, ContentRootPath = AppContext.BaseDirectory });

// The project this instance serves: `--path <dir>` picks which project's docs to open,
// defaulting to the current directory. Its SQLite file lives at <path>/.waydocs/docs.db unless Docs:DbPath
// overrides it explicitly.
var projectPath = Path.GetFullPath(builder.Configuration["path"] ?? Environment.CurrentDirectory);
var usingDefaultDbPath = builder.Configuration["Docs:DbPath"] is null;
var dbPath = builder.Configuration["Docs:DbPath"]
    ?? Path.Combine(projectPath, ".waydocs", "docs.db");
var dbDir = Path.GetDirectoryName(dbPath)!;
Directory.CreateDirectory(dbDir);

// Consumers shouldn't have to remember to add .waydocs/ to their own .gitignore — only for the default
// location, since Docs:DbPath could point anywhere and we don't own that directory's contents.
if (usingDefaultDbPath)
{
    var gitignorePath = Path.Combine(dbDir, ".gitignore");
    if (!File.Exists(gitignorePath)) File.WriteAllText(gitignorePath, "*\n");
}

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

// Serves web/dist when it's been copied into wwwroot (see scripts/publish-api.ps1 / the CI workflow) — a
// no-op if wwwroot doesn't exist, e.g. a plain dev `dotnet run` with no bundled web build.
app.UseDefaultFiles();
app.UseStaticFiles();

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
    await svc.SaveAsync(req, author ?? "Human", source ?? "web"));

api.MapPost("/link", async (LinkRequest req, string? author, string? source, DocService svc) =>
    await svc.LinkAsync(req.From, req.To, req.Type, req.Message, author ?? "Human", source ?? "web"));

api.MapPost("/revert", async (string id, RevertRequest req, string? author, string? source, DocService svc) =>
    await svc.RevertAsync(id, req.To, req.Message, author ?? "Human", source ?? "web"));

api.MapGet("/changelog", async (int? sinceDays, string? ticket, bool? includeImports, DocService svc) =>
    await svc.ChangelogAsync(new ChangelogFilter(sinceDays, ticket, includeImports)));

api.MapGet("/gaps", async (DocService svc) => await svc.GapsAsync());

api.MapGet("/check", async (DocService svc) => await svc.CheckAsync());

api.MapGet("/source", async (DocService svc) => new { source = await svc.SourceAsync() });

api.MapPost("/import", async (List<ImportItem> items, DocService svc) => await svc.ImportAsync(items));

// Minimal-hosting routing is matched before this file's other middleware runs, so an unconditional MapGet("/")
// would win over UseStaticFiles's index.html even when a web build is bundled — only register the API-only
// fallback when there's no bundled UI to serve instead.
if (!File.Exists(Path.Combine(app.Environment.WebRootPath ?? "", "index.html")))
    app.MapGet("/", () => Results.Redirect("/api/docs"));

app.Run();
