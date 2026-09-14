(() => {
  const COLLECTION = "333口诀";
  let returnCursor = null;
  let touchStart = null;

  const isMnemonic = (question) => Boolean(question) && (
    question.reviewCollection === COLLECTION ||
    String(question.id || "").startsWith("mn116-") ||
    String(question.id || "").startsWith("dense-old-")
  );

  const currentQuestion = () => state.round?.[state.cursor];
  const isBackReview = () => returnCursor != null && state.cursor < returnCursor;

  function ratingsVisible(show) {
    document.querySelector(".rating-title")?.classList.toggle("hidden", !show);
    document.querySelector(".ratings")?.classList.toggle("hidden", !show);
  }

  function ensureHint() {
    const card = document.querySelector(".question-card");
    if (!card) return null;
    let hint = document.querySelector("#swipeReviewHint");
    if (!hint) {
      hint = document.createElement("div");
      hint.id = "swipeReviewHint";
      hint.className = "hidden";
      hint.style.cssText = "margin:8px 0 12px;padding:8px 11px;border:1px solid var(--line,#ddd6c8);border-radius:10px;background:var(--surface-soft,#faf7f0);font-size:.82rem;color:var(--muted,#6f675d);";
      const meta = card.querySelector(".question-meta");
      meta?.insertAdjacentElement("afterend", hint);
    }
    hint.textContent = "回看上一题 · 右滑可返回当前题";
    hint.classList.toggle("hidden", !isBackReview());
    return hint;
  }

  function ensureContentButton() {
    const reveal = document.querySelector("#reveal");
    if (!reveal) return null;
    let button = document.querySelector("#mnemonicContentToggle");
    if (!button) {
      button = document.createElement("button");
      button.id = "mnemonicContentToggle";
      button.type = "button";
      button.className = "secondary hidden";
      button.style.marginLeft = "8px";
      reveal.insertAdjacentElement("afterend", button);
    }
    return button;
  }

  function buildPanels(question) {
    const answerArea = document.querySelector("#answerArea");
    const heading = document.querySelector("#answerHeading");
    const reference = document.querySelector("#referenceAnswer");
    const reveal = document.querySelector("#reveal");
    const contentButton = ensureContentButton();
    if (!answerArea || !heading || !reference || !reveal || !contentButton) return;

    heading.textContent = "口诀闪卡";
    reference.innerHTML = "";

    const mnemonic = document.createElement("div");
    mnemonic.id = "mnemonicPanel";
    mnemonic.className = "hidden";
    mnemonic.style.cssText = "white-space:pre-wrap;line-height:1.75;margin:8px 0 12px;padding:12px 14px;border:1px solid var(--line,#ddd6c8);border-radius:12px;background:var(--surface-soft,#faf7f0);font-weight:600;";
    mnemonic.textContent = `【口诀】\n${question.mnemonic || "（这条原资料没有单列口诀）"}`;

    const content = document.createElement("div");
    content.id = "mnemonicContentPanel";
    content.className = "hidden";
    content.style.cssText = "white-space:pre-wrap;line-height:1.75;margin:8px 0 12px;padding:12px 14px;border:1px solid var(--line,#ddd6c8);border-radius:12px;";
    content.textContent = `【口诀内容】\n${question.mnemonicContent || question.answer || "（原资料未提供展开内容）"}`;

    reference.append(mnemonic, content);
    answerArea.classList.add("hidden");
    reveal.disabled = false;
    reveal.textContent = "① 展开口诀";
    reveal.dataset.mnemonicOpen = "0";
    reveal.dataset.mnemonicId = question.id || "";

    contentButton.classList.add("hidden");
    contentButton.textContent = "② 展开口诀内容";
    contentButton.dataset.contentOpen = "0";
    contentButton.dataset.contentSeen = "0";
    contentButton.dataset.mnemonicId = question.id || "";
    ratingsVisible(false);
  }

  function setupCurrentQuestion() {
    const question = currentQuestion();
    const contentButton = ensureContentButton();
    ensureHint();

    if (!question || !isMnemonic(question)) {
      contentButton?.classList.add("hidden");
      return;
    }
    buildPanels(question);
  }

  // Wrap the final render hook so each mnemonic card starts collapsed.
  const previousRenderSubjective = renderSubjectiveQuestion;
  renderSubjectiveQuestion = function renderSubjectiveWithCollapsibleMnemonic(question) {
    previousRenderSubjective(question);
    if (isMnemonic(question)) buildPanels(question);
    else ensureContentButton()?.classList.add("hidden");
  };

  // Replace the existing reveal button to remove older one-way reveal listeners.
  const oldReveal = document.querySelector("#reveal");
  if (oldReveal) {
    const reveal = oldReveal.cloneNode(true);
    oldReveal.replaceWith(reveal);

    reveal.addEventListener("click", () => {
      const question = currentQuestion();
      if (!question) return;
      if (!isMnemonic(question)) {
        revealAnswer();
        return;
      }

      if (typeof saveCurrentNote === "function") saveCurrentNote();
      const answerArea = document.querySelector("#answerArea");
      const panel = document.querySelector("#mnemonicPanel");
      const contentButton = ensureContentButton();
      if (!answerArea || !panel || !contentButton) return;

      const opening = panel.classList.contains("hidden");
      panel.classList.toggle("hidden", !opening);
      answerArea.classList.remove("hidden");
      reveal.dataset.mnemonicOpen = opening ? "1" : "0";
      reveal.textContent = opening ? "收起口诀" : "① 展开口诀";

      // Once the mnemonic has been opened at least once, content can be independently expanded/folded.
      contentButton.classList.remove("hidden");
      if (isBackReview()) ratingsVisible(false);
    });
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("#mnemonicContentToggle");
    if (!button) return;
    const question = currentQuestion();
    if (!question || !isMnemonic(question)) return;

    const answerArea = document.querySelector("#answerArea");
    const panel = document.querySelector("#mnemonicContentPanel");
    if (!answerArea || !panel) return;

    const opening = panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !opening);
    answerArea.classList.remove("hidden");
    button.dataset.contentOpen = opening ? "1" : "0";
    button.textContent = opening ? "收起口诀内容" : "② 展开口诀内容";

    if (opening) button.dataset.contentSeen = "1";
    const seen = button.dataset.contentSeen === "1";
    ratingsVisible(seen && !isBackReview());
  });

  function renderAtCursor() {
    renderQuestion();
    ensureHint();
    if (isBackReview()) ratingsVisible(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goPrevious() {
    const question = currentQuestion();
    if (!question || !isMnemonic(question) || state.cursor <= 0) return;
    if (returnCursor == null) returnCursor = state.cursor;
    state.cursor -= 1;
    renderAtCursor();
  }

  function goForwardFromReview() {
    if (returnCursor == null || state.cursor >= returnCursor) return;
    state.cursor += 1;
    if (state.cursor >= returnCursor) returnCursor = null;
    renderAtCursor();
  }

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
    }, { passive: true });

    quiz.addEventListener("touchend", (event) => {
      if (!touchStart || event.changedTouches.length !== 1) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStart.x;
      const dy = touch.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
      if (dx < 0) goPrevious();
      else goForwardFromReview();
    }, { passive: true });
  }

  // New rounds should start in normal forward mode.
  const startButton = document.querySelector("#start");
  startButton?.addEventListener("click", () => { returnCursor = null; }, true);

  setupCurrentQuestion();
})();
