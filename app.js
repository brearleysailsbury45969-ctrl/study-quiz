const STORAGE_KEY = "study-quiz-progress-v1";
const REPO = "brearleysailsbury45969-ctrl/study-quiz";

const state = {
  questions: [],
  round: [],
  cursor: 0,
  results: { known: 0, unsure: 0, unknown: 0 },
  currentRoundLog: [],
  roundStartedAt: null,
  selectedChoice: null,
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
    return String(question.correctValues[0]);
  }
  const raw = question.correct ?? question.correctAnswer ?? question.key;
  if (raw != null) return String(raw);
  if (typeof question.answer === "string" && /^[A-D]$/i.test(question.answer.trim())) {
    return question.answer.trim().toUpperCase();
  }
  return "";
}

function choiceExplanation(question) {
  return question.explanation || question.analysis || question.rationale || "";
}

function renderTodayCount() {
  const today = localDate();
  const count = state.progress.sessions.filter((item) => item.date === today).length;
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

function populateSubjects() {
  const subjects = [...new Set(state.questions.map((q) => q.subject).filter(Boolean))];
  subjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = `${subject}（${state.questions.filter((q) => q.subject === subject).length}题）`;
    $("#subject").append(option);
  });
}

function startRound() {
  const subject = $("#subject").value;
  const requestedType = $("#questionType").value;
  const mode = $("#mode").value;
  const count = Math.max(1, Math.min(30, Number($("#count").value) || 5));

  let pool = state.questions.filter((q) => subject === "all" || q.subject === subject);
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
          ? "当前范围还没有选择题。之后我可以直接把选择题写进专用题库。"
          : "当前范围没有题目。";
    alert(message);
    return;
  }

  state.round = (mode === "sequential" ? pool : shuffle(pool)).slice(0, count);
  state.cursor = 0;
  state.results = { known: 0, unsure: 0, unknown: 0 };
  state.currentRoundLog = [];
  state.roundStartedAt = new Date();
  state.selectedChoice = null;
  setup.classList.add("hidden");
  finish.classList.add("hidden");
  quiz.classList.remove("hidden");
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderQuestion() {
  const question = state.round[state.cursor];
  const kind = questionKind(question);
  state.selectedChoice = null;

  $("#questionTypeBadge").textContent = questionTypeLabel(question);
  $("#questionSubject").textContent = question.subject || "未分类";
  $("#questionNumber").textContent = question.number != null ? `第 ${question.number} 题` : "";
  $("#questionTitle").textContent = question.title || question.prompt || "";
  $("#questionPrompt").textContent = question.prompt || "";
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
  state.selectedChoice = String(value);
  document.querySelectorAll(".choice-option").forEach((button) => {
    button.classList.toggle("selected", button.dataset.value === state.selectedChoice);
  });
  $("#submitChoice").disabled = false;
}

function submitChoiceAnswer() {
  const question = state.round[state.cursor];
  if (!question || questionKind(question) !== "choice" || !state.selectedChoice) return;

  saveCurrentNote();
  const key = correctChoice(question);
  const isCorrect = key && state.selectedChoice === key;
  state.progress.choiceAnswers[question.id] = state.selectedChoice;
  state.progress.correctness[question.id] = Boolean(isCorrect);
  saveProgress();

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

  $("#referenceAnswer").textContent = choiceExplanation(question) || (key ? `正确答案：${key}` : "暂无解析");
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

function saveCurrentNote() {
  const question = state.round[state.cursor];
  if (!question) return;
  state.progress.notes[question.id] = $("#questionNote").value;
  saveProgress();
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
  const question = state.round[state.cursor];
  const now = new Date();
  const kind = questionKind(question);
  saveCurrentNote();
  state.progress.ratings[question.id] = rating;

  const event = {
    id: question.id,
    rating,
    type: kind,
    date: localDate(now),
    at: now.toISOString(),
  };
  if (kind === "choice") {
    event.selection = state.selectedChoice || state.progress.choiceAnswers[question.id] || "";
    event.correctAnswer = correctChoice(question);
    event.correct = state.progress.correctness[question.id] === true;
  } else {
    event.answerSnapshot = state.progress.answers[question.id] || "";
  }

  state.progress.sessions.push(event);
  state.currentRoundLog.push({
    ...event,
    subject: question.subject,
    number: question.number,
    title: question.title,
    answer: kind === "subjective" ? (state.progress.answers[question.id] || "") : "",
    note: state.progress.notes[question.id] || "",
    favorite: Boolean(state.progress.favorites[question.id]),
  });
  state.results[rating] += 1;
  saveProgress();

  state.cursor += 1;
  if (state.cursor < state.round.length) {
    renderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    showFinish();
  }
}

function showFinish() {
  const endedAt = new Date();
  const roundRecord = {
    date: localDate(endedAt),
    startedAt: state.roundStartedAt ? state.roundStartedAt.toISOString() : null,
    endedAt: endedAt.toISOString(),
    results: { ...state.results },
    items: [...state.currentRoundLog],
  };
  state.progress.rounds.push(roundRecord);
  saveProgress();

  quiz.classList.add("hidden");
  finish.classList.remove("hidden");
  const choiceItems = roundRecord.items.filter((item) => item.type === "choice");
  const correctCount = choiceItems.filter((item) => item.correct).length;
  const cards = [
    [state.results.known, "会"],
    [state.results.unsure, "模糊 / 蒙对"],
    [state.results.unknown, "不会"],
  ];
  if (choiceItems.length) cards.unshift([`${correctCount}/${choiceItems.length}`, "选择题正确"]);
  $("#summary").innerHTML = cards
    .map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`)
    .join("");
  $("#reportStatus").textContent = "提交后，我就能从 GitHub 读取本轮详情。";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnToSetup() {
  quiz.classList.add("hidden");
  finish.classList.add("hidden");
  setup.classList.remove("hidden");
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
    `### ${index + 1}. ${item.subject || "未分类"}｜${item.number != null ? `第 ${item.number} 题｜` : ""}${item.title || item.id}`,
    `- 题目 ID：${item.id}`,
    `- 题型：${kind === "choice" ? "选择题" : "简答 / 论述题"}`,
    `- 自评：${ratingLabel(item.rating)}`,
  );
  if (kind === "choice") {
    lines.push(
      `- 我的选择：${item.selection || "（未记录）"}`,
      `- 正确答案：${item.correctAnswer || "（未配置）"}`,
      `- 客观结果：${item.correct ? "正确" : "错误"}`,
    );
  } else {
    lines.push(`- 我的作答：${item.answer || item.answerSnapshot || "（未填写）"}`);
  }
  lines.push(
    `- 笔记：${item.note || "（无）"}`,
    `- 收藏：${item.favorite ? "是" : "否"}`,
  );
}

function buildRoundReport(round) {
  if (!round) return "";
  const total = round.items.length;
  const durationSeconds = round.startedAt && round.endedAt
    ? Math.max(0, Math.round((new Date(round.endedAt) - new Date(round.startedAt)) / 1000))
    : null;
  const durationText = durationSeconds == null ? "未知" : `${Math.floor(durationSeconds / 60)}分${durationSeconds % 60}秒`;
  const choiceItems = round.items.filter((item) => item.type === "choice");
  const correctCount = choiceItems.filter((item) => item.correct).length;
  const lines = [
    `# 学习测验报告`,
    "",
    `- 日期：${round.date}`,
    `- 题数：${total}`,
    `- 会：${round.results.known}；模糊/蒙对：${round.results.unsure}；不会：${round.results.unknown}`,
    `- 用时：${durationText}`,
  ];
  if (choiceItems.length) lines.push(`- 选择题正确：${correctCount}/${choiceItems.length}`);
  lines.push("", `## 逐题记录`);
  round.items.forEach((item, index) => appendReportItem(lines, item, index));
  return lines.join("\n");
}

function buildTodayReport() {
  const today = localDate();
  const events = state.progress.sessions.filter((item) => item.date === today);
  const lines = [
    `# 今日学习记录`,
    "",
    `- 日期：${today}`,
    `- 作答次数：${events.length}`,
    "",
    `## 逐题记录`,
  ];

  events.forEach((event, index) => {
    const question = findQuestion(event.id);
    const kind = event.type || (question ? questionKind(question) : "subjective");
    const item = {
      ...event,
      type: kind,
      subject: question?.subject,
      number: question?.number,
      title: question?.title,
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
$("#decrease").addEventListener("click", () => $("#count").value = Math.max(1, Number($("#count").value) - 1));
$("#increase").addEventListener("click", () => $("#count").value = Math.min(30, Number($("#count").value) + 1));
document.querySelectorAll("[data-rating]").forEach((button) => button.addEventListener("click", () => rate(button.dataset.rating)));
$("#resetProgress").addEventListener("click", () => {
  if (confirm("确定清空这台设备上的全部答题记录、笔记和收藏吗？")) {
    state.progress = emptyProgress();
    saveProgress();
  }
});

const questionFiles = [
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
    state.questions = groups.flat();
    populateSubjects();
    renderTodayCount();
  })
  .catch((error) => {
    setup.innerHTML = `<p>题库加载失败：${error.message}</p><p>请通过网站地址访问，不要直接打开本地 HTML 文件。</p>`;
  });
