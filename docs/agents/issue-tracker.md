# Issue tracker: GitHub

GitHub Issues is the canonical issue and specification tracker for this repository.

## Working convention

- Prefer the authenticated GitHub connector; otherwise use `gh` from an authenticated clone.
- Read the full issue state before acting: body, labels, comments, assignees, linked pull requests, sub-issues, and native dependencies where available.
- Keep one coherent problem or deliverable per issue, with acceptance criteria and blockers in the issue body.
- Pull requests are implementation/review artifacts, not a replacement issue tracker.
- Keep a work log in the originating issue: factual changes, exact PR/commit refs, check results, review rounds, residual blockers, and who performed the write. A GitHub OAuth `Avkroken` actor must not be presented as proof that the account owner personally acted.
- Use `Fixes #N` / `Closes #N` only when the issue's full acceptance criteria are met; use `Refs #N` / `Relates to #N` for partial work. Follow release/changelog linking via the existing canonical GitHub Release flow.
- Before closing any unmerged PR, record the concrete reason in its discussion; never silently close active agent work. The closure-audit workflow provides a supplemental provider-event record, not session-level attribution.
- Durable architecture or domain decisions belong in version-controlled repository documentation rather than only in issue comments.

## CLI fallback

Read an issue with linked pull requests explicitly included:

```bash
gh issue view <number> --json number,title,body,state,labels,assignees,comments,closedByPullRequestsReferences
```

Use `gh issue list`, `gh issue create`, `gh issue comment`, and `gh issue close` for the corresponding operations. Inspect native dependency/sub-issue state through the GitHub connector or API when it affects execution order.

When a skill says to publish or fetch a ticket, use this repository's GitHub Issues tracker.
