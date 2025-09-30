// Test script for scan-all-orgs functionality
import fetch from "node-fetch";

async function testScanAllOrgs() {
  const adoPat = process.env.ADO_PAT;
  if (!adoPat) {
    console.log("❌ ADO_PAT not set in environment");
    return;
  }

  const headers = {
    Authorization: "Basic " + Buffer.from(":" + adoPat).toString("base64"),
  };

  try {
    // Step 1: Fetch profile
    console.log("🔍 Fetching profile...");
    const profileResp = await fetch(
      `https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.0`,
      { headers }
    );
    const profile = await profileResp.json();
    if (!profile?.id) {
      console.log("❌ No profile found");
      return;
    }
    console.log("✅ Profile found:", profile.displayName);

    // Step 2: Fetch all organizations for this profile
    console.log("🔍 Fetching organizations...");
    const orgsResp = await fetch(
      `https://app.vssps.visualstudio.com/_apis/accounts?memberId=${profile.id}&api-version=7.0`,
      { headers }
    );
    const orgsData = await orgsResp.json();
    if (!orgsData?.value?.length) {
      console.log("❌ No organizations found");
      return;
    }

    console.log(`✅ Found ${orgsData.value.length} organization(s):`);
    orgsData.value.forEach((org, index) => {
      console.log(`${index + 1}. ${org.accountName}`);
    });

    // Step 3: Fetch projects for first org
    const firstOrg = orgsData.value[0].accountName;
    console.log(`\n🔍 Fetching projects for org: ${firstOrg}`);
    const projResp = await fetch(
      `https://dev.azure.com/${firstOrg}/_apis/projects?api-version=7.0`,
      { headers }
    );
    const projectsData = await projResp.json();
    if (!projectsData?.value?.length) {
      console.log(`❌ No projects found for org ${firstOrg}`);
      return;
    }

    console.log(`✅ Found ${projectsData.value.length} project(s) in ${firstOrg}:`);
    projectsData.value.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name}`);
    });

  } catch (err) {
    console.log(`❌ Error: ${err.message}`);
  }
}

testScanAllOrgs();