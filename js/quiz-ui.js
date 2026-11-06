"use strict";

const ui = Object.fromEntries([
  "setupScreen", "quizScreen", "resultScreen", "reviewScreen", "verbalCount", "numericalCount",
  "abstractCount", "minutes", "questionSource", "quizMode", "bankStatus", "setupError", "startBtn",
  "ad5PresetBtn", "quickBtn", "restartBtn", "reviewBtn", "backToResultsBtn", "sectionPill",
  "counterPill", "scorePill", "flagPill", "timerDisplay", "progressFill", "questionTitle",
  "questionMeta", "questionStem", "wordTranslation", "optionsContainer", "feedbackBox", "submitBtn", "nextBtn",
  "previousBtn", "skipBtn", "flagBtn", "finishBtn", "questionNavigator", "resultSummary",
  "totalScoreBox", "verbalScoreBox", "numericalScoreBox", "abstractScoreBox", "coachingText",
  "reviewContainer", "reviewFilter", "reviewWordTranslation", "exportBtn"
].map(id => [id, document.getElementById(id)]));

let selections = [];
let confirmed = new Set();
let deadline = 0;
let examFinished = true;
const translationCache = new Map();
const pendingTranslations = new Map();
let translationTooltipSequence = 0;

function showScreen(name) {
  ["setupScreen", "quizScreen", "resultScreen", "reviewScreen"].forEach(id => ui[id].classList.toggle("hidden", id !== name));
}

function questionMarkup(q) {
  const image = q.image ? `<div class="question-image-wrap"><img class="question-image ${q.source?.file.endsWith("docx") ? "docx" : ""}" src="${q.image}" alt="${escapeHtml(q.imageAlt)}"></div><a class="image-link" href="${q.image}" target="_blank" rel="noopener">Отвори фигурите в пълен размер</a>` : "";
  return (q.stemHtml || escapeHtml(q.stem)) + image;
}

function makeWordsTranslatable(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);

  textNodes.forEach(textNode => {
    const text = textNode.nodeValue;
    const words = [...text.matchAll(/[\p{Script=Cyrillic}\p{M}]+/gu)];
    if (!words.length) return;
    const fragment = document.createDocumentFragment();
    let offset = 0;
    words.forEach(match => {
      fragment.append(document.createTextNode(text.slice(offset, match.index)));
      const word = match[0];
      const button = document.createElement("span");
      button.className = "translatable-word";
      button.textContent = word;
      button.setAttribute("role", "button");
      button.setAttribute("tabindex", "0");
      button.setAttribute("aria-label", `Преведи „${word}“ на английски`);
      button.setAttribute("aria-expanded", "false");
      const tooltip = document.createElement("span");
      tooltip.className = "word-tooltip";
      tooltip.id = `word-tooltip-${++translationTooltipSequence}`;
      tooltip.setAttribute("role", "tooltip");
      button.setAttribute("aria-describedby", tooltip.id);
      button.append(tooltip);
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const opening = button.getAttribute("aria-expanded") !== "true";
        closeWordTooltips(button);
        button.classList.toggle("is-open", opening);
        button.setAttribute("aria-expanded", String(opening));
        if (opening) {
          setWordTooltip(button, translationCache.get(word) || "Зарежда се превод…");
          translateWord(word, button);
        } else button.querySelector(".word-tooltip").classList.remove("visible");
      });
      button.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        button.click();
      });
      button.addEventListener("pointerenter", event => {
        if (event.pointerType !== "mouse") return;
        button.classList.add("is-hovered");
        setWordTooltip(button, translationCache.get(word) || "Зарежда се превод…");
        translateWord(word, button);
      });
      button.addEventListener("pointerleave", event => {
        if (event.pointerType !== "mouse") return;
        button.classList.remove("is-hovered");
        hideWordTooltip(button, true);
      });
      button.addEventListener("focus", () => {
        setWordTooltip(button, translationCache.get(word) || "Зарежда се превод…");
        translateWord(word, button);
      });
      button.addEventListener("blur", () => {
        hideWordTooltip(button);
      });
      fragment.append(button);
      offset = match.index + word.length;
    });
    fragment.append(document.createTextNode(text.slice(offset)));
    textNode.replaceWith(fragment);
  });
}

function positionWordTooltip(word) {
  const tooltip = word.querySelector(".word-tooltip");
  if (!tooltip?.classList.contains("visible")) return;
  const wordRect = word.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const halfWidth = tooltipRect.width / 2;
  const left = Math.min(window.innerWidth - halfWidth - 12, Math.max(halfWidth + 12, wordRect.left + wordRect.width / 2));
  let top = wordRect.bottom + 8;
  if (top + tooltipRect.height > window.innerHeight - 8 && wordRect.top - tooltipRect.height - 8 >= 8) {
    top = wordRect.top - tooltipRect.height - 8;
  }
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function setWordTooltip(word, text) {
  const tooltip = word.querySelector(".word-tooltip");
  tooltip.textContent = text;
  tooltip.classList.add("visible");
  positionWordTooltip(word);
}

function hideWordTooltip(word, force = false) {
  if (word.classList.contains("is-open")) return;
  if (!force && (word.classList.contains("is-hovered") || word.matches(":focus"))) return;
  word.querySelector(".word-tooltip").classList.remove("visible");
}

function closeWordTooltips(except = null) {
  document.querySelectorAll(".translatable-word.is-open").forEach(word => {
    if (word === except) return;
    word.classList.remove("is-open");
    word.setAttribute("aria-expanded", "false");
    hideWordTooltip(word, true);
  });
}

function showTranslationError(word, output) {
  output.replaceChildren();
  output.append(document.createTextNode(`Преводът на „${word}“ не е наличен. Проверете връзката или опитайте `));
  const link = document.createElement("a");
  link.href = `https://translate.google.com/?sl=bg&tl=en&text=${encodeURIComponent(word)}&op=translate`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Google Translate";
  output.append(link, document.createTextNode("."));
}

async function translateWord(word, trigger) {
  const output = ui.reviewScreen.classList.contains("hidden") ? ui.wordTranslation : ui.reviewWordTranslation;
  try {
    let translation = translationCache.get(word);
    if (!translation) {
      let request = pendingTranslations.get(word);
      if (!request) {
        const params = new URLSearchParams({ q: word, langpair: "bg|en" });
        request = fetch(`https://api.mymemory.translated.net/get?${params}`)
          .then(response => {
            if (!response.ok) throw new Error(`Translation service returned ${response.status}`);
            return response.json();
          })
          .then(result => {
            const translated = result.responseData?.translatedText?.trim();
            if (Number(result.responseStatus) !== 200 || !translated) {
              throw new Error("Translation service returned no translation");
            }
            translationCache.set(word, translated);
            return translated;
          })
          .finally(() => pendingTranslations.delete(word));
        pendingTranslations.set(word, request);
      }
      translation = await request;
    }
    if (!trigger.isConnected) return;
    setWordTooltip(trigger, translation);
    trigger.setAttribute("aria-label", `${word}: ${translation}`);
    output.classList.add("hidden");
    output.textContent = "";
  } catch {
    if (!trigger.isConnected) return;
    setWordTooltip(trigger, "Преводът не е наличен");
    output.classList.remove("hidden");
    showTranslationError(word, output);
  }
}

document.addEventListener("click", event => {
  if (!event.target.closest?.(".translatable-word")) closeWordTooltips();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeWordTooltips();
});
const repositionWordTooltips = () => {
  document.querySelectorAll(".word-tooltip.visible").forEach(tooltip => positionWordTooltip(tooltip.parentElement));
};
window.addEventListener("resize", repositionWordTooltips);
window.addEventListener("scroll", repositionWordTooltips, true);

function refreshSetup() {
  const counts = window.EPSO_BANK.stats(ui.questionSource.value);
  ui.bankStatus.textContent = `Банка: ${counts.verbal.total} вербални · ${counts.numerical.total} числови · ${counts.abstract.total} абстрактни. Невключвани досега: ${counts.verbal.unseen + counts.numerical.unseen + counts.abstract.unseen}. Всеки тест избира нови случайни въпроси. За един раздел задайте 0 за останалите.`;
  ["verbal", "numerical", "abstract"].forEach(category => {
    ui[`${category}Count`].max = Math.min(counts[category].total, 100);
  });
}

function applyPreset(config) {
  ["verbalCount", "numericalCount", "abstractCount", "minutes"].forEach(key => { ui[key].value = config[key]; });
  ui.questionSource.value = config.source;
  ui.quizMode.value = config.mode;
  refreshSetup();
}

function readConfig() {
  const config = { source: ui.questionSource.value, mode: ui.quizMode.value };
  ["verbalCount", "numericalCount", "abstractCount", "minutes"].forEach(key => {
    const value = Number(ui[key].value);
    const min = key === "minutes" ? 5 : 0;
    const max = key === "minutes" ? 240 : Number(ui[key].max);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`Въведете цяло число от ${min} до ${max} за „${document.querySelector(`label[for="${key}"]`).textContent}“.`);
    }
    config[key] = value;
  });
  if (!(config.verbalCount + config.numericalCount + config.abstractCount)) {
    throw new Error("Изберете поне един въпрос.");
  }
  return config;
}

function startExam(config) {
  try {
    const nextExam = buildExam(config);
    if (!nextExam.length) throw new Error("Изберете поне един въпрос.");
    clearInterval(timerInterval);
    exam = nextExam;
    activeConfig = { ...config };
    window.EPSO_BANK.record(exam);
    currentIndex = 0;
    selections = new Array(exam.length).fill(null);
    confirmed = new Set();
    examFinished = false;
    deadline = Date.now() + config.minutes * 60_000;
    ui.setupError.classList.add("hidden");
    showScreen("quizScreen");
    tickTimer();
    timerInterval = setInterval(tickTimer, 500);
    loadQuestion();
  } catch (error) {
    ui.setupError.textContent = error.message;
    ui.setupError.classList.remove("hidden");
  }
}

function tickTimer() {
  secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  ui.timerDisplay.textContent = formatTime(secondsLeft);
  if (!secondsLeft && !examFinished) finishExam(true);
}

function renderNavigation() {
  ui.questionNavigator.replaceChildren();
  exam.forEach((q, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = index + 1;
    button.className = `${index === currentIndex ? "current " : ""}${selections[index] !== null ? "saved " : ""}${flaggedQuestionIds.has(q.id) ? "flagged" : ""}`;
    button.setAttribute("aria-label", `Въпрос ${index + 1}${flaggedQuestionIds.has(q.id) ? ", маркиран" : ""}${selections[index] !== null ? ", с отговор" : ", без отговор"}`);
    if (index === currentIndex) button.setAttribute("aria-current", "step");
    button.addEventListener("click", () => { currentIndex = index; loadQuestion(); });
    ui.questionNavigator.append(button);
  });
}

function loadQuestion() {
  const q = exam[currentIndex];
  ui.wordTranslation.textContent = "";
  ui.wordTranslation.classList.add("hidden");
  selectedOptionIndex = selections[currentIndex];
  answeredCurrent = confirmed.has(currentIndex);
  const practice = activeConfig.mode === "practice";
  ui.sectionPill.textContent = q.subcategory;
  ui.counterPill.textContent = `Въпрос ${currentIndex + 1} / ${exam.length}`;
  const answered = selections.filter(value => value !== null).length;
  ui.scorePill.textContent = practice ? `Точки: ${[...confirmed].filter(i => selections[i] === exam[i].correct).length}` : `С отговор: ${answered} / ${exam.length}`;
  ui.flagPill.textContent = `Маркирани: ${flaggedQuestionIds.size}`;
  ui.flagBtn.textContent = flaggedQuestionIds.has(q.id) ? "Премахни маркера" : "Маркирай";
  ui.progressFill.style.width = `${answered / exam.length * 100}%`;
  ui.questionTitle.textContent = q.title;
  ui.questionMeta.textContent = `${q.format === "legacy" ? "По-стар формат: вярно / невярно / не може да се каже. " : "Един правилен отговор. "}${q.sourceTag}`;
  ui.questionStem.innerHTML = questionMarkup(q);
  ui.questionStem.lang = "bg";
  makeWordsTranslatable(ui.questionStem);
  ui.optionsContainer.replaceChildren();
  ui.optionsContainer.classList.toggle("visual-choices", Boolean(q.image));
  ui.optionsContainer.setAttribute("role", "radiogroup");
  ui.optionsContainer.setAttribute("aria-label", "Отговори");
  q.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option";
    button.classList.toggle("selected", selectedOptionIndex === index);
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(selectedOptionIndex === index));
    button.setAttribute("aria-label", `${String.fromCharCode(65 + index)}. ${optionPlain(option)}`);
    button.innerHTML = `<strong>${String.fromCharCode(65 + index)}.</strong> ${optionHtml(option)}`;
    button.addEventListener("click", () => {
      if (practice && confirmed.has(currentIndex)) return;
      selections[currentIndex] = index;
      if (practice) confirmed.add(currentIndex);
      loadQuestion();
      if (practice) ui.feedbackBox.focus({ preventScroll: true });
      else ui.optionsContainer.children[index].focus();
    });
    ui.optionsContainer.append(button);
  });
  ui.feedbackBox.className = "feedback hidden";
  ui.submitBtn.classList.toggle("hidden", practice);
  ui.submitBtn.textContent = practice ? "Провери отговора" : currentIndex === exam.length - 1 ? "Предай теста" : "Запази и продължи";
  ui.nextBtn.classList.toggle("hidden", !practice || !answeredCurrent);
  ui.previousBtn.disabled = currentIndex === 0;
  ui.skipBtn.classList.toggle("hidden", practice && answeredCurrent);
  if (practice && answeredCurrent) showFeedback(q);
  renderNavigation();
}

function showFeedback(q) {
  const selected = selections[currentIndex];
  const correct = selected === q.correct;
  [...ui.optionsContainer.children].forEach((element, index) => {
    element.classList.toggle("correct", index === q.correct);
    element.classList.toggle("wrong", index === selected && !correct);
    element.disabled = true;
  });
  ui.feedbackBox.className = `feedback ${correct ? "good" : "bad"}`;
  ui.feedbackBox.innerHTML = `<strong>${correct ? "Правилно" : "Грешно"}</strong>
    <p>Правилен отговор: ${String.fromCharCode(65 + q.correct)}. ${escapeHtml(optionPlain(q.options[q.correct]))}</p>
    ${q.options[q.correct].html || ''}
    ${correct ? "" : `<p><strong>За вашия избор:</strong> ${escapeHtml(q.optionRationales[selected])}</p>`}
    <p class="explanation">${escapeHtml(q.explanation)}</p>
    <details><summary>Обяснение за всеки вариант</summary><ul>${q.options.map((option, i) => `<li><strong>${String.fromCharCode(65 + i)}. ${escapeHtml(optionPlain(option))}</strong>: ${escapeHtml(q.optionRationales[i])}</li>`).join("")}</ul></details>`;
  makeWordsTranslatable(ui.feedbackBox);
}

function advance() {
  if (currentIndex < exam.length - 1) { currentIndex++; loadQuestion(); }
  else requestFinish();
}

function submitCurrentAnswer() {
  if (selections[currentIndex] === null) {
    ui.feedbackBox.className = "feedback";
    ui.feedbackBox.textContent = "Изберете отговор или използвайте „Пропусни“.";
    return;
  }
  confirmed.add(currentIndex);
  if (activeConfig.mode === "practice") loadQuestion();
  else advance();
}

function requestFinish() {
  const missing = selections.filter(value => value === null).length;
  if (confirm(missing ? `Има ${missing} въпроса без отговор. Да приключи ли тестът?` : "Да предадете ли теста за оценяване?")) finishExam(false);
}

function finishExam(timeExpired) {
  if (examFinished) return;
  examFinished = true;
  clearInterval(timerInterval);
  results.score = 0;
  Object.values(results.byCategory).forEach(stats => { stats.correct = 0; });
  Object.values(results.bySubcategory).forEach(stats => { stats.correct = 0; });
  results.answers = exam.map((q, index) => {
    const selected = selections[index];
    const isCorrect = selected === q.correct;
    if (isCorrect) {
      results.score++;
      results.byCategory[q.category].correct++;
      results.bySubcategory[q.subcategory].correct++;
    }
    return { q, questionNumber: index + 1, selected, isCorrect, flagged: flaggedQuestionIds.has(q.id) };
  });
  ui.totalScoreBox.textContent = `${results.score} / ${exam.length}`;
  ["verbal", "numerical", "abstract"].forEach(category => {
    const stats = results.byCategory[category];
    ui[`${category}ScoreBox`].textContent = `${stats.correct} / ${stats.total}`;
  });
  const missing = selections.filter(value => value === null).length;
  ui.resultSummary.textContent = `${timeExpired ? "Времето изтече. " : ""}Резултат: ${results.score} от ${exam.length} (${(100 * results.score / exam.length).toFixed(1)}%). Без отговор: ${missing}.`;
  const advice = {
    verbal: "Търсете доказателство в текста. Разграничавайте „възможно“ от „сигурно“, „някои“ от „всички“ и корелация от причинност.",
    numerical: "Проверявайте мерните единици и основата на процента. Записвайте формулата и закръгляйте само крайния резултат.",
    abstract: "Проследявайте поотделно броя, движението, завъртането и запълването. Проверявайте правилото във всички кадри."
  };
  ui.coachingText.textContent = Object.entries(results.byCategory).filter(([, stats]) => stats.total).map(([category, stats]) =>
    `${({ verbal: "Вербално", numerical: "Числово", abstract: "Абстрактно" })[category]}: ${stats.correct}/${stats.total}. ${advice[category]}`).join("\n\n");
  showScreen("resultScreen");
}

function openReview() {
  showScreen("reviewScreen");
  ui.reviewWordTranslation.textContent = "";
  ui.reviewWordTranslation.classList.add("hidden");
  const filter = ui.reviewFilter.value;
  const answers = results.answers.filter(item => filter === "all" || filter === "wrong" && !item.isCorrect || filter === "flagged" && item.flagged);
  ui.reviewContainer.innerHTML = answers.map(({ q, questionNumber, selected, isCorrect, flagged }) => `<article class="review-card" lang="bg">
    <div class="small">Въпрос ${questionNumber} · ${escapeHtml(q.subcategory)}${flagged ? " · маркиран" : ""}</div>
    <div class="stem">${questionMarkup(q)}</div>
    <p><strong>Вашият отговор:</strong> ${selected === null ? "Без отговор" : `${String.fromCharCode(65 + selected)}. ${escapeHtml(optionPlain(q.options[selected]))}`}</p>
    <p><strong>Правилен отговор:</strong> ${String.fromCharCode(65 + q.correct)}. ${escapeHtml(optionPlain(q.options[q.correct]))}</p>
    <strong style="color:var(--${isCorrect ? "good" : "bad"})">${isCorrect ? "Правилно" : selected === null ? "Пропуснат въпрос" : "Грешно"}</strong>
    ${selected !== null && !isCorrect ? `<p>${escapeHtml(q.optionRationales[selected])}</p>` : ""}
    <p class="explanation">${escapeHtml(q.explanation)}</p><div class="small">${escapeHtml(q.sourceTag)}</div>
    </article>`).join("") || "<p>Няма въпроси за този филтър.</p>";
  makeWordsTranslatable(ui.reviewContainer);
  ui.reviewContainer.lang = "bg";
}

function exportResults() {
  const rows = [["Въпрос", "Раздел", "Условие", "Избран отговор", "Правилен отговор", "Точки", "Маркиран", "Източник", "Обяснение"],
    ...results.answers.map(({ q, questionNumber, selected, isCorrect, flagged }) => [questionNumber, q.subcategory,
      q.reviewStem || q.stem, selected === null ? "Без отговор" : `${String.fromCharCode(65 + selected)}. ${optionPlain(q.options[selected])}`,
      `${String.fromCharCode(65 + q.correct)}. ${optionPlain(q.options[q.correct])}`, Number(isCorrect), flagged ? "Да" : "Не", q.sourceTag, q.explanation])];
  const csv = "\uFEFF" + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "epso-rezultat.csv"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

ui.startBtn.addEventListener("click", () => {
  try { startExam(readConfig()); }
  catch (error) { ui.setupError.textContent = error.message; ui.setupError.classList.remove("hidden"); }
});
ui.ad5PresetBtn.addEventListener("click", () => applyPreset(AD5_STYLE_CONFIG));
ui.quickBtn.addEventListener("click", () => startExam({ ...QUICK_CONFIG, source: ui.questionSource.value }));
ui.questionSource.addEventListener("change", refreshSetup);
ui.submitBtn.addEventListener("click", submitCurrentAnswer);
ui.nextBtn.addEventListener("click", advance);
ui.skipBtn.addEventListener("click", advance);
ui.previousBtn.addEventListener("click", () => { if (currentIndex > 0) { currentIndex--; loadQuestion(); } });
ui.flagBtn.addEventListener("click", () => {
  const id = exam[currentIndex].id;
  flaggedQuestionIds.has(id) ? flaggedQuestionIds.delete(id) : flaggedQuestionIds.add(id);
  loadQuestion();
});
ui.finishBtn.addEventListener("click", requestFinish);
ui.restartBtn.addEventListener("click", () => { refreshSetup(); showScreen("setupScreen"); });
ui.reviewBtn.addEventListener("click", () => { ui.reviewFilter.value = "all"; openReview(); });
ui.reviewFilter.addEventListener("change", openReview);
ui.backToResultsBtn.addEventListener("click", () => showScreen("resultScreen"));
ui.exportBtn.addEventListener("click", exportResults);
document.addEventListener("keydown", event => {
  if (examFinished || ui.quizScreen.classList.contains("hidden") || event.ctrlKey || event.altKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  const index = event.key.toUpperCase().charCodeAt(0) - 65;
  if (event.key.length === 1 && index >= 0 && index < exam[currentIndex].options.length) {
    ui.optionsContainer.children[index].click();
    event.preventDefault();
  }
});
refreshSetup();
showScreen("setupScreen");
[ui.startBtn, ui.quickBtn].forEach(button => { button.disabled = true; });
window.EPSO_BANK.ready.finally(() => {
  refreshSetup();
  [ui.startBtn, ui.quickBtn].forEach(button => { button.disabled = false; });
});
