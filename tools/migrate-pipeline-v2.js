import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

export function migratepipelineyaml(server) {
  const execAsync = promisify(exec);

  server.tool(
    "migrate-pipeline-ps",
    {
      adoOrg: z.string().optional(),
      adoProject: z.string().optional(),
      adoRepo: z.string().optional(),
      githubOwner: z.string(),
      githubRepo: z.string(),
    //   pipelineId: z.string(),
    },
    async (args) => {
      const { adoOrg, adoProject, adoRepo, githubOwner, githubRepo, pipelineId } = args;

      const psCommand = `pwsh -ExecutionPolicy Bypass -File ./scripts/migrate-pipeline-v2.ps1 `
        + `${adoOrg ? `-AdoOrg "${adoOrg}" ` : ""}`
        + `${adoProject ? `-AdoProject "${adoProject}" ` : ""}`
        + `${adoRepo ? `-AdoRepo "${adoRepo}" ` : ""}`
        + `-GithubOwner "${githubOwner}" `
        + `-GithubRepo "${githubRepo}" `
        // + `-pipeline_id "${pipelineId}"`;

      try {
        const { stdout, stderr } = await execAsync(psCommand, {
          timeout: 10 * 60 * 1000, // 10 minutes
          maxBuffer: 20 * 1024 * 1024, // 20 MB
        });

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