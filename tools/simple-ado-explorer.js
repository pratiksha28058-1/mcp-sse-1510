// Simple ADO Explorer - Non-interactive version with pre-selected choices
import fetch from "node-fetch";

class SimpleADOExplorer {
  constructor() {
    this.adoPat = process.env.ADO_PAT;
    this.headers = {
      Authorization: "Basic " + Buffer.from(":" + this.adoPat).toString("base64"),
    };
  }

  async checkCredentials() {
    if (!this.adoPat) {
      console.log("❌ ADO_PAT not set in environment");
      return false;
    }
    return true;
  }

  async fetchProfile() {
    try {
      const profileResp = await fetch(
        `https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.0`,
        { headers: this.headers }
      );
      const profile = await profileResp.json();
      if (!profile?.id) {
        console.log("❌ No profile found");
        return null;
      }
      return profile;
    } catch (error) {
      console.log(`❌ Error fetching profile: ${error.message}`);
      return null;
    }
  }

  async fetchOrganizations(profile) {
    try {
      const orgsResp = await fetch(
        `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${profile.id}&api-version=7.0`,
        { headers: this.headers }
      );
      const orgsData = await orgsResp.json();
      if (!orgsData?.value?.length) {
        console.log("❌ No organizations found");
        return [];
      }
      return orgsData.value;
    } catch (error) {
      console.log(`❌ Error fetching organizations: ${error.message}`);
      return [];
    }
  }

  async fetchProjects(orgName) {
    try {
      const projResp = await fetch(
        `https://dev.azure.com/${orgName}/_apis/projects?api-version=7.0`,
        { headers: this.headers }
      );
      const projectsData = await projResp.json();
      if (!projectsData?.value?.length) {
        console.log(`❌ No projects found for org ${orgName}`);
        return [];
      }
      return projectsData.value;
    } catch (error) {
      console.log(`❌ Error fetching projects: ${error.message}`);
      return [];
    }
  }

  async fetchRepositories(orgName, projectName) {
    try {
      const repoResp = await fetch(
        `https://dev.azure.com/${orgName}/${projectName}/_apis/git/repositories?api-version=7.0`,
        { headers: this.headers }
      );
      const reposData = await repoResp.json();
      if (!reposData?.value?.length) {
        return [];
      }
      return reposData.value;
    } catch (error) {
      console.log(`❌ Error fetching repositories: ${error.message}`);
      return [];
    }
  }

  async fetchPipelines(orgName, projectName) {
    try {
      const pipeResp = await fetch(
        `https://dev.azure.com/${orgName}/${projectName}/_apis/pipelines?api-version=7.0`,
        { headers: this.headers }
      );
      const pipelinesData = await pipeResp.json();
      if (!pipelinesData?.value?.length) {
        return [];
      }
      return pipelinesData.value;
    } catch (error) {
      console.log(`❌ Error fetching pipelines: ${error.message}`);
      return [];
    }
  }

  async exploreOrganization(orgIndex = 4) { // Default to PratikshaTiwari (index 4)
    console.log("🚀 Simple Azure DevOps Explorer");
    console.log("=================================");

    if (!await this.checkCredentials()) {
      return;
    }

    try {
      // Step 1: Get profile and organizations
      console.log("\n🔍 Step 1: Organizations");
      console.log("=" .repeat(30));

      const profile = await this.fetchProfile();
      if (!profile) return;

      console.log(`✅ Profile: ${profile.displayName}`);

      const orgs = await this.fetchOrganizations(profile);
      if (!orgs.length) return;

      console.log(`\n📋 Found ${orgs.length} organization(s):`);
      orgs.forEach((org, index) => {
        const marker = index === orgIndex ? "👉" : "  ";
        console.log(`${marker} ${index + 1}. ${org.accountName}`);
      });

      const selectedOrg = orgs[orgIndex].accountName;
      console.log(`\n✅ Selected Organization: ${selectedOrg}`);

      // Step 2: Get projects for selected org
      console.log("\n🔍 Step 2: Projects");
      console.log("=" .repeat(30));

      const projects = await this.fetchProjects(selectedOrg);
      if (!projects.length) return;

      console.log(`\n📁 Found ${projects.length} project(s) in ${selectedOrg}:`);
      projects.forEach((project, index) => {
        console.log(`  ${index + 1}. ${project.name}`);
      });

      // Step 3: Show repositories and pipelines for each project
      console.log("\n🔍 Step 3: Repositories & Pipelines");
      console.log("=" .repeat(40));

      for (let i = 0; i < Math.min(projects.length, 5); i++) { // Show first 5 projects
        const project = projects[i];
        console.log(`\n📁 Project ${i + 1}: ${project.name}`);
        console.log("-".repeat(30));

        // Fetch repositories
        const repos = await this.fetchRepositories(selectedOrg, project.name);
        if (repos.length > 0) {
          console.log(`  📦 Repositories (${repos.length}):`);
          repos.forEach((repo, repoIndex) => {
            console.log(`    ${repoIndex + 1}. ${repo.name}`);
          });
        } else {
          console.log("  📦 No repositories found");
        }

        // Fetch pipelines
        const pipelines = await this.fetchPipelines(selectedOrg, project.name);
        if (pipelines.length > 0) {
          console.log(`  🚀 Pipelines (${pipelines.length}):`);
          pipelines.forEach((pipeline, pipeIndex) => {
            console.log(`    ${pipeIndex + 1}. ${pipeline.name} (ID: ${pipeline.id})`);
          });
        } else {
          console.log("  🚀 No pipelines found");
        }
      }

      // Summary
      console.log("\n🎉 Exploration Summary:");
      console.log("=" .repeat(30));
      console.log(`📋 Organization: ${selectedOrg}`);
      console.log(`📁 Total Projects: ${projects.length}`);
      
      // Count total repos and pipelines
      let totalRepos = 0;
      let totalPipelines = 0;
      
      for (const project of projects) {
        const repos = await this.fetchRepositories(selectedOrg, project.name);
        const pipelines = await this.fetchPipelines(selectedOrg, project.name);
        totalRepos += repos.length;
        totalPipelines += pipelines.length;
      }
      
      console.log(`📦 Total Repositories: ${totalRepos}`);
      console.log(`🚀 Total Pipelines: ${totalPipelines}`);

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

// Run the explorer with PratikshaTiwari organization (index 4)
const explorer = new SimpleADOExplorer();
explorer.exploreOrganization(4);