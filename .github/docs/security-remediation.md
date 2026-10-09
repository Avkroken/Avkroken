# Automated security remediation

The repository-local `.github/workflows/security-alert-issues.yml` runs every
hour and can be dispatched manually. It reconciles open Code Scanning and
Dependabot alerts into sanitized GitHub Issues, and queues eligible work.
Automated Copilot cloud-agent assignment is **not available** with the Actions
installation token. An authorized user-to-server token is required; no new
credential is provisioned and no unsupported API write is attempted.
It recognizes pre-existing
`skvallerbyttan-alert` markers to avoid duplicate tracking issues.

**Secret-scanning reads are disabled for both public and private repositories**
until an authorized credential and confidential tracking channel are verified.
Public Issues must never disclose secret-scanning findings. The script does
not copy secrets, raw findings, or exploit details into issue bodies.

The owner `Avkroken` is requested as issue assignee. A coding agent
may be assigned manually by an authorized user. This workflow does **not**
claim to start a Copilot agent or create remediation PRs, because its
`GITHUB_TOKEN` cannot satisfy that API's authentication requirement. Codex and Claude are supported GitHub partner coding agents when enabled in
Copilot cloud-agent settings. Their live assignment identities/API support
must be verified before this automation can request their sessions; they are
not yet programmatically assigned here. CodeRabbit reviews pull requests
when enabled and is not an ordinary issue assignee.
No fake assignments are reported. Existing CI, CodeQL advanced setup, rulesets,
and manual/auto-merge policies are unchanged.

## Permissions and failure reporting

The workflow uses the built-in `GITHUB_TOKEN` with contents read, issues write,
pull requests read, security events read, and `vulnerability-alerts: read`
(the latter is supported by GitHub Actions as of September 2026).
Unsupported or forbidden Code Scanning and Dependabot reads fail visibly
instead of being counted as successful reconciliation. Secret-scanning reads
are explicitly deferred (not attempted) and require separately verified
provider credentials and confidential tracking; no secret-scanning capability
is claimed by this workflow.

The existing `COPILOT_GITHUB_TOKEN` is documented as **read-only** for
release notes; it must not be used for agent assignment. GitHub's `GITHUB_TOKEN` is an installation token and cannot invoke
Copilot cloud-agent issue assignment via that API. The workflow logs an
explicit notice and leaves the issue queued, without trying an unauthorized
write or creating a new secret.
Do not invent a new token or secret. Skvallerbyttan stays read-only.

A run can create/reopen up to 100 tracking issues. It queues new agent work
behind existing open pull requests in the repository. When the queue is
clear, it reports the next eligible issue for separately authorized
assignment, without claiming any agent was assigned. Only owner-authored issues and tracking
issues created by GitHub Actions with the expected marker are automatically
eligible for code-agent execution; untrusted third-party issues need triage.
Later scheduled runs resume remaining work.
Issues generated with `GITHUB_TOKEN` do not themselves trigger a new
`issues` workflow. This does not authorize the installation token to delegate agent
work. No empty placeholder PRs are created or auto-merged.

Test with `node --test .github/scripts/security-reconcile.test.mjs`.
