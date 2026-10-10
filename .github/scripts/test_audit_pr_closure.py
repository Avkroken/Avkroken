#!/usr/bin/env python3
"""Regression tests for unmerged PR closure attribution."""
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit
from urllib.error import HTTPError

from audit_pr_closure import closure_comment, closure_marker, existing_comment, has_existing_audit_comment, main, reconcile_recent_closures

REPO = "Avkroken/Avkroken"
SHA = "a" * 40


def event(action="closed", merged=False, actor="Avkroken", number=214):
    return {
        "action": action,
        "sender": {"login": actor},
        "pull_request": {
            "number": number,
            "merged": merged,
            "closed_at": "2026-10-08T10:20:23Z",
            "head": {"sha": SHA, "repo": {"full_name": REPO}},
            "title": "do-not-render-title",
            "body": "do-not-render-body",
        },
    }


class ClosureAuditTests(unittest.TestCase):
    def test_unmerged_closure_records_provider_actor_time_sha_and_run(self):
        comment = closure_comment(event(), REPO, "12345")
        self.assertIn("GitHub actor: `Avkroken`", comment)
        self.assertIn("2026-10-08T10:20:23Z", comment)
        self.assertIn(SHA, comment)
        self.assertIn("https://github.com/Avkroken/Avkroken/actions/runs/12345", comment)
        self.assertIn("not verified agent/session identity", comment)
        self.assertIn("**not a merge**", comment)
        self.assertNotIn("do-not-render-title", comment)
        self.assertNotIn("do-not-render-body", comment)

    def test_merged_or_unrelated_events_are_not_audited(self):
        self.assertIsNone(closure_comment(event(merged=True), REPO, "12"))
        self.assertIsNone(closure_comment(event(action="reopened"), REPO, "12"))
        self.assertIsNone(closure_comment(event(action="synchronize"), REPO, "12"))

    def test_bot_actor_login_is_preserved(self):
        comment = closure_comment(event(actor="dependabot[bot]"), REPO, "3")
        self.assertIn("GitHub actor: `dependabot[bot]`", comment)

    def test_closure_comment_has_stable_marker_and_deduplicates(self):
        marker = closure_marker(214, SHA, "2026-10-08T10:20:23Z")
        comment = closure_comment(event(), REPO, "12345")
        self.assertIn(marker, comment)
        trusted = {"user": {"login": "github-actions[bot]", "type": "Bot"}, "body": comment}
        self.assertTrue(has_existing_audit_comment(
            [{"body": "older"}, trusted], marker,
        ))
        self.assertFalse(has_existing_audit_comment(
            [{"user": {"login": "attacker"}, "body": comment}], marker,
        ))
        self.assertFalse(has_existing_audit_comment(
            [{"user": {"login": "github-actions[bot]", "type": "Bot"},
              "body": "Quoted marker: " + comment}], marker,
        ))
        self.assertFalse(has_existing_audit_comment([{"body": "older"}], marker))
        self.assertFalse(has_existing_audit_comment(
            [{"user": {"login": "github-actions[bot]", "type": "User"},
              "body": comment}], marker,
        ), "matching username without GitHub Bot type is not trusted")

    def test_repeated_closure_same_head_has_separate_audit_marker(self):
        first = event()
        second = event()
        second["pull_request"]["closed_at"] = "2026-10-09T11:20:23Z"
        first_comment = closure_comment(first, REPO, "123")
        second_comment = closure_comment(second, REPO, "124")
        self.assertNotEqual(first_comment.splitlines()[0], second_comment.splitlines()[0])
        marker = closure_marker(214, SHA, second["pull_request"]["closed_at"])
        self.assertFalse(has_existing_audit_comment(
            [{"user": {"login": "github-actions[bot]", "type": "Bot"}, "body": first_comment}],
            marker,
        ))

    def test_identical_closure_events_from_different_runs_are_idempotent(self):
        first = closure_comment(event(), REPO, "12345")
        second = closure_comment(event(), REPO, "12346")
        rerun = closure_comment(event(), REPO, "12345")
        self.assertEqual(first.splitlines()[0], second.splitlines()[0])
        self.assertEqual(first.splitlines()[0], rerun.splitlines()[0])
        self.assertTrue(has_existing_audit_comment([
            {"user": {"login": "github-actions[bot]", "type": "Bot"}, "body": first}
        ], second.splitlines()[0]))


    def test_closure_lookup_paginates_past_ten_pages_with_since(self):
        marker = closure_marker(214, SHA, "2026-10-08T10:20:23Z")
        audit_body = marker + "\n### GitHub closure audit (unmerged PR)\n\nAudit"
        pages = []

        def urlopen(request, timeout=20):
            query = parse_qs(urlsplit(request.full_url).query)
            self.assertEqual(query["since"], ["2026-10-08T10:20:21Z"])
            page = int(query["page"][0])
            pages.append(page)
            comments = ([{"body": "ordinary comment"}] * 100
                        if page <= 11 else
                        [{"body": audit_body, "user": {
                            "login": "github-actions[bot]", "type": "Bot"}}])
            return io.BytesIO(json.dumps(comments).encode("utf-8"))

        with patch("audit_pr_closure.urllib.request.urlopen", side_effect=urlopen):
            self.assertTrue(existing_comment(REPO, 214, "test-only", marker,
                                             "2026-10-08T10:20:23Z"))
        self.assertEqual(pages, list(range(1, 13)))

    def test_closure_lookup_skips_prior_history(self):
        marker = closure_marker(214, SHA, "2026-10-08T10:20:23Z")
        calls = []

        def urlopen(request, timeout=20):
            query = parse_qs(urlsplit(request.full_url).query)
            self.assertEqual(query["since"], ["2026-10-08T10:20:21Z"])
            calls.append(query)
            return io.BytesIO(b"[]")

        with patch("audit_pr_closure.urllib.request.urlopen", side_effect=urlopen):
            self.assertFalse(existing_comment(REPO, 214, "test-only", marker,
                                              "2026-10-08T10:20:23Z"))
        self.assertEqual(len(calls), 1)


    def test_scheduled_recovery_audits_sha_named_branch_once_using_provider_actor(self):
        from datetime import datetime, timezone
        pr = event(actor="ignored-scheduler")["pull_request"]
        pr["head"]["ref"] = "e" * 40  # GitHub can suppress this event.
        pr.update({"updated_at": "2026-10-08T10:20:24Z",
                   "merged_at": None, "state": "closed"})
        merged = {**pr, "number": 215, "merged_at": "2026-10-08T10:21:00Z"}
        closure_event = {
            "event": "closed", "created_at": pr["closed_at"],
            "actor": {"login": "actual-closer"},
        }
        calls = []
        posted = []
        now = datetime(2026, 10, 8, 11, tzinfo=timezone.utc)

        with tempfile.TemporaryDirectory() as directory:
            summary = Path(directory) / "summary.md"

            def urlopen(request, timeout=20):
                parsed = urlsplit(request.full_url)
                calls.append((request.get_method(), parsed.path))
                if request.get_method() == "POST":
                    posted.append(json.loads(request.data)["body"])
                    response = io.BytesIO(b"{}")
                    response.status = 201
                    return response
                if parsed.path.endswith("/pulls"):
                    result = [pr, merged]
                elif parsed.path.endswith("/issues/214/comments"):
                    result = ([{"user": {"login": "github-actions[bot]", "type": "Bot"},
                                "body": posted[0]}] if posted else [])
                elif parsed.path.endswith("/issues/214/events"):
                    result = [closure_event]
                else:
                    raise AssertionError(parsed.path)
                return io.BytesIO(json.dumps(result).encode("utf-8"))

            with patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": str(summary),
                                       "GITHUB_TOKEN": "test-only"}), \\
                    patch("audit_pr_closure.urllib.request.urlopen", side_effect=urlopen):
                reconcile_recent_closures(REPO, "test-only", "456", now=now)
                reconcile_recent_closures(REPO, "test-only", "457", now=now)
            self.assertIn("GitHub closure audit", summary.read_text(encoding="utf-8"))
        self.assertEqual(len(posted), 1)
        self.assertIn("GitHub actor: `actual-closer`", posted[0])
        self.assertIn("actions/runs/456", posted[0])
        self.assertEqual(sum(path.endswith("/issues/214/events")
                             for _, path in calls), 1)
        self.assertFalse(any(path.endswith("/issues/215/events")
                             for _, path in calls))

    def test_scheduled_recovery_fails_without_matching_actor_evidence(self):
        from datetime import datetime, timezone
        pr = event()["pull_request"]
        pr.update({"updated_at": "2026-10-08T10:20:24Z", "merged_at": None})
        posts = []

        def urlopen(request, timeout=20):
            parsed = urlsplit(request.full_url)
            if request.get_method() == "POST":
                posts.append(request.full_url)
                raise AssertionError("Must not publish without provider actor")
            if parsed.path.endswith("/pulls"):
                result = [pr]
            elif parsed.path.endswith("/issues/214/comments"):
                result = []
            elif parsed.path.endswith("/issues/214/events"):
                result = [{"event": "closed",
                           "created_at": "2026-10-07T10:20:23Z",
                           "actor": {"login": "wrong-closer"}}]
            else:
                raise AssertionError(parsed.path)
            return io.BytesIO(json.dumps(result).encode("utf-8"))

        with patch("audit_pr_closure.urllib.request.urlopen", side_effect=urlopen):
            with self.assertRaisesRegex(RuntimeError, "No matching provider closure event"):
                reconcile_recent_closures(
                    REPO, "test-only", "456",
                    now=datetime(2026, 10, 8, 11, tzinfo=timezone.utc),
                )
        self.assertEqual(posts, [])

    def test_schedule_entrypoint_uses_backstop_not_webhook_payload(self):
        from unittest.mock import ANY
        with patch.dict(os.environ, {
            "GITHUB_EVENT_NAME": "schedule", "GITHUB_REPOSITORY": REPO,
            "GITHUB_RUN_ID": "987", "GITHUB_TOKEN": "test-only",
            "GITHUB_EVENT_PATH": "/does/not/exist",
        }), patch("audit_pr_closure.reconcile_recent_closures") as reconcile:
            main()
        reconcile.assert_called_once_with(REPO, "test-only", "987")

    def test_untrusted_identity_cannot_inject_markdown(self):
        bad = event(actor="evil`@everyone\n", number=215)
        comment = closure_comment(bad, REPO, "2")
        self.assertIn("GitHub actor: `unknown`", comment)
        self.assertNotIn("@everyone", comment)
        self.assertNotIn("evil", comment)

    def test_untrusted_url_and_invalid_identifier_rejected(self):
        self.assertIsNone(closure_comment(event(number=0), REPO, "2"))
        self.assertIsNone(closure_comment(event(), "evil/path/extra", "2"))
        comment = closure_comment(event(), REPO, "bad-run-id")
        self.assertIn("actions/runs/unknown", comment)

    def test_fork_closure_publishes_audit_or_retains_summary_on_denied_write(self):
        fork_event = event()
        fork_event["pull_request"]["head"]["repo"]["full_name"] = "contributor/fork"
        for denied in (False, True):
            with self.subTest(denied=denied), tempfile.TemporaryDirectory() as directory:
                path = Path(directory)
                event_file = path / "event.json"
                summary_file = path / "summary.md"
                event_file.write_text(json.dumps(fork_event), encoding="utf-8")
                calls = []

                def urlopen(request, timeout=20):
                    calls.append(request.get_method())
                    if request.get_method() == "GET":
                        return io.BytesIO(b"[]")
                    if denied:
                        raise HTTPError(request.full_url, 403, "Forbidden", {}, None)
                    response = io.BytesIO(b"{}")
                    response.status = 201
                    return response

                with patch.dict(os.environ, {
                    "GITHUB_EVENT_PATH": str(event_file),
                    "GITHUB_REPOSITORY": REPO,
                    "GITHUB_RUN_ID": "12345",
                    "GITHUB_STEP_SUMMARY": str(summary_file),
                    "GITHUB_TOKEN": "test-placeholder",
                }), patch("audit_pr_closure.urllib.request.urlopen", side_effect=urlopen):
                    main()

                self.assertEqual(calls, ["GET", "POST"])
                self.assertIn("GitHub closure audit", summary_file.read_text(encoding="utf-8"))

    def test_same_repository_write_denial_does_not_silently_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            event_file = path / "event.json"
            event_file.write_text(json.dumps(event()), encoding="utf-8")

            def urlopen(request, timeout=20):
                if request.get_method() == "GET":
                    return io.BytesIO(b"[]")
                raise HTTPError(request.full_url, 403, "Forbidden", {}, None)

            with patch.dict(os.environ, {
                "GITHUB_EVENT_PATH": str(event_file),
                "GITHUB_REPOSITORY": REPO,
                "GITHUB_RUN_ID": "12345",
                "GITHUB_STEP_SUMMARY": str(path / "summary.md"),
                "GITHUB_TOKEN": "test-placeholder",
            }), patch("audit_pr_closure.urllib.request.urlopen", side_effect=urlopen):
                with self.assertRaises(HTTPError):
                    main()


if __name__ == "__main__":
    unittest.main()
