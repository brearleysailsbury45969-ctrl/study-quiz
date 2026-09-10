const STORAGE_KEY = "study-quiz-progress-v1";
const REPO = "brearleysailsbury45969-ctrl/study-quiz";

const state = {
  questions: [],
  round: [],
  cursor: 0,
  results: { known: 0, unsure: 0, unknown: 0 },
  currentRoundLog: [],
  roundStartedAt: null,
  progress: loadProgress(),
};

const $ = (selector) => document.querySelector(selector);
const setup = $("#setup");
const quiz = $("#quiz");
const finish = $("#finish");

function emptyProgress() {
  return { ratings: {}, answers: {}, notes: {}, favorites: {}, sessions: [], rounds: [] };
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
  const subjects = [...new Set(state.questions.map((q) => q.subject))];
  subjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject;
    option.textContent = `${subject}（${state.questions.filter((q) => q.subject === subject).length}题）`;
    $("#subject").append(option);
  });
}

function startRound() {
  const subject = $("#subject").value;
  const mode = $("#mode").value;
  const count = Math.max(1, Math.min(30, Number($("#count").value) || 5));
  let pool = state.questions.filter((q) => subject === "all" || q.subject === subject);

  if (mode === "review") {
    pool = pool.filter((q) => ["unsure", "unknown"].includes(state.progress.ratings[q.id]));
  }
  if (mode === "favorites") {
    pool = pool.filter((q) => state.progress.favorites[q.id]);
  }
  if (!pool.length) {
    const message = mode === "review"
      ? "当前范围还没有“模糊”或“不会”的题。"
      : mode === "favorites"
        ? "当前范围还没有收藏题目。"
        : "当前范围没有题目。";
    alert(message);
    return;
  }

  state.round = (mode === "sequential" ? pool : shuffle(pool)).slice(0, count);
  state.cursor = 0;
  state.results = { known: 0, unsure: 0, unknown: 0 };
  state.currentRoundLog = [];
  state.roundStartedAt = new Date();
  setup.classList.add("hidden");
  finish.classList.add("hidden");
  quiz.classList.remove("hidden");
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderQuestion() {
  const question = state.round[state.cursor];
  $("#questionSubject").textContent = question.subject;
  $("#questionNumber").textContent = `第 ${question.number} 题`;
  $("#questionTitle").textContent = question.title;
  $("#questionPrompt").textContent = question.prompt;
  $("#referenceAnswer").textContent = question.answer;
  $("#userAnswer").value = state.progress.answers[question.id] || "";
  $("#questionNote").value = state.progress.notes[question.id] || "";
  $("#answerArea").classList.add("hidden");
  $("#mine").classList.add("hidden");
  $("#reveal").classList.remove("hidden");
  $("#userAnswer").disabled = false;
  $("#progressText").textContent = `${state.cursor + 1} / ${state.round.length}`;
  $("#progressBar").style.width = `${((state.cursor + 1) / state.round.length) * 100}%`;
  renderFavoriteButton();
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
  const answer = $("#userAnswer").value.trim();
  state.progress.answers[question.id] = answer;
  saveCurrentNote();
  saveProgress();
  $("#mine").textContent = answer || "（这次没有输入答案）";
  $("#userAnswer").disabled = true;
  $("#reveal").classList.add("hidden");
  $("#answerArea").classList.remove("hidden");
  $("#answerArea").scrollIntoView({ behavior: "smooth", block: "start" });
}

function rate(rating) {
  const question = state.round[state.cursor];
  const now = new Date();
  saveCurrentNote();
  state.progress.ratings[question.id] = rating;
  const event = {
    id: question.id,
    rating,
    date: localDate(now),
    at: now.toISOString(),
  };
  state.progress.sessions.push(event);
  state.currentRoundLog.push({
    ...event,
    subject: question.subject,
    number: question.number,
    title: question.title,
    answer: state.progress.answers[question.id] || "",
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
  $("#summary").innerHTML = [
    [state.results.known, "会"],
    [state.results.unsure, "模糊"],
    [state.results.unknown, "不会"],
  ].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
  $("#reportStatus").textContent = "提交后，我就能从 GitHub 读取本轮详情。";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnToSetup() {
  quiz.classList.add("hidden");
  finish.classList.add("hidden");
  setup.classList.remove("hidden");
}

function ratingLabel(rating) {
  return { known: "会", unsure: "模糊", unknown: "不会" }[rating] || rating || "未标记";
}

function findQuestion(id) {
  return state.questions.find((q) => q.id === id);
}

function latestRound() {
  return state.progress.rounds[state.progress.rounds.length - 1] || null;
}

function buildRoundReport(round) {
  if (!round) return "";
  const total = round.items.length;
  const durationSeconds = round.startedAt && round.endedAt
    ? Math.max(0, Math.round((new Date(round.endedAt) - new Date(round.startedAt)) / 1000))
    : null;
  const durationText = durationSeconds == null ? "未知" : `${Math.floor(durationSeconds / 60)}分${durationSeconds % 60}秒`;
  const lines = [
    `# 学习测验报告`,
    "",
    `- 日期：${round.date}`,
    `- 题数：${total}`,
    `- 会：${round.results.known}；模糊：${round.results.unsure}；不会：${round.results.unknown}`,
    `- 用时：${durationText}`,
    "",
    `## 逐题记录`,
  ];
  round.items.forEach((item, index) => {
    lines.push(
      "",
      `### ${index + 1}. ${item.subject}｜第 ${item.number} 题｜${item.title}`,
      `- 题目 ID：${item.id}`,
      `- 自评：${ratingLabel(item.rating)}`,
      `- 收藏：${item.favorite ? "是" : "否"}`,
      `- 我的作答：${item.answer || "（未填写）"}`,
      `- 笔记：${item.note || "（无）"}`,
    );
  });
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
    lines.push(
      "",
      `### ${index + 1}. ${question ? `${question.subject}｜第 ${question.number} 题｜${question.title}` : event.id}`,
      `- 题目 ID：${event.id}`,
      `- 自评：${ratingLabel(event.rating)}`,
      `- 我的作答：${state.progress.answers[event.id] || "（未填写）"}`,
      `- 笔记：${state.progress.notes[event.id] || "（无）"}`,
      `- 收藏：${state.progress.favorites[event.id] ? "是" : "否"}`,
    );
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
  $("#reportStatus").textContent = "GitHub 已打开：确认内容后点 Submit new issue 即可。";
}

function submitToday() {
  const today = localDate();
  const body = buildTodayReport();
  if (!state.progress.sessions.some((item) => item.date === today)) {
    alert("今天还没有答题记录。");
    return;
  }
  openGitHubIssue(`[STUDY-REPORT] ${today} 今日学习记录`, body);
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
