const STORAGE_KEY = "study-quiz-progress-v1";
const state = {
  questions: [],
  round: [],
  cursor: 0,
  results: { known: 0, unsure: 0, unknown: 0 },
  progress: loadProgress(),
};

const $ = (selector) => document.querySelector(selector);
const setup = $("#setup");
const quiz = $("#quiz");
const finish = $("#finish");

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { ratings: {}, answers: {}, sessions: [] };
  } catch {
    return { ratings: {}, answers: {}, sessions: [] };
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  renderTodayCount();
}

function renderTodayCount() {
  const today = new Date().toLocaleDateString("sv-SE");
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
  if (!pool.length) {
    alert(mode === "review" ? "当前范围还没有“模糊”或“不会”的题。" : "当前范围没有题目。");
    return;
  }

  state.round = (mode === "sequential" ? pool : shuffle(pool)).slice(0, count);
  state.cursor = 0;
  state.results = { known: 0, unsure: 0, unknown: 0 };
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
  $("#answerArea").classList.add("hidden");
  $("#mine").classList.add("hidden");
  $("#reveal").classList.remove("hidden");
  $("#userAnswer").disabled = false;
  $("#progressText").textContent = `${state.cursor + 1} / ${state.round.length}`;
  $("#progressBar").style.width = `${((state.cursor + 1) / state.round.length) * 100}%`;
}

function revealAnswer() {
  const question = state.round[state.cursor];
  const answer = $("#userAnswer").value.trim();
  state.progress.answers[question.id] = answer;
  saveProgress();
  $("#mine").textContent = answer || "（这次没有输入答案）";
  $("#userAnswer").disabled = true;
  $("#reveal").classList.add("hidden");
  $("#answerArea").classList.remove("hidden");
  $("#answerArea").scrollIntoView({ behavior: "smooth", block: "start" });
}

function rate(rating) {
  const question = state.round[state.cursor];
  state.progress.ratings[question.id] = rating;
  state.progress.sessions.push({
    id: question.id,
    rating,
    date: new Date().toLocaleDateString("sv-SE"),
    at: new Date().toISOString(),
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
  quiz.classList.add("hidden");
  finish.classList.remove("hidden");
  $("#summary").innerHTML = [
    [state.results.known, "会"],
    [state.results.unsure, "模糊"],
    [state.results.unknown, "不会"],
  ].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnToSetup() {
  quiz.classList.add("hidden");
  finish.classList.add("hidden");
  setup.classList.remove("hidden");
}

$("#start").addEventListener("click", startRound);
$("#quit").addEventListener("click", returnToSetup);
$("#again").addEventListener("click", returnToSetup);
$("#reveal").addEventListener("click", revealAnswer);
$("#toggleMine").addEventListener("click", () => $("#mine").classList.toggle("hidden"));
$("#decrease").addEventListener("click", () => $("#count").value = Math.max(1, Number($("#count").value) - 1));
$("#increase").addEventListener("click", () => $("#count").value = Math.min(30, Number($("#count").value) + 1));
document.querySelectorAll("[data-rating]").forEach((button) => button.addEventListener("click", () => rate(button.dataset.rating)));
$("#resetProgress").addEventListener("click", () => {
  if (confirm("确定清空这台设备上的全部答题记录吗？")) {
    state.progress = { ratings: {}, answers: {}, sessions: [] };
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
