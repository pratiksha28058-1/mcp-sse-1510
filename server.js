// server.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { registerexample } from "./tools/example.js";
//import { getadoprojects } from "./tools/get-ado-projects_sh.js";
import { getadoprojects_ps } from "./tools/get-ado-projects_PS.js";
import { getadoprojects } from "./tools/getadoProjects.js"; // <-- import your tool
import { sayHiTool } from "./tools/sayHiTool.js";
import { migraterepo } from "./tools/migrate-ado-repo.js";
// import { migrate_prs } from "./tools/migratePR.js";
import { registerMigratePRTool } from "./tools/migratePR.js";
import { Migrate_Yml_Pipeline } from "./tools/migrate-pipeline.js";

// Initialize server
const server = new McpServer({
  name: "ADO to GitHub Migration SSE Server",
  version: "1.0.0",
});


// Example tool
// server.tool("example_tool", { param: z.string() }, async ({ param }) => ({
//   content: [{ type: "text", text: `Processed: ${param}` }],
// }));

const app = express();
let transport;


registerexample(server);
getadoprojects(server);
sayHiTool(server);
getadoprojects_ps(server);
migraterepo(server);
// migrate_prs(server);
registerMigratePRTool(server);
Migrate_Yml_Pipeline(server);

// SSE endpoint
// HEAD check for /sse (must come before app.get)
app.head("/sse", (req, res) => {
  res.status(200).end();  // instant 200 response
});

// SSE endpoint
app.get("/sse", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});


// Message handler
app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res);
});

// Allow HEAD check for /messages
app.head("/messages", (req, res) => {
  res.status(200).end();
});



// Use PORT from environment (Azure injects PORT=8080)
const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`✅ MCP SSE server running on http://0.0.0.0:${port}/sse`);
});