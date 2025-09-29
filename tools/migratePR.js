// tools/migratePR.js
import { z } from "zod";
import fetch from "node-fetch";

export function registerMigratePRTool(server) {
  server.tool(
    "migrate_prs",
    {
      AdoOrg: z.string(),
      AdoProject: z.string(),
      AdoRepo: z.string(),
      GithubOwner: z.string(),
      GithubRepo: z.string(),
      MigrateComments: z.boolean().default(true),
      MigrateReviews: z.boolean().default(true),
      DryRun: z.boolean().default(false),
    },
    async ({
      AdoOrg,
      AdoProject,
      AdoRepo,
      GithubOwner,
      GithubRepo,
      MigrateComments,
      MigrateReviews,
      DryRun,
    }) => {
      const adoPAT = process.env.ADO_PAT;
      const githubToken = process.env.GITHUB_PAT;

      if (!adoPAT) {
        throw new Error("Environment variable ADO_PAT is not set.");
      }
      if (!githubToken) {
        throw new Error("Environment variable GITHUB_PAT is not set.");
      }

      const adoBaseUrl = `https://dev.azure.com/${AdoOrg}`;
      const adoProjectUrl = `${adoBaseUrl}/${AdoProject}`;
      const githubApiUrl = "https://api.github.com";

      const adoHeaders = {
        Authorization:
          "Basic " +
          Buffer.from(`:${adoPAT}`).toString("base64"),
        "Content-Type": "application/json",
      };

      const ghHeaders = {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };

      const log = [];

      const fetchAdoPRs = async () => {
        const url = `${adoProjectUrl}/_apis/git/repositories/${AdoRepo}/pullrequests?api-version=6.0&status=all&$top=1000`;
        const res = await fetch(url, { headers: adoHeaders });
        if (!res.ok) throw new Error(`Failed to get ADO PRs: ${res.statusText}`);
        const json = await res.json();
        return json.value || [];
      };

      const createGithubPR = async (adoPR, sourceBranch, targetBranch) => {
        const body = {
          title: adoPR.title,
          body: adoPR.description || "",
          head: sourceBranch,
          base: targetBranch,
        };

        if (DryRun) {
          log.push(`🟡 [DryRun] Would create PR: ${adoPR.title}`);
          return null;
        }

        const url = `${githubApiUrl}/repos/${GithubOwner}/${GithubRepo}/pulls`;
        const res = await fetch(url, {
          method: "POST",
          headers: ghHeaders,
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          throw new Error(`Failed to create GitHub PR: ${await res.text()}`);
        }
        return await res.json();
      };

      try {
        log.push("📥 Fetching ADO PRs...");
        const adoPRs = await fetchAdoPRs();

        if (!adoPRs.length) {
          return {
            content: [{ type: "text", text: "⚠️ No PRs found in ADO repo." }],
          };
        }

        log.push(`Found ${adoPRs.length} PRs in ADO.`);

        let migrated = 0;
        let failed = 0;

        for (const adoPR of adoPRs.sort(
          (a, b) => new Date(a.creationDate) - new Date(b.creationDate)
        )) {
          try {
            const sourceBranch = adoPR.sourceRefName.replace("refs/heads/", "");
            const targetBranch = adoPR.targetRefName.replace("refs/heads/", "");

            log.push(`➡️ Migrating PR: ${adoPR.title} (${adoPR.pullRequestId})`);

            const ghPR = await createGithubPR(
              adoPR,
              sourceBranch,
              targetBranch
            );

            if (ghPR) {
              migrated++;
              log.push(`✅ Created GitHub PR #${ghPR.number}`);

              if (adoPR.status === "abandoned" || adoPR.status === "completed") {
                const closeBody = { state: "closed" };
                await fetch(
                  `${githubApiUrl}/repos/${GithubOwner}/${GithubRepo}/pulls/${ghPR.number}`,
                  {
                    method: "PATCH",
                    headers: ghHeaders,
                    body: JSON.stringify(closeBody),
                  }
                );
                log.push(`🔒 Closed PR (status was ${adoPR.status} in ADO)`);
              }
            }
          } catch (err) {
            failed++;
            log.push(`❌ Failed to migrate PR: ${err.message}`);
          }

          // Small delay to avoid rate limits
          await new Promise((r) => setTimeout(r, 1000));
        }

        log.push("\n=== Migration Summary ===");
        log.push(`Total ADO PRs: ${adoPRs.length}`);
        log.push(`✅ Migrated: ${migrated}`);
        log.push(`❌ Failed: ${failed}`);

        if (DryRun) {
          log.push("🟡 This was a Dry Run, no changes applied.");
        }

        return {
          content: [{ type: "text", text: log.join("\n") }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `❌ PR Migration failed: ${err.message}` }],
        };
      }
    }
  );
}
