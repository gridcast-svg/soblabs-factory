// Password-protected review environment. The app remains a browser-local sandbox.
import http from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const username = process.env.SANDBOX_USERNAME;
const password = process.env.SANDBOX_PASSWORD;
if (!username || username.includes(":") || !password || password.length < 16) {
  console.error(
    "Set SANDBOX_USERNAME and a SANDBOX_PASSWORD of at least 16 characters in hosting settings.",
  );
  process.exit(1);
}
const port = Number(process.env.PORT || 10000);
const internalPort = port === 3100 ? 3101 : 3100;
const digest = (value) => createHash("sha256").update(value).digest();
const expected = digest(`${username}:${password}`);
function authorized(header) {
  if (typeof header !== "string" || !header.startsWith("Basic ") || header.length > 4096)
    return false;
  return timingSafeEqual(digest(Buffer.from(header.slice(6), "base64").toString("utf8")), expected);
}
const root = fileURLToPath(new URL("../", import.meta.url));
const appEnv = { ...process.env };
delete appEnv.SANDBOX_USERNAME;
delete appEnv.SANDBOX_PASSWORD;
const app = spawn(process.execPath, [resolve(root, ".output/server/index.mjs")], {
  cwd: root,
  env: { ...appEnv, HOST: "127.0.0.1", PORT: String(internalPort) },
  stdio: ["ignore", "inherit", "inherit"],
});
let closing = false;
const server = http.createServer((req, res) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  if (req.url !== "/healthz" && !authorized(req.headers.authorization)) {
    res.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="Soblabs sandbox", charset="UTF-8"',
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    });
    res.end("Sign in with your sandbox access credentials.");
    return;
  }
  // Health checks verify the built application is responding; no app data is returned.
  const health = req.url === "/healthz";
  const headers = { ...req.headers };
  delete headers.authorization;
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: internalPort,
      method: health ? "GET" : req.method,
      path: health ? "/" : req.url,
      headers,
    },
    (response) => {
      if (health) {
        response.resume();
        res.writeHead(response.statusCode === 200 ? 200 : 503, {
          "Content-Type": "text/plain",
          "Cache-Control": "no-store",
        });
        res.end(response.statusCode === 200 ? "ok" : "unavailable");
        return;
      }
      for (const [key, value] of Object.entries(response.headers)) {
        if (
          value !== undefined &&
          !["connection", "transfer-encoding", "content-security-policy"].includes(key)
        )
          res.setHeader(key, value);
      }
      res.statusCode = response.statusCode || 502;
      response.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(503, { "Content-Type": "text/plain" });
    res.end("Sandbox is starting. Try again shortly.");
  });
  upstream.setTimeout(30000, () => upstream.destroy());
  req.on("aborted", () => upstream.destroy());
  if (health) upstream.end();
  else req.pipe(upstream);
});
function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  server.close();
  app.kill("SIGTERM");
  const timeout = setTimeout(() => {
    app.kill("SIGKILL");
    process.exit(code);
  }, 5000);
  timeout.unref();
  app.once("exit", () => process.exit(code));
}
app.on("error", () => {
  console.error("Unable to start built application. Run npm run build first.");
  shutdown(1);
});
app.on("exit", () => {
  if (!closing) shutdown(1);
});
process.on("SIGTERM", () => shutdown());
process.on("SIGINT", () => shutdown());
server.listen(port, "0.0.0.0", () =>
  console.log(`Sandbox access gateway listening on port ${port}`),
);
