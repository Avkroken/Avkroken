# Dokumentation

Det här är dokumentationskartan för `Avkroken/Avkroken`.

## Appar

- [Jobb](../apps/jobb/README.md) — appens egen README och `apps/jobb/docs/`.
- [Skvallerbyttan](../apps/skvallerbyttan/README.md) — appens egen README och `apps/skvallerbyttan/docs/`.
- [Ingest](../apps/ingest/README.md) — deploy-neutral ingress-seam och `apps/ingest/docs/`.
- [Events](../apps/events/README.md) — deploy-neutral event-ledger-seam och `apps/events/docs/`.
- [Spam filter](../apps/spam-filter/README.md) — inkommande Email Routing-filter för `denied.se`.
- [Portal](../apps/portal/README.md) — appens egen README och `apps/portal/docs/`.
- [Dumpen](../apps/dumpen/README.md) — appens egen README och `apps/dumpen/docs/`.

## Delad monorepo-kontext

[docs/organization/](organization/) innehåller endast dokumentation som faktiskt delas av flera appar i **detta repository** eller gäller rootens workflows/struktur.

Den katalogen är inte source of truth för fristående Avkroken-repositories.

## Fristående repositories

Varje fristående repository äger själv:

- README,
- `docs/`,
- Wiki,
- Issues,
- Discussions,
- repo-specifika tekniska instruktioner.

Det finns ingen central dokumentationsspegel. Varje repository äger sin dokumentation och sina tekniska instruktioner lokalt.
