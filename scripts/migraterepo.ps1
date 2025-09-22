param()

# Prompt for inputs
$AdoOrg      = Read-Host "Enter Azure DevOps Org name"
$AdoProject  = Read-Host "Enter Azure DevOps Project name"
$AdoRepo     = Read-Host "Enter Azure DevOps Repo name"
$GithubOwner = Read-Host "Enter GitHub Owner/User name"
$GithubRepo  = Read-Host "Enter GitHub Repo name"

# Ask for PATs securely
$AdoPat     = Read-Host "Enter Azure DevOps PAT" -AsSecureString
$GithubPat  = Read-Host "Enter GitHub PAT" -AsSecureString

# Convert secure strings to plain text (needed for git URL embedding)
$AdoPatPlain    = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                     [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdoPat))
$GithubPatPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                     [Runtime.InteropServices.Marshal]::SecureStringToBSTR($GithubPat))

# Construct repo URLs
$AdoUrl    = "https://$AdoPatPlain@dev.azure.com/$AdoOrg/$AdoProject/_git/$AdoRepo"
$GithubUrl = "https://$GithubPatPlain@github.com/$GithubOwner/$GithubRepo.git"

Write-Host "Cloning from ADO: $AdoUrl" -ForegroundColor Cyan
Write-Host "Pushing to GitHub: $GithubUrl" -ForegroundColor Cyan

# Temporary folder
$tempDir = "temp-$AdoRepo"
if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
mkdir $tempDir | Out-Null
Set-Location $tempDir

# Clone mirror from ADO
git clone --mirror $AdoUrl

# Push mirror to GitHub
Set-Location "$AdoRepo.git"
git remote set-url origin $GithubUrl
git push --mirror

Write-Host "✅ Migration completed successfully!" -ForegroundColor Green

# Cleanup
Set-Location ../..
Remove-Item -Recurse -Force $tempDir