(() => {
  const FILES = [
    "questions/333-mnemonics-chinese.json",
    "questions/333-mnemonics-foreign.json",
    "questions/333-mnemonics-psychology.json",
    "questions/333-mnemonics-principles.json",
    "questions/333-mnemonics-dense-old.json",
  ];
  const SUBJECT_ORDER = ["教育学原理", "中国教育史", "外国教育史", "教育心理学"];
  const COLLECTION = "333口诀";
  let sourceCards = [];
  let cards = [];

  const $ = (selector) => document.querySelector(selector);
  const loadJson = (path) => fetch(path).then((response) => {
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  });

  function customStore() {
    if (!state.progress.customMnemonics || !Array.isArray(state.progress.customMnemonics)) {
      state.progress.customMnemonics = [];
    }
    return state.progress.customMnemonics;
  }

  function normalizeCustom(card, index = 0) {
    return {
      id: card.id || `custom-mn-${Date.now()}-${index}`,
      type: "flashcard",
      subject: SUBJECT_ORDER.includes(card.subject) ? card.subject : "教育学原理",
      number: card.number || null,
      title: String(card.title || "未命名口诀").trim(),
      mnemonic: String(card.mnemonic || ""),
      answer: String(card.answer ?? card.content ?? ""),
      mnemonicContent: String(card.answer ?? card.content ?? ""),
      source: card.source || "我的轻松记编码",
      libraryGroup: card.libraryGroup || `我的口诀｜${card.subject || "教育学原理"}`,
      reviewCollection: COLLECTION,
      isUserCard: true,
      createdAt: card.createdAt || new Date().toISOString(),
    };
  }

  function allCustomCards() {
    return customStore().map(normalizeCustom);
  }

  function sortCards(items) {
    return [...items].sort((a, b) => {
      const sa = SUBJECT_ORDER.indexOf(a.subject);
      const sb = SUBJECT_ORDER.indexOf(b.subject);
      if (sa !== sb) return sa - sb;
      if (Boolean(a.isUserCard) !== Boolean(b.isUserCard)) return a.isUserCard ? 1 : -1;
      return Number(a.number || 99999) - Number(b.number || 99999) || String(a.title).localeCompare(String(b.title), "zh-CN");
    });
  }

  function rebuildCards() {
    cards = sortCards([...sourceCards, ...allCustomCards()]);
  }

  function installCustomIntoPractice(customCards = allCustomCards()) {
    if (!Array.isArray(state.questions)) return;
    const existingIds = new Set(state.questions.map((item) => item?.id).filter(Boolean));
    const normalized = customCards.map((card) => ({
      ...card,
      type: "flashcard",
      reviewCollection: COLLECTION,
      prompt: `${card.source || "我的口诀"}｜先只看题目回忆；先展开口诀，再展开口诀内容。`,
      mnemonicContent: card.answer || "",
    })).filter((card) => !existingIds.has(card.id));
    if (normalized.length) state.questions = [...state.questions, ...normalized];
    if (typeof populateSubjects === "function") populateSubjects();
  }

  function installStyles() {
    if ($("#mn333Styles")) return;
    const style = document.createElement("style");
    style.id = "mn333Styles";
    style.textContent = `
      .mn333-launch{margin:0 0 14px}
      .mn333-overlay{position:fixed;inset:0;z-index:1100;background:rgba(34,31,27,.5);padding:14px;display:flex;align-items:center;justify-content:center}
      .mn333-overlay.hidden{display:none}
      .mn333-panel{width:min(1000px,100%);height:min(88vh,860px);background:var(--surface,#fff);border:1px solid var(--line,#ddd6c8);border-radius:20px;box-shadow:0 18px 55px rgba(0,0,0,.2);display:grid;grid-template-rows:auto auto 1fr;overflow:hidden}
      .mn333-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 18px 10px}
      .mn333-head h2{margin:0;font-size:1.2rem}
      .mn333-close{border:0;background:transparent;font-size:1.65rem;cursor:pointer;padding:4px 8px;color:inherit}
      .mn333-tools{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,220px) auto;gap:10px;padding:0 18px 14px}
      .mn333-tools input,.mn333-tools select{width:100%;box-sizing:border-box}
      .mn333-add{white-space:nowrap}
      .mn333-body{min-height:0;display:grid;grid-template-columns:minmax(260px,.9fr) minmax(0,1.4fr);border-top:1px solid var(--line,#ddd6c8)}
      .mn333-list{overflow:auto;padding:10px;background:var(--surface-soft,#faf7f0);border-right:1px solid var(--line,#ddd6c8)}
      .mn333-item{width:100%;text-align:left;border:1px solid transparent;background:transparent;color:inherit;border-radius:12px;padding:11px 12px;margin:0 0 6px;cursor:pointer}
      .mn333-item:hover,.mn333-item.active{background:var(--surface,#fff);border-color:var(--line,#ddd6c8)}
      .mn333-item strong{display:block;line-height:1.45;font-size:.94rem}
      .mn333-item small{display:block;margin-top:4px;color:var(--muted,#6f675d);font-size:.75rem}
      .mn333-detail{overflow:auto;padding:22px}
      .mn333-meta{font-size:.8rem;color:var(--muted,#6f675d)}
      .mn333-detail h3{font-size:1.25rem;line-height:1.5;margin:8px 0 14px}
      .mn333-stage{margin:12px 0;padding:14px;border-radius:14px;border:1px solid var(--line,#ddd6c8);white-space:pre-wrap;line-height:1.75}
      .mn333-stage.mnemonic{background:var(--surface-soft,#faf7f0);font-weight:600}
      .mn333-stage.hidden{display:none}
      .mn333-button-row{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
      .mn333-empty{padding:20px;color:var(--muted,#6f675d);text-align:center}
      .mn333-count{font-size:.8rem;color:var(--muted,#6f675d);font-weight:400}
      .mn333-add-form{max-width:700px}
      .mn333-add-form label{display:block;font-size:.84rem;margin:11px 0 5px}
      .mn333-add-form input,.mn333-add-form select,.mn333-add-form textarea{width:100%;box-sizing:border-box}
      .mn333-add-tip{font-size:.8rem;color:var(--muted,#6f675d);line-height:1.6;margin-top:10px}
      @media(max-width:720px){
        .mn333-overlay{padding:0;align-items:stretch}
        .mn333-panel{height:100%;max-height:none;border-radius:0;border-left:0;border-right:0}
        .mn333-tools{grid-template-columns:1fr 1fr;padding-left:14px;padding-right:14px}
        .mn333-tools #mn333Search{grid-column:1/-1}
        .mn333-add{width:100%}
        .mn333-body{grid-template-columns:1fr;grid-template-rows:minmax(180px,36%) minmax(0,1fr)}
        .mn333-list{border-right:0;border-bottom:1px solid var(--line,#ddd6c8)}
        .mn333-detail{padding:16px}
      }
    `;
    document.head.append(style);
  }

  function createUI() {
    installStyles();
    if ($("#mn333Launch")) return;
    const anchor = $("#flashcardLibraryButton") || $("#dailyReview");
    if (!anchor) return;

    const launch = document.createElement("button");
    launch.id = "mn333Launch";
    launch.type = "button";
    launch.className = "secondary wide mn333-launch";
    launch.disabled = true;
    launch.textContent = "333 口诀库 · 正在加载…";
    anchor.insertAdjacentElement("afterend", launch);

    const overlay = document.createElement("section");
    overlay.id = "mn333Overlay";
    overlay.className = "mn333-overlay hidden";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="mn333-panel" role="dialog" aria-modal="true" aria-labelledby="mn333Title">
        <div class="mn333-head">
          <h2 id="mn333Title">333 口诀库 <span id="mn333Count" class="mn333-count"></span></h2>
          <button id="mn333Close" class="mn333-close" type="button" aria-label="关闭">×</button>
        </div>
        <div class="mn333-tools">
          <input id="mn333Search" type="search" placeholder="搜索人物、理论、口诀…" autocomplete="off">
          <select id="mn333Subject" aria-label="按科目筛选"><option value="all">全部四科</option></select>
          <button id="mn333Add" class="primary mn333-add" type="button">＋ 添加我的口诀</button>
        </div>
        <div class="mn333-body">
          <div id="mn333List" class="mn333-list"></div>
          <article id="mn333Detail" class="mn333-detail"><p class="mn333-empty">先选左边一条，只看题目回忆。</p></article>
        </div>
      </div>`;
    document.body.append(overlay);

    const close = () => {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    };
    const open = () => {
      renderList();
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      $("#mn333Search").focus();
    };
    launch.addEventListener("click", open);
    $("#mn333Close").addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !overlay.classList.contains("hidden")) close(); });
    $("#mn333Search").addEventListener("input", renderList);
    $("#mn333Subject").addEventListener("change", renderList);
    $("#mn333Add").addEventListener("click", showAddForm);
  }

  function refreshSubjectOptions() {
    const select = $("#mn333Subject");
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="all">全部四科</option>';
    SUBJECT_ORDER.forEach((subject) => {
      const option = document.createElement("option");
      option.value = subject;
      option.textContent = `${subject}（${cards.filter((c) => c.subject === subject).length}）`;
      select.append(option);
    });
    select.value = current === "all" || SUBJECT_ORDER.includes(current) ? current : "all";
  }

  function visibleCards() {
    const subject = $("#mn333Subject")?.value || "all";
    const query = ($("#mn333Search")?.value || "").trim().toLowerCase();
    return cards.filter((card) => {
      if (subject !== "all" && card.subject !== subject) return false;
      if (!query) return true;
      return [card.title, card.mnemonic, card.answer, card.subject, card.source].filter(Boolean).join("\n").toLowerCase().includes(query);
    });
  }

  function renderList(preferredId = "") {
    const list = $("#mn333List");
    const count = $("#mn333Count");
    if (!list || !count) return;
    const filtered = visibleCards();
    count.textContent = `· ${filtered.length} / ${cards.length} 条`;
    list.innerHTML = "";
    if (!filtered.length) {
      list.innerHTML = '<p class="mn333-empty">没有匹配的口诀。</p>';
      $("#mn333Detail").innerHTML = '<p class="mn333-empty">换个关键词试试，或者点“＋ 添加我的口诀”。</p>';
      return;
    }
    filtered.forEach((card, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "mn333-item";
      item.dataset.id = card.id;
      const title = document.createElement("strong");
      title.textContent = card.title;
      const meta = document.createElement("small");
      meta.textContent = card.isUserCard ? `${card.subject} · 我的口诀` : `${card.subject} · #${card.number}`;
      item.append(title, meta);
      item.addEventListener("click", () => showCard(card));
      list.append(item);
      if ((preferredId && card.id === preferredId) || (!preferredId && index === 0)) showCard(card);
    });
  }

  function showCard(card) {
    document.querySelectorAll(".mn333-item").forEach((item) => item.classList.toggle("active", item.dataset.id === card.id));
    const detail = $("#mn333Detail");
    detail.innerHTML = "";

    const meta = document.createElement("div");
    meta.className = "mn333-meta";
    meta.textContent = card.isUserCard
      ? `${card.subject} · 我的口诀 · ${card.source || "我的轻松记编码"}`
      : `${card.subject} · 第 ${card.number} 条 · ${card.source || "口诀资料"}`;
    const title = document.createElement("h3");
    title.textContent = card.title;

    const mnemonic = document.createElement("div");
    mnemonic.className = "mn333-stage mnemonic hidden";
    mnemonic.textContent = card.mnemonic || "（这条还没有口诀）";
    const answer = document.createElement("div");
    answer.className = "mn333-stage hidden";
    answer.textContent = card.answer || "（这条还没有内容，可以之后再补）";

    const row = document.createElement("div");
    row.className = "mn333-button-row";
    const revealMnemonic = document.createElement("button");
    revealMnemonic.type = "button";
    revealMnemonic.className = "primary";
    revealMnemonic.textContent = "① 展开口诀";
    const revealAnswer = document.createElement("button");
    revealAnswer.type = "button";
    revealAnswer.className = "secondary";
    revealAnswer.textContent = "② 展开口诀内容";
    revealAnswer.disabled = true;

    revealMnemonic.addEventListener("click", () => {
      const opening = mnemonic.classList.contains("hidden");
      mnemonic.classList.toggle("hidden", !opening);
      revealMnemonic.textContent = opening ? "收起口诀" : "① 展开口诀";
      revealAnswer.disabled = false;
    });
    revealAnswer.addEventListener("click", () => {
      const opening = answer.classList.contains("hidden");
      answer.classList.toggle("hidden", !opening);
      revealAnswer.textContent = opening ? "收起口诀内容" : "② 展开口诀内容";
    });

    row.append(revealMnemonic, revealAnswer);
    detail.append(meta, title, row, mnemonic, answer);
    document.dispatchEvent(new CustomEvent("mn333:detail-shown", { detail: { card } }));
  }

  function showAddForm() {
    const detail = $("#mn333Detail");
    if (!detail) return;
    document.querySelectorAll(".mn333-item").forEach((item) => item.classList.remove("active"));
    detail.innerHTML = `
      <div class="mn333-meta">我的轻松记编码</div>
      <h3>＋ 添加一张 333 口诀卡</h3>
      <section class="mn333-add-form">
        <label for="mn333AddSubject">科目</label>
        <select id="mn333AddSubject">
          ${SUBJECT_ORDER.map((subject) => `<option value="${subject}">${subject}</option>`).join("")}
        </select>
        <label for="mn333AddTitle">题目 / 知识点</label>
        <input id="mn333AddTitle" type="text" placeholder="例如：宋代书院教育的特点" autocomplete="off">
        <label for="mn333AddMnemonic">口诀</label>
        <textarea id="mn333AddMnemonic" rows="4" placeholder="写你刚刚编码好的口诀"></textarea>
        <label for="mn333AddContent">口诀内容 / 得分点（可以暂时空着）</label>
        <textarea id="mn333AddContent" rows="8" placeholder="把口诀还原成哪些关键词；暂时没整理好也可以留空，以后再补。"></textarea>
        <div class="mn333-button-row">
          <button id="mn333AddSave" class="primary" type="button">保存并查看</button>
          <button id="mn333AddContinue" class="secondary" type="button">保存并继续添加</button>
          <button id="mn333AddCancel" class="text-button" type="button">取消</button>
        </div>
        <p class="mn333-add-tip">新卡会立即进入“333口诀”自动复习题池，也会出现在这里的搜索结果里。它和你修改过的口诀一样，保存在本机学习记录中，并随“备份本机记录”一起导出。</p>
      </section>`;

    const lastSubject = localStorage.getItem("mn333-last-add-subject");
    if (SUBJECT_ORDER.includes(lastSubject)) $("#mn333AddSubject").value = lastSubject;
    $("#mn333AddTitle").focus();

    $("#mn333AddSave").addEventListener("click", () => saveNewCard(false));
    $("#mn333AddContinue").addEventListener("click", () => saveNewCard(true));
    $("#mn333AddCancel").addEventListener("click", () => renderList());
  }

  function saveNewCard(continueAdding) {
    const subject = $("#mn333AddSubject")?.value || "教育学原理";
    const title = ($("#mn333AddTitle")?.value || "").trim();
    const mnemonic = ($("#mn333AddMnemonic")?.value || "").trim();
    const answer = ($("#mn333AddContent")?.value || "").trim();
    if (!title) {
      alert("先给这张卡写一个题目 / 知识点吧，这样以后才能搜得到它 😚");
      $("#mn333AddTitle")?.focus();
      return;
    }
    if (!mnemonic && !answer) {
      alert("口诀和内容至少填一个；内容可以以后再补。😚");
      $("#mn333AddMnemonic")?.focus();
      return;
    }

    const card = normalizeCustom({
      id: `custom-mn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      subject,
      title,
      mnemonic,
      answer,
      source: "我的轻松记编码",
      createdAt: new Date().toISOString(),
    });
    customStore().push(card);
    saveProgress();
    localStorage.setItem("mn333-last-add-subject", subject);
    rebuildCards();
    refreshSubjectOptions();
    installCustomIntoPractice([card]);
    document.dispatchEvent(new CustomEvent("mn333:custom-updated", { detail: { card, action: "add" } }));

    if (continueAdding) {
      showAddForm();
      $("#mn333AddSubject").value = subject;
      return;
    }

    $("#mn333Search").value = title;
    $("#mn333Subject").value = "all";
    renderList(card.id);
  }

  createUI();
  Promise.all(FILES.map(loadJson))
    .then((groups) => {
      sourceCards = groups.flat();
      rebuildCards();
      refreshSubjectOptions();
      installCustomIntoPractice();
      const launch = $("#mn333Launch");
      launch.disabled = false;
      launch.textContent = `333 口诀库 · ${cards.length} 条`;
    })
    .catch((error) => {
      console.error("333口诀库加载失败：", error);
      const launch = $("#mn333Launch");
      if (launch) {
        launch.disabled = true;
        launch.textContent = "333 口诀库 · 加载失败";
      }
    });
})();