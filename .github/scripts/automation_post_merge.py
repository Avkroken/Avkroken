#!/usr/bin/env python3
"""Reconcile missed GitHub-token merges to repo-local CI and release triggers.

GitHub does not produce push workflows for commits created with GITHUB_TOKEN.
The current default-branch tip is sufficient: CI must validate that exact SHA
and semantic release covers all unreleased commits reachable from that tip.
"""
import datetime as dt
import json
import os
import urllib.request


def github_api(method, path, payload=None):
    repository = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GITHUB_TOKEN"]
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"https://api.github.com/repos/{repository}/{path}",
        data=body,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "avkroken-automation-post-merge",
            **({"Content-Type": "application/json"} if body is not None else {}),
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read()
    return json.loads(data) if data else {}


def is_trusted_merge(pr, repository, default_branch, head_sha):
    if pr.get("merged_at") is None or pr.get("merge_commit_sha") != head_sha:
        return False
    base = pr.get("base") or {}
    head = pr.get("head") or {}
    user = pr.get("user") or {}
    if base.get("ref") != default_branch:
        return False
    if (head.get("repo") or {}).get("full_name") != repository:
        return False
    login = user.get("login")
    role = user.get("type")
    if login in {"dependabot[bot]", "copilot-swe-agent[bot]"}:
        return role == "Bot"
    # A user OAuth connection may act as Avkroken on a codex/* branch; a
    # branch name is not an authenticated agent principal. Do not elevate it.
    # OAuth-authored merges trigger native push workflows without this dispatch.
    return (
        login == "gamnacken[bot]"
        and role == "Bot"
        and str(head.get("ref") or "").startswith("codex/")
    )


def has_target_run(payload, head_sha):
    return any(
        run.get("head_sha") == head_sha
        and run.get("event") in {"push", "repository_dispatch", "workflow_dispatch"}
        and run.get("conclusion") not in {"cancelled", "startup_failure", "skipped"}
        for run in payload.get("workflow_runs", [])
    )


def reconcile(api, repository, now):
    config = api("GET", "")
    branch = config["default_branch"]
    head_sha = api("GET", f"branches/{branch}")["commit"]["sha"]
    associated = api("GET", f"commits/{head_sha}/pulls?per_page=100")

    matches = [
        pr for pr in associated
        if is_trusted_merge(pr, repository, branch, head_sha)
    ]
    if not matches:
        print("Default-branch tip is not a trusted automation merge; no dispatch.")
        return False

    pr = max(matches, key=lambda item: item["merged_at"])
    merged_at = dt.datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
    if (now - merged_at).total_seconds() < 90:
        print("Merge is recent; waiting for native workflow registration.")
        return False

    ci = api("GET", f"actions/workflows/ci.yml/runs?head_sha={head_sha}&per_page=100")
    release = api("GET", f"actions/workflows/release.yml/runs?head_sha={head_sha}&per_page=100")
    codeql = api("GET", f"actions/workflows/codeql.yml/runs?head_sha={head_sha}&per_page=100")
    if (has_target_run(ci, head_sha) and has_target_run(release, head_sha)
            and has_target_run(codeql, head_sha)):
        print(f"CI, CodeQL, and release runs already registered for {head_sha}.")
        return False

    api("POST", "dispatches", {
        "event_type": "agent-pr-merged",
        "client_payload": {
            "pr_number": pr["number"],
            "merge_sha": head_sha,
            "head_sha": (pr.get("head") or {}).get("sha"),
            "merged_at": pr["merged_at"],
        },
    })
    print(f"Reconciled missing CI/CodeQL/release registration for {head_sha}.")
    return True


if __name__ == "__main__":
    reconcile(
        github_api,
        os.environ["GITHUB_REPOSITORY"],
        dt.datetime.now(dt.timezone.utc),
    )
