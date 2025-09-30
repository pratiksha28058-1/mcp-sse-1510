// tools/scan-ado-full.js
import { z } from "zod";
import fetch from "node-fetch";

export function registerScanADOTool(server, context) {
  server.tool(
    "scan-ado-full",
    {
      orgSerial: z.number().optional().describe("Serial number of Org to select"),
      projectSerial: z.number().optional().describe("Serial number of Project to select"),
    },
    async ({ orgSerial, projectSerial }) => {
      const adoPat = process.env.ADO_PAT;
      if (!adoPat) {
        return { content: [{ type: "text", text: "❌ ADO_PAT not set in environment" }], isError: true };
      }

      const headers = { Authorization: "Basic " + Buffer.from(":" + adoPat).toString("base64") };

      try {
        // Step 1: Get profile
        const profileResp = await fetch(
          `https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.0`,
          { headers }
        );
        const profile = await profileResp.json();
        if (!profile?.id) return { content: [{ type: "text", text: "❌ No profile found" }], isError: true };

        // Step 2: Get all orgs
        const orgsResp = await fetch(
          `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${profile.id}&api-version=7.0`,
          { headers }
        );
        const orgsData = await orgsResp.json();
        if (!orgsData?.value?.length) return { content: [{ type: "text", text: "❌ No orgs found" }], isError: true };

        context.adoOrgs = orgsData.value.map((o) => o.accountName);

        let selectedOrg;
        if (orgSerial !== undefined && orgSerial >= 0 && orgSerial < context.adoOrgs.length) {
          selectedOrg = context.adoOrgs[orgSerial];
        } else {
          // default first org
          selectedOrg = context.adoOrgs[0];
        }

        // Step 3: Get projects for selected org
        const projResp = await fetch(`https://dev.azure.com/${selectedOrg}/_apis/projects?api-version=7.0`, { headers });
        const projectsData = await projResp.json();
        if (!projectsData?.value?.length) return { content: [{ type: "text", text: "❌ No projects found" }], isError: true };

        context.adoProjects = projectsData.value.map((p) => p.name);

        let selectedProject;
        if (projectSerial !== undefined && projectSerial >= 0 && projectSerial < context.adoProjects.length) {
          selectedProject = context.adoProjects[projectSerial];
        } else {
          selectedProject = context.adoProjects[0];
        }

        // Step 4: Get repos
        const repoResp = await fetch(
          `https://dev.azure.com/${selectedOrg}/${selectedProject}/_apis/git/repositories?api-version=7.0`,
          { headers }
        );
        const reposData = await repoResp.json();
        if (!reposData?.value?.length) return { content: [{ type: "text", text: "❌ No repos found" }], isError: true };

        context.adoRepos = reposData.value.map((r) => r.name);

        // Step 5: Get pipelines for each repo
        let pipelinesSummary = [];
        for (const repoName of context.adoRepos) {
          const pipeResp = await fetch(
            `https://dev.azure.com/${selectedOrg}/${selectedProject}/_apis/pipelines?api-version=7.0`,
            { headers }
          );
          const pipelinesData = await pipeResp.json();
          if (pipelinesData?.value?.length) {
            pipelinesSummary.push({ repo: repoName, pipelines: pipelinesData.value.map((p) => ({ id: p.id, name: p.name })) });
          } else {
            pipelinesSummary.push({ repo: repoName, pipelines: [] });
          }
        }

        context.adoPipelines = pipelinesSummary;

        // Prepare output
        let output = `✅ Selected Org: ${selectedOrg}\n✅ Selected Project: ${selectedProject}\n\n📦 Repos & Pipelines:\n`;
        pipelinesSummary.forEach((repoItem) => {
          output += `  📁 Repo: ${repoItem.repo}\n`;
          if (repoItem.pipelines.length) {
            output += `    🚀 Pipelines: ${repoItem.pipelines.map((p) => `${p.name} (ID:${p.id})`).join(", ")}\n`;
          } else {
            output += `    🚀 No pipelines found\n`;
          }
        });

        return { content: [{ type: "text", text: output }] };
      } catch (err) {
        return { content: [{ type: "text", text: `❌ Error: ${err.message}` }], isError: true };
      }
    }
  );
}