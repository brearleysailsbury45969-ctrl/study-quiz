(() => {
  if (typeof state === "undefined" || !state.progress) return;

  const ACTIVE_KEY = "activeMnemonicRound";
  const COLLECTION = "333口诀";
  let saveTimer = null;

  function isMnemonic(question) {
    if (!question) return false;
    const id = String(question.id || "");
    return question.reviewCollection === COLLECTION
      || id.startsWith("mn116-")
      || id.startsWith("dense-old-")
      || id.startsWith("custom-mn-")
      || id.startsWith("seed-20260914-");
  }

  function active() {
    const value = state.progress?.[ACTIVE_KEY];
    return value && Array.isArray(value.round) && value.round.length ? value : null;
  }

  function isActiveMnemonicRound() {
    return Array.isArray(state.round)
      && state.round.length > 0
      && state.roundMode !== "timed"
      && state.round.some(isMnemonic);
  }

  function uniqueRatedCount(log = []) {
    return new Set(log.map((item) => item?.id).filter(Boolean)).size;
  }

  function safeQuestionCopy(question) {
    if (!question) return null;
    return {
      id: question.id,
      type: question.type,
      subject: question.subject,
      number: question.number,
      title: question.title,
      prompt: question.prompt,
      mnemonic: question.mnemonic,
      mnemonicContent: question.mnemonicContent,
      answer: question.answer,
      source: question.source,
      reviewCollection: question.reviewCollection,
      isUserCard: question.isUserCard,
    };
  }

  function persistActiveRound() {
    if (!isActiveMnemonicRound() || state.roundFinished) return;
    const cursor = Math.max(0, Math.min(state.cursor || 0, state.round.length - 1));
    const question = state.round[cursor];
    state.progress[ACTIVE_KEY] = {
      version: 1,
      round: state.round.map(safeQuestionCopy).filter(Boolean),
      cursor,
      mode: state.roundMode || "random",
      results: { ...(state.results || { known: 0, unsure: 0, unknown: 0 }) },
      currentRoundLog: Array.isArray(state.currentRoundLog) ? state.currentRoundLog.map((item) => ({ ...item })) : [],
      startedAt: state.roundStartedAt instanceof Date
        ? state.roundStartedAt.toISOString()
        : (state.roundStartedAt || new Date().toISOString()),
      savedAt: new Date().toISOString(),
      currentId: question?.id || "",
      currentTitle: question?.title || question?.prompt || "未命名口诀",
    };
    if (typeof saveProgress === "function") saveProgress();
    refreshResumeUI();
  }

  function clearActiveRound() {
    if (!state.progress?.[ACTIVE_KEY]) return;
    delete state.progress[ACTIVE_KEY];
    if (typeof saveProgress === "function") saveProgress();
    refreshResumeUI();
  }

  function mergedQuestion(saved, currentMap) {
    const current = saved?.id ? currentMap.get(saved.id) : null;
    return current ? { ...saved, ...current } : saved;
  }

  function resumeRound() {
    const saved = active();
    if (!saved) return;

    if (typeof saveCurrentNote === "function" && !document.querySelector("#quiz")?.classList.contains("hidden")) {
      try { saveCurrentNote(); } catch {}
    }

    const currentMap = new Map((state.questions || []).map((question) => [question.id, question]));
    const restored = saved.round.map((question) => mergedQuestion(question, currentMap)).filter(Boolean);
    if (!restored.length) {
      alert("上次那轮口诀暂时无法恢复，可以刷新页面后再试一次。");
      return;
    }

    state.round = restored;
    state.cursor = Math.max(0, Math.min(Number(saved.cursor) || 0, restored.length - 1));
    state.results = { known: 0, unsure: 0, unknown: 0, ...(saved.results || {}) };
    state.currentRoundLog = Array.isArray(saved.currentRoundLog) ? saved.currentRoundLog.map((item) => ({ ...item })) : [];
    state.roundStartedAt = saved.startedAt ? new Date(saved.startedAt) : new Date();
    state.roundMode = saved.mode || "random";
    state.roundFinished = false;
    state.selectedChoice = null;
    state.timedOut = false;
    state.timerDeadline = null;
    state.timedTotalSeconds = 0;

    document.querySelector("#setup")?.classList.add("hidden");
    document.querySelector("#finish")?.classList.add("hidden");
    document.querySelector("#quiz")?.classList.remove("hidden");
    if (typeof hideTimer === "function") hideTimer();
    if (typeof renderQuestion === "function") renderQuestion();

    const current = state.round[state.cursor];
    const rated = new Set(state.currentRoundLog.map((item) => item?.id).filter(Boolean));
    if (current?.id && rated.has(current.id)) {
      document.querySelector(".rating-title")?.classList.add("hidden");
      document.querySelector(".ratings")?.classList.add("hidden");
    }

    persistActiveRound();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function discardRound() {
    const saved = active();
    if (!saved) return;
    const rated = uniqueRatedCount(saved.currentRoundLog);
    const message = rated
      ? `放弃这轮未完成口诀吗？已经评分的 ${rated} 张仍保留在逐题记录里，只是不再显示“继续上次”。`
      : "放弃这轮未完成口诀吗？这只会清除续学位置。";
    if (!confirm(message)) return;
    clearActiveRound();
  }

  function injectStyles() {
    if (document.querySelector("#mnemonicResumeStyles")) return;
    const style = document.createElement("style");
    style.id = "mnemonicResumeStyles";
    style.textContent = `
      .mn-resume-card{margin:0 0 14px;padding:13px 14px;border:1px solid var(--line,#ddd6c8);border-radius:14px;background:var(--surface-soft,#faf7f0)}
      .mn-resume-card.hidden{display:none}
      .mn-resume-title{font-weight:700;line-height:1.45;margin-bottom:4px}
      .mn-resume-meta{font-size:.8rem;line-height:1.5;color:var(--muted,#6f675d);margin-bottom:10px}
      .mn-resume-actions{display:flex;gap:8px;flex-wrap:wrap}
      .mn-resume-actions button{flex:1;min-width:120px}
      .unfinished-history{margin:0 16px 10px;padding:12px 13px;border:1px solid var(--line,#ddd6c8);border-radius:13px;background:var(--surface-soft,#faf7f0)}
      .unfinished-history.hidden{display:none}
      .unfinished-history strong{display:block;font-size:.9rem;line-height:1.45;margin-bottom:4px}
      .unfinished-history p{margin:0 0 9px;font-size:.78rem;line-height:1.5;color:var(--muted,#6f675d)}
      .unfinished-history .mn-resume-actions button{padding:7px 10px}
    `;
    document.head.append(style);
  }

  function ensureHomeResume() {
    const setup = document.querySelector("#setup");
    if (!setup) return null;
    let card = document.querySelector("#mnemonicResumeCard");
    if (card) return card;
    card = document.createElement("section");
    card.id = "mnemonicResumeCard";
    card.className = "mn-resume-card hidden";
    const daily = document.querySelector("#dailyReview");
    if (daily) daily.insertAdjacentElement("afterend", card);
    else setup.prepend(card);
    return card;
  }

  function ensureHistoryResume() {
    const overlay = document.querySelector("#practiceHistoryOverlay");
    if (!overlay) return null;
    let card = overlay.querySelector("#unfinishedMnemonicRound");
    if (card) return card;
    const toolbar = overlay.querySelector(".history-toolbar");
    if (!toolbar) return null;
    card = document.createElement("section");
    card.id = "unfinishedMnemonicRound";
    card.className = "unfinished-history hidden";
    toolbar.insertAdjacentElement("afterend", card);
    return card;
  }

  function timeLabel(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function roundInfo(saved) {
    const total = saved.round.length;
    const cursor = Math.max(0, Math.min(Number(saved.cursor) || 0, total - 1));
    const rated = uniqueRatedCount(saved.currentRoundLog || []);
    const title = saved.currentTitle || saved.round[cursor]?.title || "未命名口诀";
    return { total, cursor, rated, title };
  }

  function refreshResumeUI() {
    injectStyles();
    const saved = active();
    const home = ensureHomeResume();
    const history = ensureHistoryResume();

    if (!saved) {
      home?.classList.add("hidden");
      history?.classList.add("hidden");
      return;
    }

    const info = roundInfo(saved);
    const html = `
      <div class="mn-resume-title">继续上次口诀 · ${info.cursor + 1} / ${info.total}</div>
      <div class="mn-resume-meta">停在：${escapeHtmlLocal(info.title)} · 已评分 ${info.rated}/${info.total}${saved.savedAt ? ` · 保存于 ${escapeHtmlLocal(timeLabel(saved.savedAt))}` : ""}</div>
      <div class="mn-resume-actions">
        <button class="primary" type="button" data-resume-mnemonic>继续这一轮</button>
        <button class="text-button" type="button" data-discard-mnemonic>放弃未完成轮次</button>
      </div>`;

    if (home) {
      home.innerHTML = html;
      home.classList.remove("hidden");
    }
    if (history) {
      history.innerHTML = `<strong>未完成练习 · ${info.cursor + 1}/${info.total} · ${escapeHtmlLocal(info.title)}</strong>
        <p>这一张即使还没评分，也会保留在这里。已经评分 ${info.rated}/${info.total} 张。</p>
        <div class="mn-resume-actions"><button class="primary" type="button" data-resume-mnemonic>从这里继续</button><button class="text-button" type="button" data-discard-mnemonic>放弃本轮</button></div>`;
      history.classList.remove("hidden");
    }
  }

  function escapeHtmlLocal(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-resume-mnemonic]")) {
      resumeRound();
      return;
    }
    if (event.target.closest?.("[data-discard-mnemonic]")) {
      discardRound();
      return;
    }
    if (event.target.closest?.("#practiceHistoryButton")) {
      window.setTimeout(refreshResumeUI, 0);
      return;
    }
    if (event.target.closest?.("#quit")) {
      persistActiveRound();
      window.setTimeout(refreshResumeUI, 40);
    }
  }, true);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persistActiveRound();
    else refreshResumeUI();
  });
  window.addEventListener("pagehide", persistActiveRound);
  window.addEventListener("beforeunload", persistActiveRound);

  const quiz = document.querySelector("#quiz");
  if (quiz) {
    new MutationObserver(() => {
      if (!quiz.classList.contains("hidden")) persistActiveRound();
      else refreshResumeUI();
    }).observe(quiz, { attributes: true, attributeFilter: ["class"] });
  }

  const finish = document.querySelector("#finish");
  if (finish) {
    new MutationObserver(() => {
      if (!finish.classList.contains("hidden") && state.roundFinished) clearActiveRound();
    }).observe(finish, { attributes: true, attributeFilter: ["class"] });
  }

  // Save cursor/order/log continuously while a mnemonic round is open. This also catches swipe navigation.
  saveTimer = window.setInterval(() => {
    if (!document.querySelector("#quiz")?.classList.contains("hidden")) persistActiveRound();
  }, 1200);

  // Practice-history UI may be created after this script; wait for it without blocking the page.
  let attempts = 0;
  const waitForHistory = () => {
    refreshResumeUI();
    if (!document.querySelector("#practiceHistoryOverlay") && attempts < 80) {
      attempts += 1;
      window.setTimeout(waitForHistory, 100);
    }
  };
  waitForHistory();
})();