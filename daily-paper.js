(() => {
  const DAILY_MODE = "daily-half-paper";
  const DAILY_TOTAL_SECONDS = 90 * 60;
  const DAILY_CHOICE_COUNT = 15;
  const DAILY_ESSAY_COUNT = 1;
  const DAILY_MATERIAL_COUNT = 2;
  const PAPER_STRUCTURE = { choice: 15, essay: 1, material: 2 };

  const modeSelect = document.querySelector("#mode");
  const startButton = document.querySelector("#start");
  if (!modeSelect || !startButton || typeof state === "undefined") return;

  const option = document.createElement("option");
  option.value = DAILY_MODE;
  option.textContent = "每日半套卷（15选择＋1论述＋2材料｜90分钟）";
  modeSelect.insertBefore(option, modeSelect.children[1] || null);

  const pace = document.createElement("p");
  pace.id = "paperPace";
  pace.className = "save-hint hidden";
  const quizTopline = document.querySelector(".quiz-topline");
  if (quizTopline) quizTopline.insertAdjacentElement("afterend", pace);

  function ensureDailyStore() {
    if (!state.progress.dailyPapers || typeof state.progress.dailyPapers !== "object") {
      state.progress.dailyPapers = {};
    }
  }

  function isDailyMode() {
    return modeSelect.value === DAILY_MODE || state.roundMode === DAILY_MODE;
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let x = seed >>> 0 || 1;
    return () => {
      x += 0x6D2B79F5;
      let t = x;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(items, seed) {
    const copy = [...items];
    const random = seededRandom(seed);
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function subjectiveClass(question) {
    if (questionKind(question) === "choice") return "choice";
    const text = `${question.title || ""}\n${question.prompt || ""}`;
    const materialSignals = /(阅读(?:下列|以下)?材料|根据(?:上述|以下)材料|材料\s*[一二三四五六七八九十0-9]*[:：]|阅读.*案例|分析下述案例|教例|案例中|情境中)/;
    const multiPart = /(?:\(|（)[1一](?:\)|）)|请回答[:：]?/;
    if (materialSignals.test(text) && (multiPart.test(text) || text.length > 220)) return "material";
    const shortSignals = /(简答|简述|列举|写出|指出.*?条|概述.*?含义)/;
    const essaySignals = /(论述|试述|评述|阐述|试析|分析|比较|评价|谈谈|说明.*?关系|为什么)/;
    if (essaySignals.test(text) && !shortSignals.test(text)) return "essay";
    return "short";
  }

  function orderedFreshPool(items, seed) {
    const recent = recentQuestionIds(120);
    const fresh = items.filter((q) => !recent.has(q.id));
    const old = items.filter((q) => recent.has(q.id));
    return [
      ...seededShuffle(fresh, seed ^ 0xA341316C),
      ...seededShuffle(old, seed ^ 0xC8013EA4),
    ];
  }

  function chooseBalancedChoices(seed) {
    const choicePool = state.questions.filter((q) => questionKind(q) === "choice" && SUBJECT_ORDER.includes(canonicalSubject(q)));
    const startIndex = seed % SUBJECT_ORDER.length;
    const rotated = [...SUBJECT_ORDER.slice(startIndex), ...SUBJECT_ORDER.slice(0, startIndex)];
    const allocations = new Map(rotated.map((subject, index) => [subject, index < 3 ? 4 : 3]));
    const picked = [];
    rotated.forEach((subject, index) => {
      const subjectPool = choicePool.filter((q) => canonicalSubject(q) === subject);
      const ordered = orderedFreshPool(subjectPool, seed ^ hashString(`${subject}-${index}`));
      picked.push(...ordered.slice(0, allocations.get(subject)));
    });
    if (picked.length < DAILY_CHOICE_COUNT) {
      const used = new Set(picked.map((q) => q.id));
      const rest = orderedFreshPool(choicePool.filter((q) => !used.has(q.id)), seed ^ 0x9E3779B9);
      picked.push(...rest.slice(0, DAILY_CHOICE_COUNT - picked.length));
    }
    return picked.slice(0, DAILY_CHOICE_COUNT);
  }

  function chooseSubjectives(seed) {
    const subjectives = state.questions.filter((q) => questionKind(q) !== "choice");
    let essays = subjectives.filter((q) => subjectiveClass(q) === "essay");
    let materials = subjectives.filter((q) => subjectiveClass(q) === "material");
    if (!essays.length) essays = subjectives.filter((q) => subjectiveClass(q) !== "material");
    if (materials.length < DAILY_MATERIAL_COUNT) {
      materials = subjectives.filter((q) => subjectiveClass(q) !== "essay");
    }

    const essay = orderedFreshPool(essays, seed ^ 0x243F6A88)[0] || null;
    const materialOrdered = orderedFreshPool(materials.filter((q) => q.id !== essay?.id), seed ^ 0xB7E15162);
    const chosenMaterials = [];
    const usedSubjects = new Set();
    for (const item of materialOrdered) {
      const subject = canonicalSubject(item);
      if (!usedSubjects.has(subject)) {
        chosenMaterials.push(item);
        usedSubjects.add(subject);
      }
      if (chosenMaterials.length >= DAILY_MATERIAL_COUNT) break;
    }
    if (chosenMaterials.length < DAILY_MATERIAL_COUNT) {
      for (const item of materialOrdered) {
        if (!chosenMaterials.some((q) => q.id === item.id)) chosenMaterials.push(item);
        if (chosenMaterials.length >= DAILY_MATERIAL_COUNT) break;
      }
    }
    return { essay, materials: chosenMaterials.slice(0, DAILY_MATERIAL_COUNT) };
  }

  function buildOrRestoreDailyPaper() {
    ensureDailyStore();
    const date = localDate();
    const stored = state.progress.dailyPapers[date];
    if (stored?.ids?.length === DAILY_CHOICE_COUNT + DAILY_ESSAY_COUNT + DAILY_MATERIAL_COUNT) {
      const restored = stored.ids.map((id) => findQuestion(id)).filter(Boolean);
      if (restored.length === stored.ids.length) return restored.map((q, index) => ({ ...q, paperType: stored.types?.[index] || subjectiveClass(q) }));
    }

    const seed = hashString(`333-half-paper-${date}`);
    const choices = chooseBalancedChoices(seed);
    const { essay, materials } = chooseSubjectives(seed);
    if (choices.length < DAILY_CHOICE_COUNT || !essay || materials.length < DAILY_MATERIAL_COUNT) return null;

    const paper = [
      ...choices.map((q) => ({ ...q, paperType: "choice" })),
      { ...essay, paperType: "essay" },
      ...materials.map((q) => ({ ...q, paperType: "material" })),
    ];
    state.progress.dailyPapers[date] = {
      ids: paper.map((q) => q.id),
      types: paper.map((q) => q.paperType),
      createdAt: new Date().toISOString(),
    };
    saveProgress();
    return paper;
  }

  function syncDailySetup() {
    const daily = modeSelect.value === DAILY_MODE;
    const typeSelect = document.querySelector("#questionType");
    const subjectSelect = document.querySelector("#subject");
    const countInput = document.querySelector("#count");
    const decrease = document.querySelector("#decrease");
    const increase = document.querySelector("#increase");
    const hint = document.querySelector("#timedHint");

    if (daily) {
      typeSelect.value = "all";
      subjectSelect.value = "all";
      countInput.value = 18;
      typeSelect.disabled = true;
      subjectSelect.disabled = true;
      countInput.disabled = true;
      decrease.disabled = true;
      increase.disabled = true;
      hint.textContent = "按近年333真题结构砍半：15道单选（30分）＋1道论述（15分）＋2道材料分析（30分），共75分，限时90分钟。建议：选择题30分钟、论述20分钟、两道材料各20分钟。当天试卷固定，第二天自动换卷。";
      hint.classList.remove("hidden");
      startButton.textContent = "开始今日半套卷";
    } else {
      countInput.disabled = false;
      decrease.disabled = false;
      increase.disabled = false;
      startButton.textContent = "开始本轮";
      if (typeof syncTimedSetup === "function") syncTimedSetup();
      if (modeSelect.value !== "timed") subjectSelect.disabled = false;
      setPaperChrome(false);
      pace.classList.add("hidden");
    }
  }

  function setPaperChrome(active) {
    const noteLabel = document.querySelector('label[for="questionNote"]');
    const noteBox = document.querySelector("#questionNote");
    const saveHint = document.querySelector(".question-card .save-hint");
    const favorite = document.querySelector("#favorite");
    [noteLabel, noteBox, saveHint, favorite].forEach((el) => {
      if (el) el.classList.toggle("hidden", active);
    });
  }

  function currentPaperLabel(question) {
    if (question.paperType === "choice") return "单项选择题";
    if (question.paperType === "material") return "材料分析题";
    return "论述题";
  }

  function updateDailyQuestionChrome() {
    if (state.roundMode !== DAILY_MODE) return;
    const question = state.round[state.cursor];
    if (!question) return;
    const badge = document.querySelector("#questionTypeBadge");
    if (badge) badge.textContent = currentPaperLabel(question);
    const number = document.querySelector("#questionNumber");
    if (number) {
      const sectionNo = question.paperType === "choice" ? state.cursor + 1 : question.paperType === "essay" ? 31 : 32 + (state.cursor - 16);
      const source = question.source ? `${question.source} · ` : "";
      number.textContent = `${source}模拟卷第 ${sectionNo} 题`;
    }
    const reveal = document.querySelector("#reveal");
    if (questionKind(question) !== "choice") {
      const answerBox = document.querySelector("#userAnswer");
      if (answerBox) answerBox.value = "";
      if (reveal) reveal.textContent = "保存作答并下一题";
    }
    const noteBox = document.querySelector("#questionNote");
    if (noteBox) noteBox.value = "";
    setPaperChrome(true);
    const submitChoice = document.querySelector("#submitChoice");
    if (submitChoice && questionKind(question) === "choice") submitChoice.textContent = "确认并下一题";
    state.dailyQuestionStartedAt = Date.now();
    updatePaceText();
  }

  const originalRenderQuestion = renderQuestion;
  renderQuestion = function renderQuestionWithDailyPaper() {
    originalRenderQuestion();
    updateDailyQuestionChrome();
  };

  function startDailyClock() {
    stopTimerInterval();
    state.timerDeadline = Date.now() + DAILY_TOTAL_SECONDS * 1000;
    state.timedTotalSeconds = DAILY_TOTAL_SECONDS;
    const box = document.querySelector("#timerBox");
    if (box) box.classList.remove("hidden");
    updateDailyClock();
    state.timerInterval = setInterval(updateDailyClock, 250);
  }

  function updatePaceText() {
    if (state.roundMode !== DAILY_MODE || !pace) return;
    const elapsed = Math.max(0, Math.round((Date.now() - state.roundStartedAt.getTime()) / 1000));
    const question = state.round[state.cursor];
    if (!question) return;
    let target = "选择题建议在开考30分钟内完成";
    if (question.paperType === "essay") target = "论述题建议用20分钟，累计约50分钟进入材料题";
    if (question.paperType === "material") target = "材料分析题建议每题20分钟，90分钟到时自动交卷";
    pace.textContent = `${currentPaperLabel(question)}｜${target}｜已用 ${formatClock(elapsed)}`;
    pace.classList.remove("hidden");
  }

  function updateDailyClock() {
    if (state.roundMode !== DAILY_MODE || !state.timerDeadline || state.roundFinished) return;
    const remainingMs = state.timerDeadline - Date.now();
    const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
    const timerText = document.querySelector("#timerText");
    const box = document.querySelector("#timerBox");
    if (timerText) timerText.textContent = formatClock(remaining);
    if (box) {
      box.classList.toggle("warning", remaining <= 15 * 60);
      box.classList.toggle("critical", remaining <= 5 * 60);
    }
    updatePaceText();
    if (remainingMs <= 0) finishDailyDueToTimeout();
  }

  function saveDailyLog(question, { selection = "", correct = false, answered = true, timedOut = false } = {}) {
    const now = new Date();
    const kind = questionKind(question);
    const secondsSpent = state.dailyQuestionStartedAt ? Math.max(0, Math.round((Date.now() - state.dailyQuestionStartedAt) / 1000)) : null;
    if (kind === "choice") {
      state.progress.choiceAnswers[question.id] = selection;
      state.progress.correctness[question.id] = Boolean(correct);
    } else {
      state.progress.answers[question.id] = document.querySelector("#userAnswer")?.value || state.progress.answers[question.id] || "";
    }
    state.progress.notes[question.id] = document.querySelector("#questionNote")?.value || state.progress.notes[question.id] || "";
    const event = {
      id: question.id,
      rating: "paper",
      type: kind,
      paperType: question.paperType,
      paperMode: DAILY_MODE,
      date: localDate(now),
      at: now.toISOString(),
      answered,
      timed: true,
      timedOut,
      secondsSpent,
    };
    if (kind === "choice") {
      event.selection = selection;
      event.correctAnswer = correctChoice(question);
      event.correct = Boolean(correct);
    } else {
      event.answerSnapshot = state.progress.answers[question.id] || "";
    }
    state.progress.sessions.push(event);
    state.currentRoundLog.push({
      ...event,
      subject: canonicalSubject(question),
      number: question.number,
      title: question.title,
      prompt: question.prompt || "",
      source: question.source || "",
      answer: kind === "subjective" ? (state.progress.answers[question.id] || "") : "",
      note: state.progress.notes[question.id] || "",
      favorite: Boolean(state.progress.favorites[question.id]),
    });
    saveProgress();
  }

  function dailyAdvance() {
    state.cursor += 1;
    if (state.cursor < state.round.length) {
      renderQuestion();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      finishDailyPaper(false);
    }
  }

  function submitDailyChoice() {
    const question = state.round[state.cursor];
    if (!question || questionKind(question) !== "choice" || !state.selectedChoice) return;
    const key = correctChoice(question);
    saveDailyLog(question, {
      selection: state.selectedChoice,
      correct: Boolean(key) && state.selectedChoice === key,
      answered: true,
    });
    dailyAdvance();
  }

  function submitDailySubjective() {
    const question = state.round[state.cursor];
    if (!question || questionKind(question) === "choice") return;
    saveDailyLog(question, { answered: Boolean(document.querySelector("#userAnswer")?.value.trim()) });
    dailyAdvance();
  }

  function finishDailyDueToTimeout() {
    if (state.roundFinished) return;
    const logged = new Set(state.currentRoundLog.map((item) => item.id));
    for (let i = state.cursor; i < state.round.length; i += 1) {
      const question = state.round[i];
      if (logged.has(question.id)) continue;
      let answered = false;
      let selection = "";
      let correct = false;
      if (i === state.cursor) {
        if (questionKind(question) === "choice" && state.selectedChoice) {
          selection = state.selectedChoice;
          correct = selection === correctChoice(question);
          answered = true;
        } else if (questionKind(question) !== "choice") {
          answered = Boolean(document.querySelector("#userAnswer")?.value.trim());
        }
      }
      saveDailyLog(question, { selection, correct, answered, timedOut: true });
    }
    finishDailyPaper(true);
  }

  function finishDailyPaper(timedOut) {
    if (state.roundFinished) return;
    state.roundFinished = true;
    stopTimerInterval();
    const endedAt = new Date();
    const elapsed = Math.min(DAILY_TOTAL_SECONDS, Math.max(0, Math.round((endedAt - state.roundStartedAt) / 1000)));
    const roundRecord = {
      date: localDate(endedAt),
      startedAt: state.roundStartedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      mode: DAILY_MODE,
      paper: true,
      timed: true,
      timedOut,
      allottedSeconds: DAILY_TOTAL_SECONDS,
      elapsedSeconds: elapsed,
      structure: PAPER_STRUCTURE,
      results: { ...state.results },
      items: [...state.currentRoundLog],
    };
    state.progress.rounds.push(roundRecord);
    saveProgress();

    document.querySelector("#quiz")?.classList.add("hidden");
    document.querySelector("#finish")?.classList.remove("hidden");
    document.querySelector("#timerBox")?.classList.add("hidden");
    pace.classList.add("hidden");

    const choiceItems = roundRecord.items.filter((item) => item.paperType === "choice");
    const subjectiveItems = roundRecord.items.filter((item) => item.paperType !== "choice");
    const correctCount = choiceItems.filter((item) => item.correct).length;
    const answeredSubjective = subjectiveItems.filter((item) => item.answered !== false).length;
    const unanswered = roundRecord.items.filter((item) => item.answered === false).length;
    const cards = [
      [`${correctCount}/${choiceItems.length}`, "选择题正确"],
      [`${answeredSubjective}/${subjectiveItems.length}`, "主观题已作答"],
      [formatClock(elapsed), timedOut ? "到时交卷" : "实际用时"],
    ];
    if (unanswered) cards.push([unanswered, "未作答"]);
    document.querySelector("#summary").innerHTML = cards
      .map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`)
      .join("");
    document.querySelector("#reportStatus").textContent = "今日半套卷：75分制，标准90分钟。提交给 ChatGPT 后可按真题标准继续批改主观题和分析用时。";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startDailyPaper() {
    const paper = buildOrRestoreDailyPaper();
    if (!paper) {
      alert("当前题库还不足以稳定组成 15 道选择＋1 道论述＋2 道材料分析。请让我继续补题库后再试。");
      return;
    }
    state.round = paper;
    state.cursor = 0;
    state.results = { known: 0, unsure: 0, unknown: 0 };
    state.currentRoundLog = [];
    state.roundStartedAt = new Date();
    state.roundMode = DAILY_MODE;
    state.roundFinished = false;
    state.timedOut = false;
    state.selectedChoice = null;
    state.timedTotalSeconds = DAILY_TOTAL_SECONDS;

    document.querySelector("#setup")?.classList.add("hidden");
    document.querySelector("#finish")?.classList.add("hidden");
    document.querySelector("#quiz")?.classList.remove("hidden");
    renderQuestion();
    startDailyClock();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const originalBuildRoundReport = buildRoundReport;
  buildRoundReport = function buildPaperAwareReport(round) {
    if (!round || round.mode !== DAILY_MODE) return originalBuildRoundReport(round);
    const choiceItems = round.items.filter((item) => item.paperType === "choice");
    const correctCount = choiceItems.filter((item) => item.correct).length;
    const lines = [
      "# 333每日半套卷报告",
      "",
      `- 日期：${round.date}`,
      "- 结构：15道单项选择＋1道论述＋2道材料分析",
      "- 分值：75分（真题结构折半）",
      `- 标准时长：${formatClock(round.allottedSeconds || DAILY_TOTAL_SECONDS)}`,
      `- 实际用时：${formatClock(round.elapsedSeconds || 0)}`,
      `- 选择题：${correctCount}/${choiceItems.length}`,
      `- 状态：${round.timedOut ? "到时自动交卷" : "主动交卷"}`,
      "",
      "## 逐题记录",
    ];
    round.items.forEach((item, index) => {
      const typeLabel = item.paperType === "choice" ? "单项选择题" : item.paperType === "material" ? "材料分析题" : "论述题";
      lines.push("", `### ${index + 1}. ${typeLabel}｜${item.subject || "未分类"}｜${item.title || item.id}`, `- 题目 ID：${item.id}`);
      if (item.source) lines.push(`- 来源：${item.source}`);
      if (item.type === "choice") {
        lines.push(`- 我的选择：${item.answered === false ? "（未作答）" : item.selection || "（未记录）"}`, `- 正确答案：${item.correctAnswer || "（未配置）"}`, `- 客观结果：${item.correct ? "正确" : "错误"}`);
      } else {
        if (item.prompt) lines.push(`- 题干：${item.prompt}`);
        lines.push(`- 我的作答：${item.answer || item.answerSnapshot || "（未填写）"}`);
      }
      if (item.secondsSpent != null) lines.push(`- 本题用时：${formatClock(item.secondsSpent)}`);
      lines.push(`- 笔记：${item.note || "（无）"}`);
    });
    return lines.join("\n");
  };

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target || state.roundMode !== DAILY_MODE) return;
    if (target.id === "submitChoice") {
      event.preventDefault();
      event.stopImmediatePropagation();
      submitDailyChoice();
    } else if (target.id === "reveal") {
      event.preventDefault();
      event.stopImmediatePropagation();
      submitDailySubjective();
    }
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target.closest("#start");
    if (!target || modeSelect.value !== DAILY_MODE) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    startDailyPaper();
  }, true);

  [document.querySelector("#quit"), document.querySelector("#again")].forEach((button) => {
    if (!button) return;
    button.addEventListener("click", () => {
      pace.classList.add("hidden");
      setPaperChrome(false);
    }, true);
  });

  modeSelect.addEventListener("change", syncDailySetup);
  syncDailySetup();
})();