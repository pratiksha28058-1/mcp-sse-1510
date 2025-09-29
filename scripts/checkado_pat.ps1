# -----------------------------
# Test Azure DevOps PAT access
# -----------------------------

# Set your variables
$organization = "PratikshaTiwari"       # e.g., "MyOrg"
$ado_pat      = $env:ADO_PAT          # Or replace with "yourPATHere"
$base64Auth   = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$ado_pat"))

# REST API to list projects
$projectsUri = "https://dev.azure.com/$organization/_apis/projects?api-version=7.0"

try {
    $response = Invoke-RestMethod -Uri $projectsUri -Headers @{Authorization = "Basic $base64Auth"} -Method Get
    Write-Host "✅ PAT is valid! Projects you can access:"
    $response.value | ForEach-Object { Write-Host "- $($_.name)" }
} catch {
    Write-Host "❌ PAT validation failed."
    Write-Host $_.Exception.Message
}