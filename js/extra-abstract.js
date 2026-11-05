/* Use asymmetric shapes so differently oriented answers remain visually distinct. */
function generateAbstractQuestion() {
  const shape = pick([0, 1]);
  const startRotation = randInt(0, 3);
  const rotationStep = pick([1, 3]);
  const startDots = randInt(0, 3);
  const dotStep = pick([1, 3]);
  const startFilled = Math.random() < 0.5;
  const alternate = Math.random() < 0.5;
  const frame = step => ({
    rotation: (startRotation + step * rotationStep) % 4,
    dots: (startDots + step * dotStep) % 4 + 1,
    filled: alternate ? startFilled !== Boolean(step % 2) : startFilled
  });
  const draw = item => {
    const dots = Array.from({ length: item.dots }, (_, i) => `<circle cx="${18 + i * 14}" cy="76" r="3" fill="#e5e7eb"/>`).join("");
    return `<span class="option-visual"><svg viewBox="0 0 80 90" width="82" height="92" aria-hidden="true">${sequenceSymbolSvg(shape, item.rotation * 90, item.filled, 80)}${dots}</svg></span>`;
  };
  const answer = frame(5);
  const choices = shuffle([
    answer,
    { ...answer, rotation: (answer.rotation + 1) % 4 },
    { ...answer, dots: answer.dots % 4 + 1 },
    { ...answer, filled: !answer.filled },
    { ...answer, rotation: (answer.rotation + 2) % 4 }
  ]);
  const correct = choices.indexOf(answer);
  const describe = item => `${item.filled ? "Плътна" : "Контурна"} фигура, завъртане ${item.rotation * 90}°, ${item.dots} точки`;
  const explanation = `Фигурата се завърта с 90° ${rotationStep === 1 ? "по" : "обратно на"} часовниковата стрелка. Броят точки ${dotStep === 1 ? "нараства с 1 (след 4 следва 1)" : "намалява с 1 (след 1 следва 4)"}. Запълването ${alternate ? "се редува плътно и контурно" : "остава непроменено"}. Продължението е: ${describe(answer)}.`;
  return ensureQuestionShape({
    category: "abstract", title: "Абстрактно мислене", subcategory: "Абстрактно мислене · допълнителни упражнения",
    stemHtml: `<div class="visual-wrap"><p>Коя фигура продължава редицата?</p><div class="generated-sequence">${[0, 1, 2, 3, 4].map(step => draw(frame(step))).join("")}<span class="option-visual">?</span></div></div>`,
    reviewStem: "Редуване на завъртане, брой точки и запълване.",
    options: choices.map(item => ({ html: draw(item), plain: describe(item) })), correct, explanation,
    optionRationales: choices.map(item => item === answer ? explanation
      : `${item.rotation !== answer.rotation ? `Неправилна ориентация: очаква се ${answer.rotation * 90}°. ` : ""}${item.dots !== answer.dots ? `Неправилен брой точки: очакват се ${answer.dots}. ` : ""}${item.filled !== answer.filled ? "Запълването нарушава редуването или постоянството. " : ""}`),
    sourceTag: "Допълнително генерирано упражнение на български"
  });
}
