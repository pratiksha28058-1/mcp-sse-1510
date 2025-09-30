<#
.SYNOPSIS
Fully migrate Azure DevOps pipelines to GitHub Actions using gh-actions-importer.
Fetches pipeline IDs dynamically and merges PRs automatically.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$GithubOwner,

    [Parameter(Mandatory = $true)]
    [string]$GithubRepo
)

# 🔐 Load PATs
$ADO_PAT = $env:ADO_PAT
$GITHUB_PAT = $env:GITHUB_PAT
if (-not $ADO_PAT) { Write-Error "❌ ADO_PAT not set"; exit 1 }
if (-not $GITHUB_PAT) { Write-Error "❌ GITHUB_PAT not set"; exit 1 }

$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$ADO_PAT"))
$headers = @{ Authorization = "Basic $base64Auth" }

# === Step 1. Get Orgs ===
Write-Host "`n🔍 Fetching ADO Orgs..."
$userUri = "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.0"
$user = Invoke-RestMethod -Uri $userUri -Headers $headers
$userId = $user.id

$orgsUri = "https://app.vssps.visualstudio.com/_apis/accounts?memberId=$userId&api-version=7.0"
$orgs = Invoke-RestMethod -Uri $orgsUri -Headers $headers

if (-not $orgs.value -or $orgs.count -eq 0) { Write-Error "❌ No ADO Orgs found."; exit 1 }

$orgs.value | ForEach-Object { 
    $i = [array]::IndexOf($orgs.value, $_) + 1
    Write-Host "$i. $($_.accountName)"
}
$orgChoice = Read-Host "👉 Enter Org number"
$AdoOrg = $orgs.value[$orgChoice - 1].accountName
Write-Host "✅ Selected Org: $AdoOrg"

# === Step 2. Get Projects ===
Write-Host "`n🔍 Fetching Projects in Org '$AdoOrg'..."
$projectsUri = "https://dev.azure.com/$AdoOrg/_apis/projects?api-version=7.0"
$projects = Invoke-RestMethod -Uri $projectsUri -Headers $headers

if (-not $projects.value -or $projects.count -eq 0) { Write-Error "❌ No Projects found."; exit 1 }

$projects.value | ForEach-Object {
    $i = [array]::IndexOf($projects.value, $_) + 1
    Write-Host "$i. $($_.name)"
}
$projChoice = Read-Host "👉 Enter Project number"
$AdoProject = $projects.value[$projChoice - 1].name
Write-Host "✅ Selected Project: $AdoProject"

# === Step 3. Get Repos ===
Write-Host "`n🔍 Fetching Repos in Project '$AdoProject'..."
$reposUri = "https://dev.azure.com/$AdoOrg/$AdoProject/_apis/git/repositories?api-version=7.0"
$repos = Invoke-RestMethod -Uri $reposUri -Headers $headers

if (-not $repos.value -or $repos.count -eq 0) { Write-Error "❌ No Repos found."; exit 1 }

$repos.value | ForEach-Object {
    $i = [array]::IndexOf($repos.value, $_) + 1
    Write-Host "$i. $($_.name)"
}
$repoChoice = Read-Host "👉 Enter Repo number"
$AdoRepo = $repos.value[$repoChoice - 1].name
Write-Host "✅ Selected Repo: $AdoRepo"

# === Step 4. Get Pipelines for Repo ===
Write-Host "`n🔍 Fetching Pipelines in Repo '$AdoRepo'..."
$pipelinesUri = "https://dev.azure.com/$AdoOrg/$AdoProject/_apis/pipelines?api-version=7.0"
$pipelines = Invoke-RestMethod -Uri $pipelinesUri -Headers $headers

if (-not $pipelines.value -or $pipelines.count -eq 0) { Write-Error "❌ No Pipelines found."; exit 1 }

foreach ($pipeline in $pipelines.value) {
    $pipelineId = $pipeline.id
    $pipelineName = $pipeline.name
    Write-Host "`n🚀 Migrating pipeline: $pipelineName (ID: $pipelineId)..."

    $importerCmd = @(
        "gh",
        "actions-importer",
        "migrate azure-devops",
        "--azure-devops-instance-url https://dev.azure.com",
        "--azure-devops-project `"$AdoProject`"",
        "--azure-devops-access-token `"$ADO_PAT`"",
        "--github-access-token `"$GITHUB_PAT`"",
        "--pipeline-id $pipelineId",
        "--target-url https://github.com/$GithubOwner/$GithubRepo",
        "--output-dir ./migration-output/$pipelineName"
    ) -join " "

    Write-Host "👉 Running: $importerCmd"
    Invoke-Expression $importerCmd
}

# === Step 5. Auto-merge migration PRs ===
Write-Host "`n🔍 Checking for migration pull requests..."
$prList = gh pr list --repo "$GithubOwner/$GithubRepo" --state open --json number,title,headRefName | ConvertFrom-Json
$importerPRs = $prList | Where-Object { $_.headRefName -like "gh-actions-importer/*" }

if ($importerPRs -and $importerPRs.Count -gt 0) {
    foreach ($pr in $importerPRs) {
        Write-Host "✅ Found migration PR #$($pr.number): $($pr.title)"
        Write-Host "👉 Merging PR #$($pr.number)..."
        gh pr merge $pr.number --repo "$GithubOwner/$GithubRepo" --squash --admin --delete-branch
    }
    Write-Host "🎉 All migration PRs merged successfully!"
} else {
    Write-Host "ℹ️ No open migration PRs from importer found."
}

Write-Host "`n🎉 Migration process fully completed!"
