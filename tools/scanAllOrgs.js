// tools/scan-all-orgs.js
import { z } from "zod";
import fetch from "node-fetch";

export function registerScanAllOrgsTool(server) {
  server.tool(
    "scan-all-orgs",
    {
      profileId: z.string().default("me").describe("ADO profile id or 'me'"),
    },
    async ({ profileId }) => {
      const adoPat = process.env.ADO_PAT;
      if (!adoPat) {
        return {
          content: [{ type: "text", text: "❌ ADO_PAT not set in environment" }],
          isError: true,
        };
      }

      const headers = {
        Authorization: "Basic " + Buffer.from(":" + adoPat).toString("base64"),
      };

      try {
        // Step 1: Fetch profile
        const profileResp = await fetch(
          `https://app.vssps.visualstudio.com/_apis/profile/profiles/${profileId}?api-version=7.0`,
          { headers }
        );
        const profile = await profileResp.json();
        if (!profile?.id) {
          return { content: [{ type: "text", text: "❌ No profile found" }], isError: true };
        }

        // Step 2: Fetch organizations
        const orgsResp = await fetch(
          `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${profile.id}&api-version=7.0`,
          { headers }
        );
        const orgsData = await orgsResp.json();
        if (!orgsData?.value?.length) {
          return { content: [{ type: "text", text: "❌ No organizations found" }], isError: true };
        }

        const adoOrgs = orgsData.value.map((o) => o.accountName);

        // Return context-like data instead of mutating undefined object
        return {
          content: [
            {
              type: "text",
              text: `✅ Found ${adoOrgs.length} org(s):\n${adoOrgs.join("\n")}`,
            },
          ],
          data: { adoOrgs }, // <-- This can be used by other MCP tools
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `❌ Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}