import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

export function getadoprojects(server) {
  const execAsync = promisify(exec);

  server.tool(
    "get-projects",
    {
      org: z.string(),
    },
    {
      description: "Fetch projects from ADO org",
    },
    async (args) => {
      try {
        const { stdout } = await execAsync(`bash ./scripts/get-ado-projects.sh ${args.org}`);
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