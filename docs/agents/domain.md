# Domain documentation

This repository is a **multi-context monorepo**. Domain and technical context must be routed to the affected application instead of being flattened into one repository-wide glossary.

## Context routing

1. Read root `AGENTS.md` for monorepo-wide constraints.
2. Read the affected application's `AGENTS.md`.
3. Treat the application's `docs/project-context.md` as its canonical current-state documentation.
4. Read relevant application-local architecture, security, operations, and ADR documentation.
5. Use `docs/organization/` only for concerns that genuinely span multiple applications.

Current application contexts include `apps/portal`, `apps/skvallerbyttan`, `apps/spam-filter`, `apps/jobb`, and `apps/dumpen`.

## CONTEXT convention

If domain-modeling work introduces explicit glossary/context files, use a root `CONTEXT-MAP.md` to point to application-local contexts rather than creating one global `CONTEXT.md`. Do not create placeholder context files merely to satisfy the convention; create or update them when terminology or architectural decisions actually need durable representation.

Use established application vocabulary consistently. If a proposal conflicts with an existing recorded decision, surface that conflict explicitly rather than silently overriding it.
