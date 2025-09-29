<#
.SYNOPSIS
Migrate an Azure DevOps repo pipeline to GitHub Actions using gh-actions-importer.
Includes interactive org, project, and repo selection.
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

if (-not $orgs.value -or $orgs.count -eq 0) { Write-Error "❌ No ADO Orgs found for this PAT."; exit 1 }

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

if (-not $projects.value -or $projects.count -eq 0) { Write-Error "❌ No Projects found in Org $AdoOrg"; exit 1 }

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

if (-not $repos.value -or $repos.count -eq 0) { Write-Error "❌ No Repos found in Project $AdoProject"; exit 1 }

$repos.value | ForEach-Object {
    $i = [array]::IndexOf($repos.value, $_) + 1
    Write-Host "$i. $($_.name)"
}
$repoChoice = Read-Host "👉 Enter Repo number"
$AdoRepo = $repos.value[$repoChoice - 1].name
Write-Host "✅ Selected Repo: $AdoRepo"

# === Step 4. Run gh-actions-importer ===
Write-Host "`n🚀 Running migration..."
$importerCmd = @(
    "gh",
    "actions-importer",
    "migrate azure-devops pipeline",
    "--azure-devops-instance-url", "https://dev.azure.com"
    "--azure-devops-organization", $AdoOrg,
    "--azure-devops-project", $AdoProject,
    "--azure-devops-access-token", $ADO_PAT,
    "--github-access-token", $GITHUB_PAT,
    "--pipeline-id", 57,
    "--target-url", "https://github.com/$GithubOwner/$GithubRepo",
    "--output-dir", ".\mcp-migration-output"
) -join " "



Write-Host "👉 Command: $importerCmd"
Invoke-Expression $importerCmd

Write-Host "`n🎉 Migration process completed!"


# === Step 5. Auto-merge PR in GitHub ===
Write-Host "`n🔍 Checking for migration pull requests..."

# List open PRs created by actions-importer (usually branch name starts with 'gh-actions-importer/')
$prList = gh pr list --repo "$GithubOwner/$GithubRepo" --state open --json number,title,headRefName | ConvertFrom-Json

$importerPR = $prList | Where-Object { $_.headRefName -like "gh-actions-importer/*" }

if ($importerPR) {
    foreach ($pr in $importerPR) {
        Write-Host "✅ Found migration PR #$($pr.number): $($pr.title)"
        Write-Host "👉 Merging PR #$($pr.number)..."

        gh pr merge $pr.number --repo "$GithubOwner/$GithubRepo" --squash --admin --delete-branch
    }
    Write-Host "🎉 Migration PR(s) merged successfully!"
} else {
    Write-Host "ℹ️ No open migration PRs found."
}