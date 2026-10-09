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

    # The workflow-run history is GitHub's durable per-SHA retry ledger.
    # Do not create Git commits, mutable cache keys, tokens or credentials
    # simply to remember failed dispatches. Since a successful dispatch may
    # produce runs for only some of the three targets, use the greatest
    # count of repository_dispatch runs among them as the precise count.
    # If none was registered, fall back conservatively to completed
    # reconciliation executions after the initial native registration window.
    history = api("GET", (
        f"actions/workflows/automation-post-merge.yml/runs"
        f"?head_sha={head_sha}&per_page=100"
    ))
    past = history.get("workflow_runs")
    if not isinstance(past, list) or len(past) >= 100:
        raise RuntimeError("Could not establish bounded post-merge retry history")

    cutoff = merged_at + dt.timedelta(seconds=90)
    current_run_id = str(os.environ.get("GITHUB_RUN_ID") or "")

    def timestamp(run):
        raw = run.get("created_at")
        if not isinstance(raw, str):
            return None
        try:
            parsed = dt.datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo is not None else None
        except ValueError:
            return None

    previous = [
        run for run in past
        if run.get("head_sha") == head_sha
        and run.get("event") in {"schedule", "workflow_dispatch", "workflow_run"}
        and run.get("status") == "completed"
        and (not current_run_id or str(run.get("id")) != current_run_id)
        and (timestamp(run) is not None and timestamp(run) >= cutoff)
    ]
    observed = []
    for payload in (ci, release, codeql):
        registrations = [
            run for run in payload.get("workflow_runs", [])
            if run.get("head_sha") == head_sha
            and run.get("event") == "repository_dispatch"
        ]
        observed.append(registrations)
    actual_attempts = max((len(runs) for runs in observed), default=0)
    if actual_attempts:
        attempts = actual_attempts
        dispatch_times = [
            timestamp(run) for group in observed for run in group
            if timestamp(run) is not None
        ]
        last = max(dispatch_times, default=None)
    else:
        attempts = len(previous)
        last = max((timestamp(run) for run in previous), default=None)

    if attempts >= 3:
        missing_label = ", ".join(missing)
        raise RuntimeError(
            f"Persistently missing {missing_label} for {head_sha}; "
            "post-merge dispatch retry limit reached (3)."
        )
    # Avoid a retry storm if a provider accepts the event but is slow to
    # register a target workflow. Backoff grows per observed dispatch.
    delay = dt.timedelta(minutes=30 * (2 ** max(0, attempts - 1)))
    if attempts and last is not None and now - last < delay:
        print(
            f"Waiting for missing {', '.join(missing)} on {head_sha}; "
            f"retry backoff active after {attempts} prior executions."
        )
        return False

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
