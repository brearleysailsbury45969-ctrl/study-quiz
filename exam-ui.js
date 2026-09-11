(() => {
  const TIMED_MODE = "timed";
  const OLD_DAILY_MODE = "daily-half-paper";
  const DAILY_MODE = "daily-half-paper-v2";
  const DAILY_TOTAL_SECONDS = 90 * 60;
  const DAILY_CHOICE_COUNT = 15;
  const DAILY_ESSAY_COUNT = 1;
  const DAILY_MATERIAL_COUNT = 2;
  const PAPER_STRUCTURE = { choice: 15, essay: 1, material: 2 };
  const DEFAULT_SECONDS_PER_CHOICE = 120;

  const modeSelect = document.querySelector("#mode");
  const startButton = document.querySelector("#start");
  const quiz = document.querySelector("#quiz");
  const finish = document.querySelector("#finish");
  if (!modeSelect || !startButton || !quiz || !finish || typeof state === "undefined") return;

  // Retire the first daily-paper implementation without touching old study records.
  const oldDailyOption = [...modeSelect.options].find((item) => item.value === OLD_DAILY_MODE);
  if (oldDailyOption) oldDailyOption.remove();
  if (![...modeSelect.options].some((item) => item.value === DAILY_MODE)) {
    const option = document.createElement("option");
    option.value = DAILY_MODE;
    option.textContent = "每日半套卷（15选择＋1论述＋2材料｜90分钟）";
    const timedOption = [...modeSelect.options].find((item) => item.value === TIMED_MODE);
    modeSelect.insertBefore(option, timedOption || modeSelect.children[1] || null);
  }

  const style = document.createElement("style");
  style.textContent = `
    .question-card{scroll-margin-top:10px}
    .exam-nav{display:flex;gap:8px;align-items:center;margin:10px 0 12px}
    .exam-nav button{flex:1;min-height:42px;border-radius:12px;border:1px solid var(--line,#ddd6c8);background:var(--surface,#fff);font-weight:700}
    .exam-nav button:disabled{opacity:.35}
    .exam-sheet{margin:0 0 14px;padding:12px;border:1px solid var(--line,#ddd6c8);border-radius:14px;background:var(--surface,#fff)}
    .exam-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
    .exam-sheet-head strong{font-size:.95rem}
    .exam-sheet-legend{font-size:.76rem;color:var(--muted,#756c60)}
    .exam-sheet-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
    .exam-sheet-grid button{min-height:38px;border-radius:10px;border:1px solid var(--line,#ddd6c8);background:var(--surface-soft,#faf7f0);font-variant-numeric:tabular-nums;font-weight:700}
    .exam-sheet-grid button.answered{background:color-mix(in srgb, currentColor 9%, var(--surface,#fff));border-width:2px}
    .exam-sheet-grid button.current{outline:2px solid currentColor;outline-offset:2px}
    .exam-submit{width:100%;margin-top:12px;min-height:44px;border-radius:12px}
    .exam-pace{margin:0 0 12px;font-size:.82rem;line-height:1.5;color:var(--muted,#756c60)}
    .exam-review{margin-top:16px;text-align:left}
    .exam-review-toggle{width:100%;min-height:44px;border-radius:12px;border:1px solid var(--line,#ddd6c8);background:var(--surface,#fff);font-weight:700}
    .exam-review-body{margin-top:12px;padding:12px;border:1px solid var(--line,#ddd6c8);border-radius:14px;background:var(--surface,#fff)}
    .review-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:12px}
    .review-grid button{min-height:38px;border-radius:10px;border:1px solid var(--line,#ddd6c8);background:var(--surface-soft,#faf7f0);font-weight:700}
    .review-grid button.correct{box-shadow:inset 0 0 0 2px #2e7d32}
    .review-grid button.wrong{box-shadow:inset 0 0 0 2px #c62828}
    .review-grid button.unanswered{opacity:.55;border-style:dashed}
    .review-detail{padding-top:4px;line-height:1.65}
    .review-detail h3{margin:.2rem 0 .7rem}
    .review-detail .review-label{font-size:.78rem;color:var(--muted,#756c60);margin:.75rem 0 .2rem}
    .review-detail .review-block{white-space:pre-wrap;word-break:break-word;padding:10px 12px;border-radius:10px;background:var(--surface-soft,#faf7f0)}
    @media(max-width:640px){.exam-sheet-grid,.review-grid{grid-template-columns:repeat(5,minmax(0,1fr))}.exam-nav{position:sticky;bottom:8px;z-index:4;padding:6px;border-radius:14px;background:color-mix(in srgb, var(--surface,#fff) 92%, transparent);backdrop-filter:blur(8px)}}
  `;
  document.head.append(style);

  const topline = document.querySelector(".quiz-topline");
  const pace = document.createElement("p");
  pace.id = "examPace";
  pace.className = "exam-pace hidden";
  const nav = document.createElement("div");
  nav.id = "examNav";
  nav.className = "exam-nav hidden";
  nav.innerHTML = `
    <button id="examPrev" type="button">← 上一题</button>
    <button id="examSheetToggle" type="button">答题卡</button>
    <button id="examNext" type="button">下一题 →</button>
  `;
  const sheet = document.createElement("section");
  sheet.id = "examSheet";
  sheet.className = "exam-sheet hidden";
  sheet.innerHTML = `
    <div class="exam-sheet-head"><strong>答题卡</strong><span id="examSheetLegend" class="exam-sheet-legend"></span></div>
    <div id="examSheetGrid" class="exam-sheet-grid"></div>
    <button id="examSubmit" class="primary exam-submit" type="button">交卷</button>
  `;
  if (topline) {
    topline.insertAdjacentElement("afterend", pace);
    pace.insertAdjacentElement("afterend", nav);
    nav.insertAdjacentElement("afterend", sheet);
  }

  const review = document.createElement("section");
  review.id = "examReview";
  review.className = "exam-review hidden";
  review.innerHTML = `
    <button id="examReviewToggle" class="exam-review-toggle" type="button">查看答题情况 / 答题卡</button>
    <div id="examReviewBody" class="exam-review-body hidden">
      <div id="reviewGrid" class="review-grid"></div>
      <div id="reviewDetail" class="review-detail"><p>点题号查看本题作答、正确答案和解析。</p></div>
    </div>
  `;
  const reportStatus = document.querySelector("#reportStatus");
  if (reportStatus) reportStatus.insertAdjacentElement("afterend", review);

  function isExamMode(mode = state.roundMode) {
    return mode === TIMED_MODE || mode === DAILY_MODE;
  }

  function ensureExamState() {
    if (!state.examDrafts || typeof state.examDrafts !== "object") state.examDrafts = {};
    if (!state.examTimeSpent || typeof state.examTimeSpent !== "object") state.examTimeSpent = {};
  }

  function stopExamClock() {
    if (typeof stopTimerInterval === "function") stopTimerInterval();
    else if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function scrollToQuestionCard() {
    const card = document.querySelector(".question-card");
    if (!card || quiz.classList.contains("hidden")) return;
    requestAnimationFrame(() => requestAnimationFrame(() => card.scrollIntoView({ behavior: "smooth", block: "start" })));
  }

  function accrueQuestionTime() {
    if (!isExamMode() || !state.examQuestionStartedAt) return;
    const question = state.round[state.cursor];
    if (!question) return;
    const elapsed = Math.max(0, Math.round((Date.now() - state.examQuestionStartedAt) / 1000));
    state.examTimeSpent[question.id] = (state.examTimeSpent[question.id] || 0) + elapsed;
    state.examQuestionStartedAt = Date.now();
  }

  function saveDraftFromUi() {
    if (!isExamMode()) return;
    ensureExamState();
    accrueQuestionTime();
    const question = state.round[state.cursor];
    if (!question) return;
    const draft = { ...(state.examDrafts[question.id] || {}) };
    if (questionKind(question) === "choice") {
      if (state.selectedChoice) draft.selection = String(state.selectedChoice).toUpperCase();
    } else {
      draft.answer = document.querySelector("#userAnswer")?.value || "";
    }
    state.examDrafts[question.id] = draft;
    renderAnswerSheet();
  }

  function draftAnswered(question) {
    const draft = state.examDrafts?.[question.id] || {};
    return questionKind(question) === "choice"
      ? Boolean(draft.selection)
      : Boolean(String(draft.answer || "").trim());
  }

  function paperNumber(question, index) {
    if (state.roundMode !== DAILY_MODE) return String(index + 1);
    if (question.paperType === "choice") return String(index + 1);
    if (question.paperType === "essay") return "31";
    const materialIndex = state.round.slice(0, index).filter((item) => item.paperType === "material").length;
    return String(33 + materialIndex);
  }

  function renderAnswerSheet() {
    const grid = document.querySelector("#examSheetGrid");
    if (!grid || !isExamMode()) return;
    ensureExamState();
    grid.innerHTML = "";
    let answered = 0;
    state.round.forEach((question, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = paperNumber(question, index);
      button.dataset.index = String(index);
      const done = draftAnswered(question);
      if (done) answered += 1;
      button.classList.toggle("answered", done);
      button.classList.toggle("current", index === state.cursor);
      button.title = `${question.paperType === "material" ? "材料" : question.paperType === "essay" ? "论述" : "第"} ${paperNumber(question, index)}${question.title ? ` · ${question.title}` : ""}`;
      grid.append(button);
    });
    const legend = document.querySelector("#examSheetLegend");
    if (legend) legend.textContent = `已答 ${answered}/${state.round.length} · 可点题号跳转并修改`;
    nav.classList.remove("hidden");
    document.querySelector("#examPrev").disabled = state.cursor <= 0;
    document.querySelector("#examNext").disabled = state.cursor >= state.round.length - 1;
  }

  function loadDraftToUi() {
    if (!isExamMode()) return;
    ensureExamState();
    const question = state.round[state.cursor];
    if (!question) return;
    const draft = state.examDrafts[question.id] || {};
    document.querySelector("#answerArea")?.classList.add("hidden");
    const favorite = document.querySelector("#favorite");
    const noteLabel = document.querySelector('label[for="questionNote"]');
    const note = document.querySelector("#questionNote");
    const saveHint = document.querySelector(".question-card .save-hint");
    [favorite, noteLabel, note, saveHint].forEach((el) => el?.classList.add("hidden"));

    if (questionKind(question) === "choice") {
      state.selectedChoice = draft.selection || null;
      document.querySelectorAll(".choice-option").forEach((button) => {
        button.disabled = false;
        button.classList.remove("correct-option", "wrong-option");
        button.classList.toggle("selected", button.dataset.value === state.selectedChoice);
      });
      const submit = document.querySelector("#submitChoice");
      if (submit) {
        submit.disabled = !state.selectedChoice;
        submit.textContent = state.cursor === state.round.length - 1 ? "保存本题" : "保存并下一题";
      }
    } else {
      const answer = document.querySelector("#userAnswer");
      if (answer) {
        answer.disabled = false;
        answer.value = draft.answer || "";
      }
      const reveal = document.querySelector("#reveal");
      if (reveal) {
        reveal.classList.remove("hidden");
        reveal.textContent = state.cursor === state.round.length - 1 ? "保存本题" : "保存并下一题";
      }
    }

    if (state.roundMode === DAILY_MODE) {
      const badge = document.querySelector("#questionTypeBadge");
      if (badge) badge.textContent = question.paperType === "material" ? "材料分析题" : question.paperType === "essay" ? "论述题" : "单项选择题";
      const number = document.querySelector("#questionNumber");
      if (number) number.textContent = `${question.source ? `${question.source} · ` : ""}模拟卷第 ${paperNumber(question, state.cursor)} 题`;
    }

    state.examQuestionStartedAt = Date.now();
    renderAnswerSheet();
    updateExamPace();
  }

  function restoreStudyChrome() {
    const favorite = document.querySelector("#favorite");
    const noteLabel = document.querySelector('label[for="questionNote"]');
    const note = document.querySelector("#questionNote");
    const saveHint = document.querySelector(".question-card .save-hint");
    [favorite, noteLabel, note, saveHint].forEach((el) => el?.classList.remove("hidden"));
    nav.classList.add("hidden");
    sheet.classList.add("hidden");
    pace.classList.add("hidden");
  }

  function goToQuestion(index) {
    if (!isExamMode()) return;
    if (index < 0 || index >= state.round.length || index === state.cursor) return;
    saveDraftFromUi();
    state.cursor = index;
    renderQuestion();
  }

  function goNext() {
    if (!isExamMode()) return;
    saveDraftFromUi();
    if (state.cursor < state.round.length - 1) {
      state.cursor += 1;
      renderQuestion();
    } else {
      sheet.classList.remove("hidden");
      renderAnswerSheet();
      scrollToQuestionCard();
    }
  }

  function goPrev() {
    if (!isExamMode()) return;
    saveDraftFromUi();
    if (state.cursor > 0) {
      state.cursor -= 1;
      renderQuestion();
    }
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
    const recent = typeof recentQuestionIds === "function" ? recentQuestionIds(120) : new Set();
    const fresh = items.filter((q) => !recent.has(q.id));
    const old = items.filter((q) => recent.has(q.id));
    return [...seededShuffle(fresh, seed ^ 0xA341316C), ...seededShuffle(old, seed ^ 0xC8013EA4)];
  }

  function chooseDailyChoices(seed) {
    const subjects = typeof SUBJECT_ORDER !== "undefined" ? SUBJECT_ORDER : ["教育学原理", "中国教育史", "外国教育史", "教育心理学"];
    const pool = state.questions.filter((q) => questionKind(q) === "choice" && subjects.includes(canonicalSubject(q)));
    const startIndex = seed % subjects.length;
    const rotated = [...subjects.slice(startIndex), ...subjects.slice(0, startIndex)];
    const allocations = new Map(rotated.map((subject, index) => [subject, index < 3 ? 4 : 3]));
    const picked = [];
    rotated.forEach((subject, index) => {
      const subjectPool = pool.filter((q) => canonicalSubject(q) === subject);
      const ordered = orderedFreshPool(subjectPool, seed ^ hashString(`${subject}-${index}`));
      picked.push(...ordered.slice(0, allocations.get(subject)));
    });
    if (picked.length < DAILY_CHOICE_COUNT) {
      const used = new Set(picked.map((q) => q.id));
      picked.push(...orderedFreshPool(pool.filter((q) => !used.has(q.id)), seed ^ 0x9E3779B9).slice(0, DAILY_CHOICE_COUNT - picked.length));
    }
    return picked.slice(0, DAILY_CHOICE_COUNT);
  }

  function chooseDailySubjectives(seed) {
    const subjectives = state.questions.filter((q) => questionKind(q) !== "choice");
    let essays = subjectives.filter((q) => subjectiveClass(q) === "essay");
    let materials = subjectives.filter((q) => subjectiveClass(q) === "material");
    if (!essays.length) essays = subjectives.filter((q) => subjectiveClass(q) !== "material");
    if (materials.length < DAILY_MATERIAL_COUNT) materials = subjectives.filter((q) => subjectiveClass(q) !== "essay");
    const essay = orderedFreshPool(essays, seed ^ 0x243F6A88)[0] || null;
    const ordered = orderedFreshPool(materials.filter((q) => q.id !== essay?.id), seed ^ 0xB7E15162);
    const picked = [];
    const usedSubjects = new Set();
    for (const item of ordered) {
      const subject = canonicalSubject(item);
      if (!usedSubjects.has(subject)) {
        picked.push(item);
        usedSubjects.add(subject);
      }
      if (picked.length >= DAILY_MATERIAL_COUNT) break;
    }
    for (const item of ordered) {
      if (picked.length >= DAILY_MATERIAL_COUNT) break;
      if (!picked.some((q) => q.id === item.id)) picked.push(item);
    }
    return { essay, materials: picked.slice(0, DAILY_MATERIAL_COUNT) };
  }

  function buildOrRestoreDailyPaper() {
    if (!state.progress.dailyPapersV2 || typeof state.progress.dailyPapersV2 !== "object") state.progress.dailyPapersV2 = {};
    const date = localDate();
    const stored = state.progress.dailyPapersV2[date];
    if (stored?.ids?.length === 18) {
      const restored = stored.ids.map((id) => findQuestion(id)).filter(Boolean);
      if (restored.length === 18) return restored.map((q, index) => ({ ...q, paperType: stored.types[index] }));
    }
    const seed = hashString(`333-half-paper-v2-${date}`);
    const choices = chooseDailyChoices(seed);
    const { essay, materials } = chooseDailySubjectives(seed);
    if (choices.length < DAILY_CHOICE_COUNT || !essay || materials.length < DAILY_MATERIAL_COUNT) return null;
    const paper = [
      ...choices.map((q) => ({ ...q, paperType: "choice" })),
      { ...essay, paperType: "essay" },
      ...materials.map((q) => ({ ...q, paperType: "material" })),
    ];
    state.progress.dailyPapersV2[date] = { ids: paper.map((q) => q.id), types: paper.map((q) => q.paperType), createdAt: new Date().toISOString() };
    saveProgress();
    return paper;
  }

  function syncSetup() {
    const daily = modeSelect.value === DAILY_MODE;
    const typeSelect = document.querySelector("#questionType");
    const subjectSelect = document.querySelector("#subject");
    const count = document.querySelector("#count");
    const decrease = document.querySelector("#decrease");
    const increase = document.querySelector("#increase");
    const hint = document.querySelector("#timedHint");
    if (daily) {
      typeSelect.value = "all";
      subjectSelect.value = "all";
      count.value = 18;
      typeSelect.disabled = true;
      subjectSelect.disabled = true;
      count.disabled = true;
      decrease.disabled = true;
      increase.disabled = true;
      hint.textContent = "真题结构折半：15道单选（30分）＋1道论述（15分）＋2道材料分析（30分），共75分，限时90分钟。选择题建议30分钟，论述20分钟，两道材料各20分钟。支持答题卡、前后跳题和交卷后复盘。";
      hint.classList.remove("hidden");
      startButton.textContent = "开始今日半套卷";
    } else if (modeSelect.value !== TIMED_MODE) {
      typeSelect.disabled = false;
      subjectSelect.disabled = false;
      count.disabled = false;
      decrease.disabled = false;
      increase.disabled = false;
      startButton.textContent = "开始本轮";
    }
  }

  function startExamCommon(round, mode, seconds) {
    state.round = round;
    state.cursor = 0;
    state.results = { known: 0, unsure: 0, unknown: 0 };
    state.currentRoundLog = [];
    state.roundStartedAt = new Date();
    state.roundMode = mode;
    state.roundFinished = false;
    state.timedOut = false;
    state.selectedChoice = null;
    state.timedTotalSeconds = seconds;
    state.timerDeadline = Date.now() + seconds * 1000;
    state.examDrafts = {};
    state.examTimeSpent = {};
    state.examQuestionStartedAt = Date.now();
    document.querySelector("#setup")?.classList.add("hidden");
    finish.classList.add("hidden");
    quiz.classList.remove("hidden");
    review.classList.add("hidden");
    renderQuestion();
    startExamClock();
  }

  function startTimedExam() {
    const subject = document.querySelector("#subject").value;
    const count = Math.max(1, Math.min(30, Number(document.querySelector("#count").value) || 5));
    let pool = state.questions.filter((q) => questionKind(q) === "choice" && (subject === "all" || canonicalSubject(q) === subject));
    if (!pool.length) {
      alert("当前范围没有选择题。");
      return;
    }
    const round = subject === "all" && typeof balancedSample === "function"
      ? balancedSample(pool, count)
      : (typeof cooldownShuffle === "function" ? cooldownShuffle(pool).slice(0, count) : shuffle(pool).slice(0, count));
    const secondsPerQuestion = typeof TIMED_SECONDS_PER_QUESTION !== "undefined" ? TIMED_SECONDS_PER_QUESTION : DEFAULT_SECONDS_PER_CHOICE;
    startExamCommon(round, TIMED_MODE, round.length * secondsPerQuestion);
  }

  function startDailyExam() {
    const paper = buildOrRestoreDailyPaper();
    if (!paper) {
      alert("当前题库还不足以稳定组成今日半套卷，请让我继续补题库后再试。");
      return;
    }
    startExamCommon(paper, DAILY_MODE, DAILY_TOTAL_SECONDS);
  }

  function startExamClock() {
    stopExamClock();
    const box = document.querySelector("#timerBox");
    box?.classList.remove("hidden");
    updateExamClock();
    state.timerInterval = setInterval(updateExamClock, 250);
  }

  function updateExamPace() {
    if (!isExamMode() || !state.roundStartedAt) {
      pace.classList.add("hidden");
      return;
    }
    const elapsed = Math.max(0, Math.round((Date.now() - state.roundStartedAt.getTime()) / 1000));
    const question = state.round[state.cursor];
    if (state.roundMode === DAILY_MODE) {
      let target = "选择题建议在开考30分钟内完成";
      if (question?.paperType === "essay") target = "论述题建议20分钟，累计约50分钟进入材料题";
      if (question?.paperType === "material") target = "材料分析题建议每题20分钟";
      pace.textContent = `${target}｜整卷已用 ${formatClock(elapsed)}`;
    } else {
      pace.textContent = `限时测验｜平均目标 2分钟/题｜整卷已用 ${formatClock(elapsed)}`;
    }
    pace.classList.remove("hidden");
  }

  function updateExamClock() {
    if (!isExamMode() || !state.timerDeadline || state.roundFinished) return;
    const remainingMs = state.timerDeadline - Date.now();
    const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
    const timerText = document.querySelector("#timerText");
    const box = document.querySelector("#timerBox");
    if (timerText) timerText.textContent = formatClock(remaining);
    if (box) {
      const warningAt = state.roundMode === DAILY_MODE ? 15 * 60 : Math.max(60, Math.round(state.timedTotalSeconds * .2));
      const criticalAt = state.roundMode === DAILY_MODE ? 5 * 60 : 30;
      box.classList.toggle("warning", remaining <= warningAt);
      box.classList.toggle("critical", remaining <= criticalAt);
    }
    updateExamPace();
    if (remainingMs <= 0) finalizeExam(true);
  }

  function buildExamLogs(timedOut) {
    saveDraftFromUi();
    state.currentRoundLog = [];
    state.results = { known: 0, unsure: 0, unknown: 0 };
    const now = new Date();
    state.round.forEach((question) => {
      const kind = questionKind(question);
      const draft = state.examDrafts[question.id] || {};
      const answered = kind === "choice" ? Boolean(draft.selection) : Boolean(String(draft.answer || "").trim());
      const event = {
        id: question.id,
        rating: state.roundMode === DAILY_MODE ? "paper" : "unknown",
        type: kind,
        paperType: question.paperType || (kind === "choice" ? "choice" : "subjective"),
        paperMode: state.roundMode,
        date: localDate(now),
        at: now.toISOString(),
        answered,
        timed: true,
        timedOut: timedOut && !answered,
        secondsSpent: state.examTimeSpent[question.id] || 0,
      };
      if (kind === "choice") {
        const key = correctChoice(question);
        const selection = draft.selection || "";
        const correct = Boolean(answered && key && selection === key);
        event.selection = selection;
        event.correctAnswer = key;
        event.correct = correct;
        state.progress.choiceAnswers[question.id] = selection;
        state.progress.correctness[question.id] = correct;
        state.progress.ratings[question.id] = correct ? "known" : "unknown";
        state.results[correct ? "known" : "unknown"] += 1;
      } else {
        event.answerSnapshot = draft.answer || "";
        state.progress.answers[question.id] = draft.answer || "";
        state.progress.ratings[question.id] = answered ? "unsure" : "unknown";
        state.results[answered ? "unsure" : "unknown"] += 1;
      }
      state.progress.sessions.push(event);
      state.currentRoundLog.push({
        ...event,
        subject: canonicalSubject(question),
        number: question.number,
        title: question.title,
        prompt: question.prompt || "",
        source: question.source || "",
        answer: kind === "choice" ? "" : (draft.answer || ""),
        note: "",
        favorite: Boolean(state.progress.favorites[question.id]),
      });
    });
    saveProgress();
  }

  function finishDailyRound(timedOut) {
    state.roundFinished = true;
    stopExamClock();
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
    quiz.classList.add("hidden");
    finish.classList.remove("hidden");
    document.querySelector("#timerBox")?.classList.add("hidden");
    nav.classList.add("hidden");
    sheet.classList.add("hidden");
    pace.classList.add("hidden");
    const choices = roundRecord.items.filter((item) => item.paperType === "choice");
    const subjective = roundRecord.items.filter((item) => item.paperType !== "choice");
    const correct = choices.filter((item) => item.correct).length;
    const subjectiveDone = subjective.filter((item) => item.answered).length;
    const unanswered = roundRecord.items.filter((item) => !item.answered).length;
    const cards = [[`${correct}/${choices.length}`, "选择题正确"], [`${subjectiveDone}/${subjective.length}`, "主观题已作答"], [formatClock(elapsed), timedOut ? "到时交卷" : "实际用时"]];
    if (unanswered) cards.push([unanswered, "未作答"]);
    document.querySelector("#summary").innerHTML = cards.map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
    document.querySelector("#reportStatus").textContent = "今日半套卷：75分制，标准90分钟。可先查看答题情况，再提交给 ChatGPT 批改主观题。";
    renderReview(roundRecord);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function finalizeExam(timedOut = false) {
    if (!isExamMode() || state.roundFinished) return;
    const unanswered = state.round.filter((q) => !draftAnswered(q)).length;
    if (!timedOut && unanswered > 0 && !confirm(`还有 ${unanswered} 题未作答，确定交卷吗？`)) return;
    buildExamLogs(timedOut);
    state.timedOut = timedOut;
    if (state.roundMode === DAILY_MODE) {
      finishDailyRound(timedOut);
    } else {
      stopExamClock();
      showFinish();
      renderReview(typeof latestRound === "function" ? latestRound() : state.progress.rounds[state.progress.rounds.length - 1]);
    }
  }

  function textBlock(value) {
    const div = document.createElement("div");
    div.className = "review-block";
    div.textContent = value || "（无）";
    return div.outerHTML;
  }

  function renderReviewDetail(round, index) {
    const detail = document.querySelector("#reviewDetail");
    if (!detail) return;
    const item = round.items[index];
    const question = findQuestion(item.id);
    if (!item || !question) return;
    const typeLabel = item.paperType === "material" ? "材料分析题" : item.paperType === "essay" ? "论述题" : questionKind(question) === "choice" ? "选择题" : "主观题";
    let html = `<h3>${typeLabel}｜${escapeHtml(item.subject || canonicalSubject(question))}｜第 ${escapeHtml(paperNumber(question, index))} 题</h3>`;
    html += `<div class="review-label">题目</div>${textBlock(question.title || question.prompt || "")}`;
    if (question.prompt && question.prompt !== question.title) html += `<div class="review-label">材料 / 题干</div>${textBlock(question.prompt)}`;
    if (questionKind(question) === "choice") {
      html += `<div class="review-label">你的答案</div>${textBlock(item.answered ? item.selection : "未作答")}`;
      html += `<div class="review-label">正确答案</div>${textBlock(item.correctAnswer || correctChoice(question) || "未配置")}`;
      html += `<div class="review-label">解析</div>${textBlock(typeof choiceExplanation === "function" ? choiceExplanation(question) : (question.explanation || "暂无解析"))}`;
    } else {
      html += `<div class="review-label">你的作答</div>${textBlock(item.answer || item.answerSnapshot || "未作答")}`;
      html += `<div class="review-label">参考答案</div>${textBlock(question.answer || "暂无参考答案")}`;
    }
    if (item.secondsSpent != null) html += `<div class="review-label">本题用时</div>${textBlock(formatClock(item.secondsSpent))}`;
    detail.innerHTML = html;
  }

  function renderReview(round) {
    if (!round || !round.timed || !Array.isArray(round.items)) {
      review.classList.add("hidden");
      return;
    }
    review.classList.remove("hidden");
    document.querySelector("#examReviewBody")?.classList.add("hidden");
    const grid = document.querySelector("#reviewGrid");
    grid.innerHTML = "";
    round.items.forEach((item, index) => {
      const question = findQuestion(item.id);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.reviewIndex = String(index);
      button.textContent = question ? paperNumber(question, index) : String(index + 1);
      if (!item.answered) button.classList.add("unanswered");
      else if (item.type === "choice") button.classList.add(item.correct ? "correct" : "wrong");
      grid.append(button);
    });
    if (round.items.length) renderReviewDetail(round, 0);
    review.dataset.roundIndex = String(state.progress.rounds.indexOf(round));
  }

  const previousBuildRoundReport = buildRoundReport;
  buildRoundReport = function buildExamAwareReport(round) {
    if (!round || round.mode !== DAILY_MODE) return previousBuildRoundReport(round);
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
      if (item.type === "choice") lines.push(`- 我的选择：${item.answered ? item.selection || "（未记录）" : "（未作答）"}`, `- 正确答案：${item.correctAnswer || "（未配置）"}`, `- 客观结果：${item.correct ? "正确" : "错误"}`);
      else {
        if (item.prompt) lines.push(`- 题干：${item.prompt}`);
        lines.push(`- 我的作答：${item.answer || item.answerSnapshot || "（未填写）"}`);
      }
      if (item.secondsSpent != null) lines.push(`- 本题用时：${formatClock(item.secondsSpent)}`);
    });
    return lines.join("\n");
  };

  const previousRenderQuestion = renderQuestion;
  renderQuestion = function renderQuestionWithExamUi() {
    previousRenderQuestion();
    if (isExamMode()) loadDraftToUi();
    else restoreStudyChrome();
    scrollToQuestionCard();
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    if (button.id === "start" && (modeSelect.value === TIMED_MODE || modeSelect.value === DAILY_MODE)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (modeSelect.value === DAILY_MODE) startDailyExam(); else startTimedExam();
      return;
    }

    if (isExamMode() && button.id === "submitChoice") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!state.selectedChoice) return;
      goNext();
      return;
    }

    if (isExamMode() && button.id === "reveal") {
      event.preventDefault();
      event.stopImmediatePropagation();
      goNext();
      return;
    }
  }, true);

  document.querySelector("#examPrev")?.addEventListener("click", goPrev);
  document.querySelector("#examNext")?.addEventListener("click", goNext);
  document.querySelector("#examSheetToggle")?.addEventListener("click", () => {
    saveDraftFromUi();
    sheet.classList.toggle("hidden");
    renderAnswerSheet();
  });
  document.querySelector("#examSheetGrid")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (!button) return;
    goToQuestion(Number(button.dataset.index));
    sheet.classList.add("hidden");
  });
  document.querySelector("#examSubmit")?.addEventListener("click", () => finalizeExam(false));

  document.querySelector("#examReviewToggle")?.addEventListener("click", () => {
    document.querySelector("#examReviewBody")?.classList.toggle("hidden");
  });
  document.querySelector("#reviewGrid")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-review-index]");
    if (!button) return;
    const roundIndex = Number(review.dataset.roundIndex);
    const round = state.progress.rounds[roundIndex];
    if (round) renderReviewDetail(round, Number(button.dataset.reviewIndex));
  });

  [document.querySelector("#quit"), document.querySelector("#again")].forEach((button) => {
    button?.addEventListener("click", () => {
      stopExamClock();
      restoreStudyChrome();
    }, true);
  });

  modeSelect.addEventListener("change", syncSetup);
  syncSetup();
})();