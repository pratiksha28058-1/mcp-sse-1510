import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";

const server = new McpServer({
  name: "Example SSE Server",
  version: "1.0.0",
});


// Register toolssss

server.tool("example_tool", { param: z.string() }, async ({ param }) => ({
  content: [{ type: "text", text: `Processed: ${param}` }],
}));



const app = express();
let transport;

app.get("/sse", async (req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  await transport.handlePostMessage(req, res);
});

app.listen(3001);