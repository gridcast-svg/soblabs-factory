import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { chromium, expect } from "@playwright/test";

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
    assert.equal(r.headers.get("content-security-policy"), "frame-ancestors 'none'");
    const html = await r.text();
    assert.ok(html.includes("Soblabs"));
    const asset = html.match(/src="([^"]+\.js[^"]*)"/);
    assert.ok(asset, "HTML should reference a built JavaScript asset");
    r = await fetch(new URL(asset[1]!, url), { headers });
    assert.equal(r.status, 200);
    for (const path of ["/av-editor/index.html", "/av-editor/index.html?v=1"]) {
      assert.equal((await fetch(url + path)).status, 401);
      r = await fetch(url + path, { headers });
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("content-security-policy"), "frame-ancestors 'self'");
    }
    // Exercise the actual production gateway: direct Nitro/Vite checks miss its headers.
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"],
      args: ["--no-sandbox"],
    });
    try {
      const page = await browser.newPage({ httpCredentials: { username, password } });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(url);
      await page.getByRole("button", { name: "System designer", exact: true }).click();
      const editor = page.frameLocator('iframe[title="Soblabs AV schematic canvas"]');
      await expect(editor.getByRole("button", { name: "+ Add device", exact: true })).toBeVisible();
      await expect(
        page.getByText("AV edits linked to this project's BOM", { exact: true }),
      ).toBeVisible();
      assert.equal((await editor.locator("app-device-node").count()) > 0, true);
      await page.getByRole("button", { name: "LED configurator", exact: true }).click();
      await expect(page.locator(".ws-led-svg [data-cell]")).toHaveCount(72);
      await page.getByRole("tab", { name: "Cabinet", exact: true }).click();
      await page.getByLabel("Maximum cabinet power (W)", { exact: true }).fill("200");
      await page.getByRole("tab", { name: "Processing", exact: true }).click();
      await page.getByLabel("Pixels per data port", { exact: true }).fill("655360");
      await expect(page.locator(".ws-led-stagefoot")).toContainText("12 data runs");
      const file = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export LED PDF", exact: true }).click();
      const stream = await (await file).createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const pdf = Buffer.concat(chunks);
      assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
      assert.ok(pdf.length > 1000);
      await page.getByRole("button", { name: "Projection planner", exact: true }).click();
      await page.getByRole("button", { name: "Load illustrative example", exact: true }).click();
      await expect(page.locator("[data-projection-position]")).toHaveCount(2);
      await expect(
        page.getByRole("button", { name: "Update projection BOM", exact: true }),
      ).toBeDisabled();
      const projectionFile = page.waitForEvent("download");
      await page.getByRole("button", { name: "Export projection PDF", exact: true }).click();
      const projectionStream = await (await projectionFile).createReadStream();
      const projectionChunks: Buffer[] = [];
      for await (const chunk of projectionStream) projectionChunks.push(Buffer.from(chunk));
      assert.equal(Buffer.concat(projectionChunks).subarray(0, 4).toString(), "%PDF");
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
    r = await fetch(url + "/healthz");
    assert.equal(await r.text(), "ok");
  } finally {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
  }
});
