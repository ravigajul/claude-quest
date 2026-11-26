// Claude Quest regression tests.
// Plays the game in a headless browser (jsdom) and checks that nothing that worked before is broken.
// Run: npm install && npm test
"use strict";
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const WORLDS = ["Office", "Heist", "Academy"];
const SKINS = { Office: "office", Heist: "heist", Academy: "wizard" };
const BOSS_CARDS = ["Specific goal", "Check every claim", "Invite pushback", "Skills for repeat"];
const TOTALS = /\bof (18|21|50|100)\b|Wave \d+ of \d+/;

function boot(opts = {}) {
  const vc = new VirtualConsole(); // canvas is not implemented in jsdom; ignore that noise
  const dom = new JSDOM(HTML, {
    runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: opts.motion ? false : true });
      w.scrollTo = () => {};
      if (opts.storage) for (const [k, v] of Object.entries(opts.storage)) w.localStorage.setItem(k, v);
    },
  });
  const w = dom.window, d = w.document, errs = [];
  w.addEventListener("error", e => errs.push(e.message));
  const buttons = () => [...d.querySelectorAll("button")];
  const btn = t => buttons().find(b => b.textContent.includes(t));
  const click = t => { const b = btn(t); if (!b) throw new Error(`No button "${t}". Seen: ${buttons().map(x => x.textContent.slice(0, 25)).join(" | ")}`); b.click(); };
  const text = () => d.body.textContent;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const T = opts.motion ? 4500 : 20;
  return { w, d, errs, btn, click, text, wait, T, dom };
}

function pickWorld(g, name) {
  const card = [...g.d.querySelectorAll(".world")].find(b => b.textContent.includes("The " + name));
  if (!card) throw new Error("World card not found: " + name);
  card.click();
}
const perfect = g => g.text().includes("Perfect run");
function goHome(g) { g.d.getElementById("pz").click(); (g.btn("Save and go home") || g.btn("Go home")).click(); }
function next(g) { const b = g.btn("Next:") || g.btn("Wait. A new message"); if (!b) throw new Error("No next button"); b.click(); }

// Level players. They pick the best answer by position, which is the same in every world.
async function playBuild(g) {
  for (const grp of g.d.querySelectorAll(".slot .opts")) { const bs = [...grp.querySelectorAll("button:not([disabled])")]; if (bs.length) bs[bs.length - 1].click(); }
  g.click("Run it"); await g.wait(g.T);
}
async function playSpot(g, bugs) {
  const lines = [...g.d.querySelectorAll(".tline")];
  bugs.forEach(i => lines[i].click());
  [...g.d.querySelectorAll("button.btn")].pop().click();
  if (g.btn("Answer")) { g.d.querySelectorAll(".opt")[1].click(); g.click("Answer"); }
}
async function playRescue(g) {
  for (let t = 0; t < 2; t++) {
    const opts = [...g.d.querySelectorAll(".opts .opt")]; opts[opts.length - 1].click();
    await g.wait(g.T);
    g.click(t === 0 ? "Keep going" : "See results");
  }
}
async function playPick(g) {
  for (let k = 0; k < 5; k++) { g.d.querySelectorAll(".tcard")[k].click(); g.click(k < 4 ? "Next job" : "See results"); }
}
async function playBoss(g) {
  for (const n of BOSS_CARDS) [...g.d.querySelectorAll(".tcard")].find(b => b.textContent.includes(n)).click();
  g.click("Start the boss");
  for (const n of BOSS_CARDS) {
    [...g.d.querySelectorAll(".tcard")].find(b => b.textContent.includes(n)).click();
    await g.wait(g.T > 100 ? 1400 : 0);
    g.click(g.btn("Next wave") ? "Next wave" : "See what happened");
  }
}
async function playWorld(g, world, onStep) {
  pickWorld(g, world); onStep && onStep("home");
  const results = [];
  g.d.querySelector(".lvl").click(); onStep && onStep("L0");
  await playBuild(g); results.push(perfect(g)); next(g); onStep && onStep("L1");
  await playBuild(g); results.push(perfect(g)); next(g); onStep && onStep("L2");
  await playSpot(g, [2, 4, 6]); results.push(perfect(g)); next(g); onStep && onStep("L3");
  await playRescue(g); results.push(perfect(g)); next(g); onStep && onStep("L4");
  await playPick(g); results.push(perfect(g)); next(g); onStep && onStep("L5");
  await playBoss(g); results.push(perfect(g)); next(g); onStep && onStep("L6");
  await playSpot(g, [3, 5]); results.push(perfect(g));
  return results;
}

// ---------- tests ----------
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

for (const world of WORLDS) {
  test(`${world}: every level plays to a perfect run with no errors`, async () => {
    const g = boot(); await g.wait(50);
    const r = await playWorld(g, world);
    assert(r.length === 7 && r.every(Boolean), `Perfect runs: ${r.join(",")}`);
    assert(g.errs.length === 0, "JS errors: " + g.errs.join("; "));
  });
  test(`${world}: no screen shows totals, and the signature is always there`, async () => {
    const g = boot(); await g.wait(50);
    await playWorld(g, world, step => {
      assert(!TOTALS.test(g.text()), `Totals visible on ${step}: ${(g.text().match(TOTALS) || [])[0]}`);
      assert(/By Ravi Gajul, built with Claude/.test(g.d.getElementById("sig").textContent), `Signature missing on ${step}`);
    });
  });
  test(`${world}: uses its own skin`, async () => {
    const g = boot(); await g.wait(50);
    assert(g.d.documentElement.getAttribute("data-skin") === "picker", "Picker should use the neutral skin");
    pickWorld(g, world);
    assert(g.d.documentElement.getAttribute("data-skin") === SKINS[world], "Wrong skin for " + world);
  });
}

test("Animated mode plays a full world with no errors", async () => {
  const g = boot({ motion: true }); await g.wait(100);
  const r = await playWorld(g, "Heist");
  assert(r.every(Boolean) && g.errs.length === 0, `Runs ${r.join(",")} errors ${g.errs.join(";")}`);
});

test("Each world has its own puzzles, not just new names", async () => {
  const seen = {};
  for (const world of WORLDS) {
    const g = boot(); await g.wait(50); pickWorld(g, world);
    const grab = () => g.d.querySelector("h2").textContent + "|" + [...g.d.querySelectorAll(".opt,.tline,.tcard")].map(b => b.textContent).join("|");
    const pages = [];
    g.d.querySelector(".lvl").click(); await playBuild(g); next(g);
    pages.push(grab()); await playBuild(g); next(g);
    pages.push(grab()); await playSpot(g, [2, 4, 6]); next(g);
    pages.push(grab()); await playRescue(g); next(g);
    pages.push(grab());
    seen[world] = pages;
  }
  for (let i = 0; i < 4; i++) {
    const [a, b, c] = WORLDS.map(wd => seen[wd][i]);
    assert(a !== b && b !== c && a !== c, `Level ${i + 1} looks the same in two worlds`);
  }
});

test("Only the first level and a ??? tile show at the start", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Office");
  const lv = [...g.d.querySelectorAll(".lvl")];
  assert(lv.length === 2 && lv[1].textContent.includes("???"), "Expected Level 0 plus one locked ??? tile");
});

test("Pause: resume keeps choices, restart and end clear them, home saves", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Office");
  const pz = g.d.getElementById("pz");
  assert(pz.hidden, "Pause button should be hidden on home");
  g.d.querySelector(".lvl").click();
  assert(!pz.hidden, "Pause button should show inside a level");
  const fmt = () => [...g.d.querySelectorAll(".slot .opts")][1].querySelectorAll("button")[1];
  fmt().click(); g.click("Home (progress saved)");
  g.d.querySelector(".lvl").click();
  assert(fmt().getAttribute("aria-pressed") === "true" && g.text().includes("Picked up where you left off"), "Choice not restored after going home");
  pz.click(); assert(!g.d.getElementById("pzm").hidden, "Pause menu did not open");
  g.click("Restart this level");
  assert(fmt().getAttribute("aria-pressed") === "false", "Restart did not clear the choice");
  fmt().click(); pz.click(); g.click("End level without saving");
  g.d.querySelector(".lvl").click();
  assert(fmt().getAttribute("aria-pressed") === "false", "End level did not clear the choice");
  await playBuild(g); next(g); await playBuild(g); next(g);
  const lines = [...g.d.querySelectorAll(".tline")]; lines[2].click(); lines[4].click();
  pz.click(); g.click("Save and go home");
  [...g.d.querySelectorAll(".lvl")][2].click();
  assert([...g.d.querySelectorAll(".tline")].filter(b => b.getAttribute("aria-pressed") === "true").length === 2, "Spot flags not restored");
  assert(g.errs.length === 0, "JS errors: " + g.errs.join("; "));
});

test("Worlds keep separate saves, and restart only clears the current world", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Office");
  g.d.querySelector(".lvl").click(); await playBuild(g); goHome(g);
  const stars = () => g.d.querySelector(".pill").textContent;
  assert(stars() === "★ 3", "Office stars " + stars());
  g.click("Switch world"); pickWorld(g, "Heist");
  assert(stars() === "★ 0", "Heist should start fresh, got " + stars());
  g.click("Switch world"); pickWorld(g, "Office");
  assert(stars() === "★ 3", "Office progress lost: " + stars());
  g.click("Restart this world"); g.click("Yes, restart");
  assert(stars() === "★ 0", "Restart did not clear Office");
});

test("Weak answers fail softly and drop a blooper", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Academy");
  g.d.querySelector(".lvl").click();
  [...g.d.querySelectorAll(".slot .opts")][1].querySelectorAll("button")[0].click();
  g.click("Run it"); await g.wait(g.T);
  assert(g.text().includes("Blooper"), "No blooper for a weak answer");
});

test("Credits name the creator and link the repo", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Heist");
  assert(g.text().includes("Designed by Ravi Gajul"), "Credit line missing");
  const a = [...g.d.querySelectorAll("a")].find(x => x.textContent.includes("Source on GitHub"));
  assert(a && a.href.includes("github.com/ravigajul/claude-quest"), "GitHub link wrong");
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); console.log("PASS  " + t.name); }
    catch (e) { failed++; console.log("FAIL  " + t.name + "\n      " + e.message); }
  }
  console.log(`\n${tests.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
