// Scoring rules shared by the teacher page and the student phones.
// Pure functions only, so they can be tested with node.

export const LETTERS = "ABCDEFGHIJ";

// Text answers are compared after this cleanup: no capitals, no accents,
// no punctuation, single spaces. "Tenth  Amendment!" == "tenth amendment".
export function norm(s) {
  return String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function acceptedList(q) {
  return (q.accepted || []).map(a => String(a).trim()).filter(a => norm(a));
}

// How a question is graded: "key" (automatic), "opinion" (any answer earns
// the points) or "manual" (text question with no accepted answers).
export function kindOf(q) {
  if (q.opinion) return "opinion";
  if (q.type === "text" && !acceptedList(q).length) return "manual";
  return "key";
}

export function pts(q) {
  const p = Number(q && q.points);
  return Number.isFinite(p) && p >= 0 ? p : 1;
}

export function answered(ans) {
  if (!ans) return false;
  if (ans.choice != null && ans.choice !== "") return true;
  return String(ans.text || "").trim() !== "";
}

// status: right | wrong | missing | counted (opinion) | pending (needs hand grading)
export function autoMark(q, ans) {
  const full = pts(q);
  if (!answered(ans)) return { status: "missing", points: 0 };
  if (q.opinion) return { status: "counted", points: full };
  if (q.type === "text") {
    const acc = acceptedList(q).map(norm);
    if (!acc.length) return { status: "pending", points: 0 };
    return acc.includes(norm(ans.text)) ? { status: "right", points: full } : { status: "wrong", points: 0 };
  }
  return Number(ans.choice) === Number(q.correct) ? { status: "right", points: full } : { status: "wrong", points: 0 };
}

// A teacher override is a number of points for one student on one question.
export function mark(q, ans, override) {
  const a = autoMark(q, ans);
  if (override == null || override === "") return a;
  const p = Number(override);
  const full = pts(q);
  const status = p >= full && full > 0 ? "right" : p > 0 ? "partial" : "wrong";
  return { status, points: p, overridden: true };
}

export function maxPoints(questions) {
  return (questions || []).reduce((s, q) => s + pts(q), 0);
}

export function fmtPts(n) {
  const r = Math.round(Number(n) * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

// What the class sees as the right answer after Reveal.
export function keyText(q) {
  const k = kindOf(q);
  if (k === "opinion") return "Opinion (no right answer)";
  if (q.type === "text") return k === "manual" ? "Graded by hand" : acceptedList(q).join(" / ");
  const i = Number(q.correct);
  return LETTERS[i] + " · " + ((q.options || [])[i] || "");
}

export function answerText(q, ans) {
  if (!answered(ans)) return "";
  if (q.type === "text") return String(ans.text);
  return LETTERS[Number(ans.choice)] || "?";
}

export function nameKey(s) { return norm(s); }

// Build the results table for one run.
// students: [{id, name, studentId, device, joinedAt}]
// answers:  [{sid, q, choice?, text?, at}]
// overrides: {"<sid>_<q>": points}
export function buildResults(questions, students, answers, overrides) {
  questions = questions || [];
  overrides = overrides || {};
  const bySid = {};
  for (const a of answers || []) (bySid[a.sid] ||= {})[a.q] = a;
  const devCount = {}, nameCount = {};
  for (const s of students || []) {
    if (s.device) devCount[s.device] = (devCount[s.device] || 0) + 1;
    const nk = nameKey(s.name);
    nameCount[nk] = (nameCount[nk] || 0) + 1;
  }
  const max = maxPoints(questions);
  const rows = (students || []).map(s => {
    const marks = questions.map((q, i) => {
      const ans = (bySid[s.id] || {})[i];
      const m = mark(q, ans, overrides[s.id + "_" + i]);
      return { ...m, answer: answerText(q, ans), at: ans && ans.at };
    });
    const total = marks.reduce((t, m) => t + m.points, 0);
    const flags = [];
    if (s.device && devCount[s.device] > 1) flags.push("Same phone as another name");
    if (nameCount[nameKey(s.name)] > 1) flags.push("Name used twice");
    return {
      sid: s.id, name: s.name, studentId: s.studentId || "", joinedAt: s.joinedAt,
      marks, total, pct: max > 0 ? total / max : 0,
      answeredCount: marks.filter(m => m.status !== "missing").length, flags
    };
  }).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }));
  const perQ = questions.map((q, i) => {
    const n = rows.length;
    const ans = rows.filter(r => r.marks[i].status !== "missing").length;
    const right = rows.filter(r => r.marks[i].status === "right").length;
    const pending = rows.filter(r => r.marks[i].status === "pending").length;
    return { answered: ans, right, pending, n, pctRight: n ? right / n : 0, kind: kindOf(q) };
  });
  const avg = rows.length ? rows.reduce((t, r) => t + r.total, 0) / rows.length : 0;
  let hardest = -1;
  perQ.forEach((p, i) => {
    if (p.kind !== "key") return;
    if (hardest < 0 || p.pctRight < perQ[hardest].pctRight) hardest = i;
  });
  return { rows, perQ, max, avg, hardest, pending: perQ.reduce((t, p) => t + p.pending, 0) };
}

// The answer key that goes to the phones when the teacher presses Reveal.
export function publicKey(q) {
  return {
    type: q.type, points: pts(q), opinion: !!q.opinion,
    correct: q.type === "mc" && !q.opinion ? Number(q.correct) : null,
    accepted: q.type === "text" && !q.opinion ? acceptedList(q) : [],
    label: keyText(q)
  };
}

// Score a phone can work out by itself from the revealed keys.
export function phoneScore(keys, myAnswers) {
  let got = 0, max = 0, pending = 0;
  for (const k of Object.keys(keys || {})) {
    const key = keys[k];
    max += pts(key);
    const m = autoMark(key, (myAnswers || {})[k]);
    if (m.status === "pending") pending += pts(key);
    got += m.points;
  }
  return { got, max, pending };
}

export function makeCode(rand = Math.random) {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no I, L, O
  let s = "";
  for (let i = 0; i < 4; i++) s += A[Math.floor(rand() * A.length)];
  return s;
}

export function randomId(n = 20, rand = Math.random) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues && rand === Math.random) {
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    for (let i = 0; i < n; i++) s += A[b[i] % A.length];
    return s;
  }
  for (let i = 0; i < n; i++) s += A[Math.floor(rand() * A.length)];
  return s;
}

export function shortName(name) {
  const p = String(name || "").trim().split(/\s+/);
  if (p.length < 2) return p[0] || "";
  return p[0] + " " + p[p.length - 1][0] + ".";
}

// Whole seconds between lo and hi; blank or invalid gives the default.
export function secs(v, lo, hi, dflt) {
  if (v === "" || v == null) return dflt;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}

export function clock(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
}

// Time left on a countdown {seconds, endsAt, paused, remaining}.
export function timeLeft(t, now) {
  if (!t) return null;
  const full = Math.max(0, Number(t.seconds) || 0) * 1000;
  const left = t.paused ? Number(t.remaining) || 0 : Number(t.endsAt) - now;
  return Math.max(0, Math.min(full || left, left));
}

// Make a quiz safe to store: trims text, clamps options, fixes points.
export function cleanQuiz(q) {
  const questions = (q.questions || []).map(x => {
    const type = x.type === "text" ? "text" : "mc";
    const out = { id: x.id || randomId(8), type, text: String(x.text || "").trim(), points: pts(x), opinion: !!x.opinion, seconds: secs(x.seconds, 0, 3600, 0) };
    if (type === "mc") {
      out.options = (x.options || []).map(o => String(o || "").trim()).slice(0, 6);
      while (out.options.length < 2) out.options.push("");
      const c = Number(x.correct);
      out.correct = Number.isInteger(c) && c >= 0 && c < out.options.length ? c : null;
    } else {
      out.accepted = acceptedList(x);
    }
    return out;
  });
  return {
    title: String(q.title || "").trim() || "Untitled quiz",
    course: String(q.course || "").trim(),
    needCode: q.needCode !== false,
    showText: q.showText !== false,
    autoNext: q.autoNext !== false,
    revealSeconds: secs(q.revealSeconds, 2, 300, 8),
    questions
  };
}

// Problems that would stop a quiz from working in class.
export function problems(quiz) {
  const out = [];
  if (!quiz.questions.length) out.push("Add at least one question.");
  quiz.questions.forEach((q, i) => {
    const n = "Question " + (i + 1);
    if (!q.text) out.push(n + " has no text.");
    if (q.type === "mc") {
      if (q.options.some(o => !o)) out.push(n + " has an empty option.");
      if (!q.opinion && q.correct == null) out.push(n + " needs a correct answer (or mark it as an opinion question).");
    }
  });
  return out;
}
