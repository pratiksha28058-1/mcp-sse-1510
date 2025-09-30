// tools/scan-ado-full-interactive.js
import { z } from "zod";
import fetch from "node-fetch";

export function registerScanADOTool(server, context) {
  server.tool(
    "scan-ado-full-interactive",
    {
      orgSerial: z.number().optional().describe("Serial number of the ADO Org to select"),
      projectSerial: z.number().optional().describe("Serial number of the project to select"),
      repoSerial: z.number().optional().describe("Serial number of the repo to select"),
    },
    async ({ orgSerial, projectSerial, repoSerial }) => {
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
        // Step 1: Get profile
        const profileResp = await fetch(
          `https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.0`,
          { headers }
        );
        const profile = await profileResp.json();
        if (!profile?.id) {
          return { content: [{ type: "text", text: "❌ No profile found" }], isError: true };
        }

        // Step 2: Get all orgs
        const orgsResp = await fetch(
          `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${profile.id}&api-version=7.0`,
          { headers }
        );
        const orgsData = await orgsResp.json();
        if (!orgsData?.value?.length) {
          return { content: [{ type: "text", text: "❌ No organizations found" }], isError: true };
        }

        // If orgSerial not provided, show orgs
        if (!orgSerial) {
          const orgsList = orgsData.value.map((o, i) => `${i + 1}. ${o.accountName}`).join("\n");
          return {
            content: [
              { type: "text", text: `📋 Found ${orgsData.value.length} org(s):\n${orgsList}\n\nEnter orgSerial to select org.` },
            ],
          };
        }

        const selectedOrg = orgsData.value[orgSerial - 1];
        if (!selectedOrg) {
          return { content: [{ type: "text", text: "❌ Invalid orgSerial" }], isError: true };
        }
        context.ado = { org: selectedOrg.accountName };

        // Step 3: Fetch projects
        const projResp = await fetch(
          `https://dev.azure.com/${selectedOrg.accountName}/_apis/projects?api-version=7.0`,
          { headers }
        );
        const projects = await projResp.json();
        if (!projects?.value?.length) {
          return { content: [{ type: "text", text: `❌ No projects found for org ${selectedOrg.accountName}` }], isError: true };
        }

        // If projectSerial not provided, show projects
        if (!projectSerial) {
          const projectsList = projects.value.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
          return {
            content: [
              { type: "text", text: `✅ Selected Org: ${selectedOrg.accountName}\n\n📁 Projects:\n${projectsList}\n\nEnter projectSerial to select project.` },
            ],
          };
        }

        const selectedProject = projects.value[projectSerial - 1];
        if (!selectedProject) {
          return { content: [{ type: "text", text: "❌ Invalid projectSerial" }], isError: true };
        }
        context.ado.project = selectedProject.name;

        // Step 4: Fetch repos
        const repoResp = await fetch(
          `https://dev.azure.com/${selectedOrg.accountName}/${selectedProject.name}/_apis/git/repositories?api-version=7.0`,
          { headers }
        );
        const repos = await repoResp.json();
        if (!repos?.value?.length) {
          return { content: [{ type: "text", text: `❌ No repos found for project ${selectedProject.name}` }], isError: true };
        }

        // If repoSerial not provided, show repos
        if (!repoSerial) {
          const reposList = repos.value.map((r, i) => `${i + 1}. ${r.name}`).join("\n");
          return {
            content: [
              { type: "text", text: `✅ Selected Org: ${selectedOrg.accountName}\n✅ Selected Project: ${selectedProject.name}\n\n📦 Repositories:\n${reposList}\n\nEnter repoSerial to select repo.` },
            ],
          };
        }

        const selectedRepo = repos.value[repoSerial - 1];
        if (!selectedRepo) {
          return { content: [{ type: "text", text: "❌ Invalid repoSerial" }], isError: true };
        }
        context.ado.repo = selectedRepo.name;

        // Step 5: Fetch pipelines for the selected repo
        const pipeResp = await fetch(
          `https://dev.azure.com/${selectedOrg.accountName}/${selectedProject.name}/_apis/pipelines?api-version=7.0`,
          { headers }
        );
        const pipelines = await pipeResp.json();
        // Filter pipelines that belong to the selected repo
        context.ado.pipelines = pipelines?.value?.filter(p => p.configuration?.repository?.name === selectedRepo.name)
          .map(p => ({ id: p.id, name: p.name })) || [];

        return {
          content: [
            { type: "text", text: `✅ Org: ${selectedOrg.accountName}\n✅ Project: ${selectedProject.name}\n✅ Repo: ${selectedRepo.name}\n🚀 Pipelines: ${context.ado.pipelines.map(p => p.name).join(", ") || "None"}` },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `❌ Error: ${err.message}` }], isError: true };
      }
    }
  );
}