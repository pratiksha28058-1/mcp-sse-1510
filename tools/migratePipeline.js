import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

export function migratepipelineyaml(server) {
  const execAsync = promisify(exec);

  server.tool(
    "migrate-pipeline-ps",
    // {
    //   org: z.string(),
    //   project: z.string(),
    //   repo: z.string(),
    //   githubOrg: z.string(),
    //   githubRepo: z.string(),
    // },
    {
      description: "Migrate ADO pipeline to GitHub",
    },
    async (args) => {
      try {
        const { stdout, stderr } = await execAsync(
          `pwsh -ExecutionPolicy Bypass -File ./scripts/Migrate_Yaml_Pipeline_v01.ps1`,
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