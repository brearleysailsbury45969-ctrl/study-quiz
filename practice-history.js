(() => {
  const STORAGE_KEY_HISTORY = "study-quiz-progress-v1";

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY));
      return {
        ratings: {}, answers: {}, choiceAnswers: {}, correctness: {}, notes: {}, favorites: {}, sessions: [], rounds: [],
        ...(raw || {}),
      };
    } catch {
      return { ratings: {}, answers: {}, choiceAnswers: {}, correctness: {}, notes: {}, favorites: {}, sessions: [], rounds: [] };
    }
  }

  function questionMap() {
    try {
      return new Map((state?.questions || []).map((q) => [q.id, q]));
    } catch {
      return new Map();
    }
  }

  function fmtDuration(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const m = Math.floor(safe / 60);
    const s = Math.floor(safe % 60);
    return m ? `${m}分${String(s).padStart(2, "0")}秒` : `${s}秒`;
  }

  function fmtDate(date) {
    if (!date) return "未知日期";
    const parts = String(date).split("-");
    if (parts.length === 3) return `${Number(parts[1])}月${Number(parts[2])}日`;
    return String(date);
  }

  function fmtTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function modeLabel(mode, timed) {
    if (timed) return "限时测验";
    return {
      random: "随机练习",
      sequential: "顺序练习",
      review: "错题 / 模糊复习",
      favorites: "收藏题练习",
    }[mode] || "普通练习";
  }

  function ratingLabel(rating) {
    return { known: "会", unsure: "模糊", unknown: "不会" }[rating] || "未标记";
  }

  function itemNeedsReview(item) {
    if (!item) return false;
    if (item.type === "choice") return item.correct === false || item.answered === false;
    return ["unsure", "unknown"].includes(item.rating);
  }

  function sessionNeedsReview(session) {
    if (!session) return false;
    if (session.type === "choice") return session.correct === false || session.answered === false;
    return ["unsure", "unknown"].includes(session.rating);
  }

  function injectStyles() {
    if (document.getElementById("practiceHistoryStyles")) return;
    const style = document.createElement("style");
    style.id = "practiceHistoryStyles";
    style.textContent = `
      .history-overlay{position:fixed;inset:0;z-index:9999;background:rgba(35,31,27,.42);display:flex;align-items:flex-end;justify-content:center;padding:0}
      .history-overlay.hidden{display:none}
      .history-sheet{width:min(760px,100%);height:min(88vh,880px);background:var(--surface,#fff);border-radius:22px 22px 0 0;box-shadow:0 -12px 50px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow:hidden}
      .history-head{padding:16px 18px 12px;border-bottom:1px solid var(--line,#e6dfd2);display:flex;align-items:center;justify-content:space-between;gap:12px}
      .history-head h2{margin:0;font-size:1.18rem}
      .history-close{border:0;background:transparent;font-size:1.45rem;padding:6px 8px;cursor:pointer}
      .history-toolbar{padding:12px 16px 10px;border-bottom:1px solid var(--line,#e6dfd2);display:grid;gap:10px}
      .history-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .history-stat{padding:10px;border:1px solid var(--line,#e6dfd2);border-radius:12px;background:var(--surface-soft,#faf7f0);text-align:center}
      .history-stat strong{display:block;font-size:1.08rem}
      .history-stat span{font-size:.75rem;color:var(--muted,#746d64)}
      .history-controls{display:flex;gap:8px;flex-wrap:wrap}
      .history-controls button{border:1px solid var(--line,#ddd6c8);background:var(--surface,#fff);border-radius:999px;padding:8px 11px;font-size:.82rem;cursor:pointer}
      .history-controls button.active{font-weight:700;outline:2px solid currentColor;outline-offset:-1px}
      .history-body{overflow:auto;padding:14px 16px 28px}
      .history-empty{padding:34px 12px;text-align:center;color:var(--muted,#746d64)}
      .history-day{margin-bottom:18px}
      .history-day-title{display:flex;align-items:baseline;justify-content:space-between;margin:0 0 8px;font-size:.9rem}
      .history-day-title span{color:var(--muted,#746d64);font-size:.75rem}
      .history-card{border:1px solid var(--line,#e2dacd);border-radius:14px;padding:12px;margin-bottom:9px;background:var(--surface,#fff)}
      .history-card-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .history-card-head strong{font-size:.92rem}
      .history-card-head span{font-size:.76rem;color:var(--muted,#746d64);white-space:nowrap}
      .history-summary{margin-top:7px;font-size:.82rem;line-height:1.55;color:var(--muted,#625c54)}
      .history-item{padding:9px 0;border-top:1px dashed var(--line,#e2dacd)}
      .history-item:first-child{border-top:0}
      .history-item-title{font-size:.86rem;line-height:1.45;margin-bottom:5px}
      .history-badges{display:flex;gap:6px;flex-wrap:wrap}
      .history-badge{display:inline-flex;align-items:center;border:1px solid var(--line,#ddd6c8);border-radius:999px;padding:3px 7px;font-size:.7rem;color:var(--muted,#6f675d)}
      .history-badge.good{font-weight:700}
      .history-badge.need{font-weight:700;outline:1px solid currentColor}
      .history-note{margin-top:6px;padding:7px 8px;background:var(--surface-soft,#faf7f0);border-radius:9px;font-size:.76rem;line-height:1.45}
      .history-limit{margin:14px 0 0;text-align:center;font-size:.73rem;color:var(--muted,#746d64)}
      @media(min-width:760px){.history-overlay{align-items:center;padding:24px}.history-sheet{border-radius:22px;height:min(86vh,880px)}}
      @media(max-width:480px){.history-stats{grid-template-columns:repeat(3,1fr)}.history-stat{padding:8px 5px}.history-body{padding-left:12px;padding-right:12px}}
    `;
    document.head.append(style);
  }

  let currentTab = "rounds";
  let currentFilter = "all";

  function buildShell() {
    injectStyles();
    if (!document.getElementById("practiceHistoryButton")) {
      const actions = document.querySelector(".setup-actions");
      if (actions) {
        const button = document.createElement("button");
        button.id = "practiceHistoryButton";
        button.className = "secondary";
        button.type = "button";
        button.textContent = "练习记录";
        actions.prepend(button);
      }
    }

    if (!document.getElementById("practiceHistoryOverlay")) {
      const overlay = document.createElement("div");
      overlay.id = "practiceHistoryOverlay";
      overlay.className = "history-overlay hidden";
      overlay.innerHTML = `
        <section class="history-sheet" role="dialog" aria-modal="true" aria-labelledby="historyTitle">
          <header class="history-head">
            <h2 id="historyTitle">练习记录</h2>
            <button id="practiceHistoryClose" class="history-close" type="button" aria-label="关闭">×</button>
          </header>
          <div class="history-toolbar">
            <div id="practiceHistoryStats" class="history-stats"></div>
            <div class="history-controls">
              <button type="button" data-history-tab="rounds" class="active">按轮次</button>
              <button type="button" data-history-tab="items">逐题记录</button>
              <button type="button" data-history-filter="all" class="active">全部</button>
              <button type="button" data-history-filter="needs">只看需复习</button>
            </div>
          </div>
          <div id="practiceHistoryBody" class="history-body"></div>
        </section>`;
      document.body.append(overlay);
    }

    document.getElementById("practiceHistoryButton")?.addEventListener("click", openHistory);
    document.getElementById("practiceHistoryClose")?.addEventListener("click", closeHistory);
    document.getElementById("practiceHistoryOverlay")?.addEventListener("click", (event) => {
      if (event.target.id === "practiceHistoryOverlay") closeHistory();
    });
    document.querySelectorAll("[data-history-tab]").forEach((button) => button.addEventListener("click", () => {
      currentTab = button.dataset.historyTab;
      document.querySelectorAll("[data-history-tab]").forEach((b) => b.classList.toggle("active", b === button));
      renderHistory();
    }));
    document.querySelectorAll("[data-history-filter]").forEach((button) => button.addEventListener("click", () => {
      currentFilter = button.dataset.historyFilter;
      document.querySelectorAll("[data-history-filter]").forEach((b) => b.classList.toggle("active", b === button));
      renderHistory();
    }));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeHistory();
    });
  }

  function openHistory() {
    renderHistory();
    document.getElementById("practiceHistoryOverlay")?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeHistory() {
    document.getElementById("practiceHistoryOverlay")?.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function renderStats(progress) {
    const sessions = progress.sessions || [];
    const rounds = progress.rounds || [];
    let today = "";
    try { today = new Date().toLocaleDateString("sv-SE"); } catch {}
    const todayCount = sessions.filter((s) => s.date === today && s.answered !== false).length;
    const needs = sessions.filter(sessionNeedsReview).length;
    document.getElementById("practiceHistoryStats").innerHTML = [
      [sessions.filter((s) => s.answered !== false).length, "累计作答"],
      [todayCount, "今日完成"],
      [needs, "需复习记录"],
    ].map(([value, label]) => `<div class="history-stat"><strong>${value}</strong><span>${label}</span></div>`).join("");
  }

  function itemHtml(item, qmap) {
    const q = qmap.get(item.id) || {};
    const type = item.type || q.type || "subjective";
    const title = item.title || q.title || item.id || "未命名题目";
    const subject = item.subject || q.subject || "未分类";
    const need = itemNeedsReview(item);
    let result = "";
    if (type === "choice") {
      if (item.answered === false) result = "未作答";
      else result = item.correct ? "正确" : "错误";
    } else {
      result = ratingLabel(item.rating);
    }
    const typeLabel = type === "choice" ? "选择题" : type === "flashcard" ? "闪卡" : "主观题";
    const note = item.note || "";
    return `<div class="history-item">
      <div class="history-item-title">${esc(title)}</div>
      <div class="history-badges">
        <span class="history-badge">${esc(subject)}</span>
        <span class="history-badge">${typeLabel}</span>
        <span class="history-badge ${need ? "need" : "good"}">${esc(result)}</span>
        ${item.favorite ? '<span class="history-badge">★ 收藏</span>' : ''}
      </div>
      ${note ? `<div class="history-note">笔记：${esc(note)}</div>` : ""}
    </div>`;
  }

  function renderRounds(progress, qmap) {
    let rounds = [...(progress.rounds || [])].reverse();
    if (currentFilter === "needs") rounds = rounds.filter((r) => (r.items || []).some(itemNeedsReview));
    if (!rounds.length) return '<div class="history-empty">这里还没有符合条件的完整练习轮次。</div>';

    const grouped = new Map();
    rounds.slice(0, 60).forEach((round) => {
      const date = round.date || "未知日期";
      if (!grouped.has(date)) grouped.set(date, []);
      grouped.get(date).push(round);
    });
    return [...grouped.entries()].map(([date, dayRounds]) => {
      const cards = dayRounds.map((round) => {
        const items = currentFilter === "needs" ? (round.items || []).filter(itemNeedsReview) : (round.items || []);
        const choice = (round.items || []).filter((x) => x.type === "choice");
        const correct = choice.filter((x) => x.correct).length;
        const known = (round.items || []).filter((x) => x.type !== "choice" && x.rating === "known").length;
        const unsure = (round.items || []).filter((x) => x.type !== "choice" && x.rating === "unsure").length;
        const unknown = (round.items || []).filter((x) => x.type !== "choice" && x.rating === "unknown").length;
        const summary = [
          choice.length ? `选择题 ${correct}/${choice.length}` : "",
          (known + unsure + unknown) ? `会 ${known} · 模糊 ${unsure} · 不会 ${unknown}` : "",
          round.elapsedSeconds != null ? `用时 ${fmtDuration(round.elapsedSeconds)}` : "",
        ].filter(Boolean).join(" ｜ ");
        return `<div class="history-card">
          <div class="history-card-head"><strong>${modeLabel(round.mode, round.timed)} · ${(round.items || []).length}题</strong><span>${fmtTime(round.endedAt || round.startedAt)}</span></div>
          <div class="history-summary">${esc(summary || "已完成一轮练习")}</div>
          ${items.map((item) => itemHtml(item, qmap)).join("")}
        </div>`;
      }).join("");
      return `<section class="history-day"><h3 class="history-day-title">${fmtDate(date)}<span>${dayRounds.length} 轮</span></h3>${cards}</section>`;
    }).join("") + '<p class="history-limit">最多显示最近 60 个完整轮次。</p>';
  }

  function renderItems(progress, qmap) {
    let sessions = [...(progress.sessions || [])].reverse();
    if (currentFilter === "needs") sessions = sessions.filter(sessionNeedsReview);
    if (!sessions.length) return '<div class="history-empty">这里还没有符合条件的逐题记录。</div>';

    const grouped = new Map();
    sessions.slice(0, 200).forEach((session) => {
      const date = session.date || "未知日期";
      if (!grouped.has(date)) grouped.set(date, []);
      grouped.get(date).push(session);
    });
    return [...grouped.entries()].map(([date, daySessions]) => {
      const rows = daySessions.map((session) => {
        const q = qmap.get(session.id) || {};
        const item = {
          ...session,
          title: q.title || q.prompt || session.id,
          subject: q.subject || "未分类",
          favorite: Boolean(progress.favorites?.[session.id]),
          note: progress.notes?.[session.id] || "",
        };
        return `<div class="history-card"><div class="history-card-head"><strong>${fmtTime(session.at) || "逐题记录"}</strong><span>${session.timed ? "限时" : "练习"}</span></div>${itemHtml(item, qmap)}</div>`;
      }).join("");
      return `<section class="history-day"><h3 class="history-day-title">${fmtDate(date)}<span>${daySessions.length} 条</span></h3>${rows}</section>`;
    }).join("") + '<p class="history-limit">最多显示最近 200 条逐题记录；完整数据仍保存在本机备份中。</p>';
  }

  function renderHistory() {
    const progress = getProgress();
    const qmap = questionMap();
    renderStats(progress);
    const body = document.getElementById("practiceHistoryBody");
    if (!body) return;
    body.innerHTML = currentTab === "items" ? renderItems(progress, qmap) : renderRounds(progress, qmap);
    body.scrollTop = 0;
  }

  buildShell();
})();
