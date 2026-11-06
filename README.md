# EPSO quiz

## Practise on your phone

Open the published quiz at <https://todorovskib.github.io/epso-quiz-practice/>. It is adapted for touch screens and narrow displays. The free GitHub Pages site and its quiz content are public; answers and scores remain in your browser and are not sent to a server.

You can also open `epso.html` locally without a server or account. Keep `js`, `css`, and `assets` beside the HTML file when sharing it with pupils.

The current app covers Bulgarian verbal, numerical, and abstract reasoning. The local bank contains **2,474 questions**: 820 verbal, 823 numerical, and 831 abstract. This includes the 74 supplied-material adaptations and 2,400 original parameterised exercises built from 32 verbal, 20 numerical, and 10 abstract patterns. These are variations of 62 patterns, not 2,400 independently authored passages. See [source notes](materials/SOURCES.md).

The default **Цялата банка** selects from all questions. You can also restrict a paper to the supplied materials or the original exercises. Set a section count to zero to practise only the other sections. Questions do not repeat within a paper. Selection prefers questions not previously included, and spreads original exercises across different patterns. After a pool is exhausted, the least recently included questions become eligible again. Original answer choices are shuffled while preserving the answer key and explanation.

**Незабавна обратна връзка при избор** is the default: clicking an answer immediately grades and locks it, displays why it is right or wrong, and offers **Следващ въпрос**. There is no confirmation step. Optional **Изпитен режим** keeps answers hidden until submission. Pupils can navigate, flag, skip, and revisit questions. Reviews include unanswered questions and diagrams. Results can be downloaded as a UTF-8 CSV file for the teacher.

On a computer, hover over a Bulgarian word in a question or explanation to see its English translation; on a phone, tap the word. The tooltip stays open until you tap elsewhere (or move the mouse away). Clicked or focused words can also be opened with Enter or Space.

IndexedDB caches the question bank locally and stores selection history. Local storage also retains history across page reloads. If browser storage is blocked, the bundled bank still works and history lasts for the current tab. Quiz answers and scores are not stored as permanent pupil records; export results before refreshing.

The 20/10/10 preset uses a 65-minute shared training timer. Official EPSO testing can use separate section timers and restrict returning to submitted sections. This local quiz does not enforce those restrictions. Answers exist in the client files, so this is a classroom practice tool, not a secure examination service. Results remain in the current browser tab until exported; refreshing starts a new session.

## Files

- `js/materials-bank.js`: adapted questions and source references.
- `js/expanded-bank.js`: the prebuilt 2,400-question original bank, available offline.
- `js/bank-store.js`: IndexedDB cache, question history, and random selection.
- `assets/questions/`: 31 extracted abstract question images.
- `js/app.js`: question generators and exam assembly.
- `js/extra-abstract.js`: extra visual reasoning questions with distinct answer figures.
- `js/quiz-ui.js`: quiz interaction, scoring, review, timer, and export.
- `css/styles.css`: appearance and mobile layout.
- `scripts/extract-materials.py` and `scripts/prepare-figures.py`: local extraction helpers; their Python dependencies are not needed to run the quiz.
- `scripts/bank/`: editable original question patterns.

To rebuild the original bank, run `node scripts/build-expanded-bank.cjs`. Run `node scripts/audit-expanded-bank.cjs` to independently recalculate every numerical key and check every abstract rule. Browser checks are in `scripts/verify-quiz.cjs` and `scripts/verify-expanded-quiz.cjs` and use the local Playwright installation.

Use UTF-8 explicitly when editing the files. `.editorconfig` records that setting. Avoid reading UTF-8 files with legacy PowerShell's default encoding and then writing the result back.
