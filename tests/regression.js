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
    runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "https://claude-quest.test/",
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
  // Visible game text only. body.textContent would include the <script> source and hide failures.
  const text = () => ["#app", "#sig", "#pzm", ".ping", ".heat"].map(sel => [...d.querySelectorAll(sel)].map(e => e.textContent).join(" ")).join(" ");
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
  // Tap the last (best) tile in each row. The result page opens by itself a moment later.
  for (const row of g.d.querySelectorAll(".trow")) { const bs = [...row.querySelectorAll("button")]; bs[bs.length - 1].click(); }
  await g.wait(g.T > 100 ? 2600 : 40);
  const chips = [...g.d.querySelectorAll(".ingr")].sort((a, b) => a.dataset.slot - b.dataset.slot);
  for (const c of chips) c.click();
  await g.wait(g.T + (chips.length ? 400 : 0));
}
// Answer each row with pick(tileCount, rowIndex), without waiting for the result.
function answerTiles(g, pick) {
  [...g.d.querySelectorAll(".trow")].forEach((row, k) => { const bs = [...row.querySelectorAll("button")]; bs[pick(bs.length, k)].click(); });
}
async function playSpot(g, bugs) {
  // One line at a time: tap Bug on the flagged lines, Looks fine on the rest.
  for (let k = 0; k < 30; k++) {
    const label = g.d.querySelector(".stream .slot-count");
    if (!label) break;
    const n = parseInt(label.textContent.split(" ")[1], 10) - 1;
    (bugs.includes(n) ? g.d.querySelector(".bug-btn") : g.d.querySelector(".fine-btn")).click();
    await g.wait(g.T > 100 ? 400 : 40);
  }
  const opts = g.d.querySelectorAll(".stream .timed-opts .opt");
  if (opts.length) { opts[1].click(); await g.wait(g.T > 100 ? 400 : 40); }
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

test("Each world plays differently: its own stage, verbs and props", async () => {
  const want = { Office: { run: "Send to Claude", prop: ".doc-bar" }, Heist: { run: "Execute the plan", prop: ".bp-title" }, Academy: { run: "Brew it", prop: ".cauldron" } };
  const checks = {};
  for (const world of WORLDS) {
    const g = boot(); await g.wait(50); pickWorld(g, world);
    g.d.querySelector(".lvl").click();
    const run = g.d.querySelector("button.run");
    assert(run && run.textContent === want[world].run, `${world} run button says "${run && run.textContent}"`);
    assert(g.d.querySelector(want[world].prop), `${world} is missing its stage prop ${want[world].prop}`);
    await playBuild(g); next(g); await playBuild(g); next(g);
    const flag = g.d.querySelector(".stream") ? "stream" : null; checks[world] = g.d.querySelector(".bug-btn") ? g.d.querySelector(".bug-btn").textContent : (flag || "none");
  }
  assert(new Set(Object.values(checks)).size === 3, "Spot-the-bug buttons are the same across worlds: " + JSON.stringify(checks));
});

test("Practice a skill: jump straight to any area without unlocking", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Office");
  const chips = [...g.d.querySelectorAll(".chip.area")];
  assert(chips.length >= 4, "Expected skill area chips, got " + chips.length);
  g.d.querySelector('.chip.area[data-area="3"]').click(); await g.wait(50);
  assert(g.text().includes("Lesson 3"), "Area chip did not open its lesson");
  assert(g.errs.length === 0, "JS errors: " + g.errs.join("; "));
});

test("Heist: no clock, never capped", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Heist");
  g.d.querySelector(".lvl").click(); await playBuild(g); next(g);
  assert(!g.d.querySelector(".heat"), "Heist should have no clock");
  await g.wait(800);
  await playBuild(g);
  assert(g.text().includes("Perfect run"), "Slow Heist run should still be perfect");
  assert(g.errs.length === 0, "JS errors: " + g.errs.join("; "));
});

test("Heist: finishing gives a clean getaway", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Heist");
  g.d.querySelector(".lvl").click(); await playBuild(g); next(g); await playBuild(g);
  assert(g.text().includes("Clean getaway"), "No clean getaway note");
});

test("Office: inbox pings arrive, and good calls earn Inbox zero", async () => {
  const g = boot({ storage: { cq_fast_inbox: "1" } }); await g.wait(50); pickWorld(g, "Office");
  g.d.querySelector(".lvl").click(); await playBuild(g); next(g);
  await g.wait(400);
  let p = g.d.querySelector(".ping"); assert(p, "First ping did not arrive");
  // Level 1 pings: index 2 (Claude can) and 3 (you decide)
  [...p.querySelectorAll("button")].find(b => b.textContent.includes("Give it to Claude")).click();
  await g.wait(300);
  p = [...g.d.querySelectorAll(".ping")].find(x => x.querySelector("button"));
  assert(p, "Second ping did not arrive");
  [...p.querySelectorAll("button")].find(b => b.textContent.includes("I'll handle it")).click();
  await playBuild(g);
  assert(g.text().includes("Inbox: 2 of 2 calls right") && g.text().includes("Inbox zero"), "Inbox result missing");
});

test("Academy: ingredients go in by hand, and the right order earns Master Brewer", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Academy");
  g.d.querySelector(".lvl").click(); await playBuild(g);
  assert(!g.d.querySelector(".ingr"), "Tutorial should skip the brewing step");
  next(g);
  answerTiles(g, n => n - 1); await g.wait(60);
  const chips = [...g.d.querySelectorAll(".ingr")];
  assert(chips.length === 3, "Expected 3 ingredients, got " + chips.length);
  chips.sort((a, b) => a.dataset.slot - b.dataset.slot).forEach(c => c.click());
  await g.wait(400);
  assert(g.text().includes("Master brew") && g.text().includes("Master Brewer"), "Master brew not recognized");
  g.click("Play again");
  answerTiles(g, n => n - 1); await g.wait(60);
  [...g.d.querySelectorAll(".ingr")].sort((a, b) => b.dataset.slot - a.dataset.slot).forEach(c => c.click());
  await g.wait(400);
  assert(g.text().includes("Claude copes with any order") && g.text().includes("Perfect run"), "Wrong order should still pass, with an honest note");
});

test("Each world has its own anime-style coach, named at the start; the result page gives one lesson", async () => {
  const names = { Office: "Mina", Heist: "Kite", Academy: "Sora" };
  for (const world of WORLDS) {
    const g = boot(); await g.wait(50); pickWorld(g, world);
    g.d.querySelector(".lvl").click(); await playBuild(g); next(g);
    assert(g.d.querySelector("h3").textContent.startsWith("Lesson 1"), world + ": level label should say Lesson");
    const c = g.d.querySelector(".coach");
    assert(c && c.querySelector("svg.fsvg"), world + ": no coach figure at level start");
    assert(c.textContent.includes(names[world]), world + ": coach should be " + names[world] + ", got " + c.textContent.slice(0, 30));
    await playBuild(g);
    assert(g.d.querySelector(".rpage"), world + ": result should be its own page");
    assert(!g.d.querySelector(".arena"), world + ": game screen should be gone behind the result");
    assert(g.text().includes("Remember this") && g.d.querySelector(".lesson-big"), world + ": no single lesson on the result page");
    const det = g.d.querySelector("details.why-more");
    assert(det && !det.open, world + ": details should start folded");
  }
});

test("A floating coach points at the next row, then fades as players learn", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Office");
  g.d.querySelector(".lvl").click();
  assert(g.d.querySelector(".floater .gsay") && g.d.querySelector(".floater .gsay").textContent === "Tap one tile", "Lesson 1 should show the floating coach");
  await playBuild(g); next(g);
  assert(g.d.querySelector(".floater") && !g.d.querySelector(".floater").hidden, "Lesson 2 should still show the coach");
  await playBuild(g); next(g);
  await playSpot(g, [2, 4, 6]); next(g);
  assert(!g.d.querySelector(".floater") || g.d.querySelector(".floater").hidden, "By lesson 4 the coach should be gone");
  assert(g.btn("Need help?"), "A Need help link should bring her back");
  g.click("Need help?");
  assert(g.d.querySelector(".floater") && !g.d.querySelector(".floater").hidden, "Need help should call the coach back");
});

test("The result opens by itself, with no button to press", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Office");
  g.d.querySelector(".lvl").click(); await playBuild(g); next(g);
  answerTiles(g, () => 0); await g.wait(60);
  assert(g.d.querySelector(".rpage"), "A weak run should open its result by itself");
  assert(!g.btn("See result"), "There should be no See result button");
});

test("Choice rows are color-coded, and the summary chips match", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Office");
  g.d.querySelector(".lvl").click(); await playBuild(g); next(g);
  const colors = [...g.d.querySelectorAll(".trow")].map(x => x.style.getPropertyValue("--slot"));
  assert(colors.length === 3 && new Set(colors).size === 3, "Rows should each have their own color: " + colors.join(","));
  const chips = [...g.d.querySelectorAll(".slots .slot")].map(x => x.style.getPropertyValue("--slot"));
  assert(chips.join() === colors.join(), "Summary chips should match the row colors");
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
  g.d.querySelector(".lvl").click(); await playBuild(g); next(g); // finish Level 0
  assert(!pz.hidden, "Pause button should show inside a level");
  const tile = (r, k) => g.d.querySelectorAll(".trow")[r].querySelectorAll("button")[k];
  const on = (r, k) => tile(r, k).getAttribute("aria-pressed") === "true";
  tile(1, 1).click();
  g.click("Home (progress saved)");
  [...g.d.querySelectorAll(".lvl")][1].click();
  assert(on(1, 1) && g.text().includes("Picked up where you left off"), "Choice not restored after going home");
  pz.click(); assert(!g.d.getElementById("pzm").hidden, "Pause menu did not open");
  g.click("Restart this level");
  assert(!on(1, 1), "Restart did not clear the choice");
  tile(1, 1).click(); pz.click(); g.click("End level without saving");
  [...g.d.querySelectorAll(".lvl")][1].click();
  assert(!on(1, 1), "End level did not clear the choice");
  await playBuild(g); next(g);
  g.d.querySelector(".fine-btn").click(); await g.wait(40);
  g.d.querySelector(".bug-btn").click(); await g.wait(40);
  pz.click(); g.click("Save and go home");
  [...g.d.querySelectorAll(".lvl")][2].click();
  assert(g.d.querySelector(".slot-count").textContent.startsWith("Line 3 of"), "Spot progress not restored");
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

test("Try again keeps your tiles so you can swap one", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Office");
  g.d.querySelector(".lvl").click(); await playBuild(g); next(g);
  answerTiles(g, () => 0); await g.wait(60);
  g.click("Try again");
  const pressed = [...g.d.querySelectorAll(".trow")].map(r => r.querySelectorAll("button")[0].getAttribute("aria-pressed"));
  assert(pressed.join() === "true,true,true", "Tiles were not kept: " + pressed.join());
  g.d.querySelectorAll(".trow")[0].querySelectorAll("button")[2].click(); await g.wait(60);
  assert(g.d.querySelector(".rpage"), "Swapping a tile should open a new result");
});

test("Weak answers fail softly and drop a blooper", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Academy");
  g.d.querySelector(".lvl").click();
  answerTiles(g, () => 0); await g.wait(120);
  assert(g.text().includes("Blooper"), "No blooper for a weak answer");
});

test("Calm mode: nothing is picked for you, and the result waits for you to finish the row", async () => {
  const g = boot({ storage: { cq_fast_clock: "1" } }); await g.wait(50); pickWorld(g, "Office");
  g.d.querySelector(".lvl").click(); await playBuild(g); next(g);
  await g.wait(600);
  assert(g.d.querySelectorAll(".trow").length === 3 && !g.d.querySelector(".rpage"), "Build moved on without a choice");
  assert(!g.text().includes("Time is up") && !g.text().includes("Pick fast"), "Build still shows time pressure");
  assert(g.errs.length === 0, "JS errors: " + g.errs.join("; "));
});

test("Calm mode: Spot the bug waits for each line, with no time limit", async () => {
  const g = boot({ storage: { cq_fast_clock: "1" } }); await g.wait(50); pickWorld(g, "Office");
  g.d.querySelector(".lvl").click(); await playBuild(g); next(g); await playBuild(g); next(g);
  await g.wait(600);
  assert(g.d.querySelector(".slot-count").textContent.startsWith("Line 1 of"), "Spot moved on without a choice");
  assert(g.errs.length === 0, "JS errors: " + g.errs.join("; "));
});

test("Credits name the creator and link the repo", async () => {
  const g = boot(); await g.wait(50); pickWorld(g, "Heist");
  assert(g.text().includes("Designed by Ravi Gajul"), "Credit line missing");
  const a = [...g.d.querySelectorAll("a")].find(x => x.textContent.includes("Source on GitHub"));
  assert(a && a.href.includes("github.com/ravigajul/claude-quest"), "GitHub link wrong");
  assert(HTML.includes('play:"https://ravigajul.github.io/claude-quest/"'), "Share link should point to GitHub Pages");
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
