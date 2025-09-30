// tools/migratePipelines.js
import { exec } from "child_process";

export async function migratePipelines(adoOrg, project, repo, ghOrg, ghRepo, ghToken, adoPat) {
  return new Promise((resolve, reject) => {
    const cmd = `
      gh actions-importer migrate ado-pipeline \
        --ado-org "${adoOrg}" \
        --ado-project "${project}" \
        --ado-repo "${repo}" \
        --github-org "${ghOrg}" \
        --github-repo "${ghRepo}" \
        --ado-pat "${adoPat}" \
        --github-pat "${ghToken}"
    `;

    exec(cmd, (error, stdout, stderr) => {
      if (error) reject(stderr || error.message);
      else resolve(stdout || `✅ Pipeline migration done for ${repo}`);
    });
  });
}
