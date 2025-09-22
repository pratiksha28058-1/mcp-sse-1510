param(
    [Parameter(Mandatory=$true)] [string]$AdoOrg,
    [Parameter(Mandatory=$true)] [string]$AdoProject,
    [Parameter(Mandatory=$true)] [string]$AdoRepo,
    [Parameter(Mandatory=$true)] [string]$GithubOwner,
    [Parameter(Mandatory=$true)] [string]$GithubRepo
)

# Disable SSL certificate validation globally
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

# Tokens from environment
$AdoToken = $env:ADO_PAT
$GithubToken = $env:GITHUB_PAT

if (-not $AdoToken -or -not $GithubToken) {
    Write-Error "Please set ADO_PAT and GITHUB_PAT environment variables"
    exit 1
}

$adoAuthHeader = @{ Authorization = "Basic $([Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$AdoToken")))" }
$githubAuthHeader = @{ Authorization = "token $GithubToken" }

$adoApiUrl = "https://dev.azure.com/$AdoOrg/$AdoProject/_apis/git/repositories/$AdoRepo/pullrequests?searchCriteria.status=all&api-version=7.0"
$githubApiUrl = "https://api.github.com"

Write-Host "Fetching ADO PRs..."
$adoPRs = Invoke-RestMethod -Uri $adoApiUrl -Headers $adoAuthHeader -SkipCertificateCheck

foreach ($pr in $adoPRs.value) {
    Write-Host "Migrating PR: $($pr.title) (#$($pr.pullRequestId))"

    $sourceBranch = $pr.sourceRefName.Replace("refs/heads/","")
    $targetBranch = $pr.targetRefName.Replace("refs/heads/","")
    $headBranch   = $sourceBranch

    # PR payload
    $prPayload = @{
        title = $pr.title
        body  = "$($pr.description)`n`n(Migrated from ADO PR #$($pr.pullRequestId))"
        head  = "${GithubOwner}:${headBranch}"
        base  = $targetBranch
    } | ConvertTo-Json -Depth 3

    # Check if PR already exists in GitHub
    $existingPRs = Invoke-RestMethod -Uri "$githubApiUrl/repos/${GithubOwner}/${GithubRepo}/pulls?head=${GithubOwner}:${headBranch}`&state=all" `
        -Headers $githubAuthHeader -SkipCertificateCheck

    if ($existingPRs.Count -gt 0) {
        Write-Host "Updating existing PR for branch $headBranch..."
        $existingPR = $existingPRs[0]

        # Update PR metadata
        $updatePayload = @{
            title = $pr.title
            body  = "$($pr.description)`n`n(Migrated/Updated from ADO PR #$($pr.pullRequestId))"
        } | ConvertTo-Json -Depth 3

        Invoke-RestMethod -Uri "$githubApiUrl/repos/$GithubOwner/$GithubRepo/pulls/$($existingPR.number)" `
            -Method Patch -Headers $githubAuthHeader -Body $updatePayload -SkipCertificateCheck

        $ghPR = $existingPR
    }
    else {
        Write-Host "Creating new PR for branch $headBranch..."
        $ghPR = Invoke-RestMethod -Uri "$githubApiUrl/repos/$GithubOwner/$GithubRepo/pulls" `
            -Method Post -Headers $githubAuthHeader -Body $prPayload -SkipCertificateCheck
    }

    # --- migrate comments ---
    $commentsUrl = "https://dev.azure.com/$AdoOrg/$AdoProject/_apis/git/repositories/$AdoRepo/pullRequests/$($pr.pullRequestId)/threads?api-version=7.0"
    $comments = Invoke-RestMethod -Uri $commentsUrl -Headers $adoAuthHeader -SkipCertificateCheck

    foreach ($thread in $comments.value) {
        foreach ($comment in $thread.comments) {
            $body = "[ADO Comment by $($comment.author.displayName) on $($comment.publishedDate)]`n$($comment.content)"
            $commentPayload = @{ body = $body } | ConvertTo-Json

            Invoke-RestMethod -Uri "$githubApiUrl/repos/$GithubOwner/$GithubRepo/issues/$($ghPR.number)/comments" `
                -Method Post -Headers $githubAuthHeader -Body $commentPayload -SkipCertificateCheck
        }
    }

    # --- migrate linked work items ---
    $workItemsUrl = "https://dev.azure.com/$AdoOrg/$AdoProject/_apis/git/repositories/$AdoRepo/pullRequests/$($pr.pullRequestId)/workitems?api-version=7.0"
    $workItems = Invoke-RestMethod -Uri $workItemsUrl -Headers $adoAuthHeader -SkipCertificateCheck

    foreach ($wi in $workItems.value) {
        $wiId = $wi.id
        $body = "Linked ADO Work Item: $wiId"
        $wiPayload = @{ body = $body } | ConvertTo-Json

        Invoke-RestMethod -Uri "$githubApiUrl/repos/$GithubOwner/$GithubRepo/issues/$($ghPR.number)/comments" `
            -Method Post -Headers $githubAuthHeader -Body $wiPayload -SkipCertificateCheck
    }
}

Write-Host "✅ Migration completed!"