import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let fails = 0;
const ok = (label, pass, detail = "") => {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) fails++;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

// ---- manifest ----
const manifest = await (await page.request.get(`${BASE}/manifest.webmanifest`)).json();
ok("manifest: display standalone", manifest.display === "standalone", manifest.display);
ok("manifest: has name + short_name", !!manifest.name && !!manifest.short_name);
ok("manifest: theme_color set", !!manifest.theme_color, manifest.theme_color);
ok("manifest: background_color set", !!manifest.background_color, manifest.background_color);
ok("manifest: start_url", manifest.start_url === "/", manifest.start_url);
ok("manifest: has 192 and 512 icons",
  manifest.icons.some(i => i.sizes === "192x192") && manifest.icons.some(i => i.sizes === "512x512"));
ok("manifest: has a maskable icon", manifest.icons.some(i => i.purpose === "maskable"));
for (const icon of manifest.icons) {
  const r = await page.request.get(BASE + icon.src);
  ok(`icon reachable: ${icon.src} (${icon.purpose})`, r.status() === 200, `HTTP ${r.status()}`);
}

// ---- head tags ----
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const head = await page.evaluate(() => ({
  manifest: document.querySelector('link[rel="manifest"]')?.getAttribute("href"),
  theme: document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
  apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href"),
  appleCapable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute("content"),
  mobileCapable: document.querySelector('meta[name="mobile-web-app-capable"]')?.getAttribute("content"),
  viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content"),
}));
ok("head: manifest linked", !!head.manifest, head.manifest);
ok("head: theme-color", head.theme === "#065f46", head.theme);
ok("head: apple-touch-icon", !!head.apple, head.apple);
ok("head: web app capable (modern or apple-prefixed)",
  head.appleCapable === "yes" || head.mobileCapable === "yes",
  `apple=${head.appleCapable} mobile=${head.mobileCapable}`);
ok("head: viewport-fit=cover", /viewport-fit=cover/.test(head.viewport || ""), head.viewport);
ok("head: zoom NOT disabled (a11y)",
  !/user-scalable=no/.test(head.viewport || "") && !/maximum-scale=1/.test(head.viewport || ""),
  head.viewport);

// ---- service worker ----
await page.waitForFunction(() => navigator.serviceWorker?.controller !== null || navigator.serviceWorker?.ready, { timeout: 15000 }).catch(()=>{});
const reg = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  return { registered: !!r, scope: r?.scope, active: !!r?.active };
});
ok("service worker: registered", reg.registered, reg.scope);

// Log in and chat, then inspect every cache for private data.
const email = `pwa-${Date.now()}@example.com`;
await page.goto(`${BASE}/signup`);
await page.fill("#email", email);
await page.fill("#password", "correct-horse-1");
await page.getByRole("button", { name: /create account/i }).click();
await page.waitForURL("**/chat");
await page.fill("#composer", "What does the Quran say about charity?");
await page.getByRole("button", { name: "Send message" }).click();
await page.waitForSelector("text=/Cited from|General Sunni|Unable to answer/", { timeout: 60000 });
await page.waitForTimeout(1500);

const cacheAudit = await page.evaluate(async () => {
  const names = await caches.keys();
  const entries = [];
  for (const n of names) {
    const c = await caches.open(n);
    for (const req of await c.keys()) entries.push({ cache: n, url: req.url });
  }
  return { names, entries };
});
console.log(`\n  cache names: ${cacheAudit.names.join(", ") || "(none)"}`);
console.log(`  cached entries: ${cacheAudit.entries.length}`);

const PRIVATE = /\/(auth|ask|conversations|api)(\/|$)/;
const leaked = cacheAudit.entries.filter(e => PRIVATE.test(new URL(e.url).pathname) || new URL(e.url).port === "8000");
ok("service worker: NO authenticated API response cached", leaked.length === 0,
  leaked.map(l => l.url).join(", "));
ok("service worker: /chat shell not precached",
  !cacheAudit.entries.some(e => new URL(e.url).pathname === "/chat"));

// The answer text must not be sitting in any cache.
const answerLeak = await page.evaluate(async () => {
  for (const n of await caches.keys()) {
    const c = await caches.open(n);
    for (const req of await c.keys()) {
      const res = await c.match(req);
      if (!res) continue;
      const ct = res.headers.get("content-type") || "";
      if (!/text|json/.test(ct)) continue;
      const body = await res.text();
      if (/What does the Quran say about charity/i.test(body)) return req.url;
    }
  }
  return null;
});
ok("service worker: answer text absent from all caches", answerLeak === null, answerLeak || "");

// ---- offline fallback ----
// Playwright's context.setOffline does not exercise service-worker
// interception (even a cached route fails with ERR_INTERNET_DISCONNECTED),
// so genuine offline behaviour is tested by stopping the server.
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const { execSync } = await import("child_process");
try { execSync("pkill -f 'next start'"); } catch {}
execSync("sleep 2");

let offlineBody = "";
try {
  await page.goto(`${BASE}/a-page-that-does-not-exist`, { waitUntil: "domcontentloaded", timeout: 15000 });
  offlineBody = (await page.textContent("body")) || "";
} catch (e) {
  offlineBody = `THREW ${String(e).split("\n")[0]}`;
}
ok("offline: fallback page served for an uncached route",
  /You.{0,3}re offline/i.test(offlineBody), offlineBody.replace(/\s+/g, " ").slice(0, 90));
// The previous version of this page was a Next route that shipped correct
// HTML and then died during hydration, so assert the rendered heading is
// actually visible and no framework error replaced it.
ok("offline: page renders (no client-side exception)",
  !/Application error/i.test(offlineBody), offlineBody.replace(/\s+/g, " ").slice(0, 90));
ok("offline: explains a connection is required",
  /internet connection/i.test(offlineBody));

// Assert against the offline page itself, before navigating anywhere else.
const imgOk = await page.evaluate(() => {
  const img = document.querySelector("img");
  return img ? img.complete && img.naturalWidth > 0 : null;
});
ok("offline: page image loads from cache", imgOk === true, String(imgOk));
await page.screenshot({ path: `${process.env.SHOTS_DIR}/offline.png` });

let cachedShell = "";
try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 15000 });
  cachedShell = (await page.textContent("body")) || "";
} catch (e) {
  cachedShell = `THREW ${String(e).split("\n")[0]}`;
}
ok("offline: precached public route still opens",
  /welcome back|log in/i.test(cachedShell), cachedShell.replace(/\s+/g, " ").slice(0, 70));



await browser.close();
console.log(`\n${fails === 0 ? "ALL PWA CHECKS PASSED" : `${fails} PWA CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
