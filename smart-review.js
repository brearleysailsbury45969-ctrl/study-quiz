(() => {
  const REVIEW_FILES = [
    "questions/333-mnemonics-principles.json",
    "questions/333-mnemonics-chinese.json",
    "questions/333-mnemonics-foreign.json",
    "questions/333-mnemonics-psychology.json",
    "questions/333-mnemonics-dense-old.json",
  ];
  const DAY_MS = 24 * 60 * 60 * 1000;
  const baseCooldownShuffle = cooldownShuffle;

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
    };
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

  Promise.all(REVIEW_FILES.map(loadJson))
    .then((groups) => {
      const reviewCards = groups.flat().map(practiceCard);

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