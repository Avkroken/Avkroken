#!/usr/bin/env python3
"""Regression tests for unmerged PR closure attribution."""
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import audit_pr_closure

from audit_pr_closure import closure_comment, closure_marker, has_existing_audit_comment

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


def published(body, login="github-actions[bot]", kind="Bot"):
    return {"body": body, "user": {"login": login, "type": kind}}


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
        comment = closure_comment(event(), REPO, "12345")
        self.assertIn(closure_marker(214, SHA, "12345"), comment)
        self.assertEqual(comment, closure_comment(event(), REPO, "12345"))
        self.assertTrue(has_existing_audit_comment([published(comment)], comment))

    def test_reclosing_same_head_is_a_distinct_occurrence(self):
        first = closure_comment(event(), REPO, "12345")
        second_event = event(actor="dependabot[bot]")
        second_event["pull_request"]["closed_at"] = "2026-10-09T10:20:23Z"
        second = closure_comment(second_event, REPO, "12346")
        self.assertNotEqual(first.splitlines()[0], second.splitlines()[0])
        self.assertFalse(has_existing_audit_comment([published(first)], second))

    def test_spoofed_or_incomplete_comments_do_not_suppress_audit(self):
        comment = closure_comment(event(), REPO, "12345")
        for candidate in [
            {"body": comment},
            published(comment, login="Avkroken", kind="User"),
            published(comment, login="other[bot]"),
            published(comment, kind="User"),
            published(comment.splitlines()[0]),
            published("quoted audit:\n" + comment),
            published(comment.replace("GitHub actor: `Avkroken`", "GitHub actor: `other`")),
        ]:
            with self.subTest(candidate=candidate):
                self.assertFalse(has_existing_audit_comment([candidate], comment))

    def test_publication_rerun_reclosure_and_fork_boundaries(self):
        comments = []
        writes = []

        def api(request, timeout):
            if request.get_method() == "POST":
                body = json.loads(request.data)["body"]
                writes.append(body)
                comments.append(published(body))
                response = io.BytesIO(b"{}")
                response.status = 201
                return response
            return io.BytesIO(json.dumps(comments).encode())

        with tempfile.TemporaryDirectory() as directory:
            payload = Path(directory) / "event.json"
            summary = Path(directory) / "summary.md"
            env = {
                "GITHUB_EVENT_PATH": str(payload),
                "GITHUB_STEP_SUMMARY": str(summary),
                "GITHUB_REPOSITORY": REPO,
                "GITHUB_RUN_ID": "12345",
                "GITHUB_TOKEN": "test-token",
            }
            payload.write_text(json.dumps(event()))
            # An ordinary commenter copying the complete expected audit is ignored.
            comments.append(published(closure_comment(event(), REPO, "12345"),
                                      login="Avkroken", kind="User"))
            with patch.dict(os.environ, env), patch.object(
                audit_pr_closure.urllib.request, "urlopen", side_effect=api
            ) as request:
                audit_pr_closure.main()
                audit_pr_closure.main()
                self.assertEqual(1, len(writes))
                os.environ["GITHUB_RUN_ID"] = "12346"
                second = event(actor="dependabot[bot]")
                second["pull_request"]["closed_at"] = "2026-10-09T10:20:23Z"
                payload.write_text(json.dumps(second))
                audit_pr_closure.main()
                audit_pr_closure.main()
                self.assertEqual(2, len(writes))
                self.assertIn("dependabot[bot]", writes[1])
                second["pull_request"]["head"]["repo"]["full_name"] = "other/fork"
                payload.write_text(json.dumps(second))
                request.reset_mock()
                audit_pr_closure.main()
                request.assert_not_called()
                self.assertIn("GitHub closure audit", summary.read_text())

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
        self.assertIsNone(comment)


if __name__ == "__main__":
    unittest.main()
