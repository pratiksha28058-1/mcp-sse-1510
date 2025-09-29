
<#
.SYNOPSIS
Migrate Azure DevOps pipeline to GitHub using MCP tools
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$AdoOrg,
    [Parameter(Mandatory=$true)]
    [string]$AdoProject,
    [Parameter(Mandatory=$true)]
    [string]$RepoName,
    [Parameter(Mandatory=$true)]
    [string]$GitHubOrg
)

# Load PATs from environment
$ADO_PAT = $env:ADO_PAT
$GITHUB_PAT = $env:GITHUB_PAT

if (-not $ADO_PAT) { Write-Error "ADO_PAT not set"; exit 1 }
if (-not $GITHUB_PAT) { Write-Error "GITHUB_PAT not set"; exit 1 }

# GitHub API headers
$ghHeaders = @{
    Authorization = "Bearer $GITHUB_PAT"
    Accept = "application/vnd.github+json"
}

# 1️⃣ Check if GitHub repo exists
$repoCheckUri = "https://api.github.com/repos/$GitHubOrg/$RepoName"
try {
    $repoResp = Invoke-RestMethod -Uri $repoCheckUri -Headers $ghHeaders -Method GET -ErrorAction Stop
    Write-Host "✅ GitHub repository '$RepoName' exists."
    $repoExists = $true
}
catch {
    Write-Host "⚠️ GitHub repository '$RepoName' does not exist. Will migrate ADO repo first."
    $repoExists = $false
}

# 2️⃣ If repo missing, call MCP tool to migrate repo
if (-not $repoExists) {
    Write-Host "🔹 Invoking MCP tool to migrate repository..."
    
    $mcpPayload = @{
        tool = "migrate_repo"
        params = @{
            adoOrg = $AdoOrg
            adoProject = $AdoProject
            repoName = $RepoName
            githubOrg = $GitHubOrg
        }
    } | ConvertTo-Json -Depth 5

    $mcpResp = Invoke-RestMethod -Uri "http://localhost:8080/messages" `
                                 -Method POST `
                                 -Body $mcpPayload `
                                 -ContentType "application/json"
    Write-Host "✅ Repository migration tool executed."
}

# 3️⃣ Call MCP tool to migrate pipeline
Write-Host "🔹 Invoking MCP tool to migrate pipeline..."
$mcpPipelinePayload = @{
    tool = "migrate_pipeline"
    params = @{
        adoOrg = $AdoOrg
        adoProject = $AdoProject
        repoName = $RepoName
        githubOrg = $GitHubOrg
    }
} | ConvertTo-Json -Depth 5

$pipelineResp = Invoke-RestMethod -Uri "http://localhost:8080/messages" `
                                  -Method POST `
                                  -Body $mcpPipelinePayload `
                                  -ContentType "application/json"

Write-Host "✅ Pipeline migration executed successfully."