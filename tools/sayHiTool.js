import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

export function sayHiTool(server) {
  const execAsync = promisify(exec);

  server.tool(
    "say-hi",
    {
      name: z.string(),
    },
    {
      description: "Say hi using shell script",
    },
    async (args) => {
      try {
        const { stdout } = await execAsync(`bash ./scripts/say-hi.sh ${args.name}`);
        return { content: [{ type: "text", text: stdout }] };
      } catch (error) {
        return { content: [{ type: "text", text: `❌ Error: ${error.message}` }], isError: true };
      }
    }
  );
}