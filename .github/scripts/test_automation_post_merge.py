#!/usr/bin/env python3
"""Regression tests for same-SHA post-merge automation reconciliation."""
import datetime as dt
import unittest

from automation_post_merge import has_target_run, is_trusted_merge, reconcile


REPO = "Avkroken/Avkroken"
SHA = "a" * 40
TIME = dt.datetime(2026, 10, 8, 12, 0, tzinfo=dt.timezone.utc)


def merged_pr(login="copilot-swe-agent[bot]", role="Bot", ref="copilot/trusted/2026-10-08"):
    return {
        "number": 123,
        "merged_at": "2026-10-08T10:00:00Z",
        "merge_commit_sha": SHA,
        "base": {"ref": "main"},
        "head": {"ref": ref, "sha": "b" * 40, "repo": {"full_name": REPO}},
        "user": {"login": login, "type": role},
    }


class FakeApi:
    def __init__(self, pr=None, ci=None, release=None):
        self.pr = merged_pr() if pr is None else pr
        self.ci = [] if ci is None else ci
        self.release = [] if release is None else release
        self.posts = []

    def __call__(self, method, path, payload=None):
        if method == "POST" and path == "dispatches":
            self.posts.append(payload)
            return {}
        if method != "GET":
            raise AssertionError((method, path))
        if path == "":
            return {"default_branch": "main"}
        if path == "branches/main":
            return {"commit": {"sha": SHA}}
        if path == f"commits/{SHA}/pulls?per_page=100":
            return [self.pr]
        if path == f"actions/workflows/ci.yml/runs?head_sha={SHA}&per_page=100":
            return {"workflow_runs": self.ci}
        if path == f"actions/workflows/release.yml/runs?head_sha={SHA}&per_page=100":
            return {"workflow_runs": self.release}
        raise AssertionError(path)


def matching_run(event="push", sha=SHA):
    return {"head_sha": sha, "event": event, "status": "completed"}


class AutomationPostMergeTests(unittest.TestCase):
    def test_only_trusted_same_repository_default_branch_merge(self):
        self.assertTrue(is_trusted_merge(merged_pr(), REPO, "main", SHA))
        # OAuth-authored commits cannot be attested as bot mutations by branch name.
        self.assertFalse(is_trusted_merge(
            merged_pr("Avkroken", "User", "codex/trusted/2026-10-08"), REPO, "main", SHA
        ))
        self.assertFalse(is_trusted_merge(
            merged_pr("copilot-swe-agent[bot]", "User"), REPO, "main", SHA
        ))
        self.assertTrue(is_trusted_merge(merged_pr(
            "dependabot[bot]", "Bot", "dependabot/npm_and_yarn/example"
        ), REPO, "main", SHA))
        self.assertFalse(is_trusted_merge(
            merged_pr("intruder", "User"), REPO, "main", SHA
        ))
        self.assertFalse(is_trusted_merge(
            {**merged_pr(), "merge_commit_sha": "not-main"}, REPO, "main", SHA
        ))
        self.assertFalse(is_trusted_merge(
            {**merged_pr(), "head": {"ref": "copilot/a", "repo": {"full_name": "foreign/repo"}}},
            REPO, "main", SHA
        ))

    def test_run_registration_must_match_head_sha(self):
        self.assertFalse(has_target_run({"workflow_runs": [matching_run(sha="older")]}, SHA))
        self.assertFalse(has_target_run({"workflow_runs": [matching_run(event="pull_request")]}, SHA))
        self.assertTrue(has_target_run({"workflow_runs": [matching_run(event="repository_dispatch")]}, SHA))

    def test_no_duplicate_when_both_required_workflows_registered(self):
        fake = FakeApi(ci=[matching_run()], release=[matching_run()])
        self.assertFalse(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts, [])

    def test_dispatch_if_ci_missing(self):
        fake = FakeApi(release=[matching_run()])
        self.assertTrue(reconcile(fake, REPO, TIME))
        self.assertEqual(len(fake.posts), 1)
        self.assertEqual(fake.posts[0]["event_type"], "agent-pr-merged")
        self.assertEqual(fake.posts[0]["client_payload"]["merge_sha"], SHA)

    def test_dispatch_if_release_missing(self):
        fake = FakeApi(ci=[matching_run()])
        self.assertTrue(reconcile(fake, REPO, TIME))
        self.assertEqual(len(fake.posts), 1)

    def test_untrusted_tip_not_dispatched(self):
        fake = FakeApi(pr=merged_pr("external", "User"))
        self.assertFalse(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts, [])

    def test_fresh_merge_waits_for_native_registration(self):
        fake = FakeApi(pr={**merged_pr(), "merged_at": "2026-10-08T11:59:30Z"})
        self.assertFalse(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts, [])


if __name__ == "__main__":
    unittest.main()
