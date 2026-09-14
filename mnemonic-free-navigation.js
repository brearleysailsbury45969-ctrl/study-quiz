(() => {
  const COLLECTION = "333口诀";
  let touchStart = null;
  const baseAdvanceQuestion = advanceQuestion;

  const isMnemonic = (question) => Boolean(question) && (
    question.reviewCollection === COLLECTION ||
    String(question.id || "").startsWith("mn116-") ||
    String(question.id || "").startsWith("dense-old-")
  );

  function currentQuestion() {
    return state.round?.[state.cursor];
  }

  function ratedThisRound(id) {
    return Boolean(id) && (state.currentRoundLog || []).some((item) => item.id === id);
  }

  function hideRatingsIfAlreadyRated() {
    const question = currentQuestion();
    if (!question || !ratedThisRound(question.id)) return;
    document.querySelector(".rating-title")?.classList.add("hidden");
    document.querySelector(".ratings")?.classList.add("hidden");
  }

  function renderCursor() {
    renderQuestion();
    hideRatingsIfAlreadyRated();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function move(delta) {
    const question = currentQuestion();
    if (!question || !isMnemonic(question)) return;
    const next = state.cursor + delta;
    if (next < 0 || next >= state.round.length) return;
    state.cursor = next;
    renderCursor();
  }

  // For mnemonic rounds, finishing/rating jumps to the next card that has not been rated yet.
  // This keeps free navigation from accidentally ending the round after the user browses ahead.
  advanceQuestion = function advanceMnemonicIntelligently() {
    const question = currentQuestion();
    if (!question || !isMnemonic(question)) return baseAdvanceQuestion();

    const rated = new Set((state.currentRoundLog || []).map((item) => item.id));
    let next = -1;
    for (let i = state.cursor + 1; i < state.round.length; i += 1) {
      if (!rated.has(state.round[i]?.id)) {
        next = i;
        break;
      }
    }
    if (next < 0) {
      for (let i = 0; i < state.cursor; i += 1) {
        if (!rated.has(state.round[i]?.id)) {
          next = i;
          break;
        }
      }
    }

    if (next >= 0) {
      state.cursor = next;
      renderCursor();
      return;
    }
    showFinish();
  };

  const quiz = document.querySelector("#quiz");
  if (quiz) {
    quiz.addEventListener("touchstart", (event) => {
      if (event.touches.length !== 1) return;
      const target = event.target;
      if (target.closest?.("button,textarea,input,select,a")) {
        touchStart = null;
        return;
      }
      const touch = event.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }, { capture: true, passive: true });

    quiz.addEventListener("touchend", (event) => {
      if (!touchStart || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

      const question = currentQuestion();
      if (!question || !isMnemonic(question)) return;

      event.stopImmediatePropagation();
      // Keep the gesture convention already in use: left swipe = previous, right swipe = next.
      if (dx < 0) move(-1);
      else move(1);
    }, { capture: true, passive: true });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("#mnemonicContentToggle,#reveal")) {
      window.setTimeout(hideRatingsIfAlreadyRated, 0);
    }
  });
})();
