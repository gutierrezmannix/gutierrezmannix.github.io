# Clicker

Live in-class quizzes. Students answer on their phones; you run the quiz from the projector.

- Students: **gutierrezmannix.github.io/clicker**
- You: **gutierrezmannix.github.io/clicker/#teacher** (sign in with Google)
- Try it without Firebase: **gutierrezmannix.github.io/clicker/?demo#teacher**, and open **/clicker/?demo** in other tabs. Each tab acts as one phone. Demo data stays in that browser.

It uses the same Firebase project as the Documentary Feed (`documentaryfeed-c9b1b`). It uses the same Google sign-in, and `gutierrezmannix.github.io` is already an authorized domain.

## One-time setup

1. Firebase console → project **DocumentaryFeed** → **Firestore Database → Rules**.
2. Replace everything with the contents of [`firestore.rules`](firestore.rules) and click **Publish**.

That file is the whole rules file for the project. It keeps every Documentary Feed rule unchanged and adds the clicker rules at the end. If you ever paste the Documentary Feed's own `firestore.rules` again, the clicker stops working, so always paste this one.

## How a class goes

1. **Quizzes** tab → **+ New quiz**. Each question is either *multiple choice* (2–6 options, click the correct one) or *text answer* (list the accepted answers, or leave the list empty to grade by hand). Each question has its own **points** and **timer** in seconds; a timer of 0 means you close voting yourself. Tick **Opinion** for questions with no right answer: every answer gets the points.
2. In class press **Activate**. Only one quiz is active at a time; activating another turns the first one off. The projector shows the link and a 4-letter room code.
3. Students type their name, student ID and the code.
4. Press **Start question 1** (or Space / → / a presenter remote's "next" key). With a timer, voting closes when time runs out. The correct answer shows for the number of seconds you set, then the next question opens by itself. You can pause the timer, add 10 seconds, reveal early, or go back.
5. **Results** tab: one row per student, points per question, total and percent. Click any cell to change its points (partial credit is allowed). For text questions, click **Q ✎** to grade identical answers in one go. **Download Excel** gives four sheets: Scores, Answers (with times), Questions (key and % right) and About.

Each activation is saved as a separate run, so two sections can take the same quiz on the same day and keep separate results.

## Privacy

Names, IDs and answers are stored only in Firestore, never in this repository. Only the signed-in owner account can read quizzes, answer keys, students or answers. Phones can read only the current question, and get the correct answer only when you reveal it. **Delete this run** in Results removes a run's answers for good.

## Files

| File | What it does |
|---|---|
| `index.html`, `main.js` | Page shell; `#teacher` loads the teacher page, anything else the student page |
| `student.js` | Phone page: join, answer, right/wrong, final score |
| `teacher.js` | Quiz list, editor, projector view, results, Excel |
| `scoring.js` | Grading rules shared by both pages |
| `store.js` | Firebase (or the in-browser demo) |
| `xlsx.js` | Writes the .xlsx and .csv files |
| `config.js` | Firebase settings, owner email, student link |
| `firestore.rules` | Security rules for the whole project |

## Tests

```
node --test clicker/tests/*.test.mjs                        # grading, timers, Excel
NODE_PATH=$(npm root -g) node clicker/tests/e2e-demo.cjs      # a full class in demo mode
```

The rules and the real Firebase code path were also run against the Firebase emulators, using `@firebase/rules-unit-testing` and the same e2e script with `EMU=8080`.
