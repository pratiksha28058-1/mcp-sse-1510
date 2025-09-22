param(
    [Parameter(Mandatory = $true)]
    [string]$AdoOrg,

    [Parameter(Mandatory = $false)]
    [string]$AdoPat
)

# If PAT is not passed, try from environment variable
if (-not $AdoPat) {
    $AdoPat = $env:ADO_PAT
}

if (-not $AdoPat) {
    Write-Error "❌ ADO_PAT is not provided. Pass it as parameter -AdoPat or set it in environment."
    exit 1
}

# Base64 encode the PAT for Basic Auth
$auth = [System.Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes(":$AdoPat"))

# Build the REST API URL
$uri = "https://dev.azure.com/$AdoOrg/_apis/projects?api-version=7.0"

try {
    $response = Invoke-RestMethod -Uri $uri -Method Get -Headers @{ Authorization = "Basic $auth" }
    if ($null -eq $response.value -or $response.value.Count -eq 0) {
        Write-Output "⚠️ No projects found in organization $AdoOrg"
    }
    else {
        # Output project list in clean JSON format (MCP tools love JSON output)
        $response.value | Select-Object name, id, state | ConvertTo-Json -Depth 3
    }
}
catch {
    Write-Error "❌ Failed to fetch projects: $($_.Exception.Message)"
    exit 1
}