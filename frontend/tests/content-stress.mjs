import { chromium } from "playwright";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const API = "http://localhost:8000";
let fails = 0;
const ok = (l, p, d = "") => { console.log(`  ${p ? "PASS" : "FAIL"}  ${l}${d ? ` — ${d}` : ""}`); if (!p) fails++; };

const email = `stress-${Date.now()}@example.com`;
const browser = await chromium.launch();

// Seed a conversation containing the awkward content the UI must survive.
const seed = await (await fetch(`${API}/auth/register`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "correct-horse-1" }),
})).json();

const LONG_TOKEN = "A".repeat(180);
const LONG_URL = "https://example.com/" + "segment-".repeat(30) + "end";
const ARABIC = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ مَٰلِكِ يَوْمِ ٱلدِّينِ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ";
const TABLE = "| Reference | Collection | Grade |\n|---|---|---|\n| Sahih al-Bukhari 1260 | Bukhari | Sahih |\n| Qur'an 2:153 | Qur'an | Revealed |";
const CODE = "```python\ndef very_long_function_name_that_does_not_wrap(argument_one, argument_two, argument_three):\n    return argument_one + argument_two\n```";

// Seed through a SQL file: the fixtures contain newlines and quotes that
// do not survive shell argument quoting reliably.
const rows = [
  ["user", LONG_TOKEN],
  ["assistant", LONG_URL],
  ["assistant", ARABIC],
  ["assistant", TABLE],
  ["assistant", CODE],
];

const esc = (v) => "'" + v.replace(/'/g, "''") + "'";
const sqlPath = `${process.env.SHOTS_DIR}/../seed.sql`;
const { writeFileSync } = await import("fs");
writeFileSync(
  sqlPath,
  `INSERT INTO conversations (user_id, title) VALUES (${seed.id}, 'Content stress');\n` +
    rows
      .map(
        ([role, content]) =>
          `INSERT INTO messages (conversation_id, role, content, status) ` +
          `SELECT id, ${esc(role)}, ${esc(content)}, 'ok' FROM conversations ` +
          `WHERE user_id = ${seed.id} ORDER BY id DESC LIMIT 1;`
      )
      .join("\n"),
  "utf8"
);
execSync(`psql -q -v ON_ERROR_STOP=1 -d islamic_ai -f ${sqlPath}`);

for (const vp of [{ w: 320, h: 568 }, { w: 390, h: 844 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", "correct-horse-1");
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("**/chat");
  await page.waitForSelector("#composer");

  // Open the seeded conversation.
  if (vp.w < 768) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog", { name: "Menu" }).waitFor();
  }
  await page.getByRole("button", { name: "Content stress", exact: true }).click();
  await page.waitForTimeout(1200);

  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    return { over: de.scrollWidth > de.clientWidth + 1, sw: de.scrollWidth, cw: de.clientWidth };
  });
  ok(`${vp.w}px: no page-level horizontal scroll`, !overflow.over, `${overflow.sw} vs ${overflow.cw}`);

  const bubbles = await page.evaluate(() => {
    const de = document.documentElement;
    return [...document.querySelectorAll(".msg")].map((el) => ({
      right: Math.round(el.getBoundingClientRect().right),
      within: el.getBoundingClientRect().right <= de.clientWidth + 1,
      dir: el.getAttribute("dir"),
      hasPre: !!el.querySelector("pre"),
      text: (el.textContent || "").slice(0, 22),
    }));
  });
  ok(`${vp.w}px: every message bubble within viewport`,
    bubbles.every((b) => b.within),
    bubbles.filter((b) => !b.within).map((b) => `${b.text}@${b.right}`).join(", "));

  ok(`${vp.w}px: Arabic message rendered RTL`,
    bubbles.some((b) => b.dir === "rtl"),
    bubbles.map((b) => b.dir).join(","));

  ok(`${vp.w}px: code fence rendered as <pre>`, bubbles.some((b) => b.hasPre));

  const preScrolls = await page.evaluate(() => {
    const pre = document.querySelector(".msg pre");
    if (!pre) return null;
    const cs = getComputedStyle(pre);
    return { overflowX: cs.overflowX, scrollable: pre.scrollWidth > pre.clientWidth };
  });
  ok(`${vp.w}px: wide code scrolls inside its bubble`,
    preScrolls?.overflowX === "auto", JSON.stringify(preScrolls));

  await page.screenshot({ path: `${process.env.SHOTS_DIR}/${vp.w}-content-stress.png`, fullPage: false });
  await ctx.close();
}

await browser.close();
console.log(`\n${fails === 0 ? "ALL CONTENT CHECKS PASSED" : `${fails} CONTENT CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
