// server.js
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";

const server = new McpServer({
  name: "Example SSE Server",
  version: "1.0.0",
});

// Example tool
server.tool("example_tool", { param: z.string() }, async ({ param }) => ({
  content: [{ type: "text", text: `Processed: ${param}` }],
}));

const app = express();
let transport;

// SSE endpoint (keep connection open)
app.get("/sse", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  // Prevent Express from auto-ending
  req.socket.setKeepAlive(true);

  transport = new SSEServerTransport("/messages", res);

  try {
    await server.connect(transport);
    console.log("🔗 SSE client connected");
  } catch (err) {
    console.error("❌ SSE connection failed:", err);
    res.end();
  }
});

// Handle messages from client → server
app.post("/messages", express.json(), async (req, res) => {
  if (!transport) {
    return res.status(503).json({ error: "No SSE transport connected" });
  }
  try {
    await transport.handlePostMessage(req, res);
  } catch (err) {
    console.error("❌ Message handling error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Azure injects PORT (usually 8080), fallback to 3001 for local
const port = process.env.PORT || 3001;
app.listen(port, "0.0.0.0", () => {
  console.log(`✅ MCP SSE server running on http://0.0.0.0:${port}/sse`);
});
