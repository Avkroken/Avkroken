import assert from "node:assert/strict";
import test from "node:test";
import {
  D1_DATABASE_NAME,
  parseD1ListJson,
  renderWranglerConfig,
  selectDatabaseId,
} from "../scripts/wrangler-config.ts";

test("D1 list parser accepts Wrangler UUID output", () => {
  const rows = parseD1ListJson(JSON.stringify([
    { uuid: "11111111-1111-1111-1111-111111111111", name: D1_DATABASE_NAME },
  ]));
  assert.deepEqual(rows, [
    { id: "11111111-1111-1111-1111-111111111111", name: D1_DATABASE_NAME },
  ]);
});

test("D1 lookup refuses ambiguous names", () => {
  assert.throws(
    () => selectDatabaseId([
      { id: "a", name: D1_DATABASE_NAME },
      { id: "b", name: D1_DATABASE_NAME },
    ]),
    /ambiguous deployment/,
  );
});

test("rendered deploy config injects only the runtime D1 ID", () => {
  const rendered = JSON.parse(renderWranglerConfig(
    "22222222-2222-2222-2222-222222222222",
    {
      name: "krosa-maja",
      d1_databases: [
        {
          binding: "AUTH_DB",
          database_name: D1_DATABASE_NAME,
          migrations_dir: "migrations",
        },
      ],
    },
  )) as {
    d1_databases: Array<Record<string, unknown>>;
  };

  assert.equal(rendered.d1_databases[0]?.database_id, "22222222-2222-2222-2222-222222222222");
  assert.equal(rendered.d1_databases[0]?.migrations_dir, "migrations");
});

test("base config must never contain an account-specific D1 ID", () => {
  assert.throws(
    () => renderWranglerConfig(
      "33333333-3333-3333-3333-333333333333",
      {
        d1_databases: [
          {
            binding: "AUTH_DB",
            database_name: D1_DATABASE_NAME,
            database_id: "committed-id",
          },
        ],
      },
    ),
    /Do not commit/,
  );
});
