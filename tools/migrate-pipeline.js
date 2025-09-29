import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

export function Migrate_Yml_Pipeline(server) {
  const execAsync = promisify(exec);

  server.tool(
    "migrate-custom-pipeline-ps",
    {
      org: z.string(),
      project: z.string(),
      repo: z.string(),
      githubOrg: z.string(),
      githubRepo: z.string(),
    },
    {
      description: "Migrate Custom Pipeline  to GitHub",
    },
    async (args) => {
      try {
        const { stdout, stderr } = await execAsync(
          `pwsh -ExecutionPolicy Bypass -File ./scripts/migrate-pipeline.ps1 $AdoOrg ${args.org} $AdoProject ${args.project} $AdoRepo ${args.repo} $GithubOwner ${args.githubOrg} $GithubRepo ${args.githubRepo}`,
          {
            timeout: 10 * 60 * 1000,   // 10 minutes
            maxBuffer: 20 * 1024 * 1024, // 20 MB buffer
          }
        );

        if (stderr && stderr.trim().length > 0) {
          return {
            content: [{ type: "text", text: `⚠️ Stderr: ${stderr}` }],
            isError: false,
          };
        }

        return { content: [{ type: "text", text: stdout || "✅ Migration finished" }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `❌ Error: ${error.message}\n${error.stderr || ""}` }],
          isError: true,
        };
      }
    }
  );
}
