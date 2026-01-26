#!/bin/bash
set -eo pipefail

# Argument: github_run_number, github_event_name, github_repository, github_sha, github_token
RUN_NUMBER=$1
EVENT_NAME=$2
REPOSITORY=$3
SHA=$4
export GH_TOKEN=$5

# Function to extract release notes from PR body
extract_release_notes() {
  local body="$1"
  
  # First pass: Remove everything between CodeRabbit comment markers using sed
  local cleaned_body="$(printf '%s\n' "$body" \
    | sed '/<!-- This is an auto-generated comment: release notes by coderabbit.ai -->/,/<!-- end of auto-generated comment: release notes by coderabbit.ai -->/d')"
  
  # Second pass: Remove the "Summary by CodeRabbit" section
  cleaned_body="$(printf '%s\n' "$cleaned_body" \
    | awk '
      BEGIN { skip=0 }
      /^## Summary by CodeRabbit/ { skip=1; next }
      /^## / && skip==1 { skip=0 }
      skip==0 { print }
    ')"
  
  # Third pass: Remove any remaining HTML comment lines
  cleaned_body="$(printf '%s\n' "$cleaned_body" | sed '/^<!--.*-->$/d' | sed '/^<!--/d' | sed '/^-->$/d')"
  
  # Fourth pass: Remove specific CodeRabbit lines
  cleaned_body="$(printf '%s\n' "$cleaned_body" \
    | (grep -v '✏️ Tip: You can customize this high-level summary in your review settings\.' || true) \
    | (grep -v '<!-- This is an auto-generated comment: release notes by coderabbit.ai -->' || true) \
    | (grep -v '<!-- end of auto-generated comment: release notes by coderabbit.ai -->' || true))"
  
  # Fifth pass: Trim leading and trailing whitespace/empty lines
  cleaned_body="$(printf '%s\n' "$cleaned_body" | sed '/^$/d' | awk 'NF {p=1} p')"
  
  # Try to extract content under "## Release Notes" heading if it exists
  local notes="$(printf '%s\n' "$cleaned_body" \
    | awk 'f && /^## /{exit} /^## Release Notes/{f=1; next} f')"
  
  # If no specific "Release Notes" section found, use the entire cleaned body
  if [ -z "$notes" ]; then
    notes="$cleaned_body"
  fi
  
  # Final trim
  notes="$(printf '%s\n' "$notes" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  
  printf '%s\n' "$notes"
}

# Determine source of release notes
NOTES=""

# Check if this was triggered by a push event (likely a merge)
if [ "$EVENT_NAME" = "push" ]; then
  echo "Fetching PR body for merged commit..."
  
  # First, try to find PR number from commit message (most reliable)
  PR_FROM_COMMIT=$(git log -1 --pretty=%B | grep -oE '#[0-9]+' | head -1 | tr -d '#' || echo "")
  
  if [ -n "$PR_FROM_COMMIT" ]; then
    echo "Found PR #$PR_FROM_COMMIT from commit message"
    PR_BODY=$(gh pr view "$PR_FROM_COMMIT" --json body --jq '.body' 2>/dev/null || echo "")
    
    if [ -n "$PR_BODY" ]; then
      echo "PR body length: ${#PR_BODY}"
      NOTES="$(extract_release_notes "$PR_BODY")"
      echo "Extracted notes length: ${#NOTES}"
    else
      echo "Warning: PR body is empty"
    fi
  else
    echo "No PR reference in commit message, searching by commit SHA..."
    # Get PRs that contain this commit (using GitHub API to search by commit)
    PR_NUMBERS=$(gh api \
      "repos/$REPOSITORY/commits/$SHA/pulls" \
      --jq '.[].number' 2>/dev/null || echo "")
    
    if [ -n "$PR_NUMBERS" ]; then
      # Take the first PR found (most recently merged)
      PR_NUMBER=$(echo "$PR_NUMBERS" | head -n 1)
      echo "Found PR #$PR_NUMBER associated with commit"
      
      # Fetch the PR body
      PR_BODY=$(gh pr view "$PR_NUMBER" --json body --jq '.body' 2>/dev/null || echo "")
      
      if [ -n "$PR_BODY" ]; then
        echo "PR body length: ${#PR_BODY}"
        NOTES="$(extract_release_notes "$PR_BODY")"
        echo "Extracted notes length: ${#NOTES}"
      else
        echo "Warning: PR body is empty"
      fi
    else
      echo "No associated PR found for this commit"
    fi
  fi
fi

# Fallback to recent commits if no PR body found (skip merge commits)
if [ -z "$NOTES" ]; then
  echo "No PR body found, using recent commits (excluding merge commits)..."
  NOTES="$(git log -n 10 --pretty=format:'- %s' --no-merges | head -n 5)"
fi

# Fail if no notes extracted
if [ -z "$NOTES" ]; then
  echo "Error: No release notes extracted" >&2
  exit 1
fi

# Write header and notes to file
{
  echo "## Version 7.$RUN_NUMBER - $(date +%Y-%m-%d)"
  echo
  printf '%s\n' "$NOTES"
} > RELEASE_NOTES.md

echo "Release notes prepared:"
cat RELEASE_NOTES.md
