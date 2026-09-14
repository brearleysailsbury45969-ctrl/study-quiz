(() => {
  const REVIEW_FILES = [
    "questions/333-mnemonics-principles.json",
    "questions/333-mnemonics-chinese.json",
    "questions/333-mnemonics-foreign.json",
    "questions/333-mnemonics-psychology.json",
    "questions/333-mnemonics-dense-old.json",
  ];
  const VIRTUAL_SUBJECT = "333口诀";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const baseCooldownShuffle = cooldownShuffle;
  const basePopulateSubjects = populateSubjects;
  const baseStartRound = startRound;
  let mnemonicCardIds = new Set();

  function loadJson(path) {
    return fetch(path).then((response) => {
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return response.json();
    });
  }

  function practiceCard(card) {
    const parts = [];
    if (card.mnemonic) parts.push(`【口诀】\n${card.mnemonic}`);
    if (card.answer) parts.push(`【口诀内容】\n${card.answer}`);
    return {
      ...card,
      type: "flashcard",
      prompt: card.prompt || `${card.source || "333口诀"}｜先只看题目回忆；翻面后核对口诀和得分点。`,
      answer: parts.join("\n\n") || "（原资料没有补充展开内容）",
      reviewSource: card.source || "333口诀",
      reviewCollection: VIRTUAL_SUBJECT,
    };
  }

  function is333Mnemonic(card) {
    return Boolean(card) && (card.reviewCollection === VIRTUAL_SUBJECT || mnemonicCardIds.has(card.id));
  }

  function ensureMnemonicSubjectOption() {
    const select = document.querySelector("#subject");
    if (!select) return;
    const count = state.questions.filter(is333Mnemonic).length;
    let option = select.querySelector(`option[value="${VIRTUAL_SUBJECT}"]`);
    if (!count) {
      option?.remove();
      return;
    }
    if (!option) {
      option = document.createElement("option");
      option.value = VIRTUAL_SUBJECT;
      select.append(option);
    }
    option.textContent = `${VIRTUAL_SUBJECT}（${count}张｜自动复习）`;
  }

  populateSubjects = function populateSubjectsWithMnemonicCollection() {
    const previous = document.querySelector("#subject")?.value || "all";
    basePopulateSubjects();
    ensureMnemonicSubjectOption();
    const select = document.querySelector("#subject");
    if (select && [...select.options].some((option) => option.value === previous)) {
      select.value = previous;
    }
  };

  startRound = function startRoundWithMnemonicCollection() {
    const subjectSelect = document.querySelector("#subject");
    if (!subjectSelect || subjectSelect.value !== VIRTUAL_SUBJECT) {
      return baseStartRound();
    }

    const typeSelect = document.querySelector("#questionType");
    const modeSelect = document.querySelector("#mode");
    const originalQuestions = state.questions;
    const mnemonicQuestions = originalQuestions.filter(is333Mnemonic);

    if (!mnemonicQuestions.length) {
      alert("333口诀还没有加载完成，请稍等一下再试。");
      return;
    }

    if (modeSelect?.value === "timed") {
      modeSelect.value = "random";
      syncTimedSetup();
    }
    if (typeSelect) typeSelect.value = "flashcard";

    state.questions = mnemonicQuestions;
    subjectSelect.value = "all";
    try {
      return baseStartRound();
    } finally {
      state.questions = originalQuestions;
      populateSubjects();
      subjectSelect.value = VIRTUAL_SUBJECT;
      if (typeSelect) typeSelect.value = "flashcard";
    }
  };

  // app.js bound the original startRound function directly to the button before this patch loaded.
  // Replace that listener so the virtual “333口诀” subject goes through the wrapper above.
  const startButton = document.querySelector("#start");
  if (startButton) {
    startButton.removeEventListener("click", baseStartRound);
    startButton.addEventListener("click", startRound);
  }

  function eventsFor(id) {
    return (state.progress?.sessions || [])
      .filter((event) => event.id === id && event.answered !== false)
      .sort((a, b) => {
        const atA = Date.parse(a.at || a.date || 0) || 0;
        const atB = Date.parse(b.at || b.date || 0) || 0;
        return atA - atB;
      });
  }

  function knownStreak(events) {
    let streak = 0;
    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (events[i].rating !== "known") break;
      streak += 1;
    }
    return streak;
  }

  function reviewMeta(card, now = Date.now()) {
    const events = eventsFor(card.id);
    if (!events.length) {
      return { tier: 2, dueAt: 0, lastAt: 0, label: "新卡" };
    }

    const last = events[events.length - 1];
    const lastAt = Date.parse(last.at || last.date || 0) || 0;
    let intervalDays = 0;

    if (last.rating === "unknown") {
      intervalDays = 0;
    } else if (last.rating === "unsure") {
      intervalDays = 1;
    } else {
      const streak = knownStreak(events);
      intervalDays = streak <= 1 ? 3 : streak === 2 ? 7 : streak === 3 ? 14 : 30;
    }

    const dueAt = lastAt + intervalDays * DAY_MS;
    const due = now >= dueAt;

    if (last.rating === "unknown") return { tier: 0, dueAt, lastAt, label: "不会" };
    if (last.rating === "unsure") return { tier: due ? 1 : 4, dueAt, lastAt, label: "模糊" };
    return { tier: due ? 3 : 5, dueAt, lastAt, label: "会" };
  }

  function smartFlashcardOrder(items) {
    const randomized = shuffle(items);
    const now = Date.now();
    return randomized.sort((a, b) => {
      const ma = reviewMeta(a, now);
      const mb = reviewMeta(b, now);
      if (ma.tier !== mb.tier) return ma.tier - mb.tier;
      if (ma.tier === 2) return 0;
      if (ma.tier <= 3) return ma.dueAt - mb.dueAt;
      return ma.dueAt - mb.dueAt || ma.lastAt - mb.lastAt;
    });
  }

  cooldownShuffle = function spacedCooldownShuffle(items) {
    const list = Array.isArray(items) ? items : [];
    if (list.length && list.every((item) => questionKind(item) === "flashcard")) {
      return smartFlashcardOrder(list);
    }
    return baseCooldownShuffle(list);
  };

  const typeOption = document.querySelector('#questionType option[value="flashcard"]');
  if (typeOption) typeOption.textContent = "口诀 / 闪卡（自动复习）";

  const dailyButton = document.querySelector("#dailyReview");
  if (dailyButton) dailyButton.textContent = "今日智能复习 · 15 张";

  const subjectSelect = document.querySelector("#subject");
  subjectSelect?.addEventListener("change", () => {
    if (subjectSelect.value !== VIRTUAL_SUBJECT) return;
    const typeSelect = document.querySelector("#questionType");
    const modeSelect = document.querySelector("#mode");
    if (modeSelect?.value === "timed") modeSelect.value = "random";
    if (typeSelect) typeSelect.value = "flashcard";
    syncTimedSetup();
  });

  Promise.all(REVIEW_FILES.map(loadJson))
    .then((groups) => {
      const reviewCards = groups.flat().map(practiceCard);
      mnemonicCardIds = new Set(reviewCards.map((card) => card.id));

      const installWhenReady = () => {
        if (!Array.isArray(state.questions) || state.questions.length === 0) {
          window.setTimeout(installWhenReady, 80);
          return;
        }
        state.questions = dedupeQuestions([...state.questions, ...reviewCards]);
        populateSubjects();

        const typeOptionNow = document.querySelector('#questionType option[value="flashcard"]');
        if (typeOptionNow) typeOptionNow.textContent = "口诀 / 闪卡（自动复习）";
      };
      installWhenReady();
    })
    .catch((error) => {
      console.error("333口诀自动复习加载失败：", error);
    });
})();