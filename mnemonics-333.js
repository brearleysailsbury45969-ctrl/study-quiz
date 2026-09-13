(() => {
  const FILES = [
    "questions/333-mnemonics-chinese.json",
    "questions/333-mnemonics-foreign.json",
    "questions/333-mnemonics-psychology.json",
    "questions/333-mnemonics-principles.json",
  ];
  const SUBJECT_ORDER = ["教育学原理", "中国教育史", "外国教育史", "教育心理学"];
  let cards = [];

  const $ = (selector) => document.querySelector(selector);
  const loadJson = (path) => fetch(path).then((response) => {
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  });

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
      .mn333-tools{display:grid;grid-template-columns:minmax(0,1fr) minmax(160px,230px);gap:10px;padding:0 18px 14px}
      .mn333-tools input,.mn333-tools select{width:100%;box-sizing:border-box}
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
      @media(max-width:720px){
        .mn333-overlay{padding:0;align-items:stretch}
        .mn333-panel{height:100%;max-height:none;border-radius:0;border-left:0;border-right:0}
        .mn333-tools{grid-template-columns:1fr;padding-left:14px;padding-right:14px}
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
  }

  function visibleCards() {
    const subject = $("#mn333Subject")?.value || "all";
    const query = ($("#mn333Search")?.value || "").trim().toLowerCase();
    return cards.filter((card) => {
      if (subject !== "all" && card.subject !== subject) return false;
      if (!query) return true;
      return [card.title, card.mnemonic, card.answer, card.subject].filter(Boolean).join("\n").toLowerCase().includes(query);
    });
  }

  function renderList() {
    const list = $("#mn333List");
    const count = $("#mn333Count");
    if (!list || !count) return;
    const filtered = visibleCards();
    count.textContent = `· ${filtered.length} / ${cards.length} 条`;
    list.innerHTML = "";
    if (!filtered.length) {
      list.innerHTML = '<p class="mn333-empty">没有匹配的口诀。</p>';
      $("#mn333Detail").innerHTML = '<p class="mn333-empty">换个关键词试试。</p>';
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
      meta.textContent = `${card.subject} · #${card.number}`;
      item.append(title, meta);
      item.addEventListener("click", () => showCard(card));
      list.append(item);
      if (index === 0) showCard(card);
    });
  }

  function showCard(card) {
    document.querySelectorAll(".mn333-item").forEach((item) => item.classList.toggle("active", item.dataset.id === card.id));
    const detail = $("#mn333Detail");
    detail.innerHTML = "";

    const meta = document.createElement("div");
    meta.className = "mn333-meta";
    meta.textContent = `${card.subject} · 第 ${card.number} 条 · ${card.source || "口诀资料"}`;
    const title = document.createElement("h3");
    title.textContent = card.title;

    const mnemonic = document.createElement("div");
    mnemonic.className = "mn333-stage mnemonic hidden";
    mnemonic.textContent = card.mnemonic || "（这条原资料没有单列口诀）";
    const answer = document.createElement("div");
    answer.className = "mn333-stage hidden";
    answer.textContent = card.answer || "（原资料未提供展开内容）";

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
      mnemonic.classList.remove("hidden");
      revealMnemonic.textContent = "✓ 口诀已展开";
      revealMnemonic.disabled = true;
      revealAnswer.disabled = false;
    });
    revealAnswer.addEventListener("click", () => {
      answer.classList.remove("hidden");
      revealAnswer.textContent = "✓ 内容已展开";
      revealAnswer.disabled = true;
    });

    row.append(revealMnemonic, revealAnswer);
    detail.append(meta, title, row, mnemonic, answer);
  }

  createUI();
  Promise.all(FILES.map(loadJson))
    .then((groups) => {
      cards = groups.flat().sort((a, b) => {
        const sa = SUBJECT_ORDER.indexOf(a.subject);
        const sb = SUBJECT_ORDER.indexOf(b.subject);
        return sa - sb || Number(a.number || 0) - Number(b.number || 0);
      });
      const select = $("#mn333Subject");
      SUBJECT_ORDER.forEach((subject) => {
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = `${subject}（${cards.filter((c) => c.subject === subject).length}）`;
        select.append(option);
      });
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
