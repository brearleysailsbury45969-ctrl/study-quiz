(() => {
  const COLLECTION = "333口诀";
  const SUBJECTS = ["教育学原理", "中国教育史", "外国教育史", "教育心理学"];
  let retries = 0;

  function cards() {
    const raw = Array.isArray(state.progress?.customMnemonics) ? state.progress.customMnemonics : [];
    return raw.map((card, index) => ({
      ...card,
      id: card.id || `custom-mn-${index}`,
      type: "flashcard",
      subject: SUBJECTS.includes(card.subject) ? card.subject : "教育学原理",
      title: String(card.title || "未命名口诀"),
      mnemonic: String(card.mnemonic || ""),
      answer: String(card.answer ?? card.content ?? ""),
      mnemonicContent: String(card.answer ?? card.content ?? ""),
      source: card.source || "我的轻松记编码",
      reviewCollection: COLLECTION,
      isUserCard: true,
      prompt: `${card.source || "我的口诀"}｜先只看题目回忆；先展开口诀，再展开口诀内容。`,
    }));
  }

  function install() {
    if (!Array.isArray(state.questions) || state.questions.length === 0) {
      if (retries < 80) {
        retries += 1;
        window.setTimeout(install, 80);
      }
      return;
    }
    retries = 0;
    const existing = new Set(state.questions.map((item) => item?.id).filter(Boolean));
    const missing = cards().filter((card) => !existing.has(card.id));
    if (missing.length) state.questions = [...state.questions, ...missing];
    if (typeof populateSubjects === "function") populateSubjects();
  }

  install();
  document.addEventListener("mn333:custom-updated", install);
})();