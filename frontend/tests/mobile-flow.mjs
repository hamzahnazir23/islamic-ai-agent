import { chromium, devices } from "playwright";

const BASE = "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR;

const VIEWPORTS = [
  { name: "phone-320 (iPhone SE 1st / small Android)", w: 320, h: 568, mobile: true },
  { name: "phone-375 (iPhone SE 2/3, iPhone 13 mini)", w: 375, h: 667, mobile: true },
  { name: "phone-390 (iPhone 14/15)",                  w: 390, h: 844, mobile: true },
  { name: "phone-430 (iPhone 15 Pro Max)",             w: 430, h: 932, mobile: true },
  { name: "phone-390-landscape",                       w: 844, h: 390, mobile: true },
  { name: "tablet-768 (iPad portrait)",                w: 768, h: 1024, mobile: true },
  { name: "tablet-1024 (iPad landscape)",              w: 1024, h: 768, mobile: true },
  { name: "desktop-1280",                              w: 1280, h: 800, mobile: false },
];

const results = [];
let failures = 0;

function check(vp, label, ok, detail = "") {
  results.push({ vp, label, ok, detail });
  if (!ok) failures++;
}

async function noHorizontalScroll(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    return {
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      overflows: de.scrollWidth > de.clientWidth + 1,
      culprits: [...document.querySelectorAll("*")]
        .filter((el) => el.getBoundingClientRect().right > de.clientWidth + 1)
        .slice(0, 3)
        .map((el) => `${el.tagName}.${(el.className || "").toString().slice(0, 40)}`),
    };
  });
}

async function tapSize(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  }, selector);
}

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: vp.mobile ? 2 : 1,
    userAgent: vp.mobile ? devices["iPhone 13"].userAgent : undefined,
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => {
    const t = m.text();
    // The browser logs a console error for the 401 that /auth/me returns
    // to a signed-out visitor. That response is expected: the session
    // cookie is httpOnly, so the client cannot know to skip the call.
    if (m.type() === "error" && !/401 \(Unauthorized\)/.test(t)) {
      consoleErrors.push(t);
    }
  });

  const email = `pw-${vp.w}-${Date.now()}@example.com`;

  try {
    // ---- LANDING ----
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    let ov = await noHorizontalScroll(page);
    check(vp.name, "landing: no horizontal scroll", !ov.overflows,
      ov.overflows ? `${ov.scrollW}>${ov.clientW} ${ov.culprits.join(", ")}` : "");
    check(vp.name, "landing: both CTAs visible",
      await page.getByRole("link", { name: "Create account" }).first().isVisible() &&
      await page.getByRole("link", { name: "Log in" }).first().isVisible());
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp.w}x${vp.h}-landing.png` });

    // ---- SIGNUP ----
    await page.getByRole("link", { name: "Create account" }).first().click();
    await page.waitForURL("**/signup");
    ov = await noHorizontalScroll(page);
    check(vp.name, "signup: no horizontal scroll", !ov.overflows,
      ov.overflows ? ov.culprits.join(", ") : "");

    const emailBox = await tapSize(page, "#email");
    check(vp.name, "signup: email field >=44px tall", emailBox && emailBox.h >= 44,
      emailBox ? `${emailBox.h}px` : "not found");
    const fontSize = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector("#email")).fontSize));
    check(vp.name, "signup: input font >=16px (no iOS zoom)", fontSize >= 16, `${fontSize}px`);

    // Validation error path
    await page.fill("#email", "not-an-email");
    await page.fill("#password", "short");
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForSelector('[role="alert"]', { timeout: 3000 });
    check(vp.name, "signup: shows validation error", true);

    await page.fill("#email", email);
    await page.fill("#password", "correct-horse-1");
    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL("**/chat", { timeout: 15000 });
    check(vp.name, "signup -> chat redirect", true);

    // ---- CHAT ----
    await page.waitForSelector("#composer", { timeout: 10000 });
    ov = await noHorizontalScroll(page);
    check(vp.name, "chat: no horizontal scroll", !ov.overflows,
      ov.overflows ? ov.culprits.join(", ") : "");

    const composerVisible = await page.evaluate(() => {
      const el = document.querySelector("#composer");
      const r = el.getBoundingClientRect();
      return r.bottom <= window.innerHeight + 1 && r.top >= 0 && r.width > 0;
    });
    check(vp.name, "chat: composer within viewport", composerVisible);

    const sendBtn = await tapSize(page, 'button[aria-label="Send message"]');
    check(vp.name, "chat: send button >=44px", sendBtn && sendBtn.h >= 44 && sendBtn.w >= 44,
      sendBtn ? `${sendBtn.w}x${sendBtn.h}` : "missing");

    // Drawer (mobile only)
    const menuBtn = page.getByRole("button", { name: "Open menu" });
    if (vp.w < 768) {
      check(vp.name, "chat: menu button present", await menuBtn.isVisible());
      await menuBtn.click();
      const dialog = page.getByRole("dialog", { name: "Menu" });
      await dialog.waitFor({ timeout: 3000 });
      check(vp.name, "drawer: opens as dialog", await dialog.isVisible());
      const drawerOv = await noHorizontalScroll(page);
      check(vp.name, "drawer: no horizontal scroll", !drawerOv.overflows);
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden", timeout: 3000 });
      check(vp.name, "drawer: Escape closes it", true);
    } else {
      check(vp.name, "desktop: sidebar visible, no menu button",
        !(await menuBtn.isVisible().catch(() => false)));
    }

    // Send a real message
    await page.fill("#composer", "What does the Quran say about patience?");
    await page.getByRole("button", { name: "Send message" }).click();
    await page.waitForSelector("text=/Cited from|General Sunni|Unable to answer/", { timeout: 60000 });
    check(vp.name, "chat: received an answer", true);

    ov = await noHorizontalScroll(page);
    check(vp.name, "chat with message: no horizontal scroll", !ov.overflows,
      ov.overflows ? ov.culprits.join(", ") : "");
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${vp.w}x${vp.h}-chat.png` });

    // ---- RELOAD: session + conversation persist ----
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#composer", { timeout: 10000 });
    const stillLoggedIn = page.url().includes("/chat");
    check(vp.name, "reload: still authenticated", stillLoggedIn);
    const restored = await page.locator("text=What does the Quran say about patience?").count();
    check(vp.name, "reload: conversation restored", restored > 0, `${restored} match(es)`);

    // ---- DRAFT PRESERVATION ----
    await page.fill("#composer", "an unsent draft");
    await page.waitForTimeout(150);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#composer", { timeout: 10000 });
    const draft = await page.inputValue("#composer");
    check(vp.name, "reload: unsent draft preserved", draft === "an unsent draft", `got "${draft}"`);
    await page.fill("#composer", "");

    // ---- HISTORY REOPEN ----
    if (vp.w < 768) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("dialog", { name: "Menu" }).waitFor();
    }
    const convoBtn = page.locator('nav[aria-label="Saved conversations"] button').first();
    await convoBtn.waitFor({ timeout: 5000 });
    check(vp.name, "history: saved conversation listed", await convoBtn.isVisible());
    await convoBtn.click();
    await page.waitForTimeout(800);
    check(vp.name, "history: reopens conversation",
      (await page.locator("text=What does the Quran say about patience?").count()) > 0);

    // ---- LOGOUT ----
    if (vp.w < 768) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("dialog", { name: "Menu" }).waitFor();
    }
    await page.getByRole("button", { name: /log out/i }).click();
    await page.waitForURL(`${BASE}/`, { timeout: 10000 });
    check(vp.name, "logout: returns to landing", true);

    await page.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
    await page.waitForURL("**/login", { timeout: 10000 });
    check(vp.name, "logout: /chat now redirects to login", true);

    check(vp.name, "no console errors", consoleErrors.length === 0,
      consoleErrors.slice(0, 2).join(" | "));
  } catch (err) {
    check(vp.name, "FLOW COMPLETED", false, String(err).split("\n")[0].slice(0, 160));
  }

  await ctx.close();
}

await browser.close();

// ---- report ----
const byVp = {};
for (const r of results) (byVp[r.vp] ??= []).push(r);
for (const [vp, rows] of Object.entries(byVp)) {
  const bad = rows.filter((r) => !r.ok);
  console.log(`\n${bad.length === 0 ? "PASS" : "FAIL"}  ${vp}   (${rows.length - bad.length}/${rows.length})`);
  for (const r of bad) console.log(`    ✗ ${r.label} ${r.detail ? `— ${r.detail}` : ""}`);
}
console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}  (${results.length} total)`);
process.exit(failures === 0 ? 0 : 1);
