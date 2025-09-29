import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

export function getadoprojects_ps(server) {
  const execAsync = promisify(exec);

  server.tool(
    "get-projects-ps",
    {
      org: z.string(),
    },
    {
      description: "Fetch projects from ADO org",
    },
    async (args) => {
      try {
        const { stdout } = await execAsync(`pwsh -ExecutionPolicy Bypass -File ./scripts/Get-AdoProjects.ps1 ${args.org}`);
       
        return { content: [{ type: "text", text: stdout }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `❌ Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
