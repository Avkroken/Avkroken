# Access-klassificering för Avkrokens webbappar

> **Scope:** Detta dokument gäller webbappar i `blixten85/Avkroken`-monorepot. Fristående Avkroken-repositories äger sin egen accessdokumentation och styrs inte av denna fil.


Det här dokumentet beskriver **klassificeringsmodellen**, inte den aktuella operativa hostinventeringen. Grundregeln är **privat tills motsatsen är uttryckligen beslutad**.

Exakta hostnamn, Cloudflare account-/policy-ID:n, privata appnamn, autentiseringsdetaljer, protokollundantag och migreringsordning ska inte lagras i detta publika repository.

## Publik webbapp

En webbapp som uttryckligen ska vara publik får öppnas endast för den avsedda hosten och de paths som faktiskt behöver vara publika.

Privilegierade funktioner ska ligga bakom en separat privat säkerhetsgräns och dessutom behålla applikationens egen behörighetskontroll som defense in depth.

## Publik app med privat adminyta

När en publik app har administrativa funktioner används en faktisk pathname, normalt under `/admin`, för den privata ytan.

En äldre privilegierad route får inte fortsätta fungera som en alternativ säkerhetsgräns. Under migrering bör den endast redirecta till den kanoniska privata routen.

## Helprivat app

En app utan avsedd publik funktion ska vara privat på hostnivå. Enskilda publika callbacks, webhooks eller hälsokontroller öppnas endast när protokollet kräver det och då så smalt som möjligt.

## Maskin-till-maskin och protokollundantag

M2M-endpoints, OAuth-callbacks, webhooks och capability-/engångstoken-endpoints kan behöva vara Internet-routbara. De ska då använda egen autentisering eller capability, minsta möjliga behörighet, lämplig rate limiting och en så liten publik attackyta som möjligt.

Publika protokollundantag är inte skäl att göra en hel host publik.

## Global standard

Workers och andra nya ytor ska vara privata som standard. Publik exponering kräver ett uttryckligt beslut och en specifik öppning.

Preview- och utvecklings-URL:er ska vara avstängda när de inte behövs.

## Operativ inventering

Den exakta mappningen mellan host, applikation, policy, identitetsgrupp, undantag och migreringsstatus är driftsinformation och ska hållas i en privat operationsyta.

Det publika repositoryt ska endast innehålla principer som kan granskas utan att avslöja konfidentiell eller onödigt detaljerad säkerhetskonfiguration.

## Kontroll vid framtida ändringar

En ny yta klassificeras som en av följande:

- publik webb/API → explicit och minsta möjliga publik host/path,
- privat mänsklig yta → autentisering krävs före åtkomst,
- M2M/protokollundantag → egen autentisering/capability och smal publik path,
- ej behövd yta → exponera den inte alls.
