<#
.SYNOPSIS
Migrate Azure DevOps repository to GitHub using GitHub CLI
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$AdoOrg,

    [Parameter(Mandatory = $true)]
    [string]$AdoProject,

    [Parameter(Mandatory = $true)]
    [string]$AdoRepo,

    [Parameter(Mandatory = $true)]
    [string]$GithubOwner,

    [Parameter(Mandatory = $true)]
    [string]$GithubRepo
)

# Load PATs from environment
$ADO_PAT = $env:ADO_PAT
$GITHUB_PAT = $env:GITHUB_PAT

if (-not $ADO_PAT) { Write-Error "ADO_PAT not set"; exit 1 }
if (-not $GITHUB_PAT) { Write-Error "GITHUB_PAT not set"; exit 1 }

# GitHub API headers
$ghHeaders = @{
    Authorization = "Bearer $GITHUB_PAT"
    Accept        = "application/vnd.github+json"
}

# 1️⃣ Check if GitHub repo exists
$repoCheckUri = "https://api.github.com/repos/$GithubOwner/$GithubRepo"
$repoExists = $false
try {
    Invoke-RestMethod -Uri $repoCheckUri -Headers $ghHeaders -Method GET -ErrorAction Stop | Out-Null
    Write-Host "✅ GitHub repository '$GithubOwner/$GithubRepo' exists."
    $repoExists = $true
}
catch {
    Write-Host "⚠️ GitHub repository '$GithubOwner/$GithubRepo' does not exist. It will be created."
}

# 2️⃣ Create GitHub repo if missing
if (-not $repoExists) {
    Write-Host "🔹 Creating GitHub repository '$GithubOwner/$GithubRepo'..."
    if ($GithubOwner -eq (Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $ghHeaders).login) {
        # Personal repo
        gh repo create "$GithubOwner/$GithubRepo" --private --confirm
    }
    else {
        # Org repo
        gh repo create "$GithubOwner/$GithubRepo" --private --confirm --owner $GithubOwner
    }
    Write-Host "✅ GitHub repository created."
}

# 3️⃣ Import ADO repo using gh import
$adoUrl = "https://dev.azure.com/$AdoOrg/$AdoProject/_git/$AdoRepo"
Write-Host "🔹 Importing ADO repo '$AdoRepo' into GitHub repo '$GithubOwner/$GithubRepo'..."
$importCmd = "gh repo import $GithubOwner/$GithubRepo --git-url $adoUrl --git-username $GithubOwner --git-password $GITHUB_PAT --confirm"
Write-Host "Executing: $importCmd"
Invoke-Expression $importCmd

Write-Host "🎉 Repository migration from Azure DevOps to GitHub completed!"
