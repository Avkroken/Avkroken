# Observability-programmet

Den här sidan kopplar Avkroken Service Map v1 / Skvallerbyttan v3 till de
appägda kontrakten i `Avkroken/Avkroken`. [Masterissue #236](https://github.com/Avkroken/Avkroken/issues/236)
äger programmets arbetsordning, fasstatus, beroenden och acceptanskriterier.
Leveransevidens hör till länkade Issues/PR:er och [GitHub Releases](https://github.com/Avkroken/Avkroken/releases).

## Hitta rätt ägare

| Arbets-ID | App eller kontraktsägare | Repositorykontext | Arbetsissue |
| --- | --- | --- | --- |
| ARCH-000–005 | Delad arkitektur och `packages/observability-contracts` | [Gemensamma wire/RPC-kontrakt](../../packages/observability-contracts/README.md) | [Program #236](https://github.com/Avkroken/Avkroken/issues/236) |
| ING-100 / ING-108 | `apps/ingest` | [Ingest-kontext](../../apps/ingest/docs/project-context.md) | [Ingress #237](https://github.com/Avkroken/Avkroken/issues/237) |
| EVT-200 / EVT-210 | `apps/events` | [Events-kontext](../../apps/events/docs/project-context.md), [runtime/cutover](../../apps/events/docs/runtime-provisioning.md), [preflight](../../apps/events/docs/staging-preflight.md) | [Ledger #238](https://github.com/Avkroken/Avkroken/issues/238) |
| STATE-250 | Separat State-app saknas | [Skvallerbyttans state och reconciliation](../../apps/skvallerbyttan/docs/architecture.md) | Se [programmet](https://github.com/Avkroken/Avkroken/issues/236) |
| LOG-300 | Separat Logs-app saknas | [Skvallerbyttans observability](../../apps/skvallerbyttan/docs/project-context.md#observability) | Se [programmet](https://github.com/Avkroken/Avkroken/issues/236) |
| MET-400 | Separat Statistik-app saknas | [Skvallerbyttans metrics och read telemetry](../../apps/skvallerbyttan/docs/project-context.md#metrics-och-kostnad) | Se [programmet](https://github.com/Avkroken/Avkroken/issues/236) |
| STA-500 | Separat Status-app saknas | [Skvallerbyttans heartbeat och readiness](../../apps/skvallerbyttan/docs/operations.md#push-baserad-liveness-och-readiness) | Se [programmet](https://github.com/Avkroken/Avkroken/issues/236) |
| AUT-600 | Separat Auth-app saknas | [Skvallerbyttans authgränser](../../apps/skvallerbyttan/docs/security.md) | Se [programmet](https://github.com/Avkroken/Avkroken/issues/236) |
| API-700 | Separat machine API-app saknas | [Skvallerbyttans API](../../apps/skvallerbyttan/docs/project-context.md#api) | Se [programmet](https://github.com/Avkroken/Avkroken/issues/236) |
| UI-800 | `apps/skvallerbyttan` | [Dashboard och konsumentkontrakt](../../apps/skvallerbyttan/docs/project-context.md) | Se [programmet](https://github.com/Avkroken/Avkroken/issues/236) |
| DEC-900 | Berörda appar vid avveckling | [Migration och rollback](../../apps/events/docs/runtime-provisioning.md) | Se [programmet](https://github.com/Avkroken/Avkroken/issues/236) |

## Målgränser och canonical ägarskap

`SERVICE_IDS` i [observability-kontrakten](../../packages/observability-contracts/src/index.ts)
namnger semantiska tjänstegränser. Ett tjänste-ID eller en målsubdomän i
programmet är inte bevis på en deployad app, provisionerad resurs eller verifierad cutover.
Apparnas egna `project-context.md`, kod och konfiguration beskriver repositorykontraktet;
faktisk providerstate verifieras hos providern.

Skvallerbyttan behåller canonical ingress och eventägarskap tills Ingest/Events
shadow-, parity- och cutover-verifiering är uppfylld. De exekverbara repositorygaterna
finns i [Events runtime gate](../../apps/events/src/runtime-gate.ts),
[staging preflight](../../apps/events/src/staging-preflight.ts) och
[live-preflight deployment gate](../../apps/events/control-plane/live-preflight-deployment-gate.ts).
En godkänd gate ersätter inte ett separat operatörsbeslut om provisionering,
deployment eller provider destination cutover.

## Arkitekturkällor

Masterissuet hänvisar till en extern dokumentfamilj i ChatGPT Library:
`00-MASTER-Avkroken-Observability-Architecture.md`, `01-HUVUDPLAN.md`,
`02-DETALJPLAN.md`, `03-ARBETSMOMENT.md`, `04-CURRENT-STATE-INVENTORY.md`,
`05-SERVICE-DEPENDENCY-GRAPH.md`, `06-SERVICE-MAP-V1.md`,
`07-COMMON-CONTRACTS-V1.md` och `08-ADR-STORAGE-TRANSPORT-V1.md`.
Filerna är inte incheckade här; denna sida återger inte deras innehåll.

Repositoryts planerade resurs- och cutoverkontrakt ägs av
[Events runtime-provisioning](../../apps/events/docs/runtime-provisioning.md) och
[runtime-provisioning.v1.json](../../apps/events/runtime-provisioning.v1.json),
med validering i de länkade gaterna. Programstatus och releasehistorik dupliceras
inte i den här navigationssidan.
