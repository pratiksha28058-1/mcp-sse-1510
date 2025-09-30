// Detailed ADO Scanner for PratikshaTiwari Organization
import fetch from "node-fetch";

async function detailedScanPratikshaTiwari() {
  const adoPat = process.env.ADO_PAT;
  if (!adoPat) {
    console.log("❌ ADO_PAT not set in environment");
    return;
  }

  const headers = {
    Authorization: "Basic " + Buffer.from(":" + adoPat).toString("base64"),
  };

  try {
    const orgName = "PratikshaTiwari";
    console.log(`🚀 Detailed Scan: ${orgName} Organization`);
    console.log("=" .repeat(50));

    // Fetch projects for PratikshaTiwari org
    console.log(`\n🔍 Fetching projects for org: ${orgName}`);
    const projResp = await fetch(
      `https://dev.azure.com/${orgName}/_apis/projects?api-version=7.0`,
      { headers }
    );
    const projectsData = await projResp.json();
    
    if (!projectsData?.value?.length) {
      console.log(`❌ No projects found for org ${orgName}`);
      return;
    }

    console.log(`\n✅ Found ${projectsData.value.length} project(s) in ${orgName}:`);
    projectsData.value.forEach((project, index) => {
      console.log(`  ${index + 1}. ${project.name}`);
    });

    // Scan each project for repos and pipelines
    console.log(`\n🔍 Scanning each project for repositories and pipelines...`);
    console.log("=" .repeat(50));

    for (let i = 0; i < projectsData.value.length; i++) {
      const project = projectsData.value[i];
      console.log(`\n📁 Project ${i + 1}: ${project.name}`);
      console.log("-".repeat(30));

      try {
        // Fetch repos for this project
        const repoResp = await fetch(
          `https://dev.azure.com/${orgName}/${project.name}/_apis/git/repositories?api-version=7.0`,
          { headers }
        );
        const reposData = await repoResp.json();
        
        if (reposData?.value?.length) {
          console.log(`  📦 Repositories (${reposData.value.length}):`);
          reposData.value.forEach((repo, repoIndex) => {
            console.log(`    ${repoIndex + 1}. ${repo.name}`);
          });
        } else {
          console.log("  📦 No repositories found");
        }

        // Fetch pipelines for this project
        const pipeResp = await fetch(
          `https://dev.azure.com/${orgName}/${project.name}/_apis/pipelines?api-version=7.0`,
          { headers }
        );
        const pipelinesData = await pipeResp.json();
        
        if (pipelinesData?.value?.length) {
          console.log(`  🚀 Pipelines (${pipelinesData.value.length}):`);
          pipelinesData.value.forEach((pipeline, pipeIndex) => {
            console.log(`    ${pipeIndex + 1}. ${pipeline.name} (ID: ${pipeline.id})`);
          });
        } else {
          console.log("  🚀 No pipelines found");
        }

      } catch (error) {
        console.log(`  ❌ Error scanning project ${project.name}: ${error.message}`);
      }
    }

    // Summary
    console.log("\n🎉 Complete Scan Summary:");
    console.log("=" .repeat(50));
    console.log(`📋 Organization: ${orgName}`);
    console.log(`📁 Total Projects: ${projectsData.value.length}`);
    
    // Count total repos and pipelines
    let totalRepos = 0;
    let totalPipelines = 0;
    
    for (const project of projectsData.value) {
      try {
        const repoResp = await fetch(
          `https://dev.azure.com/${orgName}/${project.name}/_apis/git/repositories?api-version=7.0`,
          { headers }
        );
        const reposData = await repoResp.json();
        if (reposData?.value?.length) totalRepos += reposData.value.length;

        const pipeResp = await fetch(
          `https://dev.azure.com/${orgName}/${project.name}/_apis/pipelines?api-version=7.0`,
          { headers }
        );
        const pipelinesData = await pipeResp.json();
        if (pipelinesData?.value?.length) totalPipelines += pipelinesData.value.length;
      } catch (error) {
        // Skip projects with errors
      }
    }
    
    console.log(`📦 Total Repositories: ${totalRepos}`);
    console.log(`🚀 Total Pipelines: ${totalPipelines}`);

  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

// Run the detailed scanner
detailedScanPratikshaTiwari();