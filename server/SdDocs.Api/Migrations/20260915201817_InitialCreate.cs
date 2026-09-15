using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SdDocs.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Docs",
                columns: table => new
                {
                    Id = table.Column<string>(type: "TEXT", nullable: false),
                    Domain = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedUtc = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Docs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExportStates",
                columns: table => new
                {
                    DocId = table.Column<string>(type: "TEXT", nullable: false),
                    Path = table.Column<string>(type: "TEXT", nullable: false),
                    ExportedHash = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExportStates", x => x.DocId);
                });

            migrationBuilder.CreateTable(
                name: "DocLinks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    FromDocId = table.Column<string>(type: "TEXT", nullable: false),
                    ToDocId = table.Column<string>(type: "TEXT", nullable: false),
                    Type = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DocLinks_Docs_FromDocId",
                        column: x => x.FromDocId,
                        principalTable: "Docs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DocLinks_Docs_ToDocId",
                        column: x => x.ToDocId,
                        principalTable: "Docs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DocRefs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DocId = table.Column<string>(type: "TEXT", nullable: false),
                    Type = table.Column<string>(type: "TEXT", nullable: false),
                    Value = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocRefs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DocRefs_Docs_DocId",
                        column: x => x.DocId,
                        principalTable: "Docs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Revisions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DocId = table.Column<string>(type: "TEXT", nullable: false),
                    Number = table.Column<int>(type: "INTEGER", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Summary = table.Column<string>(type: "TEXT", nullable: false),
                    Kind = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    AnswersJson = table.Column<string>(type: "TEXT", nullable: false),
                    NotCoveredJson = table.Column<string>(type: "TEXT", nullable: false),
                    RefsJson = table.Column<string>(type: "TEXT", nullable: false),
                    LinksJson = table.Column<string>(type: "TEXT", nullable: false),
                    Content = table.Column<string>(type: "TEXT", nullable: false),
                    ContentHash = table.Column<string>(type: "TEXT", nullable: false),
                    Tokens = table.Column<int>(type: "INTEGER", nullable: false),
                    HeaderTokens = table.Column<int>(type: "INTEGER", nullable: false),
                    MapTokens = table.Column<int>(type: "INTEGER", nullable: false),
                    SectionsJson = table.Column<string>(type: "TEXT", nullable: false),
                    OpenGaps = table.Column<int>(type: "INTEGER", nullable: false),
                    Message = table.Column<string>(type: "TEXT", nullable: false),
                    Ticket = table.Column<string>(type: "TEXT", nullable: true),
                    Author = table.Column<string>(type: "TEXT", nullable: false),
                    Source = table.Column<string>(type: "TEXT", nullable: false),
                    BackendCommit = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedUtc = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Revisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Revisions_Docs_DocId",
                        column: x => x.DocId,
                        principalTable: "Docs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DocLinks_FromDocId",
                table: "DocLinks",
                column: "FromDocId");

            migrationBuilder.CreateIndex(
                name: "IX_DocLinks_ToDocId",
                table: "DocLinks",
                column: "ToDocId");

            migrationBuilder.CreateIndex(
                name: "IX_DocRefs_DocId",
                table: "DocRefs",
                column: "DocId");

            migrationBuilder.CreateIndex(
                name: "IX_DocRefs_Type_Value",
                table: "DocRefs",
                columns: new[] { "Type", "Value" });

            migrationBuilder.CreateIndex(
                name: "IX_Docs_Domain",
                table: "Docs",
                column: "Domain");

            migrationBuilder.CreateIndex(
                name: "IX_Revisions_DocId_Number",
                table: "Revisions",
                columns: new[] { "DocId", "Number" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DocLinks");

            migrationBuilder.DropTable(
                name: "DocRefs");

            migrationBuilder.DropTable(
                name: "ExportStates");

            migrationBuilder.DropTable(
                name: "Revisions");

            migrationBuilder.DropTable(
                name: "Docs");
        }
    }
}
