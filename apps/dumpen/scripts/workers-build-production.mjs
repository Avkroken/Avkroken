import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

if (process.env.WORKERS_CI !== "1") {
  throw new Error("deploy:workers-builds may only run inside Cloudflare Workers Builds");
}
if (process.env.WORKERS_CI_BRANCH !== "main") {
  console.log(
    `Skipping Dumpen production deployment for non-main branch ${process.env.WORKERS_CI_BRANCH || "<unset>"}.`,
  );
  process.exit(0);
}

run("npm", ["run", "check"]);
run("npm", ["run", "deploy"]);
