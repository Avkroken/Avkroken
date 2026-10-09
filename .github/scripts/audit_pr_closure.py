#!/usr/bin/env python3
"""Audit unmerged PR closures with GitHub's *account* actor, never an inferred agent."""
import json
import os
import re
import urllib.request
from pathlib import Path


def normalized(value, pattern, fallback="unknown"):
    text = str(value or "")
    return text if re.fullmatch(pattern, text) else fallback


def closure_marker(number, sha, run_id):
    """Identify one workflow occurrence; GITHUB_RUN_ID is stable across reruns."""
    if not isinstance(number, int) or number <= 0:
        return "<!-- avkroken-pr-closure-audit:unknown:unknown -->"
    safe_sha = normalized(sha, r"[0-9a-fA-F]{40}")
    safe_run = normalized(run_id, r"[0-9]+")
    return f"<!-- avkroken-pr-closure-audit:{number}:{safe_sha}:{safe_run} -->"


def has_existing_audit_comment(comments, expected_comment):
    """Deduplicate only an exact audit published by GitHub Actions' bot account."""
    for comment in comments:
        comment = comment or {}
        author = comment.get("user") or {}
        if (
            author.get("login") == "github-actions[bot]"
            and author.get("type") == "Bot"
            and comment.get("body") == expected_comment
        ):
            return True
    return False


def closure_comment(event, repository, run_id):
    """Build a sanitized, deterministic comment; no PR title or body is trusted."""
    if event.get("action") != "closed":
        return None
    pr = event.get("pull_request") or {}
    if pr.get("merged") is not False:
        return None
    repo = normalized(repository, r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")
    number = pr.get("number")
    if not isinstance(number, int) or number <= 0 or repo == "unknown":
        return None
    actor = normalized(
        (event.get("sender") or {}).get("login"),
        r"[A-Za-z0-9-]{1,100}(?:\[bot\])?",
    )
    closed_at = normalized(pr.get("closed_at"), r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")
    sha = normalized(((pr.get("head") or {}).get("sha")), r"[0-9a-fA-F]{40}")
    run = normalized(run_id, r"[0-9]+")
    if run == "unknown":
        return None
    marker = closure_marker(number, sha, run)
    return (
        f"{marker}\n"
        "### GitHub closure audit (unmerged PR)\n\n"
        f"- GitHub actor: `{actor}` (account identity; not verified agent/session identity)\n"
        f"- Closed at: `{closed_at}`\n"
        f"- Pull request: #{number}\n"
        f"- Head SHA: `{sha}`\n"
        f"- Audit workflow: https://github.com/{repo}/actions/runs/{run}\n\n"
        "This closure is **not a merge**. If unintended, reopen the PR and "
        "complete checks and review. An OAuth account login cannot establish which "
        "AI session, if any, initiated the action."
    )


def existing_comment(repository, number, token, expected_comment):
    """Check existing PR issue comments with bounded pagination."""
    for page in range(1, 11):
        url = (
            f"https://api.github.com/repos/{repository}/issues/{number}/comments"
            f"?per_page=100&page={page}"
        )
        request = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "avkroken-pr-closure-audit",
            },
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            comments = json.load(response)
        if not isinstance(comments, list):
            raise RuntimeError("Closure audit comments response was not a list")
        if has_existing_audit_comment(comments, expected_comment):
            return True
        if len(comments) < 100:
            return False
    raise RuntimeError("Closure audit comment pagination bound reached")


def main():
    with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as handle:
        event = json.load(handle)
    repository = os.environ["GITHUB_REPOSITORY"]
    comment = closure_comment(event, repository, os.environ["GITHUB_RUN_ID"])
    if comment is None:
        print("Not an unmerged PR closure; no audit comment.")
        return

    # Retain evidence for fork PRs in the summary without publishing comments.
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with Path(summary).open("a", encoding="utf-8") as handle:
            handle.write(comment + "\n")
    print("Unmerged PR closure recorded in run summary.")

    pr = event["pull_request"]
    if ((pr.get("head") or {}).get("repo") or {}).get("full_name") != repository:
        print("External fork: omit API write, retain workflow summary.")
        return
    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        raise RuntimeError("GITHUB_TOKEN absent for same-repository closure audit")

    if existing_comment(repository, pr["number"], token, comment):
        print("Closure audit comment already exists; skipping duplicate publication.")
        return

    payload = json.dumps({"body": comment}).encode("utf-8")
    url = f"https://api.github.com/repos/{repository}/issues/{pr['number']}/comments"
    request = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "avkroken-pr-closure-audit",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        if response.status != 201:
            raise RuntimeError(f"Closure audit comment rejected: HTTP {response.status}")
    print("Closure audit comment created by GitHub Actions identity.")


if __name__ == "__main__":
    main()
