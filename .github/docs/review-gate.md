# Review reconciliation and native auto-merge consent

The collaborator (`agent-automerge-policy.yml`) and bot (`bot-pr-lifecycle.yml`)
reconcilers distinguish three review outcomes:

| Outcome | Reconciliation behavior |
| --- | --- |
| Complete review snapshot for the observed head, current approval, no active change request or unresolved thread | Leave the native queue unchanged. |
| Complete snapshot with pending approval, stale/dismissed approval, active change request, or unresolved thread (including outdated threads) | Revoke an existing native auto-merge request under the existing review policy. |
| Failed API request, GraphQL errors, malformed/missing fields, incomplete pagination, or a different head SHA | Preserve consent, emit a retry warning, and fail reconciliation visibly. |

GitHub's native ruleset and required checks remain the merge authority. Neither
reconciler enables or restores auto-merge, updates the branch, or merges commits.
They require only `pull-requests: write`; repository metadata reads are implicit.

An indeterminate read does not start an in-job retry loop. The PR remains open
and the existing event triggers and scheduled sweeps re-evaluate it: every five
minutes for collaborators and hourly at minute 37 for bots. A failed run is not
completion. A response with more than 100 reviews or threads remains incomplete
and requires manual review until pagination support is implemented.

This is the review-read safety fix tracked by #257, within the #228 automation
baseline. Durable work-item state, bounded API backoff, automated code remediation,
SLO escalation, and post-merge release verification for the broader PR steward
are not implemented by this change.

Run the shell regression suite with:

```bash
python3 .github/scripts/test_bot_review_gate.py
```
