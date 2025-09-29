param (
    [string]$AdoOrg,
    [string]$AdoProject,
    [string]$AdoRepo,
    [string]$GithubOwner,
    [string]$GithubRepo
)

# Read PATs from environment variables
$adoPat = $env:ADO_PAT
$githubPat = $env:GITHUB_PAT

if (-not $adoPat) {
    Write-Error "❌ Missing Azure DevOps PAT. Please set the ADO_PAT environment variable."
    exit 1
}
if (-not $githubPat) {
    Write-Error "❌ Missing GitHub PAT. Please set the GITHUB_PAT environment variable."
    exit 1
}

# 🔐 Ignore SSL errors (only if necessary!)
git config --global http.sslVerify false

# Temp directory
$tempFolder = Join-Path -Path $PSScriptRoot -ChildPath "temp-repo"

try {
    if (Test-Path $tempFolder) { Remove-Item -Recurse -Force $tempFolder }
    New-Item -ItemType Directory -Path $tempFolder | Out-Null

    # Authenticated URLs
    $adoAuthUrl = "https://:$($adoPat)@dev.azure.com/$AdoOrg/$AdoProject/_git/$AdoRepo"
    $githubUrl = "https://github.com/$GithubOwner/$GithubRepo.git"
    $githubApiUrl = "https://api.github.com/repos/$GithubOwner/$GithubRepo"

    # Check if GitHub repo exists
    Write-Host "🔍 Checking if GitHub repo $GithubOwner/$GithubRepo exists..."
    $repoExists = $false
    try {
        Invoke-RestMethod -Uri $githubApiUrl -Headers @{ Authorization = "token $githubPat" } -Method GET -ErrorAction Stop | Out-Null
        $repoExists = $true
        Write-Host "✔️ GitHub repo already exists."
    }
    catch {
        Write-Host "⚠️ Repo not found. Will attempt to create..."
    }

    if (-not $repoExists) {
        # Detect if owner is a user or organization
        Write-Host "🔍 Detecting if $GithubOwner is a user or organization..."
        try {
            $ownerInfo = Invoke-RestMethod -Uri "https://api.github.com/users/$GithubOwner" `
                -Headers @{ Authorization = "token $githubPat" } `
                -ErrorAction Stop
            $ownerType = $ownerInfo.type  # "User" or "Organization"
            Write-Host "✔️ Detected $GithubOwner as $ownerType"
        }
        catch {
            Write-Error "❌ Unable to detect GitHub owner type for $GithubOwner. Error: $_"
            exit 1
        }

        # Create repo based on detected type
        if ($ownerType -eq "User") {
            Write-Host "📦 Creating user repo $GithubOwner/$GithubRepo..."
            Invoke-RestMethod -Uri "https://api.github.com/user/repos" `
                -Headers @{ Authorization = "token $githubPat"; "Accept" = "application/vnd.github.v3+json" } `
                -Method POST `
                -Body (@{ name = $GithubRepo; private = $true } | ConvertTo-Json -Depth 10)
        }
        elseif ($ownerType -eq "Organization") {
            Write-Host "📦 Creating org repo $GithubOwner/$GithubRepo..."
            Invoke-RestMethod -Uri "https://api.github.com/orgs/$GithubOwner/repos" `
                -Headers @{ Authorization = "token $githubPat"; "Accept" = "application/vnd.github.v3+json" } `
                -Method POST `
                -Body (@{ name = $GithubRepo; private = $true } | ConvertTo-Json -Depth 10)
        }
        else {
            Write-Error "❌ Unknown owner type: $ownerType"
            exit 1
        }

        Write-Host "✅ GitHub repo $GithubOwner/$GithubRepo created."
    }

    # Clone from ADO
    Write-Host "⬇️ Cloning $AdoRepo from ADO..."
    git clone --mirror $adoAuthUrl $tempFolder

    # Push to GitHub
    Set-Location $tempFolder
    Write-Host "⬆️ Pushing to GitHub..."
    $githubAuthUrl = $githubUrl.Replace("https://", "https://$githubPat@")
    git remote set-url origin $githubAuthUrl
    git push --mirror

    Write-Host "🎉 Migration completed successfully!"
}
catch {
    Write-Error "❌ Migration failed: $_"
}
finally {
    Set-Location $PSScriptRoot
    if (Test-Path $tempFolder) { Remove-Item -Recurse -Force $tempFolder }
}