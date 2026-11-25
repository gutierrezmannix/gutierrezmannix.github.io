// Full class: one teacher, three students.
// Demo mode (data in the browser):   NODE_PATH=$(npm root -g) node clicker/tests/e2e-demo.cjs [downloadDir]
// Real Firebase code + rules against the local emulators (each person in their own browser):
//   EMU=8080 FIREBASE_JS=<node_modules/firebase> node clicker/tests/e2e-demo.cjs [downloadDir]
//   (run inside `firebase emulators:exec --only firestore,auth` with clicker/firestore.rules)
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
let fails = 0;
const errors = [], tlog = [];
const ok = (c, m) => { if (c) console.log("  ok  " + m); else { fails++; console.log("  FAIL " + m); } };

(async () => {
  await new Promise(r => server.listen(0, r));
  const EMU = process.env.EMU || "";
  const base = `http://127.0.0.1:${server.address().port}/clicker/`;
  const Q = EMU ? "?emu=" + EMU : "?demo";
  const browser = await chromium.launch();
  const mkCtx = async () => {
    const c = await browser.newContext({ acceptDownloads: true });
    await c.route(/fonts\.(googleapis|gstatic)\.com\/(css|s)/, r => r.abort());
    if (EMU) await c.route(/www\.gstatic\.com\/firebasejs\/10\.12\.2\/(.+)$/, r => {
      const f = path.join(process.env.FIREBASE_JS, r.request().url().split("/").pop());
      r.fulfill({ status: 200, contentType: "text/javascript", body: fs.readFileSync(f) });
    });
    return c;
  };
  const ctx = await mkCtx();
  const page = async (url, label) => {
    const p = await (EMU && label !== "teacher" ? await mkCtx() : ctx).newPage();
    p.on("pageerror", e => errors.push(label + ": " + e.message));
    if (label === "teacher") p.on("console", m => { if (m.type() === "log") tlog.push(m.text()); });
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(label + " console: " + m.text()); });
    await p.goto(url);
    return p;
  };
  const T = await page(base + Q + "#teacher", "teacher");
  await T.click("[data-act=signin]");
  await T.waitForSelector("[data-act=new]");
  if (!EMU) ok(await T.locator(".qz-title", { hasText: "Federalism check (sample)" }).count() === 1, "sample quiz is listed");

  // --- build a quiz: MC with 4 s timer, text (no timer), opinion with 3 s timer
  await T.click("[data-act=new]");
  await T.fill("#edTitle", "Timer test");
  await T.fill("#edCourse", "POLS 2305 · 01");
  await T.fill("[data-ef=revealSeconds]", "2");
  let card = T.locator(".qcard").nth(0);
  await card.locator("textarea.qt").fill("Which amendment reserves powers to the states?");
  for (const [j, v] of ["First", "Tenth", "Fourteenth", "22nd"].entries()) await card.locator(`[data-of="${j}"]`).fill(v);
  await card.locator('[data-oc="1"]').check();
  await card.locator("[data-qf=points]").fill("2");
  await card.locator("[data-qf=seconds]").fill("4");
  await T.click("[data-ea=addtext]");
  card = T.locator(".qcard").nth(1);
  await card.locator("textarea.qt").fill("Name the 1819 case that upheld the national bank.");
  await card.locator("[data-qf=accepted]").fill("McCulloch v. Maryland\nMcCulloch");
  await card.locator("[data-qf=points]").fill("3");
  await card.locator("[data-qf=seconds]").fill("0");
  await T.click("[data-ea=addmc]");
  card = T.locator(".qcard").nth(2);
  await card.locator("textarea.qt").fill("Who should run border security?");
  await card.locator("[data-qf=opinion]").check();
  card = T.locator(".qcard").nth(2);
  for (const [j, v] of ["Federal", "State", "Shared", "Not sure"].entries()) await card.locator(`[data-of="${j}"]`).fill(v);
  await card.locator("[data-qf=seconds]").fill("3");
  ok((await T.locator("#edSave .status").innerText()).includes("6 points"), "editor totals 6 points");
  await T.click("[data-ea=saveact]");
  try { await T.waitForSelector(".code-box .c", { timeout: 20000 }); }
  catch (e) {
    console.log("STUCK teacher page:\n" + (await T.locator("#tcMain").innerText()).slice(0, 300));
    if (EMU) {
      const get = async u => (await fetch("http://127.0.0.1:" + EMU + "/v1/projects/demo-clicker/databases/(default)/documents/" + u, { headers: { Authorization: "Bearer owner" } })).text();
      console.log("PAGE STATE:", await T.evaluate(() => JSON.stringify({ view: window.__clickerState.view, live: window.__clickerState.live, err: window.__clickerState.err, user: !!window.__clickerState.user })));
      console.log("LIVE DOC:", (await get("clickerLive/state")).slice(0, 400));
      console.log("TEACHER LOG:\n  " + tlog.join("\n  "));
      console.log("RUNS:", (await get("clickerRuns")).slice(0, 300));
      console.log("QUIZZES:", (await get("clickerQuizzes")).slice(0, 200));
    }
    throw e;
  }
  const code = (await T.locator(".code-box .c").innerText()).trim();
  ok(/^[A-Z]{4}$/.test(code), "projector shows room code " + code);

  // --- students join
  const S = [];
  for (const [i, name] of ["Ana Garza", "Luis Treviño", "Sofía Ramírez"].entries()) {
    const p = await page(base + Q, "student" + i);
    await p.waitForSelector("#joinForm");
    await p.fill("#jName", name);
    await p.fill("#jId", "2050000" + i);
    if (i === 0) {
      await p.fill("#jCode", "ZZZZ");
      await p.click("#jGo");
      await p.waitForSelector("#jErr:not([hidden])");
      ok((await p.locator("#jErr").innerText()).includes("doesn't match"), "wrong room code is refused");
    }
    await p.fill("#jCode", code);
    await p.click("#jGo");
    await p.waitForSelector("text=You're in");
    S.push(p);
  }
  await T.waitForFunction(() => document.querySelector(".joined-n") && document.querySelector(".joined-n").textContent === "3");
  ok(true, "projector counts 3 joined");

  // --- Q1: timed MC
  await T.click("[data-live=primary]");
  await S[0].waitForSelector(".tile[data-choice]");
  ok(await S[0].locator(".cd-n").count() === 1, "phone shows a countdown");
  await S[0].click('.tile[data-choice="1"]');
  await S[1].click('.tile[data-choice="0"]');
  await T.waitForFunction(() => /2 of 3/.test(document.querySelector(".answered")?.textContent || ""));
  ok(true, "projector shows 2 of 3 answered");
  // pause for a moment past the deadline: nothing should move
  await T.click("[data-live=pause-timer]");
  await T.waitForTimeout(4500);
  ok(await S[0].locator(".tile[data-choice]").count() === 4, "paused timer keeps voting open");
  await T.click("[data-live=pause-timer]");
  await S[0].waitForSelector(".screen.ok", { timeout: 8000 });
  ok(true, "timer ran out → answer screen by itself");
  ok(/Oops!/.test(await S[1].locator(".screen.no").innerText()) && /Tenth/.test(await S[1].locator(".screen.no .key").innerText()), "wrong answer shows Oops with the correct answer");
  ok(await S[2].locator(".screen.wait").count() === 1, "no answer shows No answer");
  ok((await S[0].locator(".screen.ok").innerText()).includes("Tenth"), "phone names the right answer");
  ok(await T.locator(".popt.right").count() === 1, "projector highlights the right option");

  // --- Q2 opens by itself after 2 s
  await S[0].waitForSelector("#tAns", { timeout: 6000 });
  ok(true, "next question opened by itself");
  await S[0].fill("#tAns", "mcculloch v. Maryland");
  await S[0].click("#tGo");
  await S[0].waitForSelector("text=Sent ✓");
  await S[1].fill("#tAns", "Marbury");
  await S[1].click("#tGo");
  await S[1].waitForSelector("text=Sent ✓");
  await T.waitForFunction(() => /2 of 3/.test(document.querySelector(".answered")?.textContent || ""));
  await T.waitForTimeout(1500);
  ok(await S[0].locator("#tAns").count() === 1, "question without a timer waits for you");
  await T.click("[data-live=primary]"); // close
  await T.click("[data-live=primary]"); // reveal
  await S[0].waitForSelector(".screen.ok");
  ok(await S[1].locator(".screen.no").count() === 1, "text answer graded automatically");
  ok(await T.locator(".textlist div.right").count() === 1, "projector lists the matching answer");
  await T.click("[data-live=primary]"); // next

  // --- Q3 timed opinion; last question → ends by itself
  await S[0].waitForSelector(".tile[data-choice]");
  await S[0].click('.tile[data-choice="0"]');
  await S[1].click('.tile[data-choice="1"]');
  await S[0].waitForSelector(".screen.info", { timeout: 8000 });
  ok((await S[0].locator(".screen.info").innerText()).includes("Counted"), "opinion answer is counted");
  await S[0].waitForSelector(".score-big", { timeout: 8000 });
  const sc = await Promise.all(S.map(p => p.locator(".score-big").innerText().catch(() => "")));
  ok(sc[0] === "6 / 6" && sc[1].startsWith("1 /"), "final phone scores " + sc.join(", "));
  await T.waitForSelector("text=Quiz complete");
  ok(true, "projector shows Quiz complete");

  // --- results + override + Excel
  await T.click("[data-live=results]");
  await T.waitForSelector("table");
  const totals = await T.locator("td.score").allInnerTexts();
  ok(totals.join(",") === "6,1,0", "results totals (Ana, Luis, Sofía) " + totals.join(","));
  await T.locator("tr", { hasText: "Luis" }).locator("button.cell").nth(1).click();
  await T.click(".modal .btn.go");
  await T.waitForFunction(() => [...document.querySelectorAll("td.score")].map(x => x.textContent).join(",") === "6,4,0");
  ok(true, "giving Luis full points on Q2 updates the total to 4");
  const dl = T.waitForEvent("download");
  await T.click("[data-res=xlsx]");
  const d = await dl;
  const out = path.join(process.argv[2] || "/tmp", d.suggestedFilename());
  await d.saveAs(out);
  ok(/^Timer-test_\d{4}-\d{2}-\d{2}\.xlsx$/.test(d.suggestedFilename()), "Excel file " + d.suggestedFilename());
  console.log("XLSX " + out);

  // --- deactivate
  await T.click("[data-view=quizzes]");
  await T.click(".qz.active [data-act=deactivate]");
  await S[0].waitForSelector("text=No quiz right now");
  ok(true, "after Deactivate phones show No quiz right now");

  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.join(" | ") : ""));
  await browser.close();
  server.close();
  console.log(fails ? `${fails} FAILED` : "all passed");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e.message.split("\n")[0]); console.error("page errors:", errors.join(" | ")); process.exit(1); });
