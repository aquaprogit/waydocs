using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Waydocs.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveKindNotCoveredLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DocLinks");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "Revisions");

            migrationBuilder.DropColumn(
                name: "LinksJson",
                table: "Revisions");

            migrationBuilder.DropColumn(
                name: "NotCoveredJson",
                table: "Revisions");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "Revisions",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LinksJson",
                table: "Revisions",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NotCoveredJson",
                table: "Revisions",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

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

            migrationBuilder.CreateIndex(
                name: "IX_DocLinks_FromDocId",
                table: "DocLinks",
                column: "FromDocId");

            migrationBuilder.CreateIndex(
                name: "IX_DocLinks_ToDocId",
                table: "DocLinks",
                column: "ToDocId");
        }
    }
}
