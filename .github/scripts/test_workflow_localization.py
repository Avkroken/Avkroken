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

    def test_privileged_agent_reconciliation_uses_default_branch_context(self):
        text = (WORKFLOWS / "agent-automerge.yml").read_text(encoding="utf-8")
        self.assertNotIn("\n  pull_request:\n", text)
        self.assertIn("workflow_run:", text)
        self.assertIn('workflows: ["Agent lifecycle signal"]', text)
        self.assertIn("schedule:", text)
        self.assertIn("permissions: {}", text)

    def test_agent_automerge_avoids_unfiltered_check_run_recursion(self):
        text = (WORKFLOWS / "agent-automerge.yml").read_text(encoding="utf-8")
        self.assertNotIn("\n  check_run:\n", text)
        self.assertIn("uses: ./.github/workflows/agent-automerge-policy.yml", text)
        self.assertIn("cron: '*/5 * * * *'", text)

    def test_agent_merge_uses_native_queue_without_author_name_allowlists(self):
        text = (WORKFLOWS / "agent-automerge-policy.yml").read_text(encoding="utf-8")
        self.assertIn('author_type="$(jq -r', text)
        self.assertIn(".auto_merge == null", text)
        self.assertIn("collaborators/${author}/permission", text)
        self.assertIn("write|maintain|admin)", text)
        self.assertIn("Bot PR is handled by the separate bot lifecycle", text)
        self.assertIn('"$head_repo" != "$REPOSITORY"', text)
        self.assertIn('"$draft" == "true"', text)
        self.assertIn("headRefOid", text)
        self.assertIn('reviewDecision == "APPROVED"', text)
        self.assertIn('commit { oid }', text)
        self.assertIn('(.commit.oid // "") == $sha', text)
        self.assertIn("--match-head-commit", text)
        self.assertIn("gh pr merge --disable-auto", text)
        self.assertIn("disable_auto_merge \"$number\" \"$head_sha\"", text)
        self.assertIn("auto-merge was withdrawn; not re-enabling", text)
        self.assertNotIn("gh pr merge --auto", text)
        self.assertIn("auto-merge was withdrawn; not re-enabling", text)
        self.assertNotIn('auto_merge.enabled_by.login', text)
        self.assertNotIn('"gamnacken[bot]"', text)
        self.assertNotIn('"dependabot[bot]"', text)
        self.assertNotIn('codex/*', text)

    def test_review_reconcilers_have_only_pull_request_write_permission(self):
        for name in ('agent-automerge.yml', 'bot-pr-lifecycle.yml'):
            text = (WORKFLOWS / name).read_text(encoding='utf-8')
            self.assertIn('permissions: {}', text)
            self.assertIn('pull-requests: write', text)
            self.assertNotIn('contents:', text)
            self.assertNotIn('checks:', text)

    def test_agent_reconciler_aggregates_each_pr_failure(self):
        text = (WORKFLOWS / "agent-automerge-policy.yml").read_text(encoding="utf-8")
        self.assertIn("failures=0", text)
        self.assertIn("failures=$((failures + 1))", text)
        self.assertIn('[[ "$failures" -eq 0 ]] || exit 1', text)

    def test_bot_review_signal_includes_new_pushes_from_trusted_context(self):
        text = (WORKFLOWS / "agent-lifecycle-signal.yml").read_text(encoding="utf-8")
        self.assertIn("pull_request_target:", text)
        self.assertIn("synchronize", text)
        self.assertIn("converted_to_draft", text)
        self.assertIn("permissions: {}", text)
        self.assertNotIn("actions/checkout", text)

    def test_pr_inventory_read_failure_is_explicitly_reported(self):
        for workflow in ("agent-automerge-policy.yml", "bot-pr-lifecycle.yml"):
            text = (WORKFLOWS / workflow).read_text(encoding="utf-8")
            self.assertIn('if ! candidates="$(gh api --paginate', text)
            self.assertIn("Could not list open PRs", text)
            self.assertNotIn("done < <(", text)

    def test_only_one_gated_dependabot_merge_path_exists(self):
        post = (WORKFLOWS / "automation-post-merge.yml").read_text(encoding="utf-8")
        self.assertNotIn('"Dependabot auto-merge"', post)
        self.assertFalse(
            (WORKFLOWS / "dependabot-automerge.yml").exists(),
            "legacy Dependabot merger bypasses review gate"
        )

    def test_bot_lifecycle_never_submits_or_restores_native_queue(self):
        text = (WORKFLOWS / "bot-pr-lifecycle.yml").read_text(encoding="utf-8")
        self.assertNotIn('gh pr merge --auto', text)
        self.assertNotIn('method="--merge"', text)
        self.assertIn('.auto_merge == null', text)
        self.assertIn('return 0', text)

    def test_bot_lifecycle_serializes_and_dispatches_only_trusted_workflows(self):
        text = (WORKFLOWS / "bot-pr-lifecycle.yml").read_text(encoding="utf-8")
        self.assertIn("concurrency:", text)
        self.assertIn("group: bot-pr-lifecycle", text)
        self.assertIn('workflows: ["Agent lifecycle signal"]', text)
        self.assertIn('types: [completed]', text)
        self.assertIn('gh pr merge --disable-auto', text)
        self.assertNotIn("gh workflow run ci.yml", text)
        self.assertNotIn("gh workflow run codeql.yml", text)
        self.assertNotIn("update-branch", text.replace("GITHUB_TOKEN update-branch", ""))
        self.assertIn("review_gate()", text)
        self.assertIn('(.reviewDecision == "APPROVED")', text)
        self.assertIn('.headRefOid == $sha', text)
        self.assertIn('all(.reviewThreads.nodes[]; .isResolved == true)', text)
        self.assertIn('commit { oid }', text)
        self.assertIn('(.commit.oid // "") == $sha', text)
        self.assertNotIn('gh pr merge --auto', text)
        self.assertIn('.auto_merge == null', text)
        self.assertIn('.user.type == "Bot"', text)
        self.assertIn("failures=0", text)
        self.assertIn("failures=$((failures + 1))", text)

    def test_closure_audit_uses_trusted_context_for_conflicting_prs(self):
        text = (WORKFLOWS / "pr-closure-audit.yml").read_text(encoding="utf-8")
        self.assertIn("pull_request_target:", text)
        self.assertIn("ref: main", text)
        self.assertNotIn("ref: ${{ github.event.pull_request.head", text)

    def test_closure_audit_serializes_duplicate_delivery_safely(self):
        workflow = (WORKFLOWS / "pr-closure-audit.yml").read_text(encoding="utf-8")
        self.assertIn("pull_request_target:", workflow)
        self.assertIn("ref: main", workflow)
        self.assertIn("persist-credentials: false", workflow)
        self.assertIn("cancel-in-progress: false", workflow)
        self.assertIn("github.event.pull_request.closed_at", workflow)

    def test_issue_tracker_requires_explicit_closure_decision(self):
        text = (ROOT / "docs" / "agents" / "issue-tracker.md").read_text(encoding="utf-8")
        self.assertIn("concrete reason and explicit decision", text)

    def test_security_reconciliation_pr_tests_cannot_displace_scheduled_reconcile(self):
        text = (WORKFLOWS / "security-alert-issues.yml").read_text(encoding="utf-8")
        self.assertIn("github.event_name == 'pull_request'", text)
        self.assertIn("tests-", text)
        self.assertIn("'reconcile'", text)

    def test_security_reconciliation_is_repository_local(self):
        text = (WORKFLOWS / "security-alert-issues.yml").read_text(encoding="utf-8")
        self.assertIn("issues:", text)
        self.assertIn("node --test .github/scripts/security-reconcile.test.mjs", text)
        self.assertIn("node .github/scripts/security-reconcile.mjs", text)
        self.assertNotIn("uses: Avkroken/.github/", text)


if __name__ == "__main__":
    unittest.main()
