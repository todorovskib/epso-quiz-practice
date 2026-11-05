// ==========================
    // CONFIG
    // ==========================
    const DEFAULT_CONFIG = {
      verbalCount: 20,
      numericalCount: 10,
      abstractCount: 10,
      minutes: 65,
      source: "all",
      mode: "practice"
    };

    const AD5_STYLE_CONFIG = {
      verbalCount: 20,
      numericalCount: 10,
      abstractCount: 10,
      minutes: 65,
      source: "all",
      mode: "practice"
    };

    const QUICK_CONFIG = {
      verbalCount: 2,
      numericalCount: 2,
      abstractCount: 2,
      minutes: 15,
      source: "all",
      mode: "practice"
    };

    const CATEGORY_LANGUAGE = {
      verbal: "bg",
      numerical: "bg",
      abstract: "bg"
    };

    // ==========================
    // STATE
    // ==========================
    let exam = [];
    let currentIndex = 0;
    let selectedOptionIndex = null;
    let answeredCurrent = false;
    let timerInterval = null;
    let secondsLeft = 0;
    let activeConfig = { ...DEFAULT_CONFIG };
    const flaggedQuestionIds = new Set();
    const questionPools = {
      verbal: null,
      numerical: null,
      abstract: null
    };

    const results = {
      score: 0,
      byCategory: {
        verbal: { correct: 0, total: 0 },
        numerical: { correct: 0, total: 0 },
        abstract: { correct: 0, total: 0 }
      },
      bySubcategory: {},
      answers: []
    };

    // ==========================
    // UTILITIES
    // ==========================
    function randInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function pick(arr) {
      return arr[randInt(0, arr.length - 1)];
    }

    function shuffle(arr) {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function formatTime(totalSeconds) {
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function stripHtml(html) {
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    }

    function normalizeOption(opt) {
      if (typeof opt === "string") {
        return { text: opt, plain: opt };
      }
      if (opt && typeof opt === "object") {
        if (typeof opt.text === "string") {
          return { text: opt.text, plain: opt.plain || opt.text };
        }
        if (typeof opt.html === "string") {
          return { html: opt.html, plain: opt.plain || stripHtml(opt.html) };
        }
      }
      const fallback = String(opt);
      return { text: fallback, plain: fallback };
    }

    function optionHtml(option) {
      if (option.html) return option.html;
      return escapeHtml(option.text || option.plain || "");
    }

    function optionPlain(option) {
      return option.plain || option.text || stripHtml(option.html || "");
    }

    function defaultOptionRationale(optionText, isCorrect) {
      if (isCorrect) {
        return "Това е най-добрият отговор, защото съответства на ключовото условие във въпроса.";
      }
      return "Този отговор не е най-добрият. Проверете точната формулировка и условията в задачата.";
    }

    function ensureQuestionShape(question) {
      const normalized = { ...question };
      normalized.options = (normalized.options || []).map(normalizeOption);
      normalized.reviewStem = normalized.reviewStem || stripHtml(normalized.stemHtml || normalized.stem || "");
      normalized.sourceTag = normalized.sourceTag || "Оригинална тренировъчна задача";
      if (!Array.isArray(normalized.optionRationales)) {
        normalized.optionRationales = normalized.options.map((opt, idx) =>
          defaultOptionRationale(optionPlain(opt), idx === normalized.correct)
        );
      }
      while (normalized.optionRationales.length < normalized.options.length) {
        const idx = normalized.optionRationales.length;
        normalized.optionRationales.push(defaultOptionRationale(optionPlain(normalized.options[idx]), idx === normalized.correct));
      }
      return normalized;
    }

    function colorDot(hex) {
      return `<span class="legend-color" style="background:${hex};"></span>`;
    }

    // ==========================
    // REASONING GENERATORS
    // ==========================
    function generateVerbalQuestion() {
      const scenarios = [
        {
          subject: "програма за обмен на експертен опит",
          actors: ["публични университети", "изследователски организации"],
          states: randInt(3, 7),
          fundedPct: pick([25, 30, 35, 40, 45, 50]),
          duration: pick([12, 18, 24, 30]),
          priority: "ясен план за разпространение на резултатите"
        },
        {
          subject: "пилотни проекти за устойчив транспорт",
          actors: ["местни власти", "публични транспортни оператори"],
          states: randInt(2, 6),
          fundedPct: pick([20, 30, 35, 40, 45]),
          duration: pick([10, 16, 22, 28]),
          priority: "измеримо намаляване на емисиите"
        },
        {
          subject: "инициатива за цифрова достъпност",
          actors: ["публични агенции", "организации с нестопанска цел"],
          states: randInt(3, 8),
          fundedPct: pick([25, 35, 40, 45, 50]),
          duration: pick([12, 18, 24, 36]),
          priority: "доказана достъпност за хора с увреждания"
        },
        {
          subject: "схема за професионално обучение",
          actors: ["акредитирани учебни центрове", "публични служби по заетостта"],
          states: randInt(2, 7),
          fundedPct: pick([20, 25, 35, 40, 45]),
          duration: pick([9, 15, 21, 27]),
          priority: "признаване на придобитите умения"
        },
        {
          subject: "мрежа за наблюдение на качеството на въздуха",
          actors: ["научни институти", "регионални администрации"],
          states: randInt(3, 9),
          fundedPct: pick([25, 30, 35, 45, 50]),
          duration: pick([12, 20, 24, 32]),
          priority: "съвместими методи за събиране на данни"
        },
        {
          subject: "проект за опазване на крайбрежните зони",
          actors: ["университети", "природозащитни организации"],
          states: randInt(2, 6),
          fundedPct: pick([20, 30, 35, 40, 50]),
          duration: pick([14, 18, 26, 34]),
          priority: "участие на местните общности"
        },
        {
          subject: "програма за обмен на административни практики",
          actors: ["национални министерства", "публични агенции"],
          states: randInt(3, 7),
          fundedPct: pick([25, 30, 40, 45, 50]),
          duration: pick([12, 18, 24, 30]),
          priority: "план за оценка на резултатите"
        },
        {
          subject: "партньорство за кръгова икономика",
          actors: ["изследователски организации", "регионални администрации"],
          states: randInt(2, 8),
          fundedPct: pick([20, 30, 35, 40, 45]),
          duration: pick([10, 16, 24, 30]),
          priority: "повторна употреба на материали"
        }
      ];

      const s = pick(scenarios);

      const rejectedPct = 100 - s.fundedPct;
      const passage = `По покана за ${s.subject} право на кандидатстване имаха само ${s.actors[0]} и ${s.actors[1]}. Всеки проект трябваше да обхваща поне ${s.states} държави членки. Финансирани бяха ${s.fundedPct}% от допустимите кандидатури; някои отхвърлени предложения получиха високи оценки. При оценяването предимство имаше ${s.priority}. Проектите трябваше да приключат до ${s.duration} месеца.`;

      const questionType = randInt(1, 7);

      let prompt, correct, explanation;
      const options = ["Вярно", "Невярно", "Не може да се каже"];

      if (questionType === 1) {
        prompt = `Частни компании можеха да участват като партньори на допустима организация.`;
        correct = 2;
        explanation = "Посочени са допустимите кандидати, но текстът не обяснява дали частни компании могат да участват като партньори. Не може да се заключи.";
      } else if (questionType === 2) {
        prompt = `Всеки финансиран проект е обхващал поне ${s.states} държави членки.`;
        correct = 0;
        explanation = `Всички проекти е трябвало да обхващат поне ${s.states} държави членки, следователно това важи и за финансираните проекти.`;
      } else if (questionType === 3) {
        prompt = `Повече от половината допустими кандидатури са били отхвърлени.`;
        correct = s.fundedPct < 50 ? 0 : 1;
        explanation = s.fundedPct < 50
          ? `Отхвърлени са ${rejectedPct}% (${100}% - ${s.fundedPct}%), което е повече от половината.`
          : `Отхвърлени са ${rejectedPct}% (${100}% - ${s.fundedPct}%), което не е повече от половината.`;
      } else if (questionType === 4) {
        prompt = `Някои отхвърлени кандидатури са получили високи оценки.`;
        correct = 0;
        explanation = "Текстът изрично посочва, че някои отхвърлени предложения са получили високи оценки.";
      } else {
        if (questionType === 5) {
          prompt = `Предложенията без приоритетния критерий „${s.priority}“ са били автоматично отхвърляни.`;
          correct = 2;
          explanation = "Посочено е, че този критерий е давал предимство, но не и че липсата му е водела до автоматично отхвърляне.";
        } else if (questionType === 6) {
          prompt = `Всички кандидатури от ${s.actors[0]} са получили финансиране.`;
          correct = 2;
          explanation = `Текстът не посочва резултатите по вид кандидат. Знаем само, че общо са финансирани ${s.fundedPct}% от допустимите кандидатури.`;
        } else {
          prompt = `Кандидатурите от ${s.actors[1]} са били единствените с високи оценки сред отхвърлените.`;
          correct = 2;
          explanation = "Текстът казва, че някои отхвърлени предложения са получили високи оценки, но не посочва от кои организации са били.";
        }
      }

      return {
        category: "reasoning",
        subcategory: "Вербално мислене",
        title: "Вербално мислене",
        stem: `${passage}\n\nТвърдение: ${prompt}\n\nИзберете „Вярно“, „Невярно“ или „Не може да се каже“ според текста.`,
        options,
        correct,
        explanation,
        optionRationales: options.map((option, index) => index === correct
          ? explanation
          : `„${option}“ не съответства на наличните доказателства в текста.`),
        sourceTag: "EPSO-стил вербално мислене (BG)"
      };
    }

    function generateNumericalQuestion() {
      const units = ["A", "B", "C", "D"];
      const variances = shuffle([-2.0, -1.5, -1.0, -0.5, 0.5, 1.0, 1.5, 2.0]).slice(0, units.length);
      const table = units.map((unit, index) => {
        const planned = randInt(8, 18);
        const variance = variances[index];
        const actual = +(planned + variance).toFixed(1);
        const staff = randInt(12, 36);
        return { unit, planned, actual, staff };
      });

      const mode = randInt(1, 6);

      let prompt = "";
      let options = [];
      let correct = 0;
      let explanation = "";

      if (mode === 1) {
        const overspenders = table.filter(r => r.actual > r.planned);
        const selectedUnit = (overspenders.length ? pick(overspenders) : pick(table)).unit;
        table.forEach(row => {
          row.actual = row.unit === selectedUnit ? +(row.planned + 0.5).toFixed(1) : +(row.planned - 0.5).toFixed(1);
        });
        const correctUnit = selectedUnit;
        prompt = "Кое звено е надвишило планирания бюджет?";
        options = units;
        correct = options.indexOf(correctUnit);
        const row = table.find(r => r.unit === correctUnit);
        explanation = `${row.unit} е изразходвало ${row.actual.toFixed(1)} млн. евро при план ${row.planned.toFixed(1)} млн. евро, т.е. надвишението е ${(row.actual - row.planned).toFixed(1)} млн. евро.`;
      } else if (mode === 2) {
        const totalActual = +(table.reduce((sum, r) => sum + r.actual, 0)).toFixed(1);
        prompt = "Какъв е общият реален разход?";
        const distractors = shuffle([
          +(totalActual - 1.0).toFixed(1),
          +(totalActual - 0.5).toFixed(1),
          totalActual,
          +(totalActual + 0.5).toFixed(1)
        ]);
        options = distractors.map(v => `${v.toFixed(1)} млн. евро`);
        correct = distractors.indexOf(totalActual);
        explanation = `Сумиране на реалните разходи: ${table.map(r => r.actual.toFixed(1)).join(" + ")} = ${totalActual.toFixed(1)} млн. евро.`;
      } else if (mode === 3) {
        const row = pick(table);
        const pct = +(((row.planned - row.actual) / row.planned) * 100).toFixed(1);
        prompt = `С какъв процент звено ${row.unit} се отклонява от плана? (Отрицателна стойност = преразход.)`;
        const distractors = shuffle([
          pct,
          +(pct + 5).toFixed(1),
          +(pct - 5).toFixed(1),
          +(pct + 2.5).toFixed(1)
        ]);
        options = distractors.map(v => `${v.toFixed(1)}%`);
        correct = distractors.indexOf(pct);
        explanation = `Изчисление: (План - Реално) / План x 100 = (${row.planned.toFixed(1)} - ${row.actual.toFixed(1)}) / ${row.planned.toFixed(1)} x 100 = ${pct.toFixed(1)}%.`;
      } else if (mode === 4) {
        const perStaff = table.map(r => ({ ...r, value: r.actual / r.staff }));
        const best = perStaff.reduce((max, r) => r.value > max.value ? r : max, perStaff[0]);
        perStaff.forEach(row => {
          while (row.unit !== best.unit && row.value >= best.value) {
            const tableRow = table.find(candidate => candidate.unit === row.unit);
            tableRow.staff++;
            row.staff = tableRow.staff;
            row.value = row.actual / row.staff;
          }
        });
        prompt = "Кое звено има най-висок реален разход на служител?";
        options = units;
        correct = options.indexOf(best.unit);
        explanation = `${best.unit} има най-висок реален разход на служител: ${best.actual.toFixed(1)} млн. евро / ${best.staff} = ${best.value.toFixed(3)} млн. евро на служител.`;
      } else if (mode === 5) {
        const totalStaff = table.reduce((sum, row) => sum + row.staff, 0);
        const distractors = shuffle([totalStaff - 2, totalStaff - 1, totalStaff, totalStaff + 1]);
        prompt = "Колко са общо служителите в четирите звена?";
        options = distractors.map(String);
        correct = distractors.indexOf(totalStaff);
        explanation = `Съберете броя служители във всички звена: ${table.map(row => row.staff).join(" + ")} = ${totalStaff}.`;
      } else {
        if (table.every(row => row.actual >= row.planned)) {
          table[0].actual = table[0].planned - 0.5;
        }
        const greatestUnderspend = table.reduce((best, row) =>
          row.planned - row.actual > best.planned - best.actual ? row : best, table[0]);
        prompt = "В кое звено реалният разход е най-много под планирания разход?";
        options = units;
        correct = options.indexOf(greatestUnderspend.unit);
        explanation = `${greatestUnderspend.unit} е изразходвало ${greatestUnderspend.planned.toFixed(1)} - ${greatestUnderspend.actual.toFixed(1)} = ${(greatestUnderspend.planned - greatestUnderspend.actual).toFixed(1)} млн. евро по-малко от планираното.`;
      }

      const tableText =
        `Звено | Планирано (млн. евро) | Реално (млн. евро) | Служители\n` +
        table.map(r => `${r.unit} | ${r.planned.toFixed(1)} | ${r.actual.toFixed(1)} | ${r.staff}`).join("\n");

      return {
        category: "reasoning",
        subcategory: "Числово мислене",
        title: "Числово мислене",
        stem: `${tableText}\n\n${prompt}`,
        options,
        correct,
        explanation,
        optionRationales: options.map((option, index) => index === correct
          ? explanation
          : "Проверете отново данните в таблицата и извършените изчисления."),
        sourceTag: "EPSO-стил числово мислене (BG)"
      };
    }

    function buildGroupedBarChartSvg(labels, seriesNames, valuesBySeries) {
      const width = 620;
      const height = 260;
      const left = 44;
      const bottom = 34;
      const top = 20;
      const right = 16;
      const plotW = width - left - right;
      const plotH = height - top - bottom;
      const maxVal = Math.ceil(Math.max(...valuesBySeries.flat()) / 10) * 10;
      const colors = ["#38bdf8", "#22c55e", "#f59e0b"];
      const groupW = plotW / labels.length;
      const barW = Math.min(20, (groupW - 18) / seriesNames.length);

      let bars = "";
      for (let li = 0; li < labels.length; li++) {
        for (let si = 0; si < seriesNames.length; si++) {
          const v = valuesBySeries[si][li];
          const h = (v / maxVal) * plotH;
          const barsWidth = seriesNames.length * barW + (seriesNames.length - 1) * 4;
          const x = left + li * groupW + (groupW - barsWidth) / 2 + si * (barW + 4);
          const y = top + plotH - h;
          bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${colors[si]}"></rect>`;
          bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" fill="#e5e7eb" font-size="10">${v}</text>`;
        }
      }

      let xLabels = "";
      for (let li = 0; li < labels.length; li++) {
        const x = left + (li * groupW) + (groupW / 2);
        xLabels += `<text x="${x.toFixed(1)}" y="${height - 10}" text-anchor="middle" fill="#94a3b8" font-size="11">${labels[li]}</text>`;
      }

      let yGrid = "";
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const value = (maxVal / steps) * i;
        const y = top + plotH - ((value / maxVal) * plotH);
        yGrid += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${width - right}" y2="${y.toFixed(1)}" stroke="#334155" stroke-width="1"></line>`;
        yGrid += `<text x="${left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="10">${Math.round(value)}</text>`;
      }

      return `
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Групирана стълбовидна диаграма">
          <rect x="0" y="0" width="${width}" height="${height}" fill="#0b1220"></rect>
          ${yGrid}
          <line x1="${left}" y1="${top + plotH}" x2="${width - right}" y2="${top + plotH}" stroke="#64748b" stroke-width="1.2"></line>
          <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotH}" stroke="#64748b" stroke-width="1.2"></line>
          ${bars}
          ${xLabels}
        </svg>
      `;
    }

    function generateChartReasoningQuestion() {
      const labels = ["Т1", "Т2", "Т3", "Т4"];
      const seriesNames = ["Звено A", "Звено B", "Звено C"];
      const mode = randInt(1, 3);
      let valuesBySeries;
      let metrics;
      do {
        valuesBySeries = seriesNames.map(() => [
          randInt(18, 35),
          randInt(20, 38),
          randInt(22, 42),
          randInt(24, 46)
        ]);
        if (mode === 1) {
          metrics = valuesBySeries.map(series => series[3] - series[0]);
        } else if (mode === 2) {
          metrics = labels.map((_, idx) => valuesBySeries.reduce((sum, series) => sum + series[idx], 0));
        } else {
          metrics = valuesBySeries.map(series => Math.max(...series) - Math.min(...series));
        }
      } while (new Set(metrics).size !== metrics.length);

      let prompt = "";
      let options = [];
      let correct = 0;
      let explanation = "";

      if (mode === 1) {
        const growth = valuesBySeries.map(series => series[3] - series[0]);
        const bestIndex = growth.indexOf(Math.max(...growth));
        options = [...seriesNames];
        correct = bestIndex;
        prompt = "Кое звено показва най-голямо увеличение от Т1 до Т4?";
        explanation = `${seriesNames[bestIndex]} се увеличава най-много (${valuesBySeries[bestIndex][0]} до ${valuesBySeries[bestIndex][3]}).`;
      } else if (mode === 2) {
        const quarterTotals = labels.map((_, idx) => valuesBySeries[0][idx] + valuesBySeries[1][idx] + valuesBySeries[2][idx]);
        const bestIndex = quarterTotals.indexOf(Math.max(...quarterTotals));
        options = [...labels];
        correct = bestIndex;
        prompt = "Кое тримесечие има най-висок общ сбор за всички звена?";
        explanation = `${labels[bestIndex]} е най-високо с обща стойност ${quarterTotals[bestIndex]}.`;
      } else {
        const ranges = valuesBySeries.map(series => Math.max(...series) - Math.min(...series));
        const bestIndex = ranges.indexOf(Math.min(...ranges));
        options = [...seriesNames];
        correct = bestIndex;
        prompt = "Кое звено е най-стабилно между тримесечията (най-малък диапазон)?";
        explanation = `${seriesNames[bestIndex]} има най-малък диапазон от ${ranges[bestIndex]}.`;
      }

      const chartSvg = buildGroupedBarChartSvg(labels, seriesNames, valuesBySeries);
      const legendHtml = `
        <div class="legend">
          <span class="legend-item">${colorDot("#38bdf8")} Звено A</span>
          <span class="legend-item">${colorDot("#22c55e")} Звено B</span>
          <span class="legend-item">${colorDot("#f59e0b")} Звено C</span>
        </div>
      `;

      return ensureQuestionShape({
        category: "reasoning",
        subcategory: "Числово мислене (графика)",
        title: "Числово мислене (графика)",
        stemHtml: `<div class="visual-wrap"><div class="small">Прегледайте графиката и изберете най-добрия отговор.</div>${chartSvg}${legendHtml}<div style="margin-top:10px;">${escapeHtml(prompt)}</div></div>`,
        reviewStem: `${prompt} Стойности по тримесечия: A=${valuesBySeries[0].join("/")}, B=${valuesBySeries[1].join("/")}, C=${valuesBySeries[2].join("/")}.`,
        options,
        correct,
        explanation,
        optionRationales: options.map((opt, idx) => idx === correct
          ? "Правилно: тази опция съвпада с изчисленията по графиката."
          : "Неправилно: сравнете всички стойности по тримесечия преди избор."),
        sourceTag: "EPSO-стил графична интерпретация (BG)"
      });
    }

    function matrixSvg(position, dots, size = 90) {
      const cell = size / 2;
      const x = [0, cell, cell, 0][position];
      const y = [0, 0, cell, cell][position];
      const dotCoords = [
        [size * 0.25, size * 0.25],
        [size * 0.75, size * 0.25],
        [size * 0.25, size * 0.75],
        [size * 0.75, size * 0.75]
      ];
      let dotsSvg = "";
      for (let i = 0; i < dots; i++) {
        const [dx, dy] = dotCoords[i];
        dotsSvg += `<circle cx="${dx}" cy="${dy}" r="${size * 0.05}" fill="#38bdf8"></circle>`;
      }
      return `
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
          <rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" fill="#0b1220" stroke="#64748b"></rect>
          <line x1="${cell}" y1="0" x2="${cell}" y2="${size}" stroke="#334155"></line>
          <line x1="0" y1="${cell}" x2="${size}" y2="${cell}" stroke="#334155"></line>
          <rect x="${x + 4}" y="${y + 4}" width="${cell - 8}" height="${cell - 8}" fill="#22c55e" opacity="0.88"></rect>
          ${dotsSvg}
        </svg>
      `;
    }

    function sequenceSymbolSvg(shape, rotation, filled, size = 82) {
      const fill = filled ? "#38bdf8" : "none";
      const stroke = "#38bdf8";
      let symbol;

      if (shape === 0) {
        symbol = `<polygon points="40,14 66,62 14,62" fill="${fill}" stroke="${stroke}" stroke-width="3"></polygon>`;
      } else if (shape === 1) {
        symbol = `<polygon points="16,24 44,24 44,14 66,40 44,66 44,56 16,56" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"></polygon>`;
      } else if (shape === 2) {
        symbol = `<rect x="18" y="18" width="44" height="44" fill="${fill}" stroke="${stroke}" stroke-width="3"></rect>`;
      } else {
        symbol = `<polygon points="40,12 68,40 40,68 12,40" fill="${fill}" stroke="${stroke}" stroke-width="3"></polygon>`;
      }

      return `<svg viewBox="0 0 80 80" width="${size}" height="${size}" aria-hidden="true"><g transform="rotate(${rotation} 40 40)">${symbol}</g></svg>`;
    }

    function generateVisualLogicQuestion() {
      const start = randInt(0, 3);
      const positionStep = pick([1, 3]);
      const dotStep = pick([1, -1]);
      const startDots = dotStep === 1 ? 1 : 4;
      const seq = [0, 1, 2].map(step => (start + positionStep * step) % 4);
      const seqDots = [0, 1, 2].map(step => ((startDots - 1 + dotStep * step + 4) % 4) + 1);
      const answerPos = (start + positionStep * 3) % 4;
      const answerDots = ((startDots - 1 + dotStep * 3 + 4) % 4) + 1;
      const positionRule = positionStep === 1 ? "по часовниковата стрелка" : "обратно на часовниковата стрелка";
      const dotRule = dotStep === 1 ? "увеличава се с една точка" : "намалява с една точка";

      const rawOptions = [{ pos: answerPos, dots: answerDots }];
      while (rawOptions.length < 4) {
        const candidate = { pos: randInt(0, 3), dots: randInt(1, 4) };
        if (!rawOptions.some(o => o.pos === candidate.pos && o.dots === candidate.dots)) {
          rawOptions.push(candidate);
        }
      }
      const shuffled = shuffle(rawOptions);
      const correct = shuffled.findIndex(o => o.pos === answerPos && o.dots === answerDots);
      const options = shuffled.map(o => ({
        html: `<span class="option-visual">${matrixSvg(o.pos, o.dots, 82)}</span>`,
        plain: `Оцветено поле ${o.pos + 1}, ${o.dots} точки`
      }));

      const stemHtml = `
        <div class="visual-wrap">
          <div class="small">Изберете следващата фигура в редицата.</div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px;">
            <span class="option-visual">${matrixSvg(seq[0], seqDots[0], 86)}</span>
            <span class="option-visual">${matrixSvg(seq[1], seqDots[1], 86)}</span>
            <span class="option-visual">${matrixSvg(seq[2], seqDots[2], 86)}</span>
            <span class="option-visual" style="font-weight:700; color:#cbd5e1;">?</span>
          </div>
        </div>
      `;

      return ensureQuestionShape({
        category: "abstract",
        subcategory: "Абстрактно / Визуална логика",
        title: "Абстрактно / Визуална логика",
        stemHtml,
        reviewStem: `Визуална редица: маркираната клетка се премества ${positionRule}, а броят точки ${dotRule}.`,
        options,
        correct,
        explanation: `Маркираната клетка се премества ${positionRule} на всяка стъпка, а броят точки ${dotRule}.`,
        optionRationales: options.map((opt, idx) => idx === correct
          ? "Правилно: спазени са и двете правила - ротация и брой точки."
          : "Неправилно: нарушено е правилото за ротация или броя точки."),
        sourceTag: "Оригинална задача за визуални модели (BG)"
      });
    }

    function generateQuestionPool(category) {
      const pool = [];
      const signatures = new Set();
      const targetSize = 120;
      const maxAttempts = targetSize * 20;

      for (let attempts = 0; pool.length < targetSize && attempts < maxAttempts; attempts++) {
        let question;
        if (category === "verbal") {
          question = generateVerbalQuestion();
        } else if (category === "numerical") {
          question = Math.random() < 0.5 ? generateNumericalQuestion() : generateChartReasoningQuestion();
        } else {
          question = Math.random() < 0.5 ? generateVisualLogicQuestion() : generateAbstractQuestion();
        }

        const signature = question.stemHtml || question.stem;
        if (!signatures.has(signature)) {
          signatures.add(signature);
          pool.push(ensureQuestionShape({ ...question, category }));
        }
      }

      if (pool.length < 80) {
        throw new Error(`Не може да се създаде достатъчно голям пул с въпроси за категорията „${category}“.`);
      }
      return pool;
    }

    function sampleQuestionPool(category, count, source = "all") {
      return window.EPSO_BANK.sample(category, count, source).map(ensureQuestionShape);
    }

    function buildReasoningQuestions(config) {
      return [
        ...sampleQuestionPool("verbal", config.verbalCount, config.source),
        ...sampleQuestionPool("numerical", config.numericalCount, config.source),
        ...sampleQuestionPool("abstract", config.abstractCount, config.source)
      ].map(ensureQuestionShape);
    }

    function buildExam(config) {
      const questions = buildReasoningQuestions(config);

      results.score = 0;
      results.byCategory = {
        verbal: { correct: 0, total: config.verbalCount },
        numerical: { correct: 0, total: config.numericalCount },
        abstract: { correct: 0, total: config.abstractCount }
      };
      results.bySubcategory = {};
      results.answers = [];

      flaggedQuestionIds.clear();

      const ordered = questions.map((q, idx) => ({ ...q, id: idx + 1 }));
      ordered.forEach(q => {
        if (!results.bySubcategory[q.subcategory]) {
          results.bySubcategory[q.subcategory] = { correct: 0, total: 0 };
        }
        results.bySubcategory[q.subcategory].total++;
      });

      return ordered;
    }

