(() => {
  const DAILY_MODE = "daily-half-paper";
  const finish = document.querySelector("#finish");
  if (!finish || typeof state === "undefined") return;

  function sanitizeUnansweredPaperItems() {
    const round = state.progress?.rounds?.[state.progress.rounds.length - 1];
    if (!round || round.mode !== DAILY_MODE) return;
    round.items.forEach((item) => {
      if (item.type !== "choice" && item.answered === false) {
        item.answer = "";
        item.answerSnapshot = "";
        if (state.progress.answers) state.progress.answers[item.id] = "";
      }
    });
    state.currentRoundLog?.forEach((item) => {
      if (item.type !== "choice" && item.answered === false) {
        item.answer = "";
        item.answerSnapshot = "";
      }
    });
    if (typeof saveProgress === "function") saveProgress();
  }

  const observer = new MutationObserver(() => {
    if (!finish.classList.contains("hidden")) sanitizeUnansweredPaperItems();
  });
  observer.observe(finish, { attributes: true, attributeFilter: ["class"] });
})();

(() => {
  if (document.querySelector('script[src="practice-history.js"]')) return;
  const script = document.createElement("script");
  script.src = "practice-history.js";
  script.async = false;
  document.body.append(script);
})();

(() => {
  if (document.querySelector('script[data-mnemonics-333]')) return;
  const script = document.createElement("script");
  script.src = "mnemonics-333.js?v=20260913";
  script.async = false;
  script.dataset.mnemonics333 = "true";
  document.body.append(script);
})();

(() => {
  if (document.querySelector('script[data-smart-review]')) return;
  const script = document.createElement("script");
  script.src = "smart-review.js?v=20260914d";
  script.async = false;
  script.dataset.smartReview = "true";
  document.body.append(script);
})();