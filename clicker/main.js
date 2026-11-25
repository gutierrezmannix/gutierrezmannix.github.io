// Students land on /clicker. You open /clicker/#teacher.
const root = document.getElementById("app");
const isTeacher = () => location.hash.replace("#", "").toLowerCase() === "teacher";
let mode = isTeacher();

async function start() {
  try {
    if (mode) (await import("./teacher.js?v=4")).mountTeacher(root);
    else (await import("./student.js?v=4")).mountStudent(root);
  } catch (e) {
    console.error(e);
    root.innerHTML = '<div class="boot"><b>The clicker could not load.</b><br>Check your internet connection and reload the page.</div>';
  }
}
window.addEventListener("hashchange", () => { if (isTeacher() !== mode) location.reload(); });
start();
