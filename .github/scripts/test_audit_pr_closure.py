#!/usr/bin/env python3
"""Regression tests for unmerged PR closure attribution."""
import unittest

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
        trusted = {"user": {"login": "github-actions[bot]"}, "body": comment}
        self.assertTrue(has_existing_audit_comment(
            [{"body": "older"}, trusted], marker,
        ))
        self.assertFalse(has_existing_audit_comment(
            [{"user": {"login": "attacker"}, "body": comment}], marker,
        ))
        self.assertFalse(has_existing_audit_comment(
            [{"user": {"login": "github-actions[bot]"},
              "body": "Quoted marker: " + comment}], marker,
        ))
        self.assertFalse(has_existing_audit_comment([{"body": "older"}], marker))

    def test_repeated_closure_same_head_has_separate_audit_marker(self):
        first = event()
        second = event()
        second["pull_request"]["closed_at"] = "2026-10-09T11:20:23Z"
        first_comment = closure_comment(first, REPO, "123")
        second_comment = closure_comment(second, REPO, "124")
        self.assertNotEqual(first_comment.splitlines()[0], second_comment.splitlines()[0])
        marker = closure_marker(214, SHA, second["pull_request"]["closed_at"])
        self.assertFalse(has_existing_audit_comment(
            [{"user": {"login": "github-actions[bot]"}, "body": first_comment}],
            marker,
        ))

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


if __name__ == "__main__":
    unittest.main()
