# Migrations

`0001-better-auth.sql` är genererad av Better Auth CLI **1.7.5** från samma schema-relevanta konfiguration som runtime använder.

Genereringen kördes i GitHub Actions med:

```sh
npm install --ignore-scripts --no-audit --no-fund
npm run generate:auth-schema
```

Den genererade SQL-filen verifierades därefter genom att:

1. Better Auth CLI rapporterade lyckad schemagenerering,
2. repositoryts tester passerade,
3. TypeScript-kontrollen passerade,
4. Worker-bundlen passerade `wrangler deploy --dry-run`,
5. SQL-filen kunde appliceras utan fel i en tom SQLite-databas.

Filen ska inte handredigeras. Vid schemaändringar ska den regenereras från den låsta dependency-versionen och granskas som en normal kodändring.

## D1

Migrationen är **inte applicerad i produktion ännu**. Skapa/verifiera först D1-databasen `krosa-maja-auth` och använd därefter Wranglers D1-migrationsflöde eller motsvarande verifierad D1-operation.

Runtime-migrationsendpoint ska inte exponeras i produktion.
