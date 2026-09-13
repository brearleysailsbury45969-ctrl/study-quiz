(() => {
  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      area.setSelectionRange(0, area.value.length);
      try {
        const ok = document.execCommand("copy");
        area.remove();
        ok ? resolve() : reject(new Error("copy failed"));
      } catch (error) {
        area.remove();
        reject(error);
      }
    });
  }

  // Do not put a long Chinese report into the query string. Mobile GitHub rejects
  // the resulting URL before the issue page can load. Copy the full report locally
  // and open a short, reliable issue URL instead.
  openGitHubIssue = function patchedOpenGitHubIssue(title, body) {
    if (!body) {
      alert("目前没有可提交的记录。");
      return;
    }

    const helper = [
      "完整学习报告已由学习网站复制到剪贴板。",
      "请在这里长按正文区域 → 粘贴，然后再提交 Issue。",
      "（这样不会因为题目或笔记较多导致 URL 过长。）",
    ].join("\n");
    const url = `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(helper)}`;

    // Start clipboard write while the click still has user activation, then open GitHub
    // synchronously so mobile browsers do not treat it as a blocked popup.
    const copyPromise = copyText(body);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    const status = document.querySelector("#reportStatus");

    copyPromise.then(() => {
      if (status) status.textContent = "完整报告已复制。GitHub 页面打开后，在正文里长按粘贴，再提交即可。";
    }).catch(() => {
      if (status) status.textContent = "GitHub 已打开，但浏览器没有允许自动复制。请点下方“复制本轮报告”，再去 GitHub 粘贴。";
    });

    if (!opened && status) {
      status.textContent = "浏览器拦截了新页面。请允许弹窗后再提交；报告仍可用“复制本轮报告”手动复制。";
    }
  };

  function injectStyles() {
    if (document.getElementById("roundReviewHotfixStyles")) return;
    const style = document.createElement("style");
    style.id = "roundReviewHotfixStyles";
    style.textContent = `
      .round-review-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}
      .round-review-overlay{position:fixed;inset:0;z-index:10020;background:rgba(35,31,27,.44);display:flex;align-items:flex-end;justify-content:center}
      .round-review-overlay.hidden{display:none}
      .round-review-sheet{width:min(780px,100%);height:min(90vh,900px);background:var(--surface,#fff);border-radius:22px 22px 0 0;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 -12px 50px rgba(0,0,0,.18)}
      .round-review-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line,#e4ddd1)}
      .round-review-head h2{margin:0;font-size:1.15rem}
      .round-review-close{border:0;background:transparent;font-size:1.5rem;padding:5px 8px;cursor:pointer}
      .round-review-summary{padding:11px 16px;background:var(--surface-soft,#faf7f0);border-bottom:1px solid var(--line,#e4ddd1);font-size:.82rem;line-height:1.55;color:var(--muted,#6d665e)}
      .round-review-body{overflow:auto;padding:13px 14px 28px}
      .round-review-item{border:1px solid var(--line,#e2dacd);border-radius:14px;padding:12px;margin-bottom:10px;background:var(--surface,#fff)}
      .round-review-item h3{font-size:.94rem;line-height:1.48;margin:0 0 8px}
      .round-review-meta{font-size:.75rem;color:var(--muted,#6d665e);margin-bottom:8px}
      .round-review-row{font-size:.82rem;line-height:1.6;margin-top:5px;white-space:pre-wrap;overflow-wrap:anywhere}
      .round-review-row strong{font-weight:700}
      .round-review-note{margin-top:8px;padding:8px 9px;border-radius:9px;background:var(--surface-soft,#faf7f0);font-size:.8rem;line-height:1.55;white-space:pre-wrap}
      .round-review-result{display:inline-block;border:1px solid var(--line,#ddd6c8);border-radius:999px;padding:2px 7px;margin-left:6px;font-size:.7rem}
      @media(min-width:760px){.round-review-overlay{align-items:center;padding:24px}.round-review-sheet{border-radius:22px;height:min(86vh,900px)}}
      @media(max-width:520px){.round-review-actions{grid-template-columns:1fr}.round-review-body{padding-left:10px;padding-right:10px}}
    `;
    document.head.append(style);
  }

  function choiceText(question, value) {
    if (!value) return "";
    try {
      const option = choiceOptions(question || {}).find((item) => String(item.value).toUpperCase() === String(value).toUpperCase());
      return option ? `${value} · ${option.label}` : String(value);
    } catch {
      return String(value);
    }
  }

  function roundItemHtml(item, index) {
    const question = typeof findQuestion === "function" ? findQuestion(item.id) : null;
    const title = item.title || question?.title || question?.prompt || item.id || "未命名题目";
    const subject = item.subject || (question && typeof canonicalSubject === "function" ? canonicalSubject(question) : question?.subject) || "未分类";
    const kind = item.type || "subjective";
    const result = kind === "choice"
      ? (item.answered === false ? "未作答" : item.correct ? "正确" : "错误")
      : (typeof ratingLabel === "function" ? ratingLabel(item.rating) : item.rating || "未标记");

    let detail = "";
    if (kind === "choice") {
      detail = `
        <div class="round-review-row"><strong>我的选择：</strong>${esc(item.answered === false ? "（未作答）" : choiceText(question, item.selection || "（未记录）"))}</div>
        <div class="round-review-row"><strong>正确答案：</strong>${esc(choiceText(question, item.correctAnswer || "（未配置）"))}</div>`;
    } else if (kind === "flashcard") {
      detail = `<div class="round-review-row"><strong>自评：</strong>${esc(result)}</div>`;
    } else {
      const answer = item.answer || item.answerSnapshot || "（未填写）";
      detail = `<div class="round-review-row"><strong>我的作答：</strong>${esc(answer)}</div><div class="round-review-row"><strong>自评：</strong>${esc(result)}</div>`;
    }

    return `<article class="round-review-item">
      <h3>${index + 1}. ${esc(title)} <span class="round-review-result">${esc(result)}</span></h3>
      <div class="round-review-meta">${esc(subject)}${item.source ? ` · ${esc(item.source)}` : ""}</div>
      ${detail}
      <div class="round-review-note"><strong>我的笔记：</strong>${esc(item.note || "（无）")}</div>
    </article>`;
  }

  function ensureRoundReviewUI() {
    injectStyles();
    if (!document.getElementById("roundReviewOverlay")) {
      const overlay = document.createElement("div");
      overlay.id = "roundReviewOverlay";
      overlay.className = "round-review-overlay hidden";
      overlay.innerHTML = `
        <section class="round-review-sheet" role="dialog" aria-modal="true" aria-labelledby="roundReviewTitle">
          <header class="round-review-head">
            <h2 id="roundReviewTitle">本轮详情</h2>
            <button id="roundReviewClose" class="round-review-close" type="button" aria-label="关闭">×</button>
          </header>
          <div id="roundReviewSummary" class="round-review-summary"></div>
          <div id="roundReviewBody" class="round-review-body"></div>
        </section>`;
      document.body.append(overlay);
      document.getElementById("roundReviewClose").addEventListener("click", closeRoundReview);
      overlay.addEventListener("click", (event) => { if (event.target === overlay) closeRoundReview(); });
      document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeRoundReview(); });
    }

    const finish = document.getElementById("finish");
    const submit = document.getElementById("submitRound");
    if (finish && submit && !document.getElementById("roundReviewActions")) {
      const actions = document.createElement("div");
      actions.id = "roundReviewActions";
      actions.className = "round-review-actions";
      actions.innerHTML = `
        <button id="viewLatestRound" class="secondary" type="button">查看本轮题目与笔记</button>
        <button id="copyLatestRound" class="secondary" type="button">复制本轮报告</button>`;
      submit.insertAdjacentElement("afterend", actions);
      document.getElementById("viewLatestRound").addEventListener("click", openRoundReview);
      document.getElementById("copyLatestRound").addEventListener("click", copyLatestRound);
    }

    if (submit) submit.textContent = "提交本轮给 ChatGPT（复制后打开 GitHub）";
  }

  function openRoundReview() {
    const round = typeof latestRound === "function" ? latestRound() : null;
    if (!round) {
      alert("还没有完成的轮次。");
      return;
    }
    ensureRoundReviewUI();
    const overlay = document.getElementById("roundReviewOverlay");
    const body = document.getElementById("roundReviewBody");
    const summary = document.getElementById("roundReviewSummary");
    const duration = round.elapsedSeconds != null && typeof formatClock === "function" ? formatClock(round.elapsedSeconds) : "未知";
    const choice = (round.items || []).filter((x) => x.type === "choice");
    const correct = choice.filter((x) => x.correct).length;
    summary.textContent = `${round.date || ""} · ${(round.items || []).length}题 · 用时 ${duration}${choice.length ? ` · 选择题 ${correct}/${choice.length}` : ""}`;
    body.innerHTML = (round.items || []).map(roundItemHtml).join("") || '<p>本轮没有逐题记录。</p>';
    body.scrollTop = 0;
    overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeRoundReview() {
    document.getElementById("roundReviewOverlay")?.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function copyLatestRound() {
    const round = typeof latestRound === "function" ? latestRound() : null;
    if (!round) {
      alert("还没有完成的轮次。");
      return;
    }
    const report = typeof buildRoundReport === "function" ? buildRoundReport(round) : JSON.stringify(round, null, 2);
    copyText(report).then(() => {
      const status = document.getElementById("reportStatus");
      if (status) status.textContent = "本轮完整报告已复制到剪贴板。";
    }).catch(() => alert("自动复制失败，请使用“备份本机记录”导出数据。"));
  }

  ensureRoundReviewUI();
})();