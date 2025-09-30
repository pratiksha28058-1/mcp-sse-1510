// tools/migratePR.js
import { z } from "zod";
import { execSync } from "child_process";

export function registerMigratePRTool(server, context) {
  server.tool(
    "migrate-prs",
    {
      githubOwner: z.string().describe("GitHub owner/org name"),
      githubRepo: z.string().describe("Target GitHub repo name"),
    },
    async ({ githubOwner, githubRepo }) => {
      if (!context.ado?.selectedOrg || !context.ado?.adoproj?.length) {
        return {
          content: [{ type: "text", text: "❌ ADO org/project not set. Run scan-all-orgs tool first." }],
          isError: true,
        };
      }

      const adoOrg = context.ado.selectedOrg;
      const adoProject = context.ado.adoproj[0];

      try {
        const cmd = `gh ado2gh pr migrate --ado-org ${adoOrg} --ado-project ${adoProject} --github-owner ${githubOwner} --github-repo ${githubRepo}`;
        const result = execSync(cmd, { encoding: "utf-8" });
        return { content: [{ type: "text", text: `✅ PR migration complete:\n${result}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `❌ Error: ${err.message}` }], isError: true };
      }
    }
  );
}
