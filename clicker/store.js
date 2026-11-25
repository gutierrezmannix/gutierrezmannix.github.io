// Data layer. Talks to Firebase (Firestore), or, with ?demo in the address,
// to a copy kept in this browser so you can try everything without Firebase.
import { firebaseConfig, ADMIN_EMAIL } from "./config.js?v=5";

const FB = "https://www.gstatic.com/firebasejs/10.12.2";

export const DEMO = (() => {
  try { if (new URLSearchParams(location.search).has("demo")) return true; } catch (e) { /* ignore */ }
  return !firebaseConfig.apiKey;
})();

export function toDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return isNaN(d) ? null : d;
}

// Testing only: on localhost, ?emu=8080 talks to the Firebase emulators instead of the real project.
export const EMU = (() => {
  try {
    const p = new URLSearchParams(location.search).get("emu");
    return p && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? Number(p) : 0;
  } catch (e) { return 0; }
})();

const clone = x => (x == null ? x : JSON.parse(JSON.stringify(x)));

// ---------- Firebase ----------
async function firebaseStore() {
  const { initializeApp } = await import(`${FB}/firebase-app.js`);
  const fs = await import(`${FB}/firebase-firestore.js`);
  const app = initializeApp(EMU ? { ...firebaseConfig, projectId: "demo-clicker" } : firebaseConfig);
  const db = fs.getFirestore(app);
  if (EMU) fs.connectFirestoreEmulator(db, "127.0.0.1", EMU);
  let au = null, auth = null;
  async function authMod() {
    if (!au) {
      au = await import(`${FB}/firebase-auth.js`);
      auth = au.getAuth(app);
      if (EMU) au.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
    return au;
  }
  const liveRef = fs.doc(db, "clickerLive", "state");
  const data = d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) });
  const list = (ref, cb, err) => fs.onSnapshot(ref, s => cb(s.docs.map(data)), err);
  return {
    demo: false,
    stamp: () => fs.serverTimestamp(),
    watchLive(cb, err) {
      return fs.onSnapshot(liveRef, s => cb(s.exists() ? s.data({ serverTimestamps: "estimate" }) : { active: false }), err);
    },
    join(runId, sid, d) {
      return fs.setDoc(fs.doc(db, "clickerRuns", runId, "students", sid), { ...d, joinedAt: fs.serverTimestamp() });
    },
    answer(runId, sid, q, payload) {
      return fs.setDoc(fs.doc(db, "clickerRuns", runId, "answers", sid + "_" + q), { sid, q, ...payload, at: fs.serverTimestamp() });
    },
    async onAuth(cb) { const a = await authMod(); a.onAuthStateChanged(auth, cb); },
    async signIn() {
      const a = await authMod();
      if (EMU) return a.signInWithCredential(auth, a.GoogleAuthProvider.credential(JSON.stringify({ sub: "teacher", email: ADMIN_EMAIL, email_verified: true })));
      return a.signInWithPopup(auth, new a.GoogleAuthProvider());
    },
    async signOut() { const a = await authMod(); return a.signOut(auth); },
    setLive(d) { return fs.setDoc(liveRef, { ...d, updatedAt: fs.serverTimestamp() }); },
    watchQuizzes(cb, err) { return list(fs.collection(db, "clickerQuizzes"), cb, err); },
    async saveQuiz(id, d) {
      if (id) {
        await fs.setDoc(fs.doc(db, "clickerQuizzes", id), { ...d, updatedAt: fs.serverTimestamp() }, { merge: true });
        return id;
      }
      const r = await fs.addDoc(fs.collection(db, "clickerQuizzes"), { ...d, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() });
      return r.id;
    },
    deleteQuiz(id) { return fs.deleteDoc(fs.doc(db, "clickerQuizzes", id)); },
    async createRun(d) {
      const r = await fs.addDoc(fs.collection(db, "clickerRuns"), { ...d, startedAt: fs.serverTimestamp(), endedAt: null });
      return r.id;
    },
    updateRun(id, patch) { return fs.updateDoc(fs.doc(db, "clickerRuns", id), patch); },
    watchRuns(cb, err) {
      return list(fs.query(fs.collection(db, "clickerRuns"), fs.orderBy("startedAt", "desc"), fs.limit(300)), cb, err);
    },
    watchStudents(runId, cb, err) { return list(fs.collection(db, "clickerRuns", runId, "students"), cb, err); },
    watchAnswers(runId, cb, err) { return list(fs.collection(db, "clickerRuns", runId, "answers"), cb, err); },
    async deleteRun(id) {
      for (const sub of ["answers", "students"]) {
        const snap = await fs.getDocs(fs.collection(db, "clickerRuns", id, sub));
        for (let i = 0; i < snap.docs.length; i += 400) {
          const b = fs.writeBatch(db);
          snap.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
          await b.commit();
        }
      }
      await fs.deleteDoc(fs.doc(db, "clickerRuns", id));
    }
  };
}

// ---------- Demo (this browser only) ----------
function sampleQuiz() {
  return {
    title: "Federalism check (sample)",
    course: "POLS 2305",
    needCode: true,
    showText: true,
    autoNext: true,
    revealSeconds: 8,
    questions: [
      { id: "s1", seconds: 30, type: "mc", text: "Under the Articles of Confederation, most governing power was held by…", points: 1, opinion: false,
        options: ["The president", "The Supreme Court", "The states", "Congress's upper house"], correct: 2 },
      { id: "s2", seconds: 30, type: "mc", text: "Which amendment reserves to the states the powers not delegated to the national government?", points: 2, opinion: false,
        options: ["First Amendment", "Tenth Amendment", "Fourteenth Amendment", "Twenty-second Amendment"], correct: 1 },
      { id: "s3", seconds: 45, type: "text", text: "Name the 1819 Supreme Court case that upheld the national bank.", points: 2, opinion: false,
        accepted: ["McCulloch v. Maryland", "McCulloch"] },
      { id: "s4", seconds: 20, type: "mc", text: "Which level of government should handle border security?", points: 1, opinion: true,
        options: ["Federal", "State", "Shared equally", "Not sure"], correct: null },
      { id: "s5", seconds: 60, type: "text", text: "In one sentence: why might a state prefer block grants to categorical grants?", points: 1, opinion: false,
        accepted: [] }
    ]
  };
}

function demoStore() {
  const KEY = "clicker-demo-v1";
  const read = () => {
    try { const x = JSON.parse(localStorage.getItem(KEY)); if (x && x.quizzes) return x; } catch (e) { /* ignore */ }
    return null;
  };
  const fresh = () => ({ live: { active: false }, quizzes: { sample: { ...sampleQuiz(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } }, runs: {} });
  let db = read() || fresh();
  const subs = new Set();
  const emit = () => subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ } setTimeout(emit, 0); };
  const sync = () => { db = read() || db; };
  window.addEventListener("storage", e => { if (e.key === KEY) { db = read() || fresh(); emit(); } });
  const sub = fn => { subs.add(fn); setTimeout(fn, 0); return () => subs.delete(fn); };
  const now = () => new Date().toISOString();
  const deny = msg => { const e = new Error(msg || "Missing or insufficient permissions."); e.code = "permission-denied"; throw e; };
  const uid = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
  const authSubs = new Set();
  const getUser = () => { try { return JSON.parse(sessionStorage.getItem("clicker-demo-user")); } catch (e) { return null; } };
  return {
    demo: true,
    stamp: () => now(),
    watchLive(cb) { return sub(() => cb(clone(db.live || { active: false }))); },
    async join(runId, sid, d) {
      sync();
      const L = db.live || {}, run = db.runs[runId];
      if (!L.active || L.runId !== runId || !run) deny();
      if (L.needCode && d.code !== run.code) deny();
      if ((run.students || {})[sid]) deny();
      (run.students ||= {})[sid] = { ...d, joinedAt: now() };
      save();
    },
    async answer(runId, sid, q, payload) {
      sync();
      const L = db.live || {}, run = db.runs[runId];
      if (!L.active || L.runId !== runId || L.phase !== "open" || L.q !== q || !run || !(run.students || {})[sid]) deny();
      (run.answers ||= {})[sid + "_" + q] = { sid, q, ...payload, at: now() };
      save();
    },
    async onAuth(cb) { authSubs.add(cb); cb(getUser()); },
    async signIn() {
      const u = { email: "demo", displayName: "Demo teacher", demo: true };
      try { sessionStorage.setItem("clicker-demo-user", JSON.stringify(u)); } catch (e) { /* ignore */ }
      authSubs.forEach(cb => cb(u));
    },
    async signOut() { try { sessionStorage.removeItem("clicker-demo-user"); } catch (e) { /* ignore */ } authSubs.forEach(cb => cb(null)); },
    async setLive(d) { sync(); db.live = { ...clone(d), updatedAt: now() }; save(); },
    watchQuizzes(cb) { return sub(() => cb(Object.entries(db.quizzes).map(([id, q]) => ({ id, ...clone(q) })))); },
    async saveQuiz(id, d) {
      sync();
      if (id && db.quizzes[id]) { db.quizzes[id] = { ...db.quizzes[id], ...clone(d), updatedAt: now() }; save(); return id; }
      const nid = id || uid();
      db.quizzes[nid] = { ...clone(d), createdAt: now(), updatedAt: now() };
      save();
      return nid;
    },
    async deleteQuiz(id) { sync(); delete db.quizzes[id]; save(); },
    async createRun(d) { sync(); const id = uid(); db.runs[id] = { ...clone(d), startedAt: now(), endedAt: null, students: {}, answers: {} }; save(); return id; },
    async updateRun(id, patch) { sync(); if (!db.runs[id]) deny(); Object.assign(db.runs[id], clone(patch)); save(); },
    watchRuns(cb) {
      return sub(() => cb(Object.entries(db.runs).map(([id, r]) => {
        const { students, answers, ...rest } = r;
        return { id, ...clone(rest) };
      }).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))));
    },
    watchStudents(runId, cb) { return sub(() => cb(Object.entries((db.runs[runId] || {}).students || {}).map(([id, s]) => ({ id, ...clone(s) })))); },
    watchAnswers(runId, cb) { return sub(() => cb(Object.entries((db.runs[runId] || {}).answers || {}).map(([id, a]) => ({ id, ...clone(a) })))); },
    async deleteRun(id) { sync(); delete db.runs[id]; save(); },
    resetDemo() { db = fresh(); save(); }
  };
}

let storePromise = null;
export function getStore() {
  if (!storePromise) storePromise = DEMO ? Promise.resolve(demoStore()) : firebaseStore();
  return storePromise;
}
