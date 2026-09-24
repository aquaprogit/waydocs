using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Waydocs.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddToolUsage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ToolUsages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Tool = table.Column<string>(type: "TEXT", nullable: false),
                    DocIdsJson = table.Column<string>(type: "TEXT", nullable: false),
                    BaselineTokens = table.Column<int>(type: "INTEGER", nullable: false),
                    ActualTokens = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedUtc = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ToolUsages", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ToolUsages_CreatedUtc",
                table: "ToolUsages",
                column: "CreatedUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ToolUsages_Tool",
                table: "ToolUsages",
                column: "Tool");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ToolUsages");
        }
    }
}
