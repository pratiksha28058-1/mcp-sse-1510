$ADO_PAT = $env:ADO_PAT
$base64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$ADO_PAT"))

# list project repos
Invoke-RestMethod "https://dev.azure.com/PratikshaTiwari/DemoAppp/_apis/git/repositories?api-version=7.0" -Headers @{Authorization="Basic $base64"}

# list pipelines in the project
Invoke-RestMethod "https://dev.azure.com/PratikshaTiwari/DemoAppp/_apis/pipelines?api-version=7.0" -Headers @{Authorization="Basic $base64"}