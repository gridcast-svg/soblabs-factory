import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const app = resolve("apps/av-editor");
function run(args) {
  const result = spawnSync("npm", args, { cwd: app, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const lockHash = createHash("sha256")
  .update(readFileSync(resolve(app, "package-lock.json")))
  .digest("hex");
const installed = resolve(app, "node_modules/.factory-lock.sha256");
if (!existsSync(installed) || readFileSync(installed, "utf8") !== lockHash) {
  run(["ci", "--include=dev", "--no-audit", "--no-fund"]);
  writeFileSync(installed, lockHash);
}
run(["run", "build"]);
const output = resolve("public/av-editor");
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(resolve(app, "dist/ng-diagram-av-schematic/browser"), output, { recursive: true });
cpSync(resolve(app, "LICENSE"), resolve(output, "LICENSE.txt"));
cpSync(
  resolve(app, "dist/ng-diagram-av-schematic/3rdpartylicenses.txt"),
  resolve(output, "3rdpartylicenses.txt"),
);
