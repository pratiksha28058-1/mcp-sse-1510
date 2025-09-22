param(
    [Parameter(Mandatory = $true)] [string]$AdoOrg,
    [Parameter(Mandatory = $true)] [string]$AdoProject,
    [Parameter(Mandatory = $true)] [string]$AdoRepo,
    [Parameter(Mandatory = $true)] [string]$GithubOwner,
    [Parameter(Mandatory = $true)] [string]$GithubRepo
)

# Get tokens from environment variables
$AdoToken    = $env:ADO_PAT
$GithubToken = $env:GITHUB_PAT

if (-not $AdoToken -or -not $GithubToken) {
    Write-Error "❌ Please set both ADO_PAT and GITHUB_PAT environment variables"
    exit 1
}

# Build repo URLs
$adoUrl     = "https://$AdoOrg@dev.azure.com/$AdoOrg/$AdoProject/_git/$AdoRepo"
$githubUrl  = "https://$GithubToken@github.com/$GithubOwner/$GithubRepo.git"
$tempFolder = "./temp-repo"

try {
    Write-Host " Starting migration from ADO → GitHub"
    Write-Host " Temp folder: $tempFolder"

    # Cleanup any leftover temp repo
    if (Test-Path $tempFolder) {
        Remove-Item -Recurse -Force $tempFolder
    }

    # Clone as bare mirror
    Write-Host " Cloning from ADO: $adoUrl"
    git clone --mirror $adoUrl $tempFolder

    # Change into temp repo folder
    Set-Location $tempFolder

    # Push all refs (branches, tags, history) to GitHub
    Write-Host " Pushing mirror to GitHub: $githubUrl"
    git push --mirror $githubUrl

    Write-Host " Migration completed successfully!"
}
catch {
    Write-Error " Migration failed: $_"
}
finally {
    # Go back and cleanup
    Set-Location ..
    if (Test-Path $tempFolder) {
        Write-Host " Cleaning up temporary repo..."
        Remove-Item -Recurse -Force $tempFolder
    }
}