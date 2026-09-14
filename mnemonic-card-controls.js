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

  function overrideStore() {
    if (!state.progress.mnemonicOverrides || typeof state.progress.mnemonicOverrides !== "object") {
      state.progress.mnemonicOverrides = {};
    }
    return state.progress.mnemonicOverrides;
  }

  function rememberSource(question) {
    if (!question || question.__mnemonicSourceRemembered) return;
    question.__mnemonicSourceRemembered = true;
    question.__sourceMnemonic = question.mnemonic || "";
    question.__sourceMnemonicContent = question.mnemonicContent ?? question.answer ?? "";
  }

  function applyOverride(question) {
    if (!question || !isMnemonic(question)) return question;
    rememberSource(question);
    const custom = overrideStore()[question.id];
    if (!custom) return question;
    question.mnemonic = custom.mnemonic ?? question.__sourceMnemonic ?? "";
    question.mnemonicContent = custom.content ?? question.__sourceMnemonicContent ?? "";
    question.answer = question.mnemonicContent;
    return question;
  }

  function updateCopies(id, mnemonic, content) {
    const lists = [state.questions || [], state.round || []];
    lists.forEach((list) => {
      list.forEach((item) => {
        if (item?.id !== id) return;
        rememberSource(item);
        item.mnemonic = mnemonic;
        item.mnemonicContent = content;
        item.answer = content;
      });
    });
  }

  function saveOverride(question, mnemonic, content) {
    if (!question?.id) return;
    rememberSource(question);
    overrideStore()[question.id] = {
      mnemonic,
      content,
      updatedAt: new Date().toISOString(),
    };
    updateCopies(question.id, mnemonic, content);
    saveProgress();
  }

  function restoreSource(question) {
    if (!question?.id) return;
    rememberSource(question);
    delete overrideStore()[question.id];
    const mnemonic = question.__sourceMnemonic || "";
    const content = question.__sourceMnemonicContent || "";
    updateCopies(question.id, mnemonic, content);
    saveProgress();
  }

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

  function ensureEditButton() {
    const contentButton = ensureContentButton();
    if (!contentButton) return null;
    let button = document.querySelector("#mnemonicEditButton");
    if (!button) {
      button = document.createElement("button");
      button.id = "mnemonicEditButton";
      button.type = "button";
      button.className = "text-button hidden";
      button.style.cssText = "margin-left:8px;";
      button.textContent = "✎ 修改口诀 / 内容";
      contentButton.insertAdjacentElement("afterend", button);
    }
    return button;
  }

  function ensureEditor() {
    const answerArea = document.querySelector("#answerArea");
    const reference = document.querySelector("#referenceAnswer");
    if (!answerArea || !reference) return null;
    let editor = document.querySelector("#mnemonicEditor");
    if (!editor) {
      editor = document.createElement("section");
      editor.id = "mnemonicEditor";
      editor.className = "hidden";
      editor.style.cssText = "margin:14px 0;padding:14px;border:1px solid var(--line,#ddd6c8);border-radius:14px;background:var(--surface-soft,#faf7f0);";
      editor.innerHTML = `
        <div style="font-weight:700;margin-bottom:10px">修改这张口诀卡</div>
        <label for="mnemonicEditText" style="display:block;font-size:.84rem;margin:8px 0 5px">口诀</label>
        <textarea id="mnemonicEditText" rows="4" style="width:100%;box-sizing:border-box" placeholder="这里可以改成你更顺手的口诀；也可以补上原来缺失的口诀。"></textarea>
        <label for="mnemonicContentEditText" style="display:block;font-size:.84rem;margin:10px 0 5px">口诀内容 / 得分点</label>
        <textarea id="mnemonicContentEditText" rows="8" style="width:100%;box-sizing:border-box" placeholder="原来没有内容的卡，可以直接在这里补充。"></textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button id="mnemonicEditSave" class="primary" type="button">保存修改</button>
          <button id="mnemonicEditCancel" class="secondary" type="button">取消</button>
          <button id="mnemonicEditRestore" class="text-button" type="button">恢复资料原文</button>
        </div>
        <p style="margin:9px 0 0;font-size:.78rem;color:var(--muted,#6f675d);line-height:1.5">修改保存在这台设备的学习记录里，并会随“备份本机记录”一起导出；不会改坏 GitHub 里的原始资料。</p>
      `;
      reference.insertAdjacentElement("afterend", editor);

      editor.querySelector("#mnemonicEditSave")?.addEventListener("click", () => {
        const question = currentQuestion();
        if (!question || !isMnemonic(question)) return;
        const mnemonic = editor.querySelector("#mnemonicEditText")?.value ?? "";
        const content = editor.querySelector("#mnemonicContentEditText")?.value ?? "";
        saveOverride(question, mnemonic, content);
        refreshVisiblePanels(question);
        editor.classList.add("hidden");
        const editButton = ensureEditButton();
        if (editButton) {
          editButton.textContent = "✓ 已保存 · 再修改";
          window.setTimeout(() => { if (editButton) editButton.textContent = "✎ 修改口诀 / 内容"; }, 1400);
        }
      });

      editor.querySelector("#mnemonicEditCancel")?.addEventListener("click", () => {
        editor.classList.add("hidden");
      });

      editor.querySelector("#mnemonicEditRestore")?.addEventListener("click", () => {
        const question = currentQuestion();
        if (!question || !isMnemonic(question)) return;
        if (!overrideStore()[question.id]) return;
        if (!confirm("恢复为资料里的原口诀和原内容吗？你在这张卡上的自定义修改会被清除。")) return;
        restoreSource(question);
        const updated = currentQuestion();
        refreshVisiblePanels(updated);
        fillEditor(updated);
      });
    }
    return editor;
  }

  function fillEditor(question) {
    const editor = ensureEditor();
    if (!editor || !question) return;
    applyOverride(question);
    const mnemonicBox = editor.querySelector("#mnemonicEditText");
    const contentBox = editor.querySelector("#mnemonicContentEditText");
    const restoreButton = editor.querySelector("#mnemonicEditRestore");
    if (mnemonicBox) mnemonicBox.value = question.mnemonic || "";
    if (contentBox) contentBox.value = question.mnemonicContent ?? question.answer ?? "";
    if (restoreButton) restoreButton.disabled = !Boolean(overrideStore()[question.id]);
  }

  function refreshVisiblePanels(question) {
    if (!question) return;
    applyOverride(question);
    const mnemonic = document.querySelector("#mnemonicPanel");
    const content = document.querySelector("#mnemonicContentPanel");
    if (mnemonic) mnemonic.textContent = `【口诀】\n${question.mnemonic || "（这条还没有口诀，可以点“修改口诀 / 内容”补上）"}`;
    if (content) content.textContent = `【口诀内容】\n${question.mnemonicContent || question.answer || "（这条还没有内容，可以点“修改口诀 / 内容”补上）"}`;
  }

  function buildPanels(question) {
    applyOverride(question);
    const answerArea = document.querySelector("#answerArea");
    const heading = document.querySelector("#answerHeading");
    const reference = document.querySelector("#referenceAnswer");
    const reveal = document.querySelector("#reveal");
    const contentButton = ensureContentButton();
    const editButton = ensureEditButton();
    const editor = ensureEditor();
    if (!answerArea || !heading || !reference || !reveal || !contentButton || !editButton) return;

    heading.textContent = "口诀闪卡";
    reference.innerHTML = "";

    const mnemonic = document.createElement("div");
    mnemonic.id = "mnemonicPanel";
    mnemonic.className = "hidden";
    mnemonic.style.cssText = "white-space:pre-wrap;line-height:1.75;margin:8px 0 12px;padding:12px 14px;border:1px solid var(--line,#ddd6c8);border-radius:12px;background:var(--surface-soft,#faf7f0);font-weight:600;";
    mnemonic.textContent = `【口诀】\n${question.mnemonic || "（这条还没有口诀，可以点“修改口诀 / 内容”补上）"}`;

    const content = document.createElement("div");
    content.id = "mnemonicContentPanel";
    content.className = "hidden";
    content.style.cssText = "white-space:pre-wrap;line-height:1.75;margin:8px 0 12px;padding:12px 14px;border:1px solid var(--line,#ddd6c8);border-radius:12px;";
    content.textContent = `【口诀内容】\n${question.mnemonicContent || question.answer || "（这条还没有内容，可以点“修改口诀 / 内容”补上）"}`;

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

    editButton.classList.remove("hidden");
    editButton.textContent = "✎ 修改口诀 / 内容";
    editor?.classList.add("hidden");
    ratingsVisible(false);
  }

  function setupCurrentQuestion() {
    const question = currentQuestion();
    const contentButton = ensureContentButton();
    const editButton = ensureEditButton();
    const editor = ensureEditor();
    ensureHint();

    if (!question || !isMnemonic(question)) {
      contentButton?.classList.add("hidden");
      editButton?.classList.add("hidden");
      editor?.classList.add("hidden");
      return;
    }
    buildPanels(question);
  }

  // Wrap the final render hook so each mnemonic card starts collapsed.
  const previousRenderSubjective = renderSubjectiveQuestion;
  renderSubjectiveQuestion = function renderSubjectiveWithCollapsibleMnemonic(question) {
    previousRenderSubjective(question);
    if (isMnemonic(question)) buildPanels(question);
    else {
      ensureContentButton()?.classList.add("hidden");
      ensureEditButton()?.classList.add("hidden");
      ensureEditor()?.classList.add("hidden");
    }
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

      applyOverride(question);
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
    const editButton = event.target.closest?.("#mnemonicEditButton");
    if (editButton) {
      const question = currentQuestion();
      if (!question || !isMnemonic(question)) return;
      const editor = ensureEditor();
      if (!editor) return;
      fillEditor(question);
      const opening = editor.classList.contains("hidden");
      editor.classList.toggle("hidden", !opening);
      if (opening) {
        document.querySelector("#answerArea")?.classList.remove("hidden");
        editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      return;
    }

    const button = event.target.closest?.("#mnemonicContentToggle");
    if (!button) return;
    const question = currentQuestion();
    if (!question || !isMnemonic(question)) return;

    applyOverride(question);
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
