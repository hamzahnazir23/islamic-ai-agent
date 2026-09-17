import { chromium } from "playwright";
import { execSync } from "child_process";
import { writeFileSync } from "fs";

const BASE = "http://localhost:3000";
const API = "http://localhost:8000";
let fails = 0;
const ok = (l, p, d = "") => { console.log(`  ${p ? "PASS" : "FAIL"}  ${l}${d ? ` — ${d}` : ""}`); if (!p) fails++; };

const email = `scroll-${Date.now()}@example.com`;
const seed = await (await fetch(`${API}/auth/register`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "correct-horse-1" }),
})).json();

// Enough history that the pane is genuinely scrollable.
const lines = [`INSERT INTO conversations (user_id, title) VALUES (${seed.id}, 'Scroll test');`];
for (let i = 0; i < 24; i++) {
  const role = i % 2 === 0 ? "user" : "assistant";
  lines.push(
    `INSERT INTO messages (conversation_id, role, content, status) ` +
    `SELECT id, '${role}', 'Seeded message number ${i} with enough text to take up a line or two on a narrow phone screen.', 'ok' ` +
    `FROM conversations WHERE user_id = ${seed.id} ORDER BY id DESC LIMIT 1;`
  );
}
const sqlPath = `${process.env.SHOTS_DIR}/../scroll-seed.sql`;
writeFileSync(sqlPath, lines.join("\n"), "utf8");
execSync(`psql -q -v ON_ERROR_STOP=1 -d islamic_ai -f ${sqlPath}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`);
await page.fill("#email", email);
await page.fill("#password", "correct-horse-1");
await page.getByRole("button", { name: /log in/i }).click();
await page.waitForURL("**/chat");
await page.waitForSelector("#composer");

await page.getByRole("button", { name: "Open menu" }).click();
await page.getByRole("dialog", { name: "Menu" }).waitFor();
await page.getByRole("button", { name: "Scroll test", exact: true }).click();
await page.waitForTimeout(1500);

const PANE = ".scroll-area.absolute";

const msgCount = () => page.locator(".msg").count();

/** Seeded history already contains "Cited from" badges, so a reply must be
 *  detected by the message count growing, not by a selector appearing. */
async function waitForReply(before, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await msgCount()) >= before + 2) return true;
    await page.waitForTimeout(300);
  }
  return false;
}

/** Smooth scrolling takes about 750ms over a long pane; polling until the
 *  position stops moving avoids a brittle fixed delay. */
async function waitForScrollSettle(timeout = 4000) {
  const deadline = Date.now() + timeout;
  let last = -1;
  while (Date.now() < deadline) {
    const top = await page.evaluate((sel) => Math.round(document.querySelector(sel).scrollTop), PANE);
    if (top === last) return top;
    last = top;
    await page.waitForTimeout(200);
  }
  return last;
}
const metrics = () => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  return { top: Math.round(el.scrollTop), h: el.scrollHeight, client: el.clientHeight,
           fromBottom: Math.round(el.scrollHeight - el.scrollTop - el.clientHeight) };
}, PANE);

let m = await metrics();
ok("opens a saved conversation scrolled to the latest message", m.fromBottom <= 5, JSON.stringify(m));

// --- scrolled up: an arriving reply must not yank the view down ---
await page.evaluate((sel) => { document.querySelector(sel).scrollTop = 0; }, PANE);
await page.waitForTimeout(400);
ok("scroll-to-latest button appears when scrolled up",
  await page.getByRole("button", { name: "Scroll to latest message" }).isVisible());

// Send from the top of the history, then scroll back up while it thinks.
const beforeFirst = await msgCount();
await page.fill("#composer", "What does the Quran say about mercy?");
await page.getByRole("button", { name: "Send message" }).click();
await page.waitForTimeout(250);
await page.evaluate((sel) => { document.querySelector(sel).scrollTop = 0; }, PANE);
const parked = await metrics();

const got1 = await waitForReply(beforeFirst);
ok("a long conversation can still be continued", got1,
  got1 ? "" : (await page.locator('main [role="alert"]').textContent().catch(() => "no reply, no error")));
await page.waitForTimeout(800);
const afterReply = await metrics();

ok("reply arriving while scrolled up does NOT pull the view down",
  Math.abs(afterReply.top - parked.top) < 60,
  `parked=${parked.top} after=${afterReply.top}`);

// --- near the bottom: new content should be followed ---
await page.getByRole("button", { name: "Scroll to latest message" }).click();
await waitForScrollSettle();
const pinned = await metrics();
ok("scroll-to-latest button returns to the bottom", pinned.fromBottom <= 5, JSON.stringify(pinned));

const beforeSecond = await msgCount();
await page.fill("#composer", "And what about gratitude?");
await page.getByRole("button", { name: "Send message" }).click();
const got2 = await waitForReply(beforeSecond);
ok("second reply received", got2);
await waitForScrollSettle();
const followed = await metrics();
ok("new message is followed when already at the bottom", followed.fromBottom <= 40, JSON.stringify(followed));

// --- viewport-height plumbing (real keyboard needs a physical device) ---
const cssVars = await page.evaluate(() => ({
  appHeight: getComputedStyle(document.documentElement).getPropertyValue("--app-height").trim(),
  kbInset: getComputedStyle(document.documentElement).getPropertyValue("--kb-inset").trim(),
  keyboardAttr: document.documentElement.dataset.keyboard,
}));
ok("visual-viewport height is applied to the shell", !!cssVars.appHeight, JSON.stringify(cssVars));

await page.locator("#composer").focus();
await page.waitForTimeout(400);
const composerVisible = await page.evaluate(() => {
  const r = document.querySelector("#composer").getBoundingClientRect();
  return { bottom: Math.round(r.bottom), innerH: window.innerHeight, ok: r.bottom <= window.innerHeight + 1 };
});
ok("composer stays in view when focused", composerVisible.ok, JSON.stringify(composerVisible));

const finalErr = await page.locator('main [role="alert"]').textContent().catch(() => null);
ok("no error banner left on screen", finalErr === null, finalErr || "");

await browser.close();
console.log(`\n${fails === 0 ? "ALL SCROLL CHECKS PASSED" : `${fails} SCROLL CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
