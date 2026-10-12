import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";

test("sandbox gateway fails closed without access settings", async () => {
  const child = spawn(process.execPath, ["scripts/sandbox-server.mjs"], {
    env: { ...process.env, SANDBOX_USERNAME: "", SANDBOX_PASSWORD: "" },
    stdio: "ignore",
  });
  const [code] = await once(child, "exit");
  assert.equal(code, 1);
});
test("sandbox gateway protects pages and assets and verifies upstream health", async () => {
  const username = "test-reviewer";
  const password = randomUUID();
  const port = 10819;
  const child = spawn(process.execPath, ["scripts/sandbox-server.mjs"], {
    env: {
      ...process.env,
      PORT: String(port),
      SANDBOX_USERNAME: username,
      SANDBOX_PASSWORD: password,
    },
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 10000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(url + "/healthz");
        if (r.status === 200) {
          ready = true;
          break;
        }
      } catch {
        /* server still starting */
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(ready, "built server should become healthy");
    let r = await fetch(url);
    assert.equal(r.status, 401);
    assert.ok(r.headers.get("www-authenticate")?.startsWith("Basic"));
    assert.equal(r.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
    r = await fetch(url + "/assets/private.js");
    assert.equal(r.status, 401);
    r = await fetch(url, {
      headers: {
        Authorization: "Basic " + Buffer.from(username + ":wrong-password").toString("base64"),
      },
    });
    assert.equal(r.status, 401);
    const headers = {
      Authorization: "Basic " + Buffer.from(username + ":" + password).toString("base64"),
    };
    r = await fetch(url, { headers });
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(html.includes("Soblabs"));
    const asset = html.match(/src="([^"]+\.js[^"]*)"/);
    assert.ok(asset, "HTML should reference a built JavaScript asset");
    r = await fetch(new URL(asset[1]!, url), { headers });
    assert.equal(r.status, 200);
    r = await fetch(url + "/healthz");
    assert.equal(await r.text(), "ok");
  } finally {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
  }
});
