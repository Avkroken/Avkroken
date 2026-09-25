# Access-standard för Avkrokens webbappar

> **Scope:** Detta dokument gäller webbappar i `Avkroken/Avkroken`-monorepot. Fristående Avkroken-repositories äger sina egna access-/exponeringskontrakt.


Grundprincipen är **neka som standard**. Ingenting ska bli publikt bara för att det råkar ligga på en Worker eller under en gemensam domän.

## Två exponeringsroller

### Privat

Används där en människa eller tjänst måste vara autentiserad innan ytan får nås.

Samma privata princip kan återanvändas för helprivata appar, adminytor och globala fallback-regler. Applikationen ansvarar därefter för roller och behörigheter.

### Publik

Används endast där Internet uttryckligen ska få komma åt ytan.

Publik åtkomst ska konfigureras specifikt för den host och path som behöver vara publik. Bred wildcard-bypass ska undvikas.

## Global fallback

Nya Workers och andra ytor ska vara privata som standard tills en mer specifik host eller path uttryckligen öppnas.

Utvecklings- och preview-URL:er ska vara avstängda när de inte behövs.

## Publika webbappar

En publik webbapp öppnas per avsedd host. Privilegierade delar ska ligga bakom en faktisk server-/edge-synlig pathname, normalt under:

```text
/admin
/admin/*
/admin/api/*
```

Den privata ytan ska dessutom behålla applikationens egen sessions-, roll- eller tokenkontroll som defense in depth.

Privilegierade API-endpoints får inte ha en alternativ fungerande väg utanför den privata säkerhetsgränsen. En äldre väg bör endast redirecta till den kanoniska routen.

## Helprivata appar

En app som inte har någon publik funktion ska vara privat på hostnivå.

Publika undantag ska inte läggas till om de inte behövs av ett konkret protokoll eller användarflöde.

## Protokollundantag

OAuth-callbacks, webhooks, capability-/engångstoken-endpoints och maskin-till-maskin-endpoints kan behöva vara publikt routbara när protokollet kräver det.

De ska då ha egen autentisering eller capability, minsta möjliga behörighet, lämplig rate limiting och en smal publik attackyta. Ett protokollundantag är inte skäl att göra hela hosten publik.

## URL-fragment

En route som `/#admin` är aldrig en säkerhetsgräns eftersom delen efter `#` inte skickas till edge eller server.

Admin-SPA:er ska därför använda en faktisk pathname för den skyddade ytan.

## Offentlig och privat dokumentation

Det här publika dokumentet beskriver endast säkerhetsprinciperna.

Följande hör hemma i privat operationsdokumentation och ska inte lagras här:

- Cloudflare account-, application- eller policy-ID:n,
- exakt hostinventering och klassificering per tjänst,
- namn på privata appar eller interna ytor,
- autentiseringsheader- eller tokennamn som bara behövs operativt,
- exakta protokollundantag och privata endpointlistor,
- detaljerad migrerings- eller borttagningsordning för aktiv säkerhetskonfiguration.

## Regel för nya Access-policys

Skapa inte en ny policy om den inte ändrar minst en av följande saker:

1. vilken identitet eller grupp som får tillgång,
2. autentiseringsmekanismen,
3. exponeringstypen på ett fundamentalt sätt.

Om inget av detta ändras ska en befintlig policy återanvändas.
