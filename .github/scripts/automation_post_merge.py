#!/usr/bin/env python3
"""Reconcile missed GitHub-token merges to repo-local CI and release triggers.

GitHub does not produce push workflows for commits created with GITHUB_TOKEN.
The current default-branch tip is sufficient: CI must validate that exact SHA
and semantic release covers all unreleased commits reachable from that tip.
"""
import datetime as dt
import json
import os
import re
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
    if base.get("ref") != default_branch:
        return False
    if (head.get("repo") or {}).get("full_name") != repository:
        return False
    # We only act on a merge GitHub has already completed at the current main
    # tip. Do not infer an agent identity from login, branch, or commit metadata.
    # Re-running canonical checks on already-merged code is safe regardless
    # of whether the merge was initiated by a GitHub App or a human collaborator.
    return True


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
        print("Default-branch tip is not a verified same-repository merge; no dispatch.")
        return False

    pr = max(matches, key=lambda item: item["merged_at"])
    merged_at = dt.datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
    if (now - merged_at).total_seconds() < 90:
        print("Merge is recent; waiting for native workflow registration.")
        return False

    ci = api("GET", f"actions/workflows/ci.yml/runs?head_sha={head_sha}&per_page=100")
    release = api("GET", f"actions/workflows/release.yml/runs?head_sha={head_sha}&per_page=100")
    codeql = api("GET", f"actions/workflows/codeql.yml/runs?head_sha={head_sha}&per_page=100")
    missing = [
        name for name, payload in (("CI", ci), ("Release", release), ("CodeQL", codeql))
        if not has_target_run(payload, head_sha)
    ]
    if not missing:
        print(f"CI, CodeQL, and release runs already registered for {head_sha}.")
        return False

    # Reserve a durable attempt before dispatch. Workflow-run history cannot
    # distinguish a genuine dispatch from a no-op/backoff-only reconciliation.
    # A commit comment is append-only evidence visible to maintainers; no
    # token, new branch, external database or mutable cache is required.
    # Re-running the same GITHUB_RUN_ID must not dispatch twice.
    run_id = os.environ.get("GITHUB_RUN_ID", "")
    if not re.fullmatch(r"[1-9][0-9]*", run_id):
        raise RuntimeError("Missing valid GITHUB_RUN_ID for dispatch reservation")
    marker_prefix = f"<!-- avkroken-dispatch-attempt:{head_sha}:"
    attempts_by_run = {}
    for page in range(1, 11):
        batch = api(
            "GET",
            f"commits/{head_sha}/comments?per_page=100&page={page}",
        )
        if not isinstance(batch, list):
            raise RuntimeError("Commit comment history is invalid")
        for comment in batch:
            if not isinstance(comment, dict):
                raise RuntimeError("Commit comment shape is invalid")
            if (comment.get("user") or {}).get("login") != "github-actions[bot]":
                continue
            body = comment.get("body")
            if not isinstance(body, str):
                continue
            marker = re.fullmatch(
                re.escape(marker_prefix) + r"([1-9][0-9]*) -->",
                body.splitlines()[0] if body else "",
            )
            if not marker:
                continue
            raw_time = comment.get("created_at")
            if not isinstance(raw_time, str):
                raise RuntimeError("Dispatch reservation timestamp unavailable")
            try:
                reserved_at = dt.datetime.fromisoformat(
                    raw_time.replace("Z", "+00:00")
                )
            except ValueError as exc:
                raise RuntimeError("Invalid dispatch reservation timestamp") from exc
            if reserved_at.tzinfo is None:
                raise RuntimeError("Timezone missing from dispatch reservation")
            if reserved_at >= merged_at:
                key = marker.group(1)
                previous = attempts_by_run.get(key)
                attempts_by_run[key] = max(previous, reserved_at) if previous else reserved_at
        if len(batch) < 100:
            break
    else:
        raise RuntimeError("Commit comment pagination bound reached")

    if run_id in attempts_by_run:
        print(f"Dispatch already reserved by this run {run_id}; avoiding duplicate.")
        return False
    attempts = len(attempts_by_run)
    if attempts >= 3:
        raise RuntimeError(
            f"Persistently missing {', '.join(missing)} for {head_sha}; "
            "post-merge dispatch retry limit reached (3)."
        )
    last = max(attempts_by_run.values(), default=None)
    delay = dt.timedelta(minutes=30 * (2 ** max(0, attempts - 1)))
    if last is not None and now - last < delay:
        print(
            f"Waiting for missing {', '.join(missing)} on {head_sha}; "
            f"retry backoff active after {attempts} actual dispatch reservations."
        )
        return False

    reservation = api(
        "POST",
        f"commits/{head_sha}/comments",
        {"body": (
            f"{marker_prefix}{run_id} -->\\n"
            "Automation post-merge: durable dispatch attempt reservation. "
            "The canonical CI, CodeQL and Release runs remain authoritative."
        )},
    )
    if not isinstance(reservation, dict) or not isinstance(reservation.get("id"), int):
        raise RuntimeError("Dispatch reservation could not be verified")
    print(
        f"Post-merge dispatch for {head_sha}: missing {', '.join(missing)}, "
        f"attempt {attempts + 1}/3."
    )
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
