// Teacher page (/clicker/#teacher): quizzes, editor, projector view, results.
import { getStore, DEMO, EMU, toDate } from "./store.js?v=4";
import {
  LETTERS, kindOf, pts, fmtPts, keyText, publicKey, buildResults, makeCode, shortName,
  cleanQuiz, problems, maxPoints, norm, acceptedList, randomId, answered, mark, secs, clock, timeLeft
} from "./scoring.js?v=4";
import { ADMIN_EMAIL, STUDENT_URL } from "./config.js?v=4";
import { xlsxBytes, csvText } from "./xlsx.js?v=4";

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const plural = (n, w) => fmtPts(n) + " " + w + (Number(n) === 1 ? "" : "s");
const when = ts => {
  const d = toDate(ts);
  return d ? d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
};
const day = ts => {
  const d = toDate(ts);
  return d ? d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "";
};
const isoDay = ts => {
  const d = toDate(ts) || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const slug = s => String(s || "quiz").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "quiz";
const DEFAULT_SECONDS = 30;
const newMC = (sec = DEFAULT_SECONDS) => ({ id: randomId(8), type: "mc", text: "", points: 1, seconds: sec, opinion: false, options: ["", "", "", ""], correct: null });
const newText = (sec = DEFAULT_SECONDS) => ({ id: randomId(8), type: "text", text: "", points: 1, seconds: sec, opinion: false, accepted: [] });
const CLIENT = randomId(10); // this browser tab; the last one you pressed a button on runs the timers
const quizMinutes = q => {
  const qs = q.questions || [];
  const t = qs.reduce((a, x) => a + (Number(x.seconds) || 0) + ((Number(x.seconds) || 0) > 0 && q.autoNext !== false ? Number(q.revealSeconds) || 8 : 0), 0);
  return t ? Math.max(1, Math.round(t / 60)) : 0;
};
const typeLabel = q => (q.type === "text" ? "Text" : "Multiple choice") + (q.opinion ? " · opinion" : "");

export async function mountTeacher(root) {
  const store = await getStore();
  const S = {
    user: undefined, view: "quizzes", quizzes: null, runs: null, live: null, err: "",
    edit: null, codes: {},
    liveRunId: null, liveStudents: [], liveAnswers: [],
    resRun: null, resSubId: null, resStudents: [], resAnswers: []
  };
  let subs = [], liveSubs = [], resSubs = [];
  if (EMU) window.__clickerState = S; // tests only (localhost emulator runs)
  const off = list => { list.forEach(u => { try { typeof u === "function" && u(); } catch (e) { /* ignore */ } }); list.length = 0; };
  const isAdmin = u => !!u && (DEMO ? true : String(u.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase());
  const onErr = e => {
    console.error(e);
    S.err = e && e.code === "permission-denied" ? "rules" : "net";
    render();
  };

  // ---------- helpers: toast + modal ----------
  let toastT;
  function toast(msg) {
    let el = document.getElementById("tcToast");
    if (!el) { el = document.createElement("div"); el.id = "tcToast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2800);
  }
  function modal(title, bodyHtml, actions, onMount) {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3><div>${bodyHtml}</div><div class="acts"></div></div>`;
    const close = () => { bg.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    bg.addEventListener("click", e => { if (e.target === bg) close(); });
    const acts = bg.querySelector(".acts");
    (actions || [{ label: "OK" }]).forEach(a => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn " + (a.cls || ""); b.textContent = a.label;
      b.addEventListener("click", async () => { if (a.run) { const keep = await a.run(bg); if (keep === true) return; } close(); });
      acts.appendChild(b);
    });
    document.body.appendChild(bg);
    if (onMount) onMount(bg);
    const f = bg.querySelector("input, .acts .btn:last-child");
    if (f) f.focus();
    return close;
  }
  const confirmBox = (title, body, label, cls) => new Promise(res => {
    modal(title, `<p>${body}</p>`, [{ label: "Cancel", run: () => res(false) }, { label, cls: cls || "primary", run: () => res(true) }]);
  });

  // ---------- data ----------
  store.onAuth(u => {
    if (EMU) console.log("auth " + (u ? u.email : "none"));
    S.user = u || null;
    off(subs); off(liveSubs); off(resSubs);
    S.liveRunId = null; S.resSubId = null; S.err = "";
    if (isAdmin(u)) {
      subs.push(store.watchQuizzes(q => { S.quizzes = q; if (S.view !== "edit") render(); }, onErr));
      subs.push(store.watchRuns(r => { S.runs = r; r.forEach(x => { if (x.code) S.codes[x.id] = x.code; }); if (S.view !== "edit") render(); }, onErr));
      let first = true;
      subs.push(store.watchLive(l => {
        if (EMU) console.log("live snapshot " + JSON.stringify({ active: l && l.active, runId: l && l.runId, phase: l && l.phase }));
        S.live = l || { active: false };
        // Opening the teacher page while a quiz is running goes straight to the live screen.
        if (first && S.live.active && S.view === "quizzes") S.view = "live";
        first = false;
        followLive();
        if (S.view !== "edit") render();
      }, onErr));
    }
    render();
  });

  function followLive() {
    const id = S.live && S.live.active ? S.live.runId : null;
    if (id === S.liveRunId) return;
    off(liveSubs);
    S.liveRunId = id; S.liveStudents = []; S.liveAnswers = [];
    if (!id) return;
    liveSubs.push(store.watchStudents(id, s => { S.liveStudents = s; if (S.view === "live" || S.view === "quizzes") render(); }, onErr));
    liveSubs.push(store.watchAnswers(id, a => { S.liveAnswers = a; if (S.view === "live") render(); }, onErr));
  }
  function followRes(id) {
    if (id === S.resSubId) return;
    off(resSubs);
    S.resSubId = id; S.resStudents = []; S.resAnswers = [];
    if (!id) return;
    resSubs.push(store.watchStudents(id, s => { S.resStudents = s; if (S.view === "results") render(); }, onErr));
    resSubs.push(store.watchAnswers(id, a => { S.resAnswers = a; if (S.view === "results") render(); }, onErr));
  }
  const runOf = id => (S.runs || []).find(r => r.id === id) || null;
  const activeQuizId = () => (S.live && S.live.active ? S.live.quizId : null);

  // ---------- frame ----------
  function frame(main) {
    const u = S.user;
    const tabs = isAdmin(u) ? `<nav class="tc-tabs" aria-label="Sections">
        <button type="button" data-view="quizzes" ${S.view === "quizzes" || S.view === "edit" ? 'aria-current="page"' : ""}>Quizzes</button>
        <button type="button" data-view="live" ${S.view === "live" ? 'aria-current="page"' : ""}>Live${S.live && S.live.active ? '<span class="dot" aria-label="active"></span>' : ""}</button>
        <button type="button" data-view="results" ${S.view === "results" ? 'aria-current="page"' : ""}>Results</button></nav>` : "";
    const right = u ? `<div class="tc-right"><span class="mono">${esc(STUDENT_URL)}</span><button class="btn small" type="button" data-act="copylink">Copy student link</button><button class="btn small" type="button" data-act="signout">Sign out</button></div>` : "";
    return (DEMO ? `<div class="demo-bar">Demo mode: everything stays in this browser. Student side: <a href="./?demo" target="_blank" rel="noopener">open it in a new tab</a> (or on a second window) · <a href="#" data-act="resetdemo">Reset demo</a></div>` : "") +
      `<div class="tc"><header class="tc-bar"><div class="tc-bar-in"><span class="tc-brand">Clicker<small>teacher</small></span>${tabs}${right}</div></header>
       <main class="tc-main${S.view === "live" ? " wide" : ""}" id="tcMain">${main}</main></div>`;
  }

  function render() {
    if (S.view === "edit" && S.edit && isAdmin(S.user)) return renderEditor();
    let main;
    if (S.user === undefined) main = `<p class="muted">Loading…</p>`;
    else if (!S.user) main = signInHtml();
    else if (!isAdmin(S.user)) main = `<div class="panel signin" style="padding:22px;display:grid;gap:12px"><h2>Not the clicker's owner</h2>
        <p>You're signed in as <b>${esc(S.user.email)}</b>. Only ${esc(ADMIN_EMAIL)} can build and run quizzes.</p>
        <button class="btn" type="button" data-act="signout">Sign out</button><a href="./">Go to the student page</a></div>`;
    else if (S.err) main = errHtml();
    else if (S.view === "live") main = liveHtml();
    else if (S.view === "results") main = resultsHtml();
    else main = quizzesHtml();
    root.innerHTML = frame(main);
    wireCommon();
    if (S.view === "live") wireLive();
    if (S.view === "results") wireResults();
    if (S.view === "quizzes") wireQuizzes();
  }

  function signInHtml() {
    return `<div class="panel signin" style="padding:24px;display:grid;gap:14px">
      <span class="eyebrow">Instructor</span><h1 style="font-size:1.8rem">Sign in to run the clicker</h1>
      <p>Use the Google account that owns the clicker. Students don't sign in; they use <span class="mono">${esc(STUDENT_URL)}</span>.</p>
      <button class="btn primary" type="button" data-act="signin">Sign in with Google</button>
      <p class="err" id="siErr" hidden></p></div>`;
  }
  function errHtml() {
    if (S.err === "rules") return `<div class="panel setup"><h2>One step left: publish the rules</h2>
      <p>Firebase refused to share the clicker data, which means the clicker rules aren't published yet.</p>
      <ol><li>Open the Firebase console, project <b>DocumentaryFeed</b>.</li>
      <li>Go to <b>Firestore Database → Rules</b>.</li>
      <li>Replace everything with the file <span class="mono">clicker/firestore.rules</span> from the website repository (it keeps the Documentary Feed rules).</li>
      <li>Click <b>Publish</b>, then reload this page.</li></ol>
      <div><button class="btn" type="button" data-act="reload">Reload</button></div></div>`;
    return `<div class="panel setup"><h2>Can't reach Firebase</h2><p>Check the internet connection and reload.</p><div><button class="btn" type="button" data-act="reload">Reload</button></div></div>`;
  }

  // ---------- quizzes ----------
  function lastUsed(quizId) {
    const r = (S.runs || []).find(x => x.quizId === quizId);
    return r ? r.startedAt : null;
  }
  function quizzesHtml() {
    if (!S.quizzes) return `<p class="muted">Loading your quizzes…</p>`;
    const act = activeQuizId();
    const t = x => { const d = toDate(x.updatedAt); return d ? d.getTime() : 0; };
    const list = [...S.quizzes].sort((a, b) => (a.id === act ? -1 : b.id === act ? 1 : t(b) - t(a)));
    const banner = S.live && S.live.active ? `<div class="panel qz active" style="padding:14px 16px">
        <div><div class="qz-title">${esc(S.live.title)} <span class="chip on">Active</span></div>
        <div class="qz-meta">${esc(S.live.course || "")} · ${S.liveStudents.length} joined · ${S.live.phase === "lobby" ? "students are joining" : S.live.phase === "ended" ? "finished" : "question " + (S.live.q + 1) + " of " + S.live.total}</div></div>
        <div class="qz-acts"><button class="btn primary" type="button" data-view="live">Open live screen</button><button class="btn" type="button" data-act="deactivate">Deactivate</button></div></div>` : "";
    const rows = list.map(q => {
      const n = (q.questions || []).length, isAct = q.id === act;
      const lu = lastUsed(q.id);
      return `<div class="panel qz${isAct ? " active" : ""}" data-qid="${esc(q.id)}">
        <div><div class="qz-title">${esc(q.title || "Untitled quiz")} ${isAct ? '<span class="chip on">Active</span>' : '<span class="chip off">Off</span>'}</div>
        <div class="qz-meta">${esc(q.course || "No course")} · ${plural(n, "question")} · ${plural(maxPoints(q.questions || []), "point")}${quizMinutes(q) ? " · about " + quizMinutes(q) + " min with timers" : ""}${lu ? " · last used " + esc(day(lu)) : " · not used yet"}</div></div>
        <div class="qz-acts">
          ${isAct ? `<button class="btn primary" type="button" data-view="live">Live screen</button><button class="btn" type="button" data-act="deactivate">Deactivate</button>`
                  : `<button class="btn go" type="button" data-act="activate">Activate</button>`}
          <button class="btn" type="button" data-act="edit">Edit</button>
          <button class="btn ghost" type="button" data-act="dup">Duplicate</button>
          ${lu ? `<button class="btn ghost" type="button" data-act="results">Results</button>` : ""}
          <button class="btn ghost" type="button" data-act="del" ${isAct ? "disabled title='Deactivate it first'" : ""}>Delete</button>
        </div></div>`;
    }).join("");
    return `<div class="tc-head"><div><span class="eyebrow">Your quizzes</span><h1>Quizzes</h1></div>
        <button class="btn primary" type="button" data-act="new">+ New quiz</button></div>
      <p class="muted">One quiz can be active at a time. Students who open <span class="mono">${esc(STUDENT_URL)}</span> see the active quiz; with none active they see “No quiz right now”.</p>
      ${banner}
      <div class="qz-list">${rows || `<div class="panel empty"><p>No quizzes yet.</p><button class="btn primary" type="button" data-act="new">Write your first quiz</button></div>`}</div>`;
  }
  function wireQuizzes() {
    root.querySelectorAll("[data-act=new]").forEach(b => b.addEventListener("click", () => {
      const course = S.quizzes && S.quizzes[0] ? S.quizzes[0].course || "" : "";
      openEditor(null, { title: "", course, needCode: true, showText: true, questions: [newMC()] });
    }));
    root.querySelectorAll(".qz[data-qid]").forEach(card => {
      const q = S.quizzes.find(x => x.id === card.dataset.qid);
      card.querySelectorAll("[data-act]").forEach(b => b.addEventListener("click", async () => {
        const a = b.dataset.act;
        if (a === "activate") activate(q);
        else if (a === "edit") openEditor(q.id, q);
        else if (a === "dup") {
          const c = cleanQuiz(q);
          await store.saveQuiz(null, { ...c, title: c.title + " (copy)" });
          toast("Copied: " + c.title + " (copy)");
        } else if (a === "results") {
          const r = (S.runs || []).find(x => x.quizId === q.id);
          S.resRun = r ? r.id : null; S.view = "results"; render();
        } else if (a === "del") {
          if (await confirmBox("Delete this quiz?", `“${esc(q.title)}” and its questions will be deleted. Results from past runs stay in Results.`, "Delete", "danger solid")) {
            await store.deleteQuiz(q.id); toast("Deleted");
          }
        }
      }));
    });
  }

  // ---------- activate / live control ----------
  function pubQuestion(q, showText) {
    const out = { type: q.type, points: pts(q), opinion: !!q.opinion, seconds: Number(q.seconds) || 0, text: showText ? q.text : "" };
    if (q.type === "mc") out.options = (q.options || []).map(o => (showText ? o : ""));
    return out;
  }
  async function activate(quiz) {
    const c = cleanQuiz(quiz);
    const pr = problems(c);
    if (pr.length) {
      modal("Fix these first", `<ul class="problems">${pr.map(p => `<li>${esc(p)}</li>`).join("")}</ul>`,
        [{ label: "Close" }, { label: "Edit quiz", cls: "primary", run: () => openEditor(quiz.id, quiz) }]);
      return;
    }
    if (S.live && S.live.active) {
      const ok = await confirmBox("Switch the active quiz?", `“${esc(S.live.title)}” is active now. Activating “${esc(c.title)}” turns it off. Its results are saved.`, "Activate " + c.title);
      if (!ok) return;
      try { await store.updateRun(S.live.runId, { endedAt: store.stamp() }); } catch (e) { /* run may be gone */ }
    }
    const code = makeCode();
    const runId = await store.createRun({
      quizId: quiz.id, title: c.title, course: c.course, questions: c.questions,
      needCode: c.needCode, showText: c.showText, autoNext: c.autoNext, revealSeconds: c.revealSeconds,
      code, overrides: {}, maxPoints: maxPoints(c.questions)
    });
    S.codes[runId] = code;
    const liveDoc = {
      active: true, runId, quizId: quiz.id, title: c.title, course: c.course,
      needCode: c.needCode, showText: c.showText, total: c.questions.length,
      q: -1, phase: "lobby", question: null, reveal: null, keys: {}, maxPoints: maxPoints(c.questions),
      timer: null, advance: null, driver: CLIENT
    };
    await store.setLive(liveDoc);
    // Firebase normally echoes the write at once; don't depend on it to show the live screen.
    if (!S.live || S.live.runId !== runId) { S.live = { ...liveDoc }; followLive(); }
    S.view = "live";
    render();
    toast(c.title + " is active");
  }
  function setLive(patch, auto) {
    if (!auto) patch = { ...patch, driver: CLIENT };
    const next = { ...S.live, ...patch };
    delete next.updatedAt;
    S.live = { ...S.live, ...patch };
    render();
    return store.setLive(next).catch(onErr);
  }
  function curQuestions() {
    const r = runOf(S.live && S.live.runId);
    return r ? r.questions || [] : [];
  }
  const countdown = sec => (sec > 0 ? { seconds: sec, endsAt: Date.now() + sec * 1000, paused: false, remaining: sec * 1000 } : null);
  function openQ(i, auto) {
    const qs = curQuestions();
    if (!qs[i]) return;
    setLive({ q: i, phase: "open", question: pubQuestion(qs[i], S.live.showText), reveal: null, timer: countdown(Number(qs[i].seconds) || 0), advance: null }, auto);
  }
  function reopen() {
    const q = curQuestions()[S.live.q];
    setLive({ phase: "open", timer: countdown(q ? Number(q.seconds) || 0 : 0), advance: null });
  }
  function closeVoting() { setLive({ phase: "closed", timer: null }); }
  function goPrev() {
    const qs = curQuestions(), i = S.live.q - 1;
    if (i < 0 || !qs[i]) return;
    const k = (S.live.keys || {})[i];
    setLive({ q: i, phase: k ? "revealed" : "closed", question: pubQuestion(qs[i], S.live.showText), reveal: k || null, timer: null, advance: null });
  }
  function reveal(auto) {
    const q = curQuestions()[S.live.q];
    if (!q) return;
    const k = publicKey(q);
    const run = runOf(S.live.runId) || {};
    const go = run.autoNext !== false && (Number(q.seconds) || 0) > 0;
    setLive({ phase: "revealed", reveal: k, keys: { ...(S.live.keys || {}), [S.live.q]: k }, timer: null,
      advance: go ? countdown(secs(run.revealSeconds, 2, 300, 8)) : null }, auto === true);
  }
  function nextQ(auto) {
    if (S.live.q + 1 < S.live.total) openQ(S.live.q + 1, auto === true);
    else endQuiz(auto === true);
  }
  function pauseToggle(field) {
    const t = S.live[field];
    if (!t) return;
    const now = Date.now();
    setLive({ [field]: t.paused ? { ...t, paused: false, endsAt: now + (Number(t.remaining) || 0) } : { ...t, paused: true, remaining: timeLeft(t, now) } });
  }
  function addTime(field, sec) {
    const t = S.live[field];
    if (!t) return;
    const now = Date.now(), left = timeLeft(t, now) + sec * 1000;
    setLive({ [field]: { ...t, seconds: Math.max(Number(t.seconds) || 0, Math.ceil(left / 1000)), endsAt: now + left, remaining: left } });
  }
  async function endQuiz(auto) {
    await setLive({ phase: "ended", timer: null, advance: null }, auto === true);
    try { await store.updateRun(S.live.runId, { endedAt: store.stamp() }); } catch (e) { /* ignore */ }
  }
  async function deactivate() {
    if (!S.live || !S.live.active) return;
    const mid = S.live.phase !== "ended" && S.live.phase !== "lobby";
    if (mid && !(await confirmBox("Deactivate now?", "The quiz isn't finished. Students will see “No quiz right now”. Answers given so far are saved.", "Deactivate", "danger solid"))) return;
    const runId = S.live.runId;
    await store.setLive({ active: false, runId: null, phase: "off" });
    try { await store.updateRun(runId, { endedAt: store.stamp() }); } catch (e) { /* ignore */ }
    toast("Deactivated. Students now see “No quiz right now”.");
  }

  // ---------- live (projector) ----------
  function primaryAction() {
    const L = S.live;
    if (!L || !L.active) return null;
    if (L.phase === "lobby") return () => openQ(0);
    if (L.phase === "open") return L.timer ? () => reveal() : closeVoting;
    if (L.phase === "closed") return () => reveal();
    if (L.phase === "revealed") return () => nextQ();
    return null;
  }
  function liveHtml() {
    const L = S.live;
    if (!L || !L.active) {
      return `<div class="panel empty"><h2>No quiz is active</h2><p>Go to Quizzes and press <b>Activate</b> on the quiz you want. Students will see it right away.</p>
        <button class="btn primary" type="button" data-view="quizzes">Go to quizzes</button></div>`;
    }
    const qs = curQuestions();
    const q = qs[L.q];
    const code = S.codes[L.runId] || (runOf(L.runId) || {}).code || "····";
    const joined = S.liveStudents.length;
    const top = `<div class="pj-top"><span><b>${esc(L.title)}</b>${L.course ? " · " + esc(L.course) : ""}</span>
      <span>${L.phase === "lobby" ? "Joining" : L.phase === "ended" ? "Finished" : `Question ${L.q + 1} of ${L.total}`} · ${joined} joined${L.needCode ? ` · code <span class="code">${esc(code)}</span>` : ""}</span></div>`;
    let body = "", hint = "", ctrls = "";
    const btn = (label, act, cls) => `<button class="btn ${cls || ""}" type="button" data-live="${act}">${label}</button>`;
    if (L.phase === "lobby") {
      const names = [...S.liveStudents].sort((a, b) => toDate(b.joinedAt) - toDate(a.joinedAt));
      body = `<div class="join-grid"><div style="display:grid;gap:8px"><span class="muted" style="font-size:1.1rem">On your phone, go to</span>
          <span class="join-url">${esc(STUDENT_URL).replace(/\//g, "/<wbr>")}</span><span class="muted" style="font-size:1.05rem">Type your name and student ID${L.needCode ? ", then the room code" : ""}.</span></div>
          ${L.needCode ? `<div class="code-box"><span class="muted">Room code</span><span class="c">${esc(code)}</span></div>` : ""}</div>
        <div style="display:grid;gap:10px"><span><span class="joined-n">${joined}</span> <span class="muted">joined</span></span>
          <div class="names">${names.slice(0, 60).map(s => `<span>${esc(shortName(s.name))}</span>`).join("")}${names.length > 60 ? `<span>+${names.length - 60}</span>` : ""}</div></div>`;
      hint = "Students can join now. Late arrivals can still join during the quiz.";
      ctrls = btn(`Start question 1 →`, "primary", "primary");
    } else if (L.phase === "ended") {
      const res = buildResults(qs, S.liveStudents, S.liveAnswers, (runOf(L.runId) || {}).overrides);
      body = `<h2 style="font-size:2rem">Quiz complete</h2><div class="stats">
        <div class="stat"><b>${res.rows.length}</b><span>students</span></div>
        <div class="stat"><b>${fmtPts(Math.round(res.avg * 10) / 10)} / ${fmtPts(res.max)}</b><span>class average (points)</span></div>
        <div class="stat"><b>${res.hardest >= 0 ? "Q" + (res.hardest + 1) + " · " + Math.round(res.perQ[res.hardest].pctRight * 100) + "%" : "—"}</b><span>hardest question</span></div></div>
        <p class="muted">Students see their own score on their phones. ${res.pending ? `${res.pending} written answer${res.pending === 1 ? "" : "s"} still need grading in Results.` : ""}</p>`;
      hint = "Results are saved.";
      ctrls = btn("See results", "results", "primary") + btn("Deactivate", "deactivate", "");
    } else if (q) {
      const ansQ = S.liveAnswers.filter(a => a.q === L.q);
      const nAns = ansQ.length;
      const revealed = L.phase === "revealed";
      let content = "";
      if (q.type === "mc") {
        const counts = (q.options || []).map((_, i) => ansQ.filter(a => a.choice === i).length);
        const tot = Math.max(1, nAns);
        content = `<div class="pgrid">${(q.options || []).map((o, i) => {
          const right = revealed && !q.opinion && i === q.correct;
          const pct = Math.round(100 * counts[i] / tot);
          return `<div class="popt${right ? " right" : ""}"><span class="fill" style="width:${revealed ? pct : 0}%"></span><span class="letter">${LETTERS[i]}</span><span class="ot">${esc(o)}</span><span class="ct">${revealed ? (right ? "✓ " : "") + counts[i] + " · " + pct + "%" : ""}</span></div>`;
        }).join("")}</div>`;
        if (revealed) {
          const r = ansQ.filter(a => a.choice === q.correct).length;
          content += `<p class="muted" style="font-size:1.05rem">${q.opinion ? "Opinion question: every answer gets the points." : `${Math.round(100 * r / Math.max(1, nAns))}% got it right`} · ${nAns} of ${joined} answered</p>`;
        }
      } else {
        if (!revealed) content = `<p class="muted" style="font-size:1.2rem">Type your answer on your phone and press Send.</p>`;
        else {
          const acc = acceptedList(q).map(norm);
          const groups = {};
          ansQ.forEach(a => { const k = norm(a.text); if (!k) return; (groups[k] ||= { text: a.text, n: 0 }).n++; });
          const list = Object.entries(groups).sort((a, b) => b[1].n - a[1].n).slice(0, 14);
          content = `<p class="keyline">${q.opinion ? "Opinion question: every answer gets the points." : kindOf(q) === "manual" ? "Graded by hand after class." : "Answer: " + esc(acceptedList(q).join(" / "))}</p>
            <div class="textlist">${list.map(([k, g]) => `<div class="${!q.opinion && acc.includes(k) ? "right" : ""}"><span>${esc(g.text)}</span><span class="n">${g.n}</span></div>`).join("") || `<p class="muted">No answers.</p>`}</div>
            <p class="muted">${nAns} of ${joined} answered${Object.keys(groups).length > 14 ? " · showing the 14 most common answers" : ""}</p>`;
        }
      }
      const cd = L.phase === "open" && L.timer ? cdHtml("timer", L.timer)
        : L.phase === "revealed" && L.advance ? `<span class="cd next${L.advance.paused ? " paused" : ""}" data-cd="advance" role="timer">${L.q + 1 >= L.total ? "Final scores" : "Next question"} in <span class="cd-n">${clock(timeLeft(L.advance, Date.now()))}</span></span>` : "";
      body = `<div class="pj-qhead"><span>Question ${L.q + 1} of ${L.total} · ${plural(pts(q), "point")} · ${esc(typeLabel(q))}</span>${L.phase === "closed" ? '<span class="closed-tag">■ Voting closed</span>' : ""}${cd}</div>
        <div class="pj-q">${esc(q.text)}</div>${content}
        ${revealed ? "" : `<div class="answered"><div class="lab"><span>Answered</span><b>${nAns} of ${joined}</b></div><div class="track"><i style="width:${joined ? Math.round(100 * nAns / joined) : 0}%"></i></div></div>`}`;
      const prev = L.q > 0 ? btn("← Previous", "prev", "ghost") : "";
      const last = L.q + 1 >= L.total;
      if (L.phase === "open" && L.timer) {
        hint = L.timer.paused ? "Timer paused." : "When time runs out, the answer shows by itself.";
        ctrls = prev + btn(L.timer.paused ? "Resume timer" : "Pause timer", "pause-timer", "") + btn("+10 s", "add-timer", "") + btn("Reveal now", "primary", "primary");
      } else if (L.phase === "open") { hint = "Voting open. Answers stay hidden until you reveal."; ctrls = prev + btn("Close voting", "primary", "primary"); }
      else if (L.phase === "closed") { hint = `${joined - nAns > 0 ? joined - nAns + " didn't answer." : "Everyone answered."}`; ctrls = prev + btn("Reopen voting", "reopen", "") + btn("Reveal answer", "primary", "primary"); }
      else if (L.advance) {
        hint = `<span data-cd="advance" class="cd inline">${last ? "Final scores" : "Next question"} in <span class="cd-n">${clock(timeLeft(L.advance, Date.now()))}</span>${L.advance.paused ? " (paused)" : ""}</span>`;
        ctrls = prev + btn("Reopen voting", "reopen", "ghost") + btn(L.advance.paused ? "Resume" : "Pause", "pause-advance", "") + btn(last ? "End quiz now" : "Next question now →", "primary", "primary");
      } else { hint = last ? "That was the last question." : `Next: question ${L.q + 2} of ${L.total}`; ctrls = prev + btn("Reopen voting", "reopen", "ghost") + btn(last ? "End quiz" : "Next question →", "primary", "primary"); }
    } else {
      body = `<p class="muted">Loading the question…</p>`;
    }
    const tail = btn("Full screen", "fs", "ghost") + (L.phase !== "ended" ? btn("Deactivate", "deactivate", "ghost") : "");
    return `<section class="pj" id="pj">${top}<div class="pj-body">${body}</div>
      <div class="pj-bar"><span class="hint">${hint} <span class="muted">· Space or → also works</span></span><div class="pj-ctrls">${ctrls}${tail}</div></div></section>`;
  }
  function wireLive() {
    root.querySelectorAll("[data-live]").forEach(b => b.addEventListener("click", () => {
      const a = b.dataset.live;
      if (a === "primary") { const f = primaryAction(); if (f) f(); }
      else if (a === "prev") goPrev();
      else if (a === "reopen") reopen();
      else if (a === "pause-timer") pauseToggle("timer");
      else if (a === "add-timer") addTime("timer", 10);
      else if (a === "pause-advance") pauseToggle("advance");
      else if (a === "deactivate") deactivate();
      else if (a === "results") { S.resRun = S.live.runId; S.view = "results"; render(); }
      else if (a === "fs") { const el = document.getElementById("pj"); if (document.fullscreenElement) document.exitFullscreen(); else if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {}); }
    }));
  }
  document.addEventListener("keydown", e => {
    if (S.view !== "live" || document.querySelector(".modal-bg")) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName)) return;
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
      const f = primaryAction();
      if (f) { e.preventDefault(); f(); }
    } else if ((e.key === "ArrowLeft" || e.key === "PageUp") && S.live && S.live.q > 0 && S.live.phase !== "lobby" && S.live.phase !== "ended") {
      e.preventDefault(); goPrev();
    }
  });
  // Re-render when the projector leaves or enters full screen so the layout fits.
  document.addEventListener("fullscreenchange", () => { if (S.view === "live") render(); });

  // Countdown: redraw the clocks and, on the device that runs the timers, move on when time is up.
  function cdHtml(field, t) {
    const left = timeLeft(t, Date.now());
    const pct = t.seconds ? Math.round(100 * left / (t.seconds * 1000)) : 0;
    return `<span class="cd${t.paused ? " paused" : ""}${left <= 5000 && !t.paused ? " low" : ""}" data-cd="${field}" role="timer"><span class="cd-n">${clock(left)}</span><span class="cd-track"><i style="width:${pct}%"></i></span></span>`;
  }
  const fired = new Set();
  const fireOnce = (key, fn) => { if (fired.has(key)) return; fired.add(key); fn(); };
  setInterval(() => {
    const L = S.live;
    if (!L || !L.active || !isAdmin(S.user)) return;
    const now = Date.now();
    document.querySelectorAll("[data-cd]").forEach(el => {
      const t = L[el.dataset.cd];
      if (!t) return;
      const left = timeLeft(t, now);
      const n = el.querySelector(".cd-n"); if (n) n.textContent = clock(left);
      const bar = el.querySelector(".cd-track i"); if (bar) bar.style.width = (t.seconds ? Math.round(100 * left / (t.seconds * 1000)) : 0) + "%";
      el.classList.toggle("low", left <= 5000 && !t.paused);
      el.classList.toggle("paused", !!t.paused);
    });
    // Only the driving device acts, unless it has gone quiet for 5 seconds past the deadline.
    const late = t => !t.paused && now - Number(t.endsAt) > 5000;
    const mine = L.driver === CLIENT || !L.driver;
    if (L.phase === "open" && L.timer && !L.timer.paused && timeLeft(L.timer, now) <= 0 && (mine || late(L.timer))) {
      fireOnce(L.runId + ":" + L.q + ":t:" + L.timer.endsAt, () => reveal(true));
    } else if (L.phase === "revealed" && L.advance && !L.advance.paused && timeLeft(L.advance, now) <= 0 && (mine || late(L.advance))) {
      fireOnce(L.runId + ":" + L.q + ":a:" + L.advance.endsAt, () => nextQ(true));
    }
  }, 250);

  // ---------- results ----------
  function resultsData() {
    const runs = S.runs || [];
    if (!runs.length) return null;
    if (!S.resRun || !runOf(S.resRun)) S.resRun = runs[0].id;
    const run = runOf(S.resRun);
    followRes(run.id);
    const res = buildResults(run.questions || [], S.resStudents, S.resAnswers, run.overrides || {});
    return { run, res };
  }
  function resultsHtml() {
    if (!S.runs) return `<p class="muted">Loading results…</p>`;
    const d = resultsData();
    if (!d) return `<div class="tc-head"><div><span class="eyebrow">After class</span><h1>Results</h1></div></div>
      <div class="panel empty"><p>No results yet. They appear here after you activate a quiz.</p></div>`;
    const { run, res } = d;
    const qs = run.questions || [];
    const isLive = S.live && S.live.active && S.live.runId === run.id;
    const opts = S.runs.map(r => `<option value="${esc(r.id)}" ${r.id === run.id ? "selected" : ""}>${esc(r.title)}${r.course ? " · " + esc(r.course) : ""} · ${esc(when(r.startedAt))}${S.live && S.live.active && S.live.runId === r.id ? " · active" : ""}</option>`).join("");
    const head = `<tr><th class="l sticky">Student</th><th class="l">ID</th>${qs.map((q, i) => `<th>${q.type === "text" && kindOf(q) !== "opinion" ? `<button class="btn small ghost" type="button" data-grade="${i}" title="Grade this question's answers">Q${i + 1} ✎</button>` : "Q" + (i + 1)}<small>${plural(pts(q), "pt")}</small></th>`).join("")}<th>Total<small>of ${fmtPts(res.max)}</small></th><th>%</th></tr>`;
    const keyRow = `<tr class="keyrow"><td class="l sticky" style="color:var(--muted);font-weight:400">Answer key</td><td></td>${qs.map(q => `<td title="${esc(keyText(q))}">${esc(q.type === "mc" && !q.opinion ? LETTERS[q.correct] : kindOf(q) === "opinion" ? "opinion" : kindOf(q) === "manual" ? "by hand" : acceptedList(q)[0] || "")}</td>`).join("")}<td></td><td></td></tr>`;
    const body = res.rows.map(r => `<tr><td class="l sticky">${esc(r.name)}${r.flags.length ? `<span class="flag" title="${esc(r.flags.join(". "))}">⚑</span>` : ""}</td><td class="id">${esc(r.studentId)}</td>` +
      r.marks.map((m, i) => {
        const label = m.status === "missing" ? "—" : qs[i].type === "text" ? m.answer : m.answer;
        const tip = `${m.answer ? "Answer: " + m.answer + "\n" : "No answer\n"}${fmtPts(m.points)} of ${fmtPts(pts(qs[i]))} points${m.overridden ? " (changed by you)" : ""}\nClick to change`;
        return `<td><button type="button" class="cell ${m.status}${m.overridden ? " ov" : ""}${qs[i].type === "text" ? " text" : ""}" data-cell="${esc(r.sid)}|${i}" title="${esc(tip)}">${esc(label)}</button></td>`;
      }).join("") + `<td class="score">${fmtPts(r.total)}</td><td>${Math.round(r.pct * 1000) / 10}%</td></tr>`).join("");
    const pct = `<tr class="pct"><td class="l sticky">% right</td><td></td>${res.perQ.map((p, i) => `<td class="${i === res.hardest ? "hard" : ""}">${p.kind === "opinion" ? Math.round(100 * p.answered / Math.max(1, p.n)) + "% ans." : p.kind === "manual" && p.pending ? p.pending + " to grade" : Math.round(100 * p.pctRight) + "%"}</td>`).join("")}<td></td><td></td></tr>`;
    return `<div class="tc-head"><div><span class="eyebrow">After class</span><h1>Results</h1></div></div>
      <section class="panel">
        <div class="res-top"><label class="muted" for="runSel" style="font-size:.85rem">Quiz run</label>
          <select id="runSel" style="flex:1 1 320px">${opts}</select>
          ${isLive ? '<span class="chip on">Active now · updates live</span>' : ""}</div>
        <div class="res-sum"><span><b>${res.rows.length}</b> students</span><span><b>${fmtPts(Math.round(res.avg * 10) / 10)}</b> of ${fmtPts(res.max)} points on average</span>
          ${res.hardest >= 0 ? `<span><b>Q${res.hardest + 1}</b> hardest (${Math.round(res.perQ[res.hardest].pctRight * 100)}% right)</span>` : ""}
          ${res.pending ? `<span><b>${res.pending}</b> written answers to grade (click Q ✎)</span>` : ""}
          <span>${esc(when(run.startedAt))}</span></div>
        ${res.rows.length ? `<div class="tbl-wrap"><table><thead>${head}</thead><tbody>${keyRow}${body}${pct}</tbody></table></div>` : `<div class="empty"><p>No students joined this run.</p></div>`}
        <div class="res-foot"><div class="legend"><span class="cell right">B</span>right <span class="cell wrong">C</span>wrong <span class="cell pending">…</span>to grade <span class="cell counted">✓</span>opinion <span class="cell">—</span>no answer <span>⚑ check name/phone</span> <span>Click any cell to change its points.</span></div>
          <div class="qz-acts"><button class="btn primary" type="button" data-res="xlsx">Download Excel (.xlsx)</button><button class="btn" type="button" data-res="csv">CSV</button><button class="btn ghost danger" type="button" data-res="delete" ${isLive ? "disabled title='Deactivate the quiz first'" : ""}>Delete this run</button></div></div>
      </section>`;
  }
  function wireResults() {
    const sel = document.getElementById("runSel");
    if (sel) sel.addEventListener("change", () => { S.resRun = sel.value; render(); });
    const d = S.runs && S.runs.length ? { run: runOf(S.resRun) } : null;
    if (!d || !d.run) return;
    const run = d.run;
    root.querySelectorAll("[data-cell]").forEach(b => b.addEventListener("click", () => {
      const [sid, qi] = b.dataset.cell.split("|");
      editCell(run, sid, Number(qi));
    }));
    root.querySelectorAll("[data-grade]").forEach(b => b.addEventListener("click", () => gradeQuestion(run, Number(b.dataset.grade))));
    root.querySelectorAll("[data-res]").forEach(b => b.addEventListener("click", async () => {
      const a = b.dataset.res;
      if (a === "xlsx") download(run, "xlsx");
      else if (a === "csv") download(run, "csv");
      else if (a === "delete") {
        if (await confirmBox("Delete this run?", `All answers from “${esc(run.title)}” on ${esc(when(run.startedAt))} will be deleted for good. Download the Excel file first if you need it.`, "Delete", "danger solid")) {
          await store.deleteRun(run.id); S.resRun = null; toast("Run deleted"); render();
        }
      }
    }));
  }
  function setOverride(run, key, val) {
    const ov = { ...(run.overrides || {}) };
    if (val == null) delete ov[key]; else ov[key] = val;
    run.overrides = ov;
    render();
    return store.updateRun(run.id, { overrides: ov }).catch(onErr);
  }
  function editCell(run, sid, i) {
    const q = (run.questions || [])[i];
    const stu = S.resStudents.find(s => s.id === sid) || { name: "?" };
    const ans = S.resAnswers.find(a => a.sid === sid && a.q === i);
    const key = sid + "_" + i;
    const auto = mark(q, ans, null);
    const cur = (run.overrides || {})[key];
    const full = pts(q);
    modal(`${stu.name} · Q${i + 1}`,
      `<div style="display:grid;gap:10px"><p class="muted" style="font-size:.9rem">${esc(q.text)}</p>
       <p><b>Answer:</b> ${ans ? esc(q.type === "text" ? ans.text : LETTERS[ans.choice] + " · " + (q.options || [])[ans.choice]) : "<span class='muted'>no answer</span>"}</p>
       <p class="muted" style="font-size:.9rem">Automatic: ${fmtPts(auto.points)} of ${fmtPts(full)}${cur != null ? ` · now ${fmtPts(cur)} (changed by you)` : ""}</p>
       <div class="field"><label for="ovPts">Points (0 to ${fmtPts(full)}, or more for extra credit)</label><input id="ovPts" type="number" min="0" step="0.5" value="${esc(cur != null ? cur : auto.points)}"></div></div>`,
      [{ label: "Automatic", run: () => setOverride(run, key, null) },
       { label: "Zero", run: () => setOverride(run, key, 0) },
       { label: `Full (${fmtPts(full)})`, cls: "go", run: () => setOverride(run, key, full) },
       { label: "Save", cls: "primary", run: bg => { const v = Number(bg.querySelector("#ovPts").value); if (!Number.isFinite(v) || v < 0) return true; setOverride(run, key, v); } }]);
  }
  function gradeQuestion(run, i) {
    const q = run.questions[i];
    const full = pts(q);
    const groups = {};
    S.resAnswers.filter(a => a.q === i && answered(a)).forEach(a => { const k = norm(a.text); (groups[k] ||= { text: a.text, sids: [] }).sids.push(a.sid); });
    const list = Object.entries(groups).sort((a, b) => b[1].sids.length - a[1].sids.length);
    const state = sids => {
      const v = sids.map(sid => mark(q, S.resAnswers.find(a => a.sid === sid && a.q === i), (run.overrides || {})[sid + "_" + i]).points);
      return v.every(x => x === v[0]) ? v[0] : null;
    };
    const rowsHtml = () => list.map(([k, g], gi) => {
      const st = state(g.sids);
      return `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;border-bottom:1px solid var(--line);padding:6px 0">
        <span>${esc(g.text)} <span class="muted mono" style="font-size:.8rem">×${g.sids.length}</span></span>
        <span style="display:flex;gap:4px"><button type="button" class="cell ${st === full ? "right" : ""}" data-g="${gi}" data-v="full" title="Full points">✓ ${fmtPts(full)}</button><button type="button" class="cell ${st === 0 ? "wrong" : ""}" data-g="${gi}" data-v="zero" title="Zero">✕ 0</button></span></div>`;
    }).join("") || `<p class="muted">No answers to grade.</p>`;
    modal(`Grade Q${i + 1}`, `<p class="muted" style="font-size:.9rem;margin-bottom:8px">${esc(q.text)}<br>Identical answers are grouped (capitals and accents ignored). Marking a group marks every student in it.</p><div id="gList" style="max-height:52vh;overflow:auto">${rowsHtml()}</div>`,
      [{ label: "Done", cls: "primary" }],
      bg => {
        bg.querySelector("#gList").addEventListener("click", async e => {
          const b = e.target.closest("[data-g]");
          if (!b) return;
          const g = list[Number(b.dataset.g)][1];
          const ov = { ...(run.overrides || {}) };
          g.sids.forEach(sid => { ov[sid + "_" + i] = b.dataset.v === "full" ? full : 0; });
          run.overrides = ov;
          bg.querySelector("#gList").innerHTML = rowsHtml();
          render();
          store.updateRun(run.id, { overrides: ov }).catch(onErr);
        });
      });
  }
  function exportSheets(run) {
    const qs = run.questions || [];
    const res = buildResults(qs, S.resStudents, S.resAnswers, run.overrides || {});
    const H = v => ({ v, bold: true });
    const scores = [[H("Name"), H("Student ID"), ...qs.map((q, i) => H(`Q${i + 1} (${fmtPts(pts(q))} pt)`)), H("Total"), H("Max"), H("Percent"), H("Notes")]];
    res.rows.forEach(r => scores.push([r.name, r.studentId, ...r.marks.map(m => m.points), r.total, res.max, Math.round(r.pct * 1000) / 10, r.flags.join("; ")]));
    const answersS = [[H("Name"), H("Student ID"), H("Question"), H("Type"), H("Answer"), H("Result"), H("Points"), H("Max points"), H("Answered at")]];
    const resultWord = { right: "right", wrong: "wrong", partial: "partial", counted: "opinion (counted)", pending: "not graded yet", missing: "no answer" };
    res.rows.forEach(r => r.marks.forEach((m, i) => {
      const d = toDate(m.at);
      answersS.push([r.name, r.studentId, i + 1, qs[i].type === "text" ? "text" : "multiple choice", m.answer, resultWord[m.status] + (m.overridden ? " (changed by teacher)" : ""), m.points, pts(qs[i]), d ? d.toLocaleString() : ""]);
    }));
    const questionsS = [[H("Q"), H("Type"), H("Question"), H("Options"), H("Correct answer"), H("Points"), H("Answered"), H("Right"), H("% right")]];
    qs.forEach((q, i) => {
      const p = res.perQ[i];
      questionsS.push([i + 1, typeLabel(q), q.text, q.type === "mc" ? (q.options || []).map((o, j) => LETTERS[j] + ") " + o).join("  ") : "", keyText(q), pts(q), p.answered, p.kind === "key" ? p.right : "", p.kind === "key" ? Math.round(p.pctRight * 1000) / 10 : ""]);
    });
    const info = [[H("Quiz"), run.title], [H("Course"), run.course || ""], [H("Started"), (toDate(run.startedAt) || new Date()).toLocaleString()], [H("Students"), res.rows.length], [H("Max points"), res.max], [H("Average"), Math.round(res.avg * 100) / 100]];
    return [
      { name: "Scores", rows: scores, widths: [26, 14, ...qs.map(() => 10), 8, 8, 9, 30] },
      { name: "Answers", rows: answersS, widths: [26, 14, 9, 15, 40, 22, 8, 10, 22] },
      { name: "Questions", rows: questionsS, widths: [5, 18, 60, 50, 30, 8, 10, 8, 9] },
      { name: "About", rows: info, widths: [14, 50] }
    ];
  }
  function download(run, kind) {
    const sheets = exportSheets(run);
    const base = slug(run.title) + "_" + isoDay(run.startedAt);
    let blob, name;
    if (kind === "xlsx") { blob = new Blob([xlsxBytes(sheets)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); name = base + ".xlsx"; }
    else { blob = new Blob(["﻿" + csvText(sheets[0].rows)], { type: "text/csv;charset=utf-8" }); name = base + ".csv"; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast("Downloaded " + name);
  }

  // ---------- editor ----------
  function openEditor(id, quiz) {
    const src = JSON.parse(JSON.stringify(quiz || {}));
    const draft = {
      title: src.title || "", course: src.course || "", needCode: src.needCode !== false, showText: src.showText !== false,
      autoNext: src.autoNext !== false, revealSeconds: src.revealSeconds == null ? 8 : src.revealSeconds,
      questions: (src.questions || []).map(q => q.type === "text" ? { ...newText(), ...q, accepted: [...(q.accepted || [])] } : { ...newMC(), ...q, options: [...(q.options || ["", "", "", ""])] })
    };
    if (!draft.questions.length) draft.questions.push(newMC());
    S.edit = { id, draft, dirty: false };
    S.view = "edit";
    window.scrollTo(0, 0);
    renderEditor();
  }
  function edStatus() {
    const e = S.edit;
    const c = cleanQuiz(e.draft);
    const pr = problems(c);
    const mins = quizMinutes(c);
    return `<div class="status"><b>${plural(c.questions.length, "question")} · ${plural(maxPoints(c.questions), "point")}${mins ? " · about " + mins + " min" : ""}</b> · ${e.dirty ? "Unsaved changes" : e.id ? "Saved" : "Not saved yet"}
      ${pr.length ? `<ul class="problems">${pr.slice(0, 3).map(p => `<li>${esc(p)}</li>`).join("")}${pr.length > 3 ? `<li>…and ${pr.length - 3} more</li>` : ""}</ul>` : ""}</div>`;
  }
  function qCardHtml(q, i, n) {
    const top = `<div class="qcard-top"><span class="qnum">Q${i + 1}</span>
      <span class="seg" role="group" aria-label="Question type"><button type="button" data-qa="type-mc" data-qi="${i}" aria-pressed="${q.type === "mc"}">Multiple choice</button><button type="button" data-qa="type-text" data-qi="${i}" aria-pressed="${q.type === "text"}">Text answer</button></span>
      <label class="ptsbox">Points <input type="number" min="0" step="0.5" data-qf="points" data-qi="${i}" value="${esc(q.points)}" aria-label="Points for question ${i + 1}"></label>
      <label class="ptsbox" title="0 = no timer: you close voting yourself">Timer <input type="number" min="0" max="3600" step="5" data-qf="seconds" data-qi="${i}" value="${esc(q.seconds || 0)}" aria-label="Seconds for question ${i + 1}"> s</label>
      <label class="check"><input type="checkbox" data-qf="opinion" data-qi="${i}" ${q.opinion ? "checked" : ""}> Opinion (no right answer)</label>
      <span class="qcard-tools"><button class="btn ghost small" type="button" data-qa="up" data-qi="${i}" ${i === 0 ? "disabled" : ""} title="Move up">↑</button><button class="btn ghost small" type="button" data-qa="down" data-qi="${i}" ${i === n - 1 ? "disabled" : ""} title="Move down">↓</button><button class="btn ghost small" type="button" data-qa="copy" data-qi="${i}" title="Duplicate">Copy</button><button class="btn ghost small danger" type="button" data-qa="del" data-qi="${i}" title="Delete question">Delete</button></span></div>
      <textarea class="qt" data-qf="text" data-qi="${i}" placeholder="Type the question" aria-label="Question ${i + 1} text">${esc(q.text)}</textarea>`;
    if (q.type === "mc") {
      return `<div class="panel qcard${q.opinion ? " opinion" : ""}">${top}<div class="opt-rows">${q.options.map((o, j) => `
        <div class="opt-row${!q.opinion && q.correct === j ? " right" : ""}"><span class="letter">${LETTERS[j]}</span>
          <input type="text" data-of="${j}" data-qi="${i}" value="${esc(o)}" placeholder="Option ${LETTERS[j]}" aria-label="Option ${LETTERS[j]}">
          <label class="mark"><input type="radio" name="correct-${i}" data-oc="${j}" data-qi="${i}" ${!q.opinion && q.correct === j ? "checked" : ""}> ${!q.opinion && q.correct === j ? "Correct answer" : "Mark correct"}</label>
          <button class="btn ghost small" type="button" data-qa="delopt" data-qi="${i}" data-oi="${j}" ${q.options.length <= 2 ? "disabled" : ""} title="Remove option" aria-label="Remove option ${LETTERS[j]}">✕</button></div>`).join("")}
        </div><div><button class="btn small" type="button" data-qa="addopt" data-qi="${i}" ${q.options.length >= 6 ? "disabled" : ""}>+ Option</button></div></div>`;
    }
    return `<div class="panel qcard${q.opinion ? " opinion" : ""}">${top}
      <div class="field acc"><label for="acc${i}">Accepted answers, one per line</label>
        <textarea id="acc${i}" data-qf="accepted" data-qi="${i}" ${q.opinion ? "disabled" : ""} placeholder="Type each accepted answer on its own line">${esc((q.accepted || []).join("\n"))}</textarea>
        <span class="hint">${q.opinion ? "Opinion: every answer gets the points." : "Matching ignores capitals, accents and punctuation. Leave it empty to grade by hand in Results."}</span></div></div>`;
  }
  function renderEditor() {
    const e = S.edit, d = e.draft;
    const isAct = e.id && e.id === activeQuizId();
    const main = `<div class="tc-head"><div><span class="eyebrow">${e.id ? "Edit quiz" : "New quiz"}</span><h1>${esc(d.title || "Untitled quiz")}</h1></div>
        <button class="btn" type="button" data-ea="back">← Back to quizzes</button></div>
      ${isAct ? `<div class="panel setup" style="padding:10px 14px"><p>This quiz is active right now. Changes apply the next time you activate it.</p></div>` : ""}
      <div class="ed">
        <div class="panel ed-meta">
          <div class="field"><label for="edTitle">Quiz title</label><input id="edTitle" data-ef="title" value="${esc(d.title)}" placeholder="Federalism check"></div>
          <div class="field"><label for="edCourse">Course · section</label><input id="edCourse" data-ef="course" value="${esc(d.course)}" placeholder="POLS 2305 · 01"></div>
          <div class="ed-opts"><label class="check"><input type="checkbox" data-ef="needCode" ${d.needCode ? "checked" : ""}> Room code on the screen (keeps absent students out)</label>
            <label class="check"><input type="checkbox" data-ef="showText" ${d.showText ? "checked" : ""}> Show question and options on phones</label></div>
          <div class="ed-opts timers"><label class="check"><input type="checkbox" data-ef="autoNext" ${d.autoNext ? "checked" : ""}> When a question's timer ends, show the answer for</label>
            <label class="ptsbox"><input type="number" min="2" max="300" data-ef="revealSeconds" value="${esc(d.revealSeconds)}" aria-label="Seconds to show the answer"> s, then open the next question by itself</label>
            <span class="ptsbox" style="margin-left:auto">Set every timer to <input type="number" min="0" max="3600" step="5" id="edAllSecs" value="${DEFAULT_SECONDS}" aria-label="Seconds for every question"> s <button class="btn small" type="button" data-ea="alltimers">Apply</button></span></div>
        </div>
        <div id="qCards" style="display:grid;gap:12px">${d.questions.map((q, i) => qCardHtml(q, i, d.questions.length)).join("")}</div>
        <div class="ed-add"><button class="btn" type="button" data-ea="addmc">+ Multiple-choice question</button><button class="btn" type="button" data-ea="addtext">+ Text question</button></div>
        <div class="ed-save" id="edSave">${edStatus()}<div class="qz-acts"><button class="btn primary" type="button" data-ea="save">Save</button><button class="btn go" type="button" data-ea="saveact" ${isAct ? "disabled" : ""}>Save &amp; activate</button></div></div>
      </div>`;
    root.innerHTML = frame(main);
    wireCommon();
    wireEditor();
  }
  function touch() {
    S.edit.dirty = true;
    const s = document.querySelector("#edSave .status");
    if (s) s.outerHTML = edStatus();
  }
  function rerenderEditor() {
    const y = window.scrollY;
    renderEditor();
    window.scrollTo(0, y);
  }
  function wireEditor() {
    const main = document.getElementById("tcMain");
    const d = S.edit.draft;
    main.addEventListener("input", ev => {
      const t = ev.target;
      if (t.dataset.ef && t.type !== "checkbox") { d[t.dataset.ef] = t.value; if (t.dataset.ef === "title") main.querySelector(".tc-head h1").textContent = t.value || "Untitled quiz"; touch(); return; }
      const qi = t.dataset.qi != null ? Number(t.dataset.qi) : null;
      if (qi == null) return;
      const q = d.questions[qi];
      if (t.dataset.qf === "text") q.text = t.value;
      else if (t.dataset.qf === "points") q.points = t.value === "" ? 1 : Math.max(0, Number(t.value));
      else if (t.dataset.qf === "seconds") q.seconds = t.value === "" ? 0 : Math.max(0, Math.round(Number(t.value)) || 0);
      else if (t.dataset.qf === "accepted") q.accepted = t.value.split("\n");
      else if (t.dataset.of != null) q.options[Number(t.dataset.of)] = t.value;
      else return;
      touch();
    });
    main.addEventListener("change", ev => {
      const t = ev.target;
      if (t.dataset.ef && t.type === "checkbox") { d[t.dataset.ef] = t.checked; touch(); return; }
      const qi = t.dataset.qi != null ? Number(t.dataset.qi) : null;
      if (qi == null) return;
      const q = d.questions[qi];
      if (t.dataset.qf === "opinion") { q.opinion = t.checked; S.edit.dirty = true; rerenderEditor(); }
      else if (t.dataset.oc != null) { q.correct = Number(t.dataset.oc); S.edit.dirty = true; rerenderEditor(); }
    });
    main.addEventListener("click", async ev => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.qa) {
        const i = Number(b.dataset.qi), qsArr = d.questions, q = qsArr[i];
        const a = b.dataset.qa;
        if (a === "type-mc" && q.type !== "mc") qsArr[i] = { ...newMC(), id: q.id, text: q.text, points: q.points, seconds: q.seconds, opinion: q.opinion };
        else if (a === "type-text" && q.type !== "text") qsArr[i] = { ...newText(), id: q.id, text: q.text, points: q.points, seconds: q.seconds, opinion: q.opinion };
        else if (a === "up" && i > 0) [qsArr[i - 1], qsArr[i]] = [qsArr[i], qsArr[i - 1]];
        else if (a === "down" && i < qsArr.length - 1) [qsArr[i + 1], qsArr[i]] = [qsArr[i], qsArr[i + 1]];
        else if (a === "copy") qsArr.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(q)), id: randomId(8) });
        else if (a === "del") {
          if ((q.text || "").trim() && !(await confirmBox("Delete this question?", `Q${i + 1}: “${esc(q.text.slice(0, 120))}”`, "Delete", "danger solid"))) return;
          qsArr.splice(i, 1);
        } else if (a === "addopt" && q.options.length < 6) q.options.push("");
        else if (a === "delopt") {
          const j = Number(b.dataset.oi);
          q.options.splice(j, 1);
          if (q.correct === j) q.correct = null; else if (q.correct > j) q.correct--;
        } else return;
        S.edit.dirty = true;
        rerenderEditor();
        return;
      }
      const a = b.dataset.ea;
      if (!a) return;
      if (a === "alltimers") {
        const v = secs(document.getElementById("edAllSecs").value, 0, 3600, DEFAULT_SECONDS);
        d.questions.forEach(q => { q.seconds = v; });
        S.edit.dirty = true;
        rerenderEditor();
        toast(v ? "Every question now has " + v + " seconds" : "Timers turned off");
        return;
      }
      if (a === "addmc" || a === "addtext") {
        const lastQ = d.questions[d.questions.length - 1];
        const sec = lastQ ? Number(lastQ.seconds) || 0 : DEFAULT_SECONDS;
        d.questions.push(a === "addmc" ? newMC(sec) : newText(sec));
        S.edit.dirty = true;
        renderEditor();
        const cards = document.querySelectorAll(".qcard");
        const last = cards[cards.length - 1];
        if (last) { last.scrollIntoView({ block: "center" }); const ta = last.querySelector("textarea.qt"); if (ta) ta.focus(); }
      } else if (a === "back") {
        if (S.edit.dirty && !(await confirmBox("Leave without saving?", "Your changes to this quiz will be lost.", "Discard changes", "danger solid"))) return;
        S.edit = null; S.view = "quizzes"; render();
      } else if (a === "save" || a === "saveact") {
        const c = cleanQuiz(d);
        b.disabled = true;
        try {
          const id = await store.saveQuiz(S.edit.id, c);
          S.edit.id = id; S.edit.dirty = false;
          toast("Saved");
          if (a === "saveact") {
            const pr = problems(c);
            if (pr.length) { rerenderEditor(); activate({ id, ...c }); return; }
            S.edit = null;
            await activate({ id, ...c });
            return;
          }
          rerenderEditor();
        } catch (err) { onErr(err); }
        finally { b.disabled = false; }
      }
    });
  }
  window.addEventListener("beforeunload", e => { if (S.view === "edit" && S.edit && S.edit.dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- common wiring ----------
  function wireCommon() {
    root.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", async () => {
      if (S.view === "edit" && S.edit && S.edit.dirty && !(await confirmBox("Leave without saving?", "Your changes to this quiz will be lost.", "Discard changes", "danger solid"))) return;
      if (S.view === "edit") S.edit = null;
      S.view = b.dataset.view;
      render();
    }));
    root.querySelectorAll("[data-act=signin]").forEach(b => b.addEventListener("click", async () => {
      try { await store.signIn(); }
      catch (e) {
        const el = document.getElementById("siErr");
        if (el) { el.hidden = false; el.textContent = e && e.code === "auth/unauthorized-domain" ? "This web address isn't allowed to sign in yet. In Firebase: Authentication → Settings → Authorized domains → add gutierrezmannix.github.io." : e && e.code === "auth/popup-blocked" ? "The browser blocked the sign-in window. Allow pop-ups for this site and try again." : "Sign-in didn't finish. Try again."; }
      }
    }));
    root.querySelectorAll("[data-act=signout]").forEach(b => b.addEventListener("click", () => store.signOut()));
    root.querySelectorAll("[data-act=reload]").forEach(b => b.addEventListener("click", () => location.reload()));
    root.querySelectorAll("[data-act=deactivate]").forEach(b => b.addEventListener("click", deactivate));
    root.querySelectorAll("[data-act=copylink]").forEach(b => b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText("https://" + STUDENT_URL); toast("Copied https://" + STUDENT_URL); }
      catch (e) { toast("Student link: https://" + STUDENT_URL); }
    }));
    root.querySelectorAll("[data-act=resetdemo]").forEach(b => b.addEventListener("click", async e => {
      e.preventDefault();
      if (await confirmBox("Reset the demo?", "This clears the demo quizzes and results in this browser.", "Reset", "danger solid")) { store.resetDemo(); S.view = "quizzes"; S.edit = null; render(); }
    }));
  }

  render();
}
