#!/usr/bin/env python3
"""Regression tests for repository-local workflow ownership and trigger safety."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"


class WorkflowLocalizationTests(unittest.TestCase):
    def test_no_workflow_calls_deleted_central_repository(self):
        offenders = []
        for path in sorted(WORKFLOWS.glob("*.yml")):
            if "Avkroken/.github/" in path.read_text(encoding="utf-8"):
                offenders.append(path.name)
        self.assertEqual([], offenders, f"deleted central workflow calls: {offenders}")

    def test_agent_automerge_avoids_unfiltered_check_run_recursion(self):
        text = (WORKFLOWS / "agent-automerge.yml").read_text(encoding="utf-8")
        self.assertNotIn("\n  check_run:\n", text)
        self.assertIn("uses: ./.github/workflows/agent-automerge-policy.yml", text)
        self.assertIn("cron: '*/5 * * * *'", text)

    def test_agent_merge_eligibility_is_permission_based(self):
        text = (WORKFLOWS / "agent-automerge-policy.yml").read_text(encoding="utf-8")
        self.assertIn('author_type="$(jq -r', text)
        self.assertIn('collaborators/${author}/permission', text)
        self.assertIn('write|maintain|admin)', text)
        self.assertIn('Bot) ;;', text)
        self.assertIn('"$head_repo" != "$REPOSITORY"', text)
        self.assertIn('"$draft" == "true"', text)
        self.assertNotIn('"gamnacken[bot]"', text)
        self.assertNotIn('codex/*', text)
        self.assertIn('method="--squash"', text)
        self.assertNotIn('method="--merge"', text)
        self.assertIn('gh pr merge --auto', text)

    def test_bot_lifecycle_uses_linear_history_compatible_merge(self):
        text = (WORKFLOWS / "bot-pr-lifecycle.yml").read_text(encoding="utf-8")
        self.assertIn('method="--squash"', text)
        self.assertNotIn('method="--merge"', text)

    def test_bot_lifecycle_serializes_and_dispatches_only_trusted_workflows(self):
        text = (WORKFLOWS / "bot-pr-lifecycle.yml").read_text(encoding="utf-8")
        self.assertIn("concurrency:", text)
        self.assertIn("group: bot-pr-lifecycle", text)
        self.assertIn("workflow_matches_default", text)
        self.assertIn("modifies trusted workflow definitions", text)
        self.assertIn("update-branch request failed", text)
        self.assertIn("failures=0", text)
        self.assertIn("failures=$((failures + 1))", text)

    def test_closure_audit_handles_conflicts_without_executing_pr_code(self):
        text = (WORKFLOWS / "pr-closure-audit.yml").read_text(encoding="utf-8")
        self.assertIn("\n  pull_request_target:\n    types: [closed]", text)
        self.assertNotIn("\n  pull_request:\n", text)
        self.assertIn("ref: main", text)
        self.assertIn("persist-credentials: false", text)
        self.assertNotIn("github.event.pull_request.head", text)
        self.assertIn("group: pr-closure-audit-${{ github.run_id }}", text)
        self.assertIn("cancel-in-progress: false", text)

    def test_issue_tracker_requires_explicit_closure_decision(self):
        text = (ROOT / "docs" / "agents" / "issue-tracker.md").read_text(encoding="utf-8")
        self.assertIn("concrete reason and explicit decision", text)

    def test_security_reconciliation_is_repository_local(self):
        text = (WORKFLOWS / "security-alert-issues.yml").read_text(encoding="utf-8")
        self.assertIn("issues:", text)
        self.assertIn("node --test .github/scripts/security-reconcile.test.mjs", text)
        self.assertIn("node .github/scripts/security-reconcile.mjs", text)
        self.assertNotIn("uses: Avkroken/.github/", text)


if __name__ == "__main__":
    unittest.main()
