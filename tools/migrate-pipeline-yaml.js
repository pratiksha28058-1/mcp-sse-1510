import { z } from "zod";
import { spawn } from "child_process";

export function migrateADOPipelineTool(server) {
  server.tool(
    "migrate_ado_pipeline",
    {
      githubOwner: z.string().min(1, "GitHub Owner is required"),
      githubRepo: z.string().min(1, "GitHub Repo is required"),
      pipelineId: z.string().optional(),
    },
    async ({ githubOwner, githubRepo, pipelineId }) => {
      return new Promise((resolve, reject) => {
        // Build PowerShell command
        const psCommand = [
          "pwsh",
          "-NoProfile",
          "-NonInteractive",
          "-File",
          "./scripts/Migrate_Yaml_Pipeline_v01.ps1",
          "-GithubOwner", `"${githubOwner}"`,
          "-GithubRepo", `"${githubRepo}"`,
        ];

        if (pipelineId) psCommand.push("-pipeline_id", `"${pipelineId}"`);

        console.log("👉 Running command:", psCommand.join(" "));

        const ps = spawn(psCommand[0], psCommand.slice(1), {
          stdio: "pipe",
          shell: true,
          env: process.env, // pass current env including ADO_PAT/GITHUB_PAT
        });

        let output = "";
        let errorOutput = "";

        ps.stdout.on("data", (data) => {
          output += data.toString();
        });

        ps.stderr.on("data", (data) => {
          errorOutput += data.toString();
        });

        ps.on("close", (code) => {
          if (code === 0) {
            resolve({
              content: [
                {
                  type: "text",
                  text: `✅ Migration completed successfully!\n\nOutput:\n${output}`,
                },
              ],
            });
          } else {
            resolve({
              content: [
                {
                  type: "text",
                  text: `❌ Migration failed (exit code ${code})\n\n${errorOutput}`,
                },
              ],
            });
          }
        });
      });
    }
  );
}