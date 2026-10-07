# @avkroken/observability-contracts

Shared wire/RPC primitives for Avkroken observability modules.

This package owns semantic contracts only. It does not own runtime state, provider credentials, transport, storage, or deployment behavior.

The initial compatibility seam preserves Skvallerbyttan's existing observation status classification while adding v1 types for service results, provenance, correlation, events, current state, status, pagination and auth claims.
