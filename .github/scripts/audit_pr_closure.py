#!/usr/bin/env python3
"""Audit unmerged PR closures with GitHub's *account* actor, never an inferred agent."""
import json
import os
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
import urllib.error
import urllib.request
from pathlib import Path


def normalized(value, pattern, fallback="unknown"):
    text = str(value or "")
    return text if re.fullmatch(pattern, text) else fallback


def closure_marker(number, sha, closed_at):
    """Identify one closure occurrence, even across reopen/close cycles."""
    if not isinstance(number, int) or number <= 0:
        return "<!-- avkroken-pr-closure-audit:unknown:unknown -->"
    safe_sha = normalized(sha, r"[0-9a-fA-F]{40}")
    safe_time = normalized(closed_at, r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")
    return f"<!-- avkroken-pr-closure-audit:{number}:{safe_sha}:{safe_time} -->"


def has_existing_audit_comment(comments, marker):
    """Trust only a genuine GitHub Actions audit message, not user text."""
    prefix = marker + "\n### GitHub closure audit (unmerged PR)\n"
    return any(
        ((comment or {}).get("user") or {}).get("login") == "github-actions[bot]"
        and ((comment or {}).get("user") or {}).get("type") == "Bot"
        and str((comment or {}).get("body") or "").startswith(prefix)
        for comment in comments
    )


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
    marker = closure_marker(number, sha, closed_at)
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


def existing_comment(repository, number, token, marker, closed_at=None):
    """Scope comment search to the closure occurrence, with bounded pagination."""
    params = {"per_page": 100}
    if closed_at:
        # Timestamps have second precision: include earlier seconds.
        closed = datetime.strptime(closed_at, "%Y-%m-%dT%H:%M:%SZ")
        since = (closed.replace(tzinfo=timezone.utc) -
                 timedelta(seconds=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
        params["since"] = since
    for page in range(1, 101):
        params["page"] = page
        url = (f"https://api.github.com/repos/{repository}/issues/{number}/comments"
               f"?{urlencode(params)}")
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
        if has_existing_audit_comment(comments, marker):
            return True
        if len(comments) < 100:
            return False
    raise RuntimeError("Closure audit comment pagination bound (100 pages) reached")


def audit_closure(event, repository, run_id):
    """Publish the same evidence for an event or a trusted scheduled recovery."""
    comment = closure_comment(event, repository, run_id)
    if comment is None:
        print("Not an unmerged PR closure; no audit comment.")
        return

    # A workflow summary is retained even when the PR came from a fork, where
    # GITHUB_TOKEN permissions may be read-only.
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with Path(summary).open("a", encoding="utf-8") as handle:
            handle.write(comment + "\n")
    print("Unmerged PR closure recorded in run summary.")

    pr = event["pull_request"]
    external_fork = ((pr.get("head") or {}).get("repo") or {}).get("full_name") != repository
    token = os.environ.get("GITHUB_TOKEN", "")
    if not token:
        if external_fork:
            print("External fork without write token; retain workflow summary.")
            return
        raise RuntimeError("GITHUB_TOKEN absent for same-repository closure audit")

    try:
        marker = closure_marker(pr["number"], (pr.get("head") or {}).get("sha"), pr.get("closed_at"))
        if existing_comment(repository, pr["number"], token, marker, pr.get("closed_at")):
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
    except urllib.error.HTTPError as error:
        # Fork closures retain their workflow summary if GitHub refuses a write.
        # Same-repository permission failures must still fail visibly.
        if external_fork and error.code in (403, 404):
            print("External fork: audit comment denied; retained workflow summary.")
            return
        raise


def github_get(repository, token, path):
    """Read only GitHub API metadata, never untrusted pull-request code."""
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repository}/{path}",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "avkroken-pr-closure-audit",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def github_time(value):
    if not isinstance(value, str):
        raise RuntimeError("GitHub audit timestamp missing or invalid")
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=timezone.utc
        )
    except ValueError as error:
        raise RuntimeError("GitHub audit timestamp missing or invalid") from error


def closure_actor(repository, number, closed_at, token):
    """Attribute the exact closure to its GitHub issue-event actor."""
    matched = None
    for page in range(1, 101):
        events = github_get(
            repository, token, f"issues/{number}/events?per_page=100&page={page}"
        )
        if not isinstance(events, list):
            raise RuntimeError(f"Invalid provider events for PR #{number}")
        for item in events:
            if not isinstance(item, dict):
                raise RuntimeError(f"Invalid provider event for PR #{number}")
            if item.get("event") != "closed" or item.get("created_at") != closed_at:
                continue
            actor = (item.get("actor") or {}).get("login")
            if normalized(actor, r"[A-Za-z0-9-]{1,100}(?:\[bot\])?") == "unknown":
                raise RuntimeError(f"Missing verified closure actor for PR #{number}")
            if matched is not None and matched != actor:
                raise RuntimeError(f"Ambiguous provider closure actor for PR #{number}")
            matched = actor
        if len(events) < 100:
            if matched is None:
                raise RuntimeError(f"No matching provider closure event for PR #{number}")
            return matched
    raise RuntimeError(f"Provider event pagination bound reached for PR #{number}")


def reconcile_recent_closures(repository, token, run_id, now=None):
    """Backstop SHA-like branches whose pull_request_target close event is suppressed."""
    if not token:
        raise RuntimeError("GITHUB_TOKEN required for scheduled closure audit")
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=48)
    for page in range(1, 101):
        pulls = github_get(
            repository, token,
            f"pulls?state=closed&sort=updated&direction=desc&per_page=100&page={page}",
        )
        if not isinstance(pulls, list):
            raise RuntimeError("Closed PR inventory response was not a list")
        for pr in pulls:
            if not isinstance(pr, dict):
                raise RuntimeError("Closed PR inventory contained invalid item")
            # GitHub returns this list in descending order of updated_at.
            if github_time(pr.get("updated_at")) < cutoff:
                return
            closed_at = pr.get("closed_at")
            if pr.get("merged_at") is not None or closed_at is None:
                continue
            if github_time(closed_at) < cutoff:
                continue
            number = pr.get("number")
            if not isinstance(number, int) or isinstance(number, bool) or number <= 0:
                raise RuntimeError("Invalid closed pull request number")
            marker = closure_marker(
                number, (pr.get("head") or {}).get("sha"), closed_at
            )
            if existing_comment(repository, number, token, marker, closed_at):
                continue
            actor = closure_actor(repository, number, closed_at, token)
            audit_closure(
                {"action": "closed", "sender": {"login": actor},
                 "pull_request": {**pr, "merged": False}},
                repository, run_id,
            )
        if len(pulls) < 100:
            return
    raise RuntimeError("Closed PR inventory pagination bound reached")


def main():
    repository = os.environ["GITHUB_REPOSITORY"]
    run_id = os.environ["GITHUB_RUN_ID"]
    if os.environ.get("GITHUB_EVENT_NAME") == "schedule":
        reconcile_recent_closures(
            repository, os.environ.get("GITHUB_TOKEN", ""), run_id
        )
        return
    with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as handle:
        event = json.load(handle)
    audit_closure(event, repository, run_id)

if __name__ == "__main__":
    main()
