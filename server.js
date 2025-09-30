// server.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
// import { getadoprojects_ps } from "./tools/get-ado-projects_PS.js";
import { migratepipelineyaml } from "./tools/migratePipeline.js";
import { registerMigratePRTool } from "./tools/migratePR.js";
import { migraterepo } from "./tools/migrateRepo.js";
import { registerScanADOTool } from "./tools/scan-ado-full-serial.js";
// import { registerScanADOTool } from "./tools/scan-ado-full-migrate.js";


// Initialize server
const server = new McpServer({
  name: "ADO to GitHub Migration SSE Server",
  version: "1.0.0",
});

// Initialize a context object to share state between tools
const context = {};


const app = express();
let transport;


migratepipelineyaml(server, context);
migraterepo(server, context);
registerMigratePRTool(server, context);
//registerScanADOOrgsTool(server, context);
//registerScanADOTool(server, context);
registerScanADOTool(server, context);

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