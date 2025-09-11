// tools/migrateRepo.js
import { z } from "zod";
import { exec } from "child_process";
import path from "path";

export function registerMigrateRepoTool(server) {
  server.tool(
    "migrate_repo",
    {
      AdoOrg: z.string(),
      AdoProject: z.string(),
      AdoRepo: z.string(),
      GithubOwner: z.string(),
      GithubRepo: z.string(),
      Public: z.boolean().optional(),
    },
    async ({ AdoOrg, AdoProject, AdoRepo, GithubOwner, GithubRepo, Public }) => {
      return new Promise((resolve, reject) => {
        const scriptPath = path.resolve("./Migrate-Repo.ps1");

        const cmd = `pwsh -File "${scriptPath}" -AdoOrg "${AdoOrg}" -AdoProject "${AdoProject}" -AdoRepo "${AdoRepo}" -GithubOwner "${GithubOwner}" -GithubRepo "${GithubRepo}" ${Public ? "-Public" : ""}`;

        exec(cmd, { env: process.env }, (error, stdout, stderr) => {
          if (error) {
            reject({
              content: [{ type: "text", text: `❌ Migration failed: ${stderr || error.message}` }],
            });
            return;
          }

          resolve({
            content: [{ type: "text", text: `✅ Migration completed:\n${stdout}` }],
          });
        });
      });
    }
  );
}
