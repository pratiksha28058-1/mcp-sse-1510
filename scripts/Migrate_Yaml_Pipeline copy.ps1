<#
.SYNOPSIS
Migrate an Azure DevOps repo + all its pipelines to GitHub with workflows
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$AdoOrg,

    [Parameter(Mandatory=$true)]
    [string]$AdoProject,

    [Parameter(Mandatory=$true)]
    [string]$AdoRepo,

    [Parameter(Mandatory=$true)]
    [string]$GithubOwner,

    [Parameter(Mandatory=$true)]
    [string]$GithubRepo
)

$AdoRepo = $AdoRepo.Trim()
$AdoOrg = $AdoOrg.Trim()
$AdoProject = $AdoProject.Trim()

Write-Host "Org: '$AdoOrg'"
Write-Host "Project: '$AdoProject'"
Write-Host "Repo: '$AdoRepo'"

# 🔐 Load PATs from environment
$ADO_PAT = $env:ADO_PAT
$GITHUB_PAT = $env:GITHUB_PAT

if (-not $ADO_PAT) { Write-Error "❌ ADO_PAT not set"; exit 1 }
if (-not $GITHUB_PAT) { Write-Error "❌ GITHUB_PAT not set"; exit 1 }

# Check GitHub CLI
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "❌ GitHub CLI 'gh' not found in PATH. Install it before running the script."
    exit 1
}

# Temp folder
$tempFolder = Join-Path $PSScriptRoot "temp_migration"
if (Test-Path $tempFolder) { Remove-Item -Recurse -Force $tempFolder }
New-Item -ItemType Directory -Path $tempFolder | Out-Null

# 🔹 Clone ADO repo
$adoUrl = "https://$ADO_PAT@dev.azure.com/$AdoOrg/$AdoProject/_git/$AdoRepo"
Write-Host "⬇️ Cloning ADO repo '$AdoRepo'..."
git clone --mirror $adoUrl $tempFolder

# 🔹 Check/create GitHub repo
$repoCheckUri = "https://api.github.com/repos/$GithubOwner/$GithubRepo"
$ghHeaders = @{
    Authorization = "Bearer $GITHUB_PAT"
    Accept        = "application/vnd.github+json"
}
$repoExists = $false
try {
    Invoke-RestMethod -Uri $repoCheckUri -Headers $ghHeaders -Method GET -ErrorAction Stop | Out-Null
    $repoExists = $true
    Write-Host "✅ GitHub repo '$GithubOwner/$GithubRepo' exists."
}
catch {
    Write-Host "⚠️ GitHub repo '$GithubOwner/$GithubRepo' not found. Creating..."
    if ($GithubOwner -eq (Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $ghHeaders).login) {
        gh repo create "$GithubOwner/$GithubRepo" --private --confirm
    } else {
        gh repo create "$GithubOwner/$GithubRepo" --private --owner $GithubOwner --confirm
    }
}

# 🔹 Push repo to GitHub
Set-Location $tempFolder
$githubUrl = "https://$GITHUB_PAT@github.com/$GithubOwner/$GithubRepo.git"
git remote set-url origin $githubUrl
git push --mirror
Write-Host "🎉 Repo migration completed!"

# 🔹 Get all pipelines for the repo
#$headers = @{ Authorization = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$ADO_PAT")) }

$base64Auth   = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$ADO_PAT"))

$repoInfoUri = "https://dev.azure.com/${AdoOrg}/${AdoProject}/_apis/git/repositories/${AdoRepo}?api-version=7.0"

Write-Host "Testing URI: $repoInfoUri"

$repoInfo = Invoke-RestMethod -Uri $repoInfoUri -Headers @{Authorization = "Basic $base64Auth"} -Method GET

#$repoInfo = Invoke-RestMethod -Uri "https://dev.azure.com/PratikshaTiwari/DemoAppp/_apis/git/repositories/mcp-server?api-version=7.0" -Headers @{Authorization = "Basic $base64Auth"} -Method GET


$repoId = $repoInfo.id

$pipelineUri = "https://dev.azure.com/${AdoOrg}/${AdoProject}/_apis/pipelines?repositoryId=$repoId&api-version=7.0"
$pipelines = Invoke-RestMethod -Uri $pipelineUri -Headers @{Authorization = "Basic $base64Auth"} -Method GET

# Workflow folder
$workflowFolder = Join-Path $tempFolder ".github\workflows"
New-Item -ItemType Directory -Path $workflowFolder -Force | Out-Null

foreach ($pipeline in $pipelines.value) {
    $yamlPath = $pipeline.configuration.path
    $pipelineName = $pipeline.name -replace ' ', '_'

    $rawYamlUri = "https://dev.azure.com/${AdoOrg}/${AdoProject}/_apis/git/repositories/$repoId/items?path=$yamlPath&api-version=7.0&includeContent=true"
    $yamlContent = Invoke-RestMethod -Uri $rawYamlUri -Headers $headers -Method GET

    $workflowFile = Join-Path $workflowFolder "$pipelineName.yml"
    $yamlContent.content | Out-File -FilePath $workflowFile -Encoding utf8

    Write-Host "✅ Pipeline '$pipelineName' saved as GitHub workflow."
}

# 🔹 Push workflows to GitHub
git add .github/workflows/*
git commit -m "Add migrated ADO pipelines as GitHub Actions workflows"
git push origin main -f

Write-Host "🎉 All pipelines migrated successfully!"