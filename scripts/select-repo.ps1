param(
    [string]$AdoPat = $env:ADO_PAT
)

if (-not $AdoPat) {
    Write-Error "Provide ADO_PAT as a parameter or environment variable."
    exit 1
}

# Force TLS 1.2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Encode-Pat($pat) {
    return [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$pat"))
}

$authHeader = @{ Authorization = "Basic $(Encode-Pat $AdoPat)" }

# 1️⃣ Get memberId
$profileId = Invoke-RestMethod -Uri "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.0" -Headers $authHeader
$memberId = $profileId.id

# 2️⃣ List all orgs
$orgs = Invoke-RestMethod -Uri "https://app.vssps.visualstudio.com/_apis/accounts?memberId=$memberId&api-version=7.0" -Headers $authHeader

if (-not $orgs.value) { Write-Error "No organizations found"; exit 1 }

Write-Host "`nAvailable Organizations:"
$i = 1
$orgs.value | ForEach-Object { Write-Host "[$i] $($_.accountName)"; $i++ }

$orgIndex = Read-Host "Enter serial number of the organization"
$selectedOrg = $orgs.value[$orgIndex - 1].accountName

# 3️⃣ List projects in selected org
$projectsUri = "https://dev.azure.com/$selectedOrg/_apis/projects?api-version=7.0"
$projects = Invoke-RestMethod -Uri $projectsUri -Headers $authHeader

if (-not $projects.value) { Write-Error "No projects found in org $selectedOrg"; exit 1 }

Write-Host "`nProjects in $selectedOrg"
$i = 1
$projects.value | ForEach-Object { Write-Host "[$i] $($_.name)"; $i++ }

$projIndex = Read-Host "Enter serial number of the project"
$selectedProject = $projects.value[$projIndex - 1].name

# 4️⃣ List repos in selected project
$reposUri = "https://dev.azure.com/$selectedOrg/$selectedProject/_apis/git/repositories?api-version=7.0"
$repos = Invoke-RestMethod -Uri $reposUri -Headers $authHeader

if (-not $repos.value) { Write-Error "No repositories found in project $selectedProject"; exit 1 }

Write-Host "`nRepositories in $selectedProject"
$i = 1
$repos.value | ForEach-Object { Write-Host "[$i] $($_.name)"; $i++ }

# 5️⃣ Allow user to select a repo
$repoIndex = Read-Host "Enter serial number of the repository"
$selectedRepo = $repos.value[$repoIndex - 1].name

Write-Host "`n✅ Selected Repository: $selectedRepo"
Write-Host "`nScan completed successfully!"