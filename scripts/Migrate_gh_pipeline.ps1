<#
.SYNOPSIS
Interactive Azure DevOps -> GitHub Actions pipeline migration.
#>

# 🔐 Load PATs
$ADO_PAT = $env:ADO_PAT
$GITHUB_PAT = $env:GITHUB_PAT

if (-not $ADO_PAT) { Write-Error "❌ ADO_PAT not set"; exit 1 }
if (-not $GITHUB_PAT) { Write-Error "❌ GITHUB_PAT not set"; exit 1 }

# GH CLI check
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "❌ GitHub CLI 'gh' not found in PATH. Install it before running the script."
    exit 1
}

$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$ADO_PAT"))
$headers = @{ Authorization = "Basic $base64Auth" }

# -------------------------------
# 1️⃣ List ADO orgs
# -------------------------------
Write-Host "`n🔍 Fetching ADO orgs..."

# Note: Azure DevOps API doesn’t provide a direct 'list orgs' endpoint; you may need to hardcode or maintain a list.
# Example: you can replace this with your known orgs array:
$adoOrgs = @("PratikshaTiwari")  

for ($i=0; $i -lt $adoOrgs.Count; $i++) {
    Write-Host "$($i+1). $($adoOrgs[$i])"
}

$orgSelection = Read-Host "Select org by serial number"
$AdoOrg = $adoOrgs[$orgSelection - 1]
Write-Host "✅ Selected Org: $AdoOrg"

# -------------------------------
# 2️⃣ List projects in org
# -------------------------------
$projectsUri = "https://dev.azure.com/$AdoOrg/_apis/projects?api-version=7.0"
$projectsResp = Invoke-RestMethod -Uri $projectsUri -Headers $headers -Method GET
$projects = $projectsResp.value

Write-Host "`n📂 Projects in org '$AdoOrg':"
for ($i=0; $i -lt $projects.Count; $i++) {
    Write-Host "$($i+1). $($projects[$i].name)"
}

$projectSelection = Read-Host "Select project by serial number"
$AdoProject = $projects[$projectSelection - 1].name
Write-Host "✅ Selected Project: $AdoProject"

# -------------------------------
# 3️⃣ List repos in project
# -------------------------------
$reposUri = "https://dev.azure.com/$AdoOrg/$AdoProject/_apis/git/repositories?api-version=7.0"
$reposResp = Invoke-RestMethod -Uri $reposUri -Headers $headers -Method GET
$repos = $reposResp.value

Write-Host "`n📦 Repos in project '$AdoProject':"
for ($i=0; $i -lt $repos.Count; $i++) {
    Write-Host "$($i+1). $($repos[$i].name)"
}

$repoSelection = Read-Host "Select repo by serial number"
$AdoRepo = $repos[$repoSelection - 1].name
Write-Host "✅ Selected Repo: $AdoRepo"

# -------------------------------
# 4️⃣ Input GitHub target
# -------------------------------
$GithubOwner = Read-Host "Enter GitHub owner/org"
$GithubRepo  = Read-Host "Enter GitHub repo name"

# -------------------------------
# 5️⃣ Run GH actions-importer migration
# -------------------------------
$outputFolder = Join-Path $PSScriptRoot "gh-migration-output"
if (Test-Path $outputFolder) { Remove-Item -Recurse -Force $outputFolder }
New-Item -ItemType Directory -Path $outputFolder | Out-Null

$githubUrl = "https://github.com/$GithubOwner/$GithubRepo"

Write-Host "`n🚀 Running migration..."
gh actions-importer migrate azure-devops `
    --ado-org $AdoOrg `
    --ado-project $AdoProject `
    --ado-repo $AdoRepo `
    --target-url $githubUrl `
    --output-dir $outputFolder `
    --github-access-token $GITHUB_PAT

Write-Host "`n🎉 Migration completed! Check '$outputFolder' for workflow files."

# -------------------------------
# 6️⃣ Push workflows to GitHub
# -------------------------------
Set-Location $outputFolder
git init
git remote add origin $githubUrl
git add .
git commit -m "Add migrated ADO pipelines as GitHub Actions workflows"
git push origin main -f

Write-Host "✅ Workflows pushed to GitHub repo '$GithubOwner/$GithubRepo'"