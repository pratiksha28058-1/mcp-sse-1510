<#
.SYNOPSIS
Migrate Azure DevOps YAML pipelines from a single repo to GitHub Actions
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

# Trim params
$AdoOrg = $AdoOrg.Trim()
$AdoProject = $AdoProject.Trim()
$AdoRepo = $AdoRepo.Trim()

# Load PATs from env
$ADO_PAT = $env:ADO_PAT
$GITHUB_PAT = $env:GITHUB_PAT

if (-not $ADO_PAT) { Write-Error "ADO_PAT not set"; exit 1 }
if (-not $GITHUB_PAT) { Write-Error "GITHUB_PAT not set"; exit 1 }

$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$ADO_PAT"))

# Temp folder
$tempFolder = Join-Path $PSScriptRoot "temp_migration"
if (Test-Path $tempFolder) { Remove-Item -Recurse -Force $tempFolder }
New-Item -ItemType Directory -Path $tempFolder | Out-Null

# ----------------------------
# Clone ADO repo
# ----------------------------
$adoUrl = "https://$ADO_PAT@dev.azure.com/$AdoOrg/$AdoProject/_git/$AdoRepo"
Write-Host "Cloning ADO repo '$AdoRepo'..."
git clone --mirror $adoUrl $tempFolder

# ----------------------------
# Create/check GitHub repo
# ----------------------------
$ghHeaders = @{
    Authorization = "Bearer $GITHUB_PAT"
    Accept = "application/vnd.github+json"
}
$repoCheckUri = "https://api.github.com/repos/$GithubOwner/$GithubRepo"

try {
    Invoke-RestMethod -Uri $repoCheckUri -Headers $ghHeaders -Method GET -ErrorAction Stop | Out-Null
    Write-Host "GitHub repo exists."
}
catch {
    Write-Host "Creating GitHub repo '$GithubOwner/$GithubRepo'..."
    if ($GithubOwner -eq (Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $ghHeaders).login) {
        gh repo create "$GithubOwner/$GithubRepo" --private --confirm
    } else {
        gh repo create "$GithubOwner/$GithubRepo" --private --owner $GithubOwner --confirm
    }
}

# ----------------------------
# Push repo to GitHub
# ----------------------------
Set-Location $tempFolder
$githubUrl = "https://$GITHUB_PAT@github.com/$GithubOwner/$GithubRepo.git"
git remote set-url origin $githubUrl
git push --mirror
Write-Host "Repository migration done!"

# ----------------------------
# Get ADO repo ID
# ----------------------------
$repoInfoUri = "https://dev.azure.com/${AdoOrg}/${AdoProject}/_apis/git/repositories/${AdoRepo}?api-version=7.0"
$repoInfo = Invoke-RestMethod -Uri $repoInfoUri -Headers @{ Authorization = "Basic $base64Auth" } -Method GET
$repoId = $repoInfo.id
Write-Host "Repo ID: $repoId"

# ----------------------------
# Get YAML pipelines for this repo
# ----------------------------
$pipelineUri = "https://dev.azure.com/${AdoOrg}/${AdoProject}/_apis/pipelines?api-version=7.0"
$pipelines = Invoke-RestMethod -Uri $pipelineUri -Headers @{ Authorization = "Basic $base64Auth" } -Method GET

# Filter for YAML pipelines belonging to this repo
$repoPipelines = $pipelines.value | Where-Object {
    $_.configuration.type -eq "yaml" -and $_.configuration.repository.name -eq $AdoRepo
}

Write-Host "Found $($repoPipelines.Count) YAML pipeline(s) in repo '$AdoRepo'"

# ----------------------------
# Download YAML files
# ----------------------------
$workflowFolder = Join-Path $tempFolder ".github/workflows"
New-Item -ItemType Directory -Path $workflowFolder -Force | Out-Null

foreach ($pipeline in $repoPipelines) {
    $yamlPath = $pipeline.configuration.path
    $pipelineName = $pipeline.name -replace ' ', '_'

    $rawYamlUri = "https://dev.azure.com/$AdoOrg/$AdoProject/_apis/git/repositories/$repoId/items?path=$yamlPath&api-version=7.0&includeContent=true"
    $yamlContent = Invoke-RestMethod -Uri $rawYamlUri -Headers @{ Authorization = "Basic $base64Auth" } -Method GET

    $workflowFile = Join-Path $workflowFolder "$pipelineName.yml"
    $yamlContent.content | Out-File -FilePath $workflowFile -Encoding utf8

    Write-Host "Pipeline '$pipelineName' saved as GitHub Actions workflow."
}

# ----------------------------
# Push workflows to GitHub
# ----------------------------
git add .github/workflows/*
git commit -m "Add migrated ADO YAML pipelines as GitHub Actions workflows"
git push origin main -f

Write-Host "All pipelines migrated successfully!"
