using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Waydocs.Api.Migrations
{
    /// <inheritdoc />
    public partial class ScopeToolUsageToSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SessionId",
                table: "ToolUsages",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_ToolUsages_SessionId",
                table: "ToolUsages",
                column: "SessionId");

            // Re-score rows recorded under the old rule (every doc a call so much as listed counted as a full
            // read, per call) with the new one — see MetricsService.RecordAsync. Those rows carry no session
            // id, so one UTC day stands in for one session. Writes and usage_stats are no longer metered.
            migrationBuilder.Sql("DELETE FROM ToolUsages WHERE Tool IN ('save_doc', 'revert_doc', 'usage_stats');");
            migrationBuilder.Sql("UPDATE ToolUsages SET SessionId = 'legacy-' || substr(CreatedUtc, 1, 10);");
            migrationBuilder.Sql("UPDATE ToolUsages SET BaselineTokens = 0, DocIdsJson = '[]' WHERE Tool <> 'get_doc';");
            migrationBuilder.Sql(
                "UPDATE ToolUsages SET BaselineTokens = 0, DocIdsJson = '[]' WHERE Tool = 'get_doc' AND Id NOT IN " +
                "(SELECT MIN(Id) FROM ToolUsages WHERE Tool = 'get_doc' GROUP BY SessionId, DocIdsJson);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ToolUsages_SessionId",
                table: "ToolUsages");

            migrationBuilder.DropColumn(
                name: "SessionId",
                table: "ToolUsages");
        }
    }
}
