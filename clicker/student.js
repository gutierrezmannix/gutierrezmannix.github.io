// Student phone page: join with name + student ID (+ room code), answer, see right or wrong.
import { getStore, DEMO } from "./store.js?v=5";
import { LETTERS, autoMark, phoneScore, randomId, fmtPts, pts, timeLeft, clock, MAX_TEXT } from "./scoring.js?v=5";
import { TEACHER_NAME } from "./config.js?v=5";
import { dialHtml, updateDials } from "./aztec.js?v=5";

// What this phone remembers. In demo mode each browser tab acts as its own phone.
const box = () => (DEMO ? sessionStorage : localStorage);
const LS = {
  get(k) { try { return JSON.parse(box().getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { box().setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  del(k) { try { box().removeItem(k); } catch (e) { /* ignore */ } }
};
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const plural = (n, w) => fmtPts(n) + " " + w + (Number(n) === 1 ? "" : "s");

function device() {
  let d = LS.get("clicker.device");
  if (!d) { d = randomId(20); LS.set("clicker.device", d); }
  return d;
}
// Everything a phone remembers about one run: who joined and what they answered.
const recKey = runId => "clicker.run." + runId;
const getRec = runId => (runId ? LS.get(recKey(runId)) : null);
const putRec = (runId, r) => LS.set(recKey(runId), r);

export async function mountStudent(root) {
  const store = await getStore();
  let live = null, loadErr = null, screen = "", joinErr = "", busy = false, flash = "", wasUp = false;
  const mem = {}; // fallback when localStorage is blocked
  const rec = () => (live && live.runId ? getRec(live.runId) || mem[live.runId] || null : null);
  const saveRec = r => { mem[live.runId] = r; putRec(live.runId, r); };

  store.watchLive(l => { live = l || { active: false }; loadErr = null; render(); }, e => { loadErr = e; render(); });
  render();

  function frame(inner, me) {
    const course = live && live.active && live.course ? `<small>${esc(live.course)}</small>` : "";
    return (DEMO ? `<div class="demo-bar">Demo mode: answers stay in this browser. Teacher side: <a href="./?demo#teacher" target="_blank" rel="noopener">open it in a new tab</a>.</div>` : "") +
      `<div class="st"><header class="st-top"><span class="st-brand">Clicker${course}</span><span class="st-me">${me ? esc(me) : ""}</span></header>` +
      `<main class="st-main" id="stMain">${inner}</main>` +
      `<footer class="st-foot">${esc(TEACHER_NAME)}</footer></div>`;
  }

  function keyFor() {
    if (loadErr) return "err";
    if (!live) return "load";
    if (!live.active) return "none";
    const r = rec();
    if (!r) return live.phase === "ended" ? "over" : "join:" + live.runId;
    if (live.phase === "lobby" || live.q < 0) return "lobby:" + live.runId;
    return live.phase + ":" + live.runId + ":" + live.q;
  }

  function render(force) {
    const k = keyFor();
    if (k === screen && !force) return;
    if (k !== screen) flash = "";
    screen = k;
    const r = rec();
    const me = r ? r.name : "";
    let html = "";
    if (k === "err") {
      html = `<div class="card"><h2>Can't reach the clicker</h2><p>Check your internet connection and reload the page.</p>
        <p class="muted" style="font-size:.85rem">${esc(loadErr && loadErr.code === "permission-denied" ? "The clicker isn't switched on yet." : "")}</p>
        <button class="btn" type="button" data-act="reload">Reload</button></div>`;
    } else if (k === "load") {
      html = `<div class="card"><p class="muted">Connecting…</p><div class="waiting"><i></i><i></i><i></i></div></div>`;
    } else if (k === "none") {
      html = `<div class="card"><h2>No quiz right now</h2><p>Keep this page open. It changes by itself when ${esc(TEACHER_NAME)} activates a quiz.</p><div class="waiting" aria-hidden="true"><i></i><i></i><i></i></div></div>`;
    } else if (k === "over") {
      html = `<div class="card"><h2>${esc(live.title)}</h2><p>This quiz has ended. Wait here for the next one.</p></div>`;
    } else if (k.startsWith("join:")) {
      html = joinHtml();
    } else if (k.startsWith("lobby:")) {
      html = `<div class="card"><span class="eyebrow">${esc(live.title)}</span><h2>You're in, ${esc(String(r.name).split(/\s+/)[0])}!</h2>
        <p>Wait for the first question. Keep this page open.</p><div class="waiting" aria-hidden="true"><i></i><i></i><i></i></div>
        <button class="linkbtn" type="button" data-act="notme">Not ${esc(r.name)}? Join again</button></div>`;
    } else if (live.phase === "open" || live.phase === "closed") {
      html = questionHtml(r, live.phase === "closed");
    } else if (live.phase === "revealed") {
      html = revealHtml(r);
    } else if (live.phase === "ended") {
      html = endHtml(r);
    }
    root.innerHTML = frame(html, me);
    updateDials(root, live, Date.now(), timeLeft);
    wire();
  }

  function joinHtml() {
    const me = LS.get("clicker.me") || {};
    return `<form class="card" id="joinForm" novalidate>
      <h2>${esc(live.title || "Join the quiz")}</h2>
      <div class="field"><label for="jName">Your name (first and last)</label>
        <input id="jName" name="name" autocomplete="name" autocapitalize="words" maxlength="60" required value="${esc(me.name || "")}"></div>
      <div class="field"><label for="jId">Student ID</label>
        <input id="jId" name="sid" inputmode="numeric" autocomplete="off" maxlength="20" required value="${esc(me.studentId || "")}"></div>
      ${live.needCode ? `<div class="field"><label for="jCode">Room code (on the screen)</label>
        <input id="jCode" name="code" class="code-in" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="4" required></div>` : ""}
      <div class="err" id="jErr" ${joinErr ? "" : "hidden"}>${esc(joinErr)}</div>
      <button class="big-btn" type="submit" id="jGo">Join</button>
    </form>`;
  }

  function qInfo() {
    const q = live.question || {};
    return { q, n: live.q + 1, of: live.total, p: pts(q) };
  }

  function questionHtml(r, closed) {
    const { q, n, of, p } = qInfo();
    const mine = (r.answers || {})[live.q];
    const dial = !closed && live.timer ? dialHtml("timer", "az-phone") : "";
    const text = live.showText && q.text ? `<p class="qtext">${esc(q.text)}</p>` : `<p class="note" style="text-align:left">Look at the screen for the question.</p>`;
    const head = `<div class="qtop"><div class="qtop-text"><div class="qhead"><span>Question ${n} of ${of} · ${plural(p, "point")}${q.opinion ? " · opinion" : ""}</span></div>${text}</div>${dial}</div>`;
    let body = "";
    if (q.type === "text") {
      if (closed) {
        body = `<div class="card"><p class="muted" style="font-size:.85rem">Your answer</p><p class="qtext">${mine && mine.text ? esc(mine.text) : "<span class='muted'>No answer</span>"}</p></div>`;
      } else {
        body = `<form class="card textans" id="textForm"><div class="field"><label for="tAns">Your answer</label>
          <textarea id="tAns" maxlength="${MAX_TEXT}" autocapitalize="sentences">${esc(mine && mine.text || "")}</textarea><span class="hint" id="tCount" hidden></span></div>
          <button class="big-btn" type="submit" id="tGo">${mine && mine.text ? "Send again" : "Send"}</button></form>`;
      }
    } else {
      const opts = q.options || [];
      const withText = live.showText && opts.some(o => o);
      body = `<div class="tiles${closed ? " locked" : ""}" style="--rows:${Math.max(1, Math.ceil(opts.length / 2))}" role="group" aria-label="Answers">` +
        opts.map((o, i) => `<button type="button" class="tile" data-choice="${i}" aria-pressed="${mine && mine.choice === i ? "true" : "false"}" ${closed ? "disabled" : ""}><b>${LETTERS[i]}</b>${withText && o ? `<small>${esc(o)}</small>` : ""}</button>`).join("") +
        `</div>`;
    }
    let status = "";
    if (flash) status = `<div class="err">${esc(flash)}</div>`;
    else if (closed) status = `<p class="note">Voting closed.${mine ? ` Your answer: <b>${q.type === "text" ? "sent" : LETTERS[mine.choice]}</b>` : " You didn't answer this one."}</p>`;
    else if (timeUp()) status = `<p class="note"><b>Time's up.</b>${mine ? ` Your answer: <b>${q.type === "text" ? "sent" : LETTERS[mine.choice]}</b>` : " You didn't answer this one."}</p>`;
    else if (mine && mine.sending) status = `<p class="note">Sending…</p>`;
    else if (mine) status = q.type === "text"
      ? `<p class="note">Sent ✓. You can edit it and send again until voting closes.</p>`
      : `<p class="note">Sent ✓ <b>${LETTERS[mine.choice]}</b>. You can change it until voting closes.</p>`;
    else status = `<p class="note">${q.type === "text" ? "Type your answer and press Send." : "Tap your answer."}</p>`;
    return head + body + `<div id="stStatus">${status}</div>`;
  }

  function soFar(r) {
    const s = phoneScore(live.keys || {}, r.answers || {});
    return `${fmtPts(s.got)} of ${plural(s.max, "point")} so far`;
  }

  // A friendly line under a wrong answer; changes from question to question.
  function cheer(q) {
    const lines = ["You'll get the next one!", "Good try. Keep going!", "Almost there. Stay with it!", "No worries, on to the next one!"];
    return lines[Math.abs(Number(q) || 0) % lines.length];
  }

  function revealHtml(r) {
    const key = (live.keys || {})[live.q] || live.reveal || {};
    const mine = (r.answers || {})[live.q];
    const m = autoMark(key, mine);
    const label = esc(key.label || "");
    const yours = mine ? (key.type === "text" ? `“${esc(mine.text)}”` : LETTERS[mine.choice]) : "";
    let html;
    if (m.status === "right") html = `<div class="screen ok"><div class="ring">✓</div><div class="big">Correct!</div><div class="key">${label}</div><div class="so">+${plural(m.points, "point")} · ${soFar(r)}</div></div>`;
    else if (m.status === "wrong") html = `<div class="screen no"><div class="big">Oops!</div><div class="ans">The correct answer is</div><div class="key">${label}</div><div class="ans soft">You answered ${yours}. ${cheer(live.q)}</div><div class="so">${soFar(r)}</div></div>`;
    else if (m.status === "counted") html = `<div class="screen info"><div class="ring">✓</div><div class="big">Counted</div><div class="ans">Opinion question: every answer gets the points.</div><div class="so">+${plural(m.points, "point")} · ${soFar(r)}</div></div>`;
    else if (m.status === "pending") html = `<div class="screen info"><div class="ring">✎</div><div class="big">Answer saved</div><div class="ans">${esc(TEACHER_NAME)} will grade this one.</div><div class="so">${soFar(r)}</div></div>`;
    else html = `<div class="screen wait"><div class="big">Missed this one</div>${key.opinion ? `<div class="ans">This was an opinion question.</div>` : `<div class="ans">The correct answer is</div><div class="key">${label}</div>`}<div class="ans soft">Be ready for the next one!</div><div class="so">${soFar(r)}</div></div>`;
    const last = live.q + 1 >= live.total;
    const next = live.advance ? `<p class="note" data-cd="advance">${last ? "Final score" : "Next question"} in <b class="cd-n">${clock(timeLeft(live.advance, Date.now()))}</b></p>` : `<p class="note">Wait for the next question.</p>`;
    return `<div class="qhead"><span>Question ${live.q + 1} of ${live.total}</span><span>${plural(pts(key), "point")}</span></div>` + html + next;
  }

  function endHtml(r) {
    const keys = live.keys || {};
    const s = phoneScore(keys, r.answers || {});
    const dots = Object.keys(keys).sort((a, b) => a - b).map(k => {
      const m = autoMark(keys[k], (r.answers || {})[k]);
      return `<i class="${m.status}" title="Question ${Number(k) + 1}">${Number(k) + 1}</i>`;
    }).join("");
    return `<div class="card" style="text-align:center;justify-items:center"><span class="eyebrow">${esc(live.title)}</span>
      <div class="score-big">${fmtPts(s.got)} / ${fmtPts(s.max)}</div><p>points. Nice work, ${esc(String(r.name).split(/\s+/)[0])}. Your answers are saved.</p>
      ${s.pending ? `<p class="muted" style="font-size:.9rem">Up to ${plural(s.pending, "more point")} once ${esc(TEACHER_NAME)} grades your written answers.</p>` : ""}
      <div class="dotsq">${dots}</div><p class="muted" style="font-size:.85rem">You can close this page.</p></div>`;
  }

  function setStatus() {
    const el = document.getElementById("stStatus");
    if (!el) return;
    const tmp = document.createElement("div");
    tmp.innerHTML = questionHtml(rec(), live.phase === "closed");
    const s = tmp.querySelector("#stStatus");
    if (s) el.innerHTML = s.innerHTML;
    document.querySelectorAll(".tile[data-choice]").forEach(b => {
      const mine = (rec().answers || {})[live.q];
      b.setAttribute("aria-pressed", mine && mine.choice === Number(b.dataset.choice) ? "true" : "false");
    });
  }

  async function send(payload) {
    const runId = live.runId, q = live.q;
    const r = rec();
    const before = (r.answers || {})[q];
    r.answers = { ...(r.answers || {}), [q]: { ...payload, sending: true } };
    saveRec(r);
    flash = "";
    setStatus();
    try {
      await store.answer(runId, r.sid, q, payload);
      const r2 = getRec(runId) || mem[runId] || r;
      if (r2.answers && r2.answers[q]) delete r2.answers[q].sending;
      if (live.runId === runId) saveRec(r2); else putRec(runId, r2);
    } catch (e) {
      const r2 = getRec(runId) || mem[runId] || r;
      r2.answers = { ...(r2.answers || {}) };
      if (before) r2.answers[q] = before; else delete r2.answers[q];
      saveRec(r2);
      flash = e && e.code === "permission-denied" ? "Voting closed before your answer arrived." : "Your answer didn't go through. Check your connection and tap again.";
    }
    if (live.runId === runId && live.q === q && (live.phase === "open" || live.phase === "closed")) setStatus();
    else render(true);
  }

  // A half-second grace so a phone whose clock runs a little fast doesn't lock early.
  function timeUp() {
    if (!live || live.phase !== "open" || !live.timer || live.timer.paused) return false;
    return Date.now() - Number(live.timer.endsAt) > 500;
  }
  setInterval(() => {
    if (!live || !live.active) return;
    const now = Date.now();
    root.querySelectorAll("[data-cd]").forEach(el => {
      const t = live[el.dataset.cd];
      if (!t) return;
      const left = timeLeft(t, now);
      const n = el.querySelector(".cd-n") || el;
      if (n.classList.contains("cd-n")) n.textContent = clock(left);
      el.classList.toggle("low", left <= 5000 && !t.paused);
      el.classList.toggle("paused", !!t.paused);
    });
    updateDials(root, live, now, timeLeft);
    root.querySelectorAll("[data-cdbar]").forEach(el => {
      const t = live[el.dataset.cdbar];
      const i = el.querySelector("i");
      if (t && i) i.style.width = (t.seconds ? Math.round(100 * timeLeft(t, now) / (t.seconds * 1000)) : 0) + "%";
    });
    const up = timeUp();
    if (up !== wasUp) {
      wasUp = up;
      root.querySelectorAll(".tile[data-choice]").forEach(b => { b.disabled = up; });
      const tiles = root.querySelector(".tiles");
      if (tiles) tiles.classList.toggle("locked", up);
      const tf = document.getElementById("textForm");
      if (tf) tf.querySelectorAll("textarea, button").forEach(x => { x.disabled = up; });
      if (rec() && (live.phase === "open")) setStatus();
    }
  }, 250);

  function wire() {
    wasUp = false;
    root.querySelectorAll("[data-act=reload]").forEach(b => b.addEventListener("click", () => location.reload()));
    const nm = root.querySelector("[data-act=notme]");
    if (nm) nm.addEventListener("click", () => { delete mem[live.runId]; LS.del(recKey(live.runId)); render(true); });
    const jf = document.getElementById("joinForm");
    if (jf) {
      const codeIn = document.getElementById("jCode");
      if (codeIn) codeIn.addEventListener("input", () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z]/g, ""); });
      jf.addEventListener("submit", async e => {
        e.preventDefault();
        if (busy) return;
        const name = document.getElementById("jName").value.trim().replace(/\s+/g, " ");
        const studentId = document.getElementById("jId").value.trim();
        const code = codeIn ? codeIn.value.trim().toUpperCase() : "";
        const errEl = document.getElementById("jErr");
        const say = m => { joinErr = m; errEl.textContent = m; errEl.hidden = !m; };
        if (name.length < 2) return say("Type your first and last name.");
        if (!studentId) return say("Type your student ID.");
        if (live.needCode && code.length !== 4) return say("Type the 4-letter room code from the screen.");
        busy = true;
        const btn = document.getElementById("jGo");
        btn.disabled = true; btn.textContent = "Joining…";
        const sid = randomId(20);
        const data = { name, studentId, device: device() };
        if (live.needCode) data.code = code;
        try {
          await store.join(live.runId, sid, data);
          LS.set("clicker.me", { name, studentId });
          saveRec({ sid, name, studentId, answers: {} });
          joinErr = "";
          busy = false;
          render(true);
        } catch (err) {
          busy = false;
          btn.disabled = false; btn.textContent = "Join";
          if (err && err.code === "permission-denied") say(live.needCode ? "That code doesn't match the one on the screen. Check it and try again." : "Couldn't join. The quiz may have just been turned off.");
          else say("Couldn't join. Check your connection and try again.");
        }
      });
    }
    root.querySelectorAll(".tile[data-choice]").forEach(b => b.addEventListener("click", () => {
      if (live.phase !== "open" || timeUp()) return;
      const i = Number(b.dataset.choice);
      const mine = (rec().answers || {})[live.q];
      if (mine && mine.choice === i && !mine.sending) return;
      send({ choice: i });
    }));
    const tf = document.getElementById("textForm");
    const ta = document.getElementById("tAns"), tc = document.getElementById("tCount");
    // Show a counter only when a long answer gets close to the limit.
    if (ta && tc) ta.addEventListener("input", () => {
      const n = ta.value.length;
      tc.hidden = n < MAX_TEXT - 2000;
      tc.textContent = n.toLocaleString() + " of " + MAX_TEXT.toLocaleString() + " characters";
    });
    if (tf) tf.addEventListener("submit", e => {
      e.preventDefault();
      if (timeUp()) return;
      const t = document.getElementById("tAns").value.trim().slice(0, MAX_TEXT);
      if (!t) { flash = "Type an answer first."; setStatus(); return; }
      send({ text: t }).then(() => { const b = document.getElementById("tGo"); if (b) b.textContent = "Send again"; });
    });
  }
}
