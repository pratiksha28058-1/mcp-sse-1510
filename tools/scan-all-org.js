// tools/scan-all-orgs.js
import { z } from "zod";
import fetch from "node-fetch";

export function registerScanAllOrgsTool(server, context) {
  server.tool(
    "scan-all-orgs",
    {
      profileId: z.string().default("me").describe("ADO profile id or 'me'"),
      orgIndex: z.number().optional().describe("Select org by serial number (1-based)"),
    },
    async ({ profileId, orgIndex }) => {
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

        // Step 2: Fetch all organizations for this profile
        const orgsResp = await fetch(
          `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${profile.id}&api-version=7.0`,
          { headers }
        );
        const orgsData = await orgsResp.json();
        if (!orgsData?.value?.length) {
          return { content: [{ type: "text", text: "❌ No organizations found" }], isError: true };
        }

        const orgs = orgsData.value.map((o) => o.accountName);

        // If no orgIndex provided, default to first org
        const selectedIndex = orgIndex && orgIndex > 0 && orgIndex <= orgs.length ? orgIndex - 1 : 0;
        const selectedOrg = orgs[selectedIndex];

        // Step 3: Fetch projects for selected org
        const projResp = await fetch(
          `https://dev.azure.com/${selectedOrg}/_apis/projects?api-version=7.0`,
          { headers }
        );
        const projectsData = await projResp.json();
        if (!projectsData?.value?.length) {
          return { content: [{ type: "text", text: `❌ No projects found for org ${selectedOrg}` }], isError: true };
        }

        const projectNames = projectsData.value.map((p) => p.name);

        // Save selected org and its projects in context
        context.ado = context.ado || {};
        context.ado.selectedOrg = selectedOrg;
        context.ado.adoproj = projectNames;

        return {
          content: [
            {
              type: "text",
              text: `✅ Selected Org: ${selectedOrg}\n✅ Projects:\n${projectNames.join("\n")}`,
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `❌ Error: ${err.message}` }], isError: true };
      }
    }
  );
}