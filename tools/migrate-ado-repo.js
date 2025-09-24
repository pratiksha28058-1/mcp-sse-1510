import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

export function migraterepo(server) {
  const execAsync = promisify(exec);

  server.tool(
    "migrate-repo-ps",
    {
      githubOrg: z.string(),
      githubRepo: z.string(),
    },
    {
      description: "Migrate ADO repo to GitHub (select org/project/repo from scan)",
    },
    async (args) => {
      try {
        // 1️⃣ Run the selection script first
        const { stdout: scanOutput } = await execAsync(
          `pwsh -ExecutionPolicy Bypass -File ./scripts/Select-Repo.ps1`,
          { timeout: 2 * 60 * 1000 } // 2 minutes
        );

        // 2️⃣ Parse JSON output
        const selection = JSON.parse(scanOutput.trim());
        const { Organization, Project, Repository } = selection;

        // 3️⃣ Run migration script with selected values
        const { stdout, stderr } = await execAsync(
          `pwsh -ExecutionPolicy Bypass -File ./scripts/Migraterepo_v0.2.ps1 $AdoOrg ${Organization} $AdoProject ${Project} $AdoRepo ${Repository} $GithubOwner ${args.githubOrg} $GithubRepo ${args.githubRepo}`,
          {
            timeout: 10 * 60 * 1000,
            maxBuffer: 20 * 1024 * 1024,
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