#!/usr/bin/env python3
"""Regression tests for same-SHA post-merge automation reconciliation."""
import datetime as dt
import os
import unittest
from unittest.mock import patch

os.environ.setdefault('GITHUB_RUN_ID', '12345')
os.environ.setdefault('GITHUB_RUN_ATTEMPT', '1')

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
    def __init__(self, pr=None, ci=None, release=None, codeql=None, recovery_runs=None, commit_comments=None, tip_after_first_read=None):
        self.pr = merged_pr('Avkroken', 'User') if pr is None else pr
        self.ci = [] if ci is None else ci
        self.release = [] if release is None else release
        self.codeql = [] if codeql is None else codeql
        self.recovery_runs = [] if recovery_runs is None else recovery_runs
        self.commit_comments = [] if commit_comments is None else commit_comments
        self.posts = []
        self.tip_after_first_read = tip_after_first_read
        self.branch_reads = 0

    def __call__(self, method, path, payload=None):
        if method == "POST" and path == "dispatches":
            self.posts.append(("dispatch", payload))
            return {}
        if method == "POST" and path == f"commits/{SHA}/comments":
            self.posts.append(("reservation", payload))
            return {"id": 123}
        if method != "GET":
            raise AssertionError((method, path))
        if path == "":
            return {"default_branch": "main"}
        if path == "branches/main":
            self.branch_reads += 1
            if self.branch_reads > 1 and self.tip_after_first_read:
                return {"commit": {"sha": self.tip_after_first_read}}
            return {"commit": {"sha": SHA}}
        if path == f"commits/{SHA}/pulls?per_page=100":
            return [self.pr]
        if path == f"actions/workflows/ci.yml/runs?head_sha={SHA}&per_page=100":
            return {"workflow_runs": self.ci}
        if path == f"actions/workflows/release.yml/runs?head_sha={SHA}&per_page=100":
            return {"workflow_runs": self.release}
        if path == f"actions/workflows/codeql.yml/runs?head_sha={SHA}&per_page=100":
            return {"workflow_runs": self.codeql}
        if path.startswith(f"commits/{SHA}/comments?per_page=100&page="):
            page = int(path.split("page=")[-1])
            return self.commit_comments[(page-1)*100:page*100]
        if path == f"actions/workflows/automation-post-merge.yml/runs?head_sha={SHA}&per_page=100":
            return {"workflow_runs": self.recovery_runs}
        raise AssertionError(path)


def matching_run(event="push", sha=SHA, status="completed", conclusion="success"):
    return {
        "head_sha": sha,
        "event": event,
        "status": status,
        "conclusion": conclusion,
    }


class AutomationPostMergeTests(unittest.TestCase):
    def test_only_trusted_same_repository_default_branch_merge(self):
        self.assertTrue(is_trusted_merge(merged_pr(), REPO, "main", SHA))
        # A provider-confirmed merge can be checked without inventing bot
        # attribution from branch names or OAuth user accounts.
        self.assertTrue(is_trusted_merge(
            merged_pr("Avkroken", "User", "codex/trusted/2026-10-08"), REPO, "main", SHA
        ))
        self.assertTrue(is_trusted_merge(
            merged_pr("copilot-swe-agent[bot]", "User"), REPO, "main", SHA
        ))
        self.assertTrue(is_trusted_merge(merged_pr(
            "dependabot[bot]", "Bot", "dependabot/npm_and_yarn/example"
        ), REPO, "main", SHA))
        self.assertTrue(is_trusted_merge(
            merged_pr("other-collaborator", "User"), REPO, "main", SHA
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

    def test_cancelled_startup_failure_and_skipped_runs_do_not_count_as_registered(self):
        for conclusion in ("cancelled", "startup_failure", "skipped"):
            self.assertFalse(has_target_run(
                {"workflow_runs": [matching_run(conclusion=conclusion)]},
                SHA,
            ))
        self.assertTrue(has_target_run(
            {"workflow_runs": [matching_run(status="queued", conclusion=None)]},
            SHA,
        ))
        self.assertTrue(has_target_run(
            {"workflow_runs": [matching_run(status="in_progress", conclusion=None)]},
            SHA,
        ))

    def test_failed_native_run_does_not_satisfy_registration(self):
        self.assertFalse(has_target_run(
            {"workflow_runs": [matching_run(conclusion="failure")]}, SHA
        ))
        self.assertFalse(has_target_run(
            {"workflow_runs": [matching_run(conclusion="timed_out")]}, SHA
        ))
        fake = FakeApi(ci=[matching_run()], release=[matching_run()],
                       codeql=[matching_run(conclusion="failure")])
        self.assertTrue(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts[-1][0], "dispatch")

    def test_dependabot_requires_trusted_dispatch_even_with_successful_push(self):
        fake = FakeApi(
            pr=merged_pr("dependabot[bot]", "Bot"),
            ci=[matching_run()], release=[matching_run()], codeql=[matching_run()],
        )
        self.assertTrue(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts[-1][0], "dispatch")

    def test_dependabot_trusted_dispatch_registration_is_idempotent(self):
        trusted = matching_run(event="repository_dispatch")
        fake = FakeApi(
            pr=merged_pr("dependabot[bot]", "Bot"),
            ci=[trusted], release=[trusted], codeql=[trusted],
        )
        self.assertFalse(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts, [])

    def test_no_duplicate_when_both_required_workflows_registered(self):
        fake = FakeApi(ci=[matching_run()], release=[matching_run()], codeql=[matching_run()])
        self.assertFalse(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts, [])

    def test_dispatch_if_ci_missing(self):
        fake = FakeApi(release=[matching_run()])
        self.assertTrue(reconcile(fake, REPO, TIME))
        self.assertEqual(len(fake.posts), 2)
        self.assertEqual(fake.posts[-1][1]["event_type"], "agent-pr-merged")
        self.assertEqual(fake.posts[-1][1]["client_payload"]["merge_sha"], SHA)

    def test_dispatch_if_release_missing(self):
        fake = FakeApi(ci=[matching_run()])
        self.assertTrue(reconcile(fake, REPO, TIME))
        self.assertEqual(len(fake.posts), 2)

    def test_dispatch_if_codeql_missing(self):
        fake = FakeApi(ci=[matching_run()], release=[matching_run()])
        self.assertTrue(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts[-1][1]["event_type"], "agent-pr-merged")


    def attempt_comment(self, run_id, timestamp):
        return {
            "user": {"login": "github-actions[bot]"},
            "body": f"<!-- avkroken-dispatch-attempt:{SHA}:{run_id} -->",
            "created_at": timestamp,
        }

    @patch.dict(os.environ, {"GITHUB_RUN_ID": "12345", "GITHUB_RUN_ATTEMPT": "2"})
    def test_rerun_recovers_after_reserved_dispatch_fails(self):
        fake = FakeApi()
        def failing_dispatch(method, path, payload=None):
            if method == "POST" and path == "dispatches":
                raise RuntimeError("dispatch unavailable")
            return fake(method, path, payload)

        with patch.dict(os.environ, {"GITHUB_RUN_ATTEMPT": "1"}):
            with self.assertRaisesRegex(RuntimeError, "dispatch unavailable"):
                reconcile(failing_dispatch, REPO, TIME)
        fake.commit_comments.append({
            "user": {"login": "github-actions[bot]"},
            "body": fake.posts[0][1]["body"],
            "created_at": TIME.isoformat(),
        })
        fake.posts.clear()
        self.assertFalse(reconcile(fake, REPO, TIME + dt.timedelta(minutes=29)))
        self.assertEqual(fake.posts, [])
        self.assertTrue(reconcile(fake, REPO, TIME + dt.timedelta(minutes=30)))
        self.assertIn(f"{SHA}:12345:2 -->", fake.posts[0][1]["body"])
        self.assertEqual(fake.posts[-1][0], "dispatch")

    @patch.dict(os.environ, {"GITHUB_RUN_ID": "12345", "GITHUB_RUN_ATTEMPT": "2"})
    def test_same_attempt_does_not_dispatch_twice(self):
        fake = FakeApi(commit_comments=[
            self.attempt_comment("12345:2", "2026-10-08T10:00:00Z")
        ])
        self.assertFalse(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts, [])

    @patch.dict(os.environ, {"GITHUB_RUN_ID": "12345", "GITHUB_RUN_ATTEMPT": "1"})
    def test_legacy_marker_is_first_attempt_and_counts_toward_budget(self):
        fake = FakeApi(commit_comments=[
            self.attempt_comment("12345", "2026-10-08T10:00:00Z"),
        ])
        self.assertFalse(reconcile(fake, REPO, TIME))
        with patch.dict(os.environ, {"GITHUB_RUN_ATTEMPT": "2"}):
            self.assertTrue(reconcile(fake, REPO, TIME))
        fake.commit_comments.extend([
            self.attempt_comment("12345:1", "2026-10-08T10:00:00Z"),
            self.attempt_comment("12345:2", "2026-10-08T10:30:00Z"),
            self.attempt_comment("12345:3", "2026-10-08T11:30:00Z"),
        ])
        fake.posts.clear()
        with patch.dict(os.environ, {"GITHUB_RUN_ATTEMPT": "4"}):
            with self.assertRaisesRegex(RuntimeError, "retry limit"):
                reconcile(fake, REPO, TIME)
        self.assertEqual(fake.posts, [])

    def test_invalid_run_attempt_fails_before_reservation(self):
        for attempt in ("", "0", "-1", "invalid"):
            with self.subTest(attempt=attempt), patch.dict(os.environ, {"GITHUB_RUN_ATTEMPT": attempt}):
                fake = FakeApi()
                with self.assertRaisesRegex(RuntimeError, "GITHUB_RUN_ATTEMPT"):
                    reconcile(fake, REPO, TIME)
                self.assertEqual(fake.posts, [])

    def test_dispatch_stops_after_three_actual_attempts_for_sha(self):
        comments = [
            self.attempt_comment(i, f"2026-10-08T{hour:02d}:30:00Z")
            for i, hour in enumerate((10, 11, 11), 1)
        ]
        fake = FakeApi(ci=[matching_run()], release=[matching_run()],
                       commit_comments=comments)
        with self.assertRaisesRegex(RuntimeError, "missing CodeQL.*retry limit"):
            reconcile(fake, REPO, TIME)
        self.assertEqual(fake.posts, [])

    def test_backoff_only_runs_do_not_spend_attempts(self):
        # Existing scheduled runs without reservation comments are not dispatches.
        recorded = [
            {"id": i, "head_sha": SHA, "event": "schedule",
             "status": "completed", "created_at": "2026-10-08T11:20:00Z"}
            for i in range(1, 15)
        ]
        fake = FakeApi(ci=[matching_run()], release=[matching_run()],
                       recovery_runs=recorded,
                       commit_comments=[self.attempt_comment(8, "2026-10-08T11:50:00Z")])
        self.assertFalse(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts, [])

    def test_unrelated_or_forged_comments_do_not_consume_retry_budget(self):
        fake = FakeApi(ci=[matching_run()], release=[matching_run()],
            commit_comments=[
                {"user": {"login": "untrusted-user"},
                 "body": f"<!-- avkroken-dispatch-attempt:{SHA}:7 -->",
                 "created_at": "2026-10-08T11:00:00Z"},
                self.attempt_comment("forged", "2026-10-08T11:00:00Z"),
            ])
        self.assertTrue(reconcile(fake, REPO, TIME))
        self.assertEqual(len(fake.posts), 2)
        self.assertEqual(fake.posts[0][0], "reservation")
        self.assertEqual(fake.posts[1][0], "dispatch")

    def test_new_default_branch_tip_aborts_dispatch_without_reservation(self):
        fake = FakeApi(ci=[matching_run()], release=[matching_run()],
                       tip_after_first_read="b" * 40)
        self.assertFalse(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts, [])

    def test_untrusted_tip_not_dispatched(self):
        forged = merged_pr("external", "User")
        forged["head"]["repo"]["full_name"] = "other/repository"
        fake = FakeApi(pr=forged)
        self.assertFalse(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts, [])

    def test_fresh_merge_waits_for_native_registration(self):
        fake = FakeApi(pr={**merged_pr(), "merged_at": "2026-10-08T11:59:30Z"})
        self.assertFalse(reconcile(fake, REPO, TIME))
        self.assertEqual(fake.posts, [])


if __name__ == "__main__":
    unittest.main()
