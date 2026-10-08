#!/usr/bin/env python3
"""Regression tests for unmerged PR closure attribution."""
import unittest

from audit_pr_closure import closure_comment

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
