import test from "node:test";
import assert from "node:assert/strict";
import { norm, autoMark, mark, buildResults, phoneScore, publicKey, cleanQuiz, problems, kindOf, makeCode, shortName, maxPoints } from "../scoring.js";
import { xlsxBytes, csvText, zip } from "../xlsx.js";

const mc = { type: "mc", text: "Which amendment?", options: ["First", "Tenth", "Fourteenth", "22nd"], correct: 1, points: 2 };
const tx = { type: "text", text: "Name the case", accepted: ["McCulloch v. Maryland", "McCulloch"], points: 3 };
const man = { type: "text", text: "Explain", accepted: [], points: 1 };
const op = { type: "mc", text: "Your view?", options: ["Yes", "No"], correct: null, opinion: true, points: 1 };

test("text matching ignores capitals, accents, punctuation and spaces", () => {
  assert.equal(norm("  McCulloch   v. Maryland!! "), "mcculloch v maryland");
  assert.equal(norm("Peña Nieto"), norm("pena nieto"));
  assert.equal(autoMark(tx, { text: "mcculloch v maryland" }).status, "right");
  assert.equal(autoMark(tx, { text: "MCCULLOCH" }).points, 3);
  assert.equal(autoMark(tx, { text: "Marbury" }).status, "wrong");
});

test("multiple choice, opinion, manual and missing answers", () => {
  assert.deepEqual(autoMark(mc, { choice: 1 }), { status: "right", points: 2 });
  assert.deepEqual(autoMark(mc, { choice: 0 }), { status: "wrong", points: 0 });
  assert.deepEqual(autoMark(mc, null), { status: "missing", points: 0 });
  assert.deepEqual(autoMark(op, { choice: 1 }), { status: "counted", points: 1 });
  assert.deepEqual(autoMark(man, { text: "because" }), { status: "pending", points: 0 });
  assert.equal(kindOf(man), "manual");
  assert.equal(kindOf(op), "opinion");
});

test("teacher overrides win, with partial credit", () => {
  assert.deepEqual(mark(man, { text: "ok" }, 1), { status: "right", points: 1, overridden: true });
  assert.deepEqual(mark(tx, { text: "close" }, 1.5), { status: "partial", points: 1.5, overridden: true });
  assert.deepEqual(mark(mc, { choice: 1 }, 0), { status: "wrong", points: 0, overridden: true });
  assert.equal(mark(mc, { choice: 1 }, null).points, 2);
});

test("results table: totals, per-question stats, flags", () => {
  const qs = [mc, tx, man, op];
  const students = [
    { id: "a", name: "Ana Garza", studentId: "1", device: "d1" },
    { id: "b", name: "Luis Treviño", studentId: "2", device: "d2" },
    { id: "c", name: "ana garza", studentId: "3", device: "d1" }
  ];
  const answers = [
    { sid: "a", q: 0, choice: 1 }, { sid: "a", q: 1, text: "McCulloch" }, { sid: "a", q: 2, text: "x" }, { sid: "a", q: 3, choice: 0 },
    { sid: "b", q: 0, choice: 2 }, { sid: "b", q: 1, text: "Marbury" },
    { sid: "c", q: 3, choice: 1 }
  ];
  const r = buildResults(qs, students, answers, { "a_2": 1 });
  assert.equal(r.max, 7);
  const ana = r.rows.find(x => x.sid === "a");
  assert.equal(ana.total, 7);
  assert.equal(ana.pct, 1);
  const luis = r.rows.find(x => x.sid === "b");
  assert.equal(luis.total, 0);
  assert.equal(r.perQ[0].right, 1);
  assert.equal(r.perQ[3].answered, 2);
  assert.equal(r.pending, 0);
  assert.ok(ana.flags.includes("Same phone as another name"));
  assert.ok(ana.flags.includes("Name used twice"));
  assert.equal(luis.flags.length, 0);
  assert.equal(r.hardest, 0 === r.perQ[0].pctRight ? 0 : r.hardest);
});

test("the phone's own score uses only revealed questions", () => {
  const keys = { 0: publicKey(mc), 1: publicKey(tx), 2: publicKey(man) };
  assert.equal(keys[0].correct, 1);
  assert.deepEqual(keys[1].accepted, ["McCulloch v. Maryland", "McCulloch"]);
  const s = phoneScore(keys, { 0: { choice: 1 }, 1: { text: "mcculloch" }, 2: { text: "essay" } });
  assert.deepEqual(s, { got: 5, max: 6, pending: 1 });
});

test("publicKey never leaks a key for opinion questions", () => {
  const k = publicKey(op);
  assert.equal(k.correct, null);
  assert.equal(k.opinion, true);
});

test("cleanQuiz and problems catch what would break in class", () => {
  const c = cleanQuiz({ title: " ", questions: [
    { type: "mc", text: " Q ", options: ["a", "", "c"], correct: 7, points: "2" },
    { type: "text", text: "T", accepted: ["", " x "], points: -3 }
  ] });
  assert.equal(c.title, "Untitled quiz");
  assert.equal(c.questions[0].text, "Q");
  assert.equal(c.questions[0].correct, null);
  assert.equal(c.questions[0].points, 2);
  assert.deepEqual(c.questions[1].accepted, ["x"]);
  assert.equal(c.questions[1].points, 1);
  const p = problems(c);
  assert.ok(p.some(x => /empty option/.test(x)));
  assert.ok(p.some(x => /needs a correct answer/.test(x)));
  assert.equal(problems(cleanQuiz({ questions: [mc, tx, man, op] })).length, 0);
  assert.equal(maxPoints(cleanQuiz({ questions: [mc, tx] }).questions), 5);
});

test("room codes avoid look-alike letters; names shorten for the projector", () => {
  for (let i = 0; i < 200; i++) assert.match(makeCode(), /^[A-HJKMNP-Z]{4}$/);
  assert.equal(shortName("Ana María Garza"), "Ana G.");
  assert.equal(shortName("Cher"), "Cher");
});

test("xlsx is a valid zip with the expected parts; csv quotes properly", () => {
  const b = xlsxBytes([{ name: "Scores", rows: [[{ v: "Name", bold: true }, "Q1"], ["Ana <&> \"G\"", 2.5]] }, { name: "Scores", rows: [["x"]] }]);
  assert.equal(b[0], 0x50); assert.equal(b[1], 0x4b);
  const txt = new TextDecoder().decode(b);
  assert.ok(txt.includes("xl/worksheets/sheet2.xml"));
  assert.ok(txt.includes("Ana &lt;&amp;&gt; &quot;G&quot;"));
  assert.ok(txt.includes('<sheet name="Scores 2"'));
  assert.equal(csvText([["a,b", 'say "hi"', 3]]), '"a,b","say ""hi""",3');
  assert.ok(zip([{ name: "a.txt", data: "hello" }]).length > 0);
});

import { secs, clock, timeLeft } from "../scoring.js";
test("timers: seconds are whole and bounded; countdown math", () => {
  assert.equal(secs("", 0, 3600, 0), 0);
  assert.equal(secs("45.4", 0, 3600, 0), 45);
  assert.equal(secs(-5, 0, 3600, 0), 0);
  assert.equal(secs(99999, 0, 3600, 0), 3600);
  const c = cleanQuiz({ questions: [{ type: "mc", text: "q", options: ["a", "b"], correct: 0, seconds: "30" }] });
  assert.equal(c.questions[0].seconds, 30);
  assert.equal(c.revealSeconds, 8);
  assert.equal(c.autoNext, true);
  assert.equal(cleanQuiz({ autoNext: false, revealSeconds: 1, questions: [] }).revealSeconds, 2);
  assert.equal(clock(0), "0:00");
  assert.equal(clock(61200), "1:02");
  assert.equal(clock(29001), "0:30");
  assert.equal(timeLeft({ seconds: 30, endsAt: 1000 + 12000 }, 1000), 12000);
  assert.equal(timeLeft({ seconds: 30, endsAt: 1000 + 90000 }, 1000), 30000, "clock skew can't add time");
  assert.equal(timeLeft({ seconds: 30, endsAt: 0 }, 5000), 0);
  assert.equal(timeLeft({ seconds: 30, paused: true, remaining: 7000, endsAt: 0 }, 99999), 7000);
});
