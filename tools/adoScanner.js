import { z } from "zod";
import fetch from "node-fetch";

export function registerScanADOTool(server, context) {
  server.tool(
    "scan-ado",
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

      // Step 1: Profile
      let profileUrl =
        profileId === "me"
          ? "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.0"
          : `https://app.vssps.visualstudio.com/_apis/profile/profiles/${profileId}?api-version=7.0`;

      const profileResp = await fetch(profileUrl, { headers });
      if (!profileResp.ok) {
        return {
          content: [
            { type: "text", text: `❌ Failed to fetch profile: ${profileResp.statusText}` },
          ],
          isError: true,
        };
      }
      const profile = await profileResp.json();
      if (!profile?.id) {
        return { content: [{ type: "text", text: "❌ No profile found" }], isError: true };
      }

      // Step 2: Orgs
      const orgsResp = await fetch(
        `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${profile.id}&api-version=7.0`,
        { headers }
      );
      const orgs = await orgsResp.json();
      if (!orgs?.value?.length) {
        return { content: [{ type: "text", text: "❌ No orgs found" }], isError: true };
      }
      const org = orgs.value[0].accountName;

      // Step 3: Projects
      const projResp = await fetch(
        `https://dev.azure.com/${org}/_apis/projects?api-version=7.0`,
        { headers }
      );
      const projects = await projResp.json();
      if (!projects?.value?.length) {
        return { content: [{ type: "text", text: "❌ No projects found" }], isError: true };
      }
      const project = projects.value[0].name;

      // Step 4: Repos
      const repoResp = await fetch(
        `https://dev.azure.com/${org}/${project}/_apis/git/repositories?api-version=7.0`,
        { headers }
      );
      const repos = await repoResp.json();
      if (!repos?.value?.length) {
        return { content: [{ type: "text", text: "❌ No repos found" }], isError: true };
      }
      const repo = repos.value[0].name;

      // Step 5: Pipelines
      const pipeResp = await fetch(
        `https://dev.azure.com/${org}/${project}/_apis/pipelines?api-version=7.0`,
        { headers }
      );
      const pipelines = await pipeResp.json();
      const pipelineId = pipelines?.value?.length ? pipelines.value[0].id : null;

      // Save in context for other migration tools
      context.ado = { org, project, repo, pipelineId };

      return {
        content: [
          {
            type: "text",
            text: `✅ Profile: ${profile.displayName}\n✅ Org: ${org}\n✅ Project: ${project}\n✅ Repo: ${repo}\n✅ Pipeline: ${pipelineId}`,
          },
        ],
      };
    }
  );
}