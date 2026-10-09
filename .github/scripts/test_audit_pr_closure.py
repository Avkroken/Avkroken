#!/usr/bin/env python3
"""Regression tests for unmerged PR closure attribution."""
import copy
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from audit_pr_closure import closure_comment, closure_marker, has_existing_audit_comment, main

REPO = "Avkroken/Avkroken"
SHA = "a" * 40
CLOSED_AT = "2026-10-08T10:20:23Z"
ACTIONS_USER = {"login": "github-actions[bot]", "type": "Bot"}


def event(action="closed", merged=False, actor="Avkroken", number=214):
    return {
        "action": action,
        "sender": {"login": actor},
        "pull_request": {
            "number": number,
            "merged": merged,
            "closed_at": CLOSED_AT,
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
        marker = closure_marker(214, SHA, CLOSED_AT)
        comment = closure_comment(event(), REPO, "12345")
        self.assertIn(marker, comment)
        self.assertTrue(has_existing_audit_comment(
            [{"body": "older"}, {"body": comment, "user": ACTIONS_USER}],
            marker,
        ))
        self.assertFalse(has_existing_audit_comment([{"body": "older"}], marker))

    def test_reclosure_at_same_head_has_distinct_marker(self):
        first = event()
        second = copy.deepcopy(first)
        second["pull_request"]["closed_at"] = "2026-10-09T10:20:23Z"
        first_comment = closure_comment(first, REPO, "12345")
        second_comment = closure_comment(second, REPO, "12346")
        self.assertNotEqual(first_comment.splitlines()[0], second_comment.splitlines()[0])
        self.assertFalse(has_existing_audit_comment(
            [{"body": first_comment, "user": ACTIONS_USER}],
            second_comment.splitlines()[0],
        ))

    def test_forged_or_unstructured_comments_do_not_suppress_audit(self):
        comment = closure_comment(event(), REPO, "12345")
        marker = comment.splitlines()[0]
        for user in [None, {}, {"login": "Avkroken", "type": "User"},
                     {"login": "other[bot]", "type": "Bot"},
                     {"login": "github-actions[bot]", "type": "User"}]:
            with self.subTest(user=user):
                self.assertFalse(has_existing_audit_comment(
                    [{"body": comment, "user": user}], marker,
                ))
        for body in [marker, "Quoted audit:\n" + comment, "```\n" + comment + "\n```"]:
            with self.subTest(body=body):
                self.assertFalse(has_existing_audit_comment(
                    [{"body": body, "user": ACTIONS_USER}], marker,
                ))

    def run_audit(self, payload, comments, run_id="12345"):
        """Run the publication boundary without any live API writes."""
        requests = []

        def respond(request, timeout):
            requests.append(request)
            if request.get_method() == "GET":
                response = io.BytesIO(json.dumps(comments).encode())
            else:
                response = io.BytesIO(b"{}")
                response.status = 201
            return response

        with tempfile.TemporaryDirectory() as directory:
            event_path = Path(directory) / "event.json"
            summary_path = Path(directory) / "summary.md"
            event_path.write_text(json.dumps(payload), encoding="utf-8")
            with patch.dict(os.environ, {
                "GITHUB_EVENT_PATH": str(event_path), "GITHUB_REPOSITORY": REPO,
                "GITHUB_RUN_ID": run_id, "GITHUB_STEP_SUMMARY": str(summary_path),
                "GITHUB_TOKEN": "test-only-placeholder",
            }), patch("audit_pr_closure.urllib.request.urlopen", side_effect=respond):
                main()
            summary = summary_path.read_text() if summary_path.exists() else ""
        return requests, summary

    def test_rerun_skips_only_authenticated_same_closure(self):
        comment = closure_comment(event(), REPO, "12345")
        requests, summary = self.run_audit(
            event(), [{"body": comment, "user": ACTIONS_USER}], run_id="12346",
        )
        self.assertEqual([request.get_method() for request in requests], ["GET"])
        self.assertIn("actions/runs/12346", summary)

    def test_reclosure_is_published_despite_prior_and_forged_comments(self):
        previous = closure_comment(event(), REPO, "12345")
        reopened = event(actor="dependabot[bot]")
        reopened["pull_request"]["closed_at"] = "2026-10-09T10:20:23Z"
        current = closure_comment(reopened, REPO, "12346")
        requests, _ = self.run_audit(reopened, [
            {"body": previous, "user": ACTIONS_USER},
            {"body": current, "user": {"login": "attacker", "type": "User"}},
        ], run_id="12346")
        self.assertEqual([request.get_method() for request in requests], ["GET", "POST"])
        self.assertEqual(json.loads(requests[-1].data)["body"], current)

    def test_fork_closure_retains_summary_without_api_access(self):
        fork = event()
        fork["pull_request"]["head"]["repo"]["full_name"] = "outside/fork"
        requests, summary = self.run_audit(fork, [])
        self.assertEqual(requests, [])
        self.assertIn("GitHub closure audit", summary)

    def test_conflicted_closures_use_trusted_target_context(self):
        workflow = (Path(__file__).resolve().parents[1] / "workflows" / "pr-closure-audit.yml").read_text()
        self.assertIn("\n  pull_request_target:\n    types: [closed]", workflow)
        self.assertNotIn("\n  pull_request:\n", workflow)
        self.assertIn("ref: main", workflow)
        self.assertIn("persist-credentials: false", workflow)
        self.assertNotIn("ref: ${{ github.event.pull_request.head", workflow)
        self.assertIn("github.event.pull_request.closed_at", workflow)
        self.assertIn("cancel-in-progress: false", workflow)

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
