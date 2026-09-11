const STORAGE_KEY = "study-quiz-progress-v1";
const REPO = "brearleysailsbury45969-ctrl/study-quiz";
const TIMED_SECONDS_PER_QUESTION = 120;
const SUBJECT_ORDER = ["教育学原理", "中国教育史", "外国教育史", "教育心理学"];

const state = {
  questions: [],
  round: [],
  cursor: 0,
  results: { known: 0, unsure: 0, unknown: 0 },
  currentRoundLog: [],
  roundStartedAt: null,
  roundMode: "random",
  roundFinished: false,
  selectedChoice: null,
  timerInterval: null,
  timerDeadline: null,
  timedTotalSeconds: 0,
  timedOut: false,
  progress: loadProgress(),
};

const $ = (selector) => document.querySelector(selector);
const setup = $("#setup");
const quiz = $("#quiz");
const finish = $("#finish");

function emptyProgress() {
  return {
    ratings: {},
    answers: {},
    choiceAnswers: {},
    correctness: {},
    notes: {},
    favorites: {},
    sessions: [],
    rounds: [],
  };
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...emptyProgress(), ...(saved || {}) };
  } catch {
    return emptyProgress();
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  renderTodayCount();
}

function localDate(value = new Date()) {
  return value.toLocaleDateString("sv-SE");
}

function canonicalSubject(question) {
  const raw = String(question.subject || "").trim();
  if (SUBJECT_ORDER.includes(raw)) return raw;
  const source = String(question.source || "");
  if (source.includes("教原")) return "教育学原理";
  if (source.includes("中教")) return "中国教育史";
  if (source.includes("外教")) return "外国教育史";
  if (source.includes("教心")) return "教育心理学";
  return raw || "未分类";
}

function questionKind(question) {
  const raw = String(question.type || "subjective").toLowerCase();
  return ["choice", "mcq", "single_choice", "single-select", "single_select"].includes(raw)
    ? "choice"
    : "subjective";
}

function questionTypeLabel(question) {
  return questionKind(question) === "choice" ? "选择题" : "简答 / 论述题";
}

function choiceOptions(question) {
  if (Array.isArray(question.options)) {
    return question.options.map((option, index) => {
      if (typeof option === "string") {
        return { value: "ABCD"[index] || String(index + 1), label: option };
      }
      return {
        value: String(option.value || option.key || "ABCD"[index] || index + 1),
        label: String(option.label || option.text || option.content || option.value || ""),
      };
    });
  }
  if (question.options && typeof question.options === "object") {
    return Object.entries(question.options).map(([value, label]) => ({ value, label: String(label) }));
  }
  return [];
}

function correctChoice(question) {
  if (Array.isArray(question.correctValues) && question.correctValues.length) {
    return String(question.correctValues[0]).toUpperCase();
  }
  const raw = question.correct ?? question.correctAnswer ?? question.key;
  if (raw != null) return String(raw).trim().toUpperCase();
  if (typeof question.answer === "string" && /^[A-D]$/i.test(question.answer.trim())) {
    return question.answer.trim().toUpperCase();
  }
  return "";
}

function choiceExplanation(question) {
  const explanation = question.explanation || question.analysis || question.rationale || "";
  if (explanation) return explanation;
  const key = correctChoice(question);
  const option = choiceOptions(question).find((item) => item.value === key);
  return key ? `正确答案：${key}${option ? ` · ${option.label}` : ""}` : "暂无解析";
}

function renderTodayCount() {
  const today = localDate();
  const count = state.progress.sessions.filter((item) => item.date === today && item.answered !== false).length;
  $("#todayCount").textContent = count;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function recentQuestionIds(limit = 80) {
  return new Set(state.progress.sessions.slice(-limit).map((item) => item.id));
}

function cooldownShuffle(items) {
  const recent = recentQuestionIds();
  const fresh = shuffle(items.filter((item) => !recent.has(item.id)));
  const cooling = shuffle(items.filter((item) => recent.has(item.id)));
  return [...fresh, ...cooling];
}

function balancedSample(pool, count) {
  const grouped = new Map();
  pool.forEach((question) => {
    const subject = canonicalSubject(question);
    if (!grouped.has(subject)) grouped.set(subject, []);
    grouped.get(subject).push(question);
  });

  const orderedSubjects = [
    ...SUBJECT_ORDER.filter((subject) => grouped.has(subject)),
    ...[...grouped.keys()].filter((subject) => !SUBJECT_ORDER.includes(subject)),
  ];
  const buckets = new Map(orderedSubjects.map((subject) => [subject, cooldownShuffle(grouped.get(subject))]));
  const picked = [];
  while (picked.length < count) {
    let added = false;
    for (const subject of orderedSubjects) {
      const bucket = buckets.get(subject);
      if (bucket && bucket.length && picked.length < count) {
        picked.push(bucket.shift());
        added = true;
      }
    }
    if (!added) break;
  }
  return picked;
}

function normalizedTitle(question) {
  return String(question.title || question.prompt || "")
    .replace(/\s+/g, "")
    .replace(/[（）()，,。．·“”‘’：:；;！!？?]/g, "")
    .toLowerCase();
}

function dedupeQuestions(items) {
  const seenIds = new Set();
  const seenText = new Set();
  const result = [];
  items.forEach((raw) => {
    const question = { ...raw, subject: canonicalSubject(raw) };
    const id = String(question.id || "");
    const signature = `${questionKind(question)}|${question.subject}|${normalizedTitle(question)}`;
    if ((id && seenIds.has(id)) || (normalizedTitle(question) && seenText.has(signature))) return;
    if (id) seenIds.add(id);
    if (normalizedTitle(question)) seenText.add(signature);
    result.push(question);
  });
  return result;
}

function populateSubjects() {
  const select = $("#subject");
  select.innerHTML = '<option value="all">全部科目</option>';
  const subjects = [...new Set(state.questions.map((q) => canonicalSubject(q)).filter(Boolean))];
  subjects.sort((a, b) => {
    const ai = SUBJECT_ORDER.indexOf(a);
    const bi = SUBJECT_ORDER.indexOf(b);
    if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    return a.localeCompare(b, "zh-CN");
  });
  subjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = `${subject}（${state.questions.filter((q) => canonicalSubject(q) === subject).length}题）`;
    select.append(option);
  });
}

function formatClock(seconds) {
  const safe = Math.max(0, Math.round(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function syncTimedSetup() {
  const timed = $("#mode").value === "timed";
  const typeSelect = $("#questionType");
  const hint = $("#timedHint");
  if (timed) {
    typeSelect.value = "choice";
    typeSelect.disabled = true;
    const count = Math.max(1, Math.min(30, Number($("#count").value) || 5));
    hint.textContent = `限时测验按 2 分钟 / 题：${count} 题共 ${formatClock(count * TIMED_SECONDS_PER_QUESTION)}。答题过程中不公布正确答案，交卷后统一结算。`;
    hint.classList.remove("hidden");
  } else {
    typeSelect.disabled = false;
    hint.classList.add("hidden");
  }
}

function startRound() {
  const subject = $("#subject").value;
  const mode = $("#mode").value;
  const requestedType = mode === "timed" ? "choice" : $("#questionType").value;
  const count = Math.max(1, Math.min(30, Number($("#count").value) || 5));

  let pool = state.questions.filter((q) => subject === "all" || canonicalSubject(q) === subject);
  if (requestedType !== "all") {
    pool = pool.filter((q) => questionKind(q) === requestedType);
  }
  if (mode === "review") {
    pool = pool.filter((q) => {
      if (["unsure", "unknown"].includes(state.progress.ratings[q.id])) return true;
      return questionKind(q) === "choice" && state.progress.correctness[q.id] === false;
    });
  }
  if (mode === "favorites") {
    pool = pool.filter((q) => state.progress.favorites[q.id]);
  }
  if (!pool.length) {
    const message = mode === "review"
      ? "当前范围还没有错题、模糊题或不会题。"
      : mode === "favorites"
        ? "当前范围还没有收藏题目。"
        : requestedType === "choice"
          ? "当前范围还没有选择题。"
          : "当前范围没有题目。";
    alert(message);
    return;
  }

  if (mode === "sequential") {
    state.round = pool.slice(0, count);
  } else if (subject === "all") {
    state.round = balancedSample(pool, count);
  } else {
    state.round = cooldownShuffle(pool).slice(0, count);
  }

  state.cursor = 0;
  state.results = { known: 0, unsure: 0, unknown: 0 };
  state.currentRoundLog = [];
  state.roundStartedAt = new Date();
  state.roundMode = mode;
  state.roundFinished = false;
  state.timedOut = false;
  state.selectedChoice = null;
  state.timedTotalSeconds = mode === "timed" ? state.round.length * TIMED_SECONDS_PER_QUESTION : 0;
  state.timerDeadline = mode === "timed" ? Date.now() + state.timedTotalSeconds * 1000 : null;

  setup.classList.add("hidden");
  finish.classList.add("hidden");
  quiz.classList.remove("hidden");
  renderQuestion();
  if (mode === "timed") startTimedClock(); else hideTimer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderQuestion() {
  const question = state.round[state.cursor];
  if (!question) return;
  const kind = questionKind(question);
  const timed = state.roundMode === "timed";
  state.selectedChoice = null;

  $("#questionTypeBadge").textContent = timed ? "限时选择题" : questionTypeLabel(question);
  $("#questionSubject").textContent = canonicalSubject(question);
  const sourceBits = [question.source, question.number != null ? `第 ${question.number} 题` : ""].filter(Boolean);
  $("#questionNumber").textContent = sourceBits.join(" · ");
  $("#questionTitle").textContent = question.title || question.prompt || "";
  $("#questionPrompt").textContent = question.prompt && question.prompt !== question.title ? question.prompt : "";
  $("#questionNote").value = state.progress.notes[question.id] || "";
  $("#answerArea").classList.add("hidden");
  $("#mine").classList.add("hidden");
  $("#choiceResult").classList.add("hidden");
  $("#referenceAnswer").textContent = "";
  $("#progressText").textContent = `${state.cursor + 1} / ${state.round.length}`;
  $("#progressBar").style.width = `${((state.cursor + 1) / state.round.length) * 100}%`;

  if (kind === "choice") {
    renderChoiceQuestion(question);
  } else {
    renderSubjectiveQuestion(question);
  }
  renderFavoriteButton();
}

function renderSubjectiveQuestion(question) {
  $("#choiceInput").classList.add("hidden");
  $("#subjectiveInput").classList.remove("hidden");
  $("#userAnswer").value = state.progress.answers[question.id] || "";
  $("#userAnswer").disabled = false;
  $("#reveal").classList.remove("hidden");
  $("#toggleMine").classList.remove("hidden");
  $("#answerHeading").textContent = "参考答案";
}

function renderChoiceQuestion(question) {
  $("#subjectiveInput").classList.add("hidden");
  $("#choiceInput").classList.remove("hidden");
  $("#toggleMine").classList.add("hidden");
  $("#answerHeading").textContent = "答案与解析";
  $("#submitChoice").disabled = true;
  $("#submitChoice").textContent = state.roundMode === "timed" ? "提交并下一题" : "提交选择";
  const container = $("#choiceOptions");
  container.innerHTML = "";

  const options = choiceOptions(question);
  if (!options.length) {
    container.innerHTML = '<p class="choice-error">这道选择题缺少选项，请让我检查题库数据。</p>';
    return;
  }

  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-option";
    button.dataset.value = option.value;
    button.innerHTML = `<strong>${escapeHtml(option.value)}</strong><span>${escapeHtml(option.label)}</span>`;
    button.addEventListener("click", () => selectChoice(option.value));
    container.append(button);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selectChoice(value) {
  state.selectedChoice = String(value).toUpperCase();
  document.querySelectorAll(".choice-option").forEach((button) => {
    button.classList.toggle("selected", button.dataset.value === state.selectedChoice);
  });
  $("#submitChoice").disabled = false;
}

function saveCurrentNote() {
  const question = state.round[state.cursor];
  if (!question) return;
  state.progress.notes[question.id] = $("#questionNote").value;
  saveProgress();
}

function recordEvent(question, rating, extra = {}) {
  const now = new Date();
  const kind = questionKind(question);
  state.progress.ratings[question.id] = rating;
  const event = {
    id: question.id,
    rating,
    type: kind,
    date: localDate(now),
    at: now.toISOString(),
    answered: extra.answered !== false,
    timed: state.roundMode === "timed",
    ...extra,
  };

  if (kind === "choice") {
    event.selection = extra.selection ?? state.progress.choiceAnswers[question.id] ?? "";
    event.correctAnswer = extra.correctAnswer ?? correctChoice(question);
    event.correct = extra.correct ?? state.progress.correctness[question.id] === true;
  } else {
    event.answerSnapshot = state.progress.answers[question.id] || "";
  }

  state.progress.sessions.push(event);
  state.currentRoundLog.push({
    ...event,
    subject: canonicalSubject(question),
    number: question.number,
    title: question.title,
    source: question.source || "",
    answer: kind === "subjective" ? (state.progress.answers[question.id] || "") : "",
    note: state.progress.notes[question.id] || "",
    favorite: Boolean(state.progress.favorites[question.id]),
  });
  state.results[rating] += 1;
  saveProgress();
}

function submitChoiceAnswer() {
  const question = state.round[state.cursor];
  if (!question || questionKind(question) !== "choice" || !state.selectedChoice) return;

  saveCurrentNote();
  const key = correctChoice(question);
  const isCorrect = Boolean(key) && state.selectedChoice === key;
  state.progress.choiceAnswers[question.id] = state.selectedChoice;
  state.progress.correctness[question.id] = Boolean(isCorrect);
  saveProgress();

  if (state.roundMode === "timed") {
    recordEvent(question, isCorrect ? "known" : "unknown", {
      selection: state.selectedChoice,
      correctAnswer: key,
      correct: isCorrect,
      answered: true,
    });
    advanceQuestion();
    return;
  }

  document.querySelectorAll(".choice-option").forEach((button) => {
    button.disabled = true;
    if (button.dataset.value === key) button.classList.add("correct-option");
    if (button.dataset.value === state.selectedChoice && !isCorrect) button.classList.add("wrong-option");
  });
  $("#submitChoice").disabled = true;

  const result = $("#choiceResult");
  result.classList.remove("hidden");
  result.classList.toggle("correct", Boolean(isCorrect));
  result.classList.toggle("wrong", !isCorrect);
  result.textContent = key
    ? `${isCorrect ? "答对了" : "答错了"}：你选 ${state.selectedChoice}，正确答案 ${key}。`
    : `你选择了 ${state.selectedChoice}。这道题暂未配置标准答案，请让我检查题库。`;

  $("#referenceAnswer").textContent = choiceExplanation(question);
  $("#answerArea").classList.remove("hidden");
  $("#answerArea").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderFavoriteButton() {
  const question = state.round[state.cursor];
  const active = Boolean(state.progress.favorites[question.id]);
  const button = $("#favorite");
  button.classList.toggle("active", active);
  button.textContent = active ? "★ 已收藏" : "☆ 收藏";
  button.setAttribute("aria-pressed", String(active));
}

function toggleFavorite() {
  const question = state.round[state.cursor];
  state.progress.favorites[question.id] = !state.progress.favorites[question.id];
  saveProgress();
  renderFavoriteButton();
}

function revealAnswer() {
  const question = state.round[state.cursor];
  if (!question || questionKind(question) === "choice") return;
  const answer = $("#userAnswer").value.trim();
  state.progress.answers[question.id] = answer;
  saveCurrentNote();
  saveProgress();
  $("#mine").textContent = answer || "（这次没有输入答案）";
  $("#referenceAnswer").textContent = question.answer || "暂无参考答案";
  $("#userAnswer").disabled = true;
  $("#reveal").classList.add("hidden");
  $("#answerArea").classList.remove("hidden");
  $("#answerArea").scrollIntoView({ behavior: "smooth", block: "start" });
}

function rate(rating) {
  if (state.roundMode === "timed") return;
  const question = state.round[state.cursor];
  if (!question) return;
  saveCurrentNote();
  recordEvent(question, rating, questionKind(question) === "choice" ? {
    selection: state.selectedChoice || state.progress.choiceAnswers[question.id] || "",
    correctAnswer: correctChoice(question),
    correct: state.progress.correctness[question.id] === true,
    answered: true,
  } : { answered: true });
  advanceQuestion();
}

function advanceQuestion() {
  state.cursor += 1;
  if (state.cursor < state.round.length) {
    renderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    showFinish();
  }
}

function startTimedClock() {
  const box = $("#timerBox");
  box.classList.remove("hidden");
  updateTimedClock();
  stopTimerInterval();
  state.timerInterval = setInterval(updateTimedClock, 250);
}

function stopTimerInterval() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function hideTimer() {
  stopTimerInterval();
  $("#timerBox").classList.add("hidden");
  $("#timerBox").classList.remove("warning" , "critical");
}

function updateTimedClock() {
  if (state.roundMode !== "timed" || !state.timerDeadline || state.roundFinished) return;
  const remainingMs = state.timerDeadline - Date.now();
  const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
  $("#timerText").textContent = formatClock(remaining);
  const box = $("#timerBox");
  box.classList.toggle("warning", remaining <= Math.max(60, Math.round(state.timedTotalSeconds * 0.2)));
  box.classList.toggle("critical", remaining <= 30);
  if (remainingMs <= 0) finishTimedDueToTimeout();
}

function finishTimedDueToTimeout() {
  if (state.roundFinished) return;
  state.timedOut = true;
  stopTimerInterval();
  const logged = new Set(state.currentRoundLog.map((item) => item.id));
  for (let i = state.cursor; i < state.round.length; i += 1) {
    const question = state.round[i];
    if (logged.has(question.id)) continue;
    if (i === state.cursor) {
      state.progress.notes[question.id] = $("#questionNote").value;
    }
    state.progress.correctness[question.id] = false;
    recordEvent(question, "unknown", {
      selection: "",
      correctAnswer: correctChoice(question),
      correct: false,
      answered: false,
      timedOut: true,
    });
  }
  showFinish();
}

function roundElapsedSeconds(endedAt = new Date()) {
  if (!state.roundStartedAt) return 0;
  const raw = Math.max(0, Math.round((endedAt - state.roundStartedAt) / 1000));
  return state.roundMode === "timed" && state.timedTotalSeconds
    ? Math.min(raw, state.timedTotalSeconds)
    : raw;
}

function showFinish() {
  if (state.roundFinished) return;
  state.roundFinished = true;
  stopTimerInterval();
  const endedAt = new Date();
  const roundRecord = {
    date: localDate(endedAt),
    startedAt: state.roundStartedAt ? state.roundStartedAt.toISOString() : null,
    endedAt: endedAt.toISOString(),
    mode: state.roundMode,
    timed: state.roundMode === "timed",
    timedOut: state.timedOut,
    allottedSeconds: state.timedTotalSeconds || null,
    elapsedSeconds: roundElapsedSeconds(endedAt),
    secondsPerQuestionTarget: state.roundMode === "timed" ? TIMED_SECONDS_PER_QUESTION : null,
    results: { ...state.results },
    items: [...state.currentRoundLog],
  };
  state.progress.rounds.push(roundRecord);
  saveProgress();

  quiz.classList.add("hidden");
  finish.classList.remove("hidden");
  hideTimer();
  const choiceItems = roundRecord.items.filter((item) => item.type === "choice");
  const answeredItems = choiceItems.filter((item) => item.answered !== false);
  const correctCount = choiceItems.filter((item) => item.correct).length;
  const unansweredCount = choiceItems.filter((item) => item.answered === false).length;
  const cards = [];
  if (choiceItems.length) cards.push([`${correctCount}/${choiceItems.length}`, "选择题正确"]);
  if (roundRecord.timed) {
    cards.push([formatClock(roundRecord.elapsedSeconds), roundRecord.timedOut ? "到时交卷" : "实际用时"]);
    if (answeredItems.length) {
      cards.push([`${Math.round(roundRecord.elapsedSeconds / answeredItems.length)}秒`, "平均 / 已答题"]);
    }
    if (unansweredCount) cards.push([unansweredCount, "未作答"]);
  } else {
    cards.push([state.results.known, "会"], [state.results.unsure, "模糊 / 蒙对"], [state.results.unknown, "不会"]);
  }
  $("#summary").innerHTML = cards
    .map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`)
    .join("");
  $("#reportStatus").textContent = roundRecord.timed
    ? `本轮标准时间：${formatClock(roundRecord.allottedSeconds)}（2分钟 / 题）。提交后我可以继续按错题和速度给你调下一轮。`
    : "提交后，我就能从 GitHub 读取本轮详情。";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnToSetup() {
  hideTimer();
  state.roundFinished = true;
  quiz.classList.add("hidden");
  finish.classList.add("hidden");
  setup.classList.remove("hidden");
  syncTimedSetup();
}

function ratingLabel(rating) {
  return { known: "会", unsure: "模糊 / 蒙对", unknown: "不会" }[rating] || rating || "未标记";
}

function findQuestion(id) {
  return state.questions.find((q) => q.id === id);
}

function latestRound() {
  return state.progress.rounds[state.progress.rounds.length - 1] || null;
}

function appendReportItem(lines, item, index) {
  const kind = item.type || "subjective";
  lines.push(
    "",
    `### ${index + 1}. ${item.subject || "未分类"}｜${item.number != null ? `${item.number}｜` : ""}${item.title || item.id}`,
    `- 题目 ID：${item.id}`,
    `- 题型：${kind === "choice" ? "选择题" : "简答 / 论述题"}`,
  );
  if (item.source) lines.push(`- 来源：${item.source}`);
  if (kind === "choice") {
    lines.push(
      `- 我的选择：${item.answered === false ? "（未作答）" : (item.selection || "（未记录）")}`,
      `- 正确答案：${item.correctAnswer || "（未配置）"}`,
      `- 客观结果：${item.correct ? "正确" : "错误"}`,
    );
  } else {
    lines.push(`- 我的作答：${item.answer || item.answerSnapshot || "（未填写）"}`);
  }
  if (!item.timed) lines.push(`- 自评：${ratingLabel(item.rating)}`);
  lines.push(`- 笔记：${item.note || "（无）"}`, `- 收藏：${item.favorite ? "是" : "否"}`);
}

function buildRoundReport(round) {
  if (!round) return "";
  const total = round.items.length;
  const durationSeconds = round.elapsedSeconds != null
    ? round.elapsedSeconds
    : round.startedAt && round.endedAt
      ? Math.max(0, Math.round((new Date(round.endedAt) - new Date(round.startedAt)) / 1000))
      : null;
  const durationText = durationSeconds == null ? "未知" : formatClock(durationSeconds);
  const choiceItems = round.items.filter((item) => item.type === "choice");
  const correctCount = choiceItems.filter((item) => item.correct).length;
  const unansweredCount = choiceItems.filter((item) => item.answered === false).length;
  const lines = [
    `# 学习测验报告`,
    "",
    `- 日期：${round.date}`,
    `- 模式：${round.timed ? "限时测验（2分钟/题）" : (round.mode || "普通练习")}`,
    `- 题数：${total}`,
    `- 用时：${durationText}`,
  ];
  if (round.timed) {
    lines.push(`- 标准时长：${formatClock(round.allottedSeconds || total * TIMED_SECONDS_PER_QUESTION)}`);
    if (round.timedOut) lines.push(`- 状态：到时自动交卷`);
  } else {
    lines.push(`- 会：${round.results.known}；模糊/蒙对：${round.results.unsure}；不会：${round.results.unknown}`);
  }
  if (choiceItems.length) lines.push(`- 选择题正确：${correctCount}/${choiceItems.length}`, `- 未作答：${unansweredCount}`);
  lines.push("", `## 逐题记录`);
  round.items.forEach((item, index) => appendReportItem(lines, item, index));
  return lines.join("\n");
}

function buildTodayReport() {
  const today = localDate();
  const events = state.progress.sessions.filter((item) => item.date === today);
  const lines = [`# 今日学习记录`, "", `- 日期：${today}`, `- 作答/记录次数：${events.length}`, "", `## 逐题记录`];
  events.forEach((event, index) => {
    const question = findQuestion(event.id);
    const kind = event.type || (question ? questionKind(question) : "subjective");
    const item = {
      ...event,
      type: kind,
      subject: question ? canonicalSubject(question) : undefined,
      number: question?.number,
      title: question?.title,
      source: question?.source || "",
      answer: event.answerSnapshot ?? state.progress.answers[event.id] ?? "",
      selection: event.selection ?? state.progress.choiceAnswers[event.id] ?? "",
      correctAnswer: event.correctAnswer ?? (question ? correctChoice(question) : ""),
      correct: event.correct ?? state.progress.correctness[event.id] === true,
      note: state.progress.notes[event.id] || "",
      favorite: Boolean(state.progress.favorites[event.id]),
    };
    appendReportItem(lines, item, index);
  });
  return lines.join("\n");
}

function openGitHubIssue(title, body) {
  if (!body) {
    alert("目前没有可提交的记录。");
    return;
  }
  const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function submitLatestRound() {
  const round = latestRound();
  if (!round) {
    alert("还没有完成的轮次。");
    return;
  }
  openGitHubIssue(`[STUDY-REPORT] ${round.date} 本轮答题`, buildRoundReport(round));
  $("#reportStatus").textContent = "GitHub 已打开：确认内容后点 Create / Submit new issue 即可。";
}

function submitToday() {
  const today = localDate();
  if (!state.progress.sessions.some((item) => item.date === today)) {
    alert("今天还没有答题记录。");
    return;
  }
  openGitHubIssue(`[STUDY-REPORT] ${today} 今日学习记录`, buildTodayReport());
}

function exportProgress() {
  const data = JSON.stringify(state.progress, null, 2);
  const blob = new Blob([data], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `study-quiz-progress-${localDate()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

$("#start").addEventListener("click", startRound);
$("#quit").addEventListener("click", returnToSetup);
$("#again").addEventListener("click", returnToSetup);
$("#reveal").addEventListener("click", revealAnswer);
$("#submitChoice").addEventListener("click", submitChoiceAnswer);
$("#toggleMine").addEventListener("click", () => $("#mine").classList.toggle("hidden"));
$("#favorite").addEventListener("click", toggleFavorite);
$("#questionNote").addEventListener("input", saveCurrentNote);
$("#submitRound").addEventListener("click", submitLatestRound);
$("#submitToday").addEventListener("click", submitToday);
$("#exportProgress").addEventListener("click", exportProgress);
$("#decrease").addEventListener("click", () => { $("#count").value = Math.max(1, Number($("#count").value) - 1); syncTimedSetup(); });
$("#increase").addEventListener("click", () => { $("#count").value = Math.min(30, Number($("#count").value) + 1); syncTimedSetup(); });
$("#count").addEventListener("input", syncTimedSetup);
$("#mode").addEventListener("change", syncTimedSetup);
document.querySelectorAll("[data-rating]").forEach((button) => button.addEventListener("click", () => rate(button.dataset.rating)));
$("#resetProgress").addEventListener("click", () => {
  if (confirm("确定清空这台设备上的全部答题记录、笔记和收藏吗？")) {
    state.progress = emptyProgress();
    saveProgress();
  }
});

const questionFiles = [
  "questions/dandan-batch-principles-1.json",
  "questions/dandan-batch-chinese-1.json",
  "questions/dandan-batch-foreign-1.json",
  "questions/dandan-batch-psychology-1.json",
  "questions/chinese-education-history.json",
  "questions/foreign-education-history.json",
  "questions/educational-psychology.json",
  "questions/education-principles.json",
  "questions/custom-choice.json",
  "questions/custom-subjective.json",
];

Promise.all(questionFiles.map((path) => fetch(path).then((response) => {
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
})))
  .then((groups) => {
    state.questions = dedupeQuestions(groups.flat());
    populateSubjects();
    renderTodayCount();
    syncTimedSetup();
  })
  .catch((error) => {
    setup.innerHTML = `<p>题库加载失败：${escapeHtml(error.message)}</p><p>请通过网站地址访问，不要直接打开本地 HTML 文件。</p>`;
  });