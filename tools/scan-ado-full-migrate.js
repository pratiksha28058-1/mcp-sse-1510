// tools/scan-ado-full-interactive.js
import { z } from "zod";
import fetch from "node-fetch";
import { exec } from "child_process";

export function registerScanADOTool(server, context) {
  server.tool(
    "scan-ado-full-interactive",
    {
      orgSerial: z.number().optional().describe("Serial number of the ADO Org to select"),
      projectSerial: z.number().optional().describe("Serial number of the project to select"),
      repoSerial: z.number().optional().describe("Serial number of the repo to select"),
      migrate: z.boolean().optional().describe("If true, migrate selected repo + pipelines to GitHub"),
      githubOrg: z.string().optional().describe("GitHub org/user where repo will be migrated"),
    },
    async ({ orgSerial, projectSerial, repoSerial, migrate, githubOrg }) => {
      const adoPat = process.env.ADO_PAT;
      const githubToken = process.env.GITHUB_TOKEN;
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
        // --- STEP 1: PROFILE ---
        const profileResp = await fetch(
          `https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.0`,
          { headers }
        );
        const profile = await profileResp.json();
        if (!profile?.id) {
          return { content: [{ type: "text", text: "❌ No profile found" }], isError: true };
        }

        // --- STEP 2: ORGS ---
        const orgsResp = await fetch(
          `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${profile.id}&api-version=7.0`,
          { headers }
        );
        const orgsData = await orgsResp.json();
        if (!orgsData?.value?.length) {
          return { content: [{ type: "text", text: "❌ No organizations found" }], isError: true };
        }

        if (!orgSerial) {
          const orgsList = orgsData.value.map((o, i) => `${i + 1}. ${o.accountName}`).join("\n");
          return {
            content: [
              { type: "text", text: `📋 Found ${orgsData.value.length} org(s):\n${orgsList}\n\nEnter orgSerial to select.` },
            ],
          };
        }

        const selectedOrg = orgsData.value[orgSerial - 1];
        if (!selectedOrg) return { content: [{ type: "text", text: "❌ Invalid orgSerial" }], isError: true };
        context.ado = { org: selectedOrg.accountName };

        // --- STEP 3: PROJECTS ---
        const projResp = await fetch(
          `https://dev.azure.com/${selectedOrg.accountName}/_apis/projects?api-version=7.0`,
          { headers }
        );
        const projects = await projResp.json();
        if (!projects?.value?.length) {
          return { content: [{ type: "text", text: `❌ No projects found for org ${selectedOrg.accountName}` }], isError: true };
        }

        if (!projectSerial) {
          const projectsList = projects.value.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
          return {
            content: [
              { type: "text", text: `✅ Org: ${selectedOrg.accountName}\n\n📁 Projects:\n${projectsList}\n\nEnter projectSerial to select.` },
            ],
          };
        }

        const selectedProject = projects.value[projectSerial - 1];
        if (!selectedProject) return { content: [{ type: "text", text: "❌ Invalid projectSerial" }], isError: true };
        context.ado.project = selectedProject.name;

        // --- STEP 4: REPOS ---
        const repoResp = await fetch(
          `https://dev.azure.com/${selectedOrg.accountName}/${selectedProject.name}/_apis/git/repositories?api-version=7.0`,
          { headers }
        );
        const repos = await repoResp.json();
        if (!repos?.value?.length) {
          return { content: [{ type: "text", text: `❌ No repos found for project ${selectedProject.name}` }], isError: true };
        }

        if (!repoSerial) {
          const reposList = repos.value.map((r, i) => `${i + 1}. ${r.name}`).join("\n");
          return {
            content: [
              { type: "text", text: `✅ Org: ${selectedOrg.accountName}\n✅ Project: ${selectedProject.name}\n\n📦 Repositories:\n${reposList}\n\nEnter repoSerial to select.` },
            ],
          };
        }

        const selectedRepo = repos.value[repoSerial - 1];
        if (!selectedRepo) return { content: [{ type: "text", text: "❌ Invalid repoSerial" }], isError: true };
        context.ado.repo = selectedRepo.name;

        // --- STEP 5: PIPELINES ---
        const pipeResp = await fetch(
          `https://dev.azure.com/${selectedOrg.accountName}/${selectedProject.name}/_apis/pipelines?api-version=7.0`,
          { headers }
        );
        const pipelines = await pipeResp.json();
        context.ado.pipelines = pipelines?.value?.filter(
          p => p.configuration?.repository?.name === selectedRepo.name
        ).map(p => ({ id: p.id, name: p.name })) || [];

        // --- STEP 6: MIGRATION (if migrate flag set) ---
        if (migrate && githubOrg && githubToken) {
          const adoRepoUrl = `https://${adoPat}@dev.azure.com/${selectedOrg.accountName}/${selectedProject.name}/_git/${selectedRepo.name}`;
          const githubRepoUrl = `https://${githubToken}@github.com/${githubOrg}/${selectedRepo.name}.git`;

          const mirrorCmd = `
            rm -rf tmp-${selectedRepo.name} &&
            git clone --mirror "${adoRepoUrl}" tmp-${selectedRepo.name} &&
            cd tmp-${selectedRepo.name} &&
            git remote set-url --push origin "${githubRepoUrl}" &&
            git push --mirror &&
            cd .. &&
            rm -rf tmp-${selectedRepo.name}
          `;
          const mirrorResult = await runCmd(mirrorCmd);

          const pipelineMigrateCmd = `
            gh actions-importer migrate ado --azure-devops-org ${selectedOrg.accountName} --project ${selectedProject.name} --repository ${selectedRepo.name} --target-url ${githubRepoUrl}
          `;
          const pipelineResult = await runCmd(pipelineMigrateCmd);

          return {
            content: [
              {
                type: "text",
                text: `✅ Org: ${selectedOrg.accountName}\n✅ Project: ${selectedProject.name}\n✅ Repo: ${selectedRepo.name}\n🚀 Pipelines: ${context.ado.pipelines.map(p => p.name).join(", ") || "None"}\n\n📦 Repo migrated result:\n${mirrorResult}\n\n⚙️ Pipeline migration result:\n${pipelineResult}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `✅ Org: ${selectedOrg.accountName}\n✅ Project: ${selectedProject.name}\n✅ Repo: ${selectedRepo.name}\n🚀 Pipelines: ${context.ado.pipelines.map(p => p.name).join(", ") || "None"}\n\n💡 To migrate this repo, run again with { migrate: true, githubOrg: "your-gh-org" }`,
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `❌ Error: ${err.message}` }], isError: true };
      }
    }
  );
}

// helper to run shell commands
function runCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { shell: "/bin/bash" }, (error, stdout, stderr) => {
      if (error) return reject(stderr || error.message);
      resolve(stdout || "✅ Done");
    });
  });
}