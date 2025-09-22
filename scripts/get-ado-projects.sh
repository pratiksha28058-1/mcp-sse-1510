#!/usr/bin/env bash

# Check input
if [ -z "$1" ]; then
  echo "Usage: $0 <ADO_ORG_NAME>"
  exit 1
fi

ORG_NAME=$1

# Check if ADO_PAT is set
if [ -z "$ADO_PAT" ]; then
  echo "❌ Environment variable ADO_PAT is not set"
  exit 1
fi

# Base64 encode PAT for basic auth
AUTH=$(echo -n ":$ADO_PAT" | base64)

# Fetch projects from Azure DevOps REST API
curl -s -u :$ADO_PAT \
  -H "Accept: application/json;api-version=7.0" \
  "https://dev.azure.com/$ORG_NAME/_apis/projects?api-version=7.0" \
  | jq -r '.value[] | .name'
