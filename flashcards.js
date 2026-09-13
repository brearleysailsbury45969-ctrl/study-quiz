(() => {
  const originalQuestionKind = questionKind;
  const originalQuestionTypeLabel = questionTypeLabel;
  const originalRenderSubjectiveQuestion = renderSubjectiveQuestion;

  questionKind = function patchedQuestionKind(question) {
    const raw = String(question?.type || "subjective").toLowerCase();
    if (raw === "flashcard") return "flashcard";
    return originalQuestionKind(question);
  };

  questionTypeLabel = function patchedQuestionTypeLabel(question) {
    return questionKind(question) === "flashcard" ? "闪卡" : originalQuestionTypeLabel(question);
  };

  renderSubjectiveQuestion = function patchedRenderSubjectiveQuestion(question) {
    originalRenderSubjectiveQuestion(question);
    const isFlashcard = questionKind(question) === "flashcard";
    const answerLabel = document.querySelector('label[for="userAnswer"]');
    const userAnswer = $("#userAnswer");
    const reveal = $("#reveal");

    if (isFlashcard) {
      if (answerLabel) answerLabel.classList.add("hidden");
      userAnswer.classList.add("hidden");
      userAnswer.value = "";
      reveal.textContent = "翻面看答案 / 触发器";
      $("#toggleMine").classList.add("hidden");
      $("#answerHeading").textContent = "答案 / 触发器";
    } else {
      if (answerLabel) answerLabel.classList.remove("hidden");
      userAnswer.classList.remove("hidden");
      reveal.textContent = "提交并查看答案";
    }
  };

  const typeSelect = $("#questionType");
  if (typeSelect && !typeSelect.querySelector('option[value="flashcard"]')) {
    const option = document.createElement("option");
    option.value = "flashcard";
    option.textContent = "闪卡 / 每日复习";
    typeSelect.append(option);
  }

  const CHAPTERS = [
    "",
    "第一章教育基础",
    "第二章中学课程",
    "第三章中学教学",
    "第四章中学生学习心理",
    "第五章中学生发展心理",
    "第六章中学生心理辅导",
    "第七章中学德育",
    "第八章中学班级管理与教师心理",
  ];
  const IMPORTANCE = ["", "一级", "二级", "三级"];
  const mnemonicFiles = [
    "questions/k2-mnemonic-a.json",
    "questions/k2-mnemonic-b.json",
  ];
  const dailyReviewFile = "questions/daily-review-cards.json";
  const notionMnemonicFile = "questions/notion-333-mnemonics.json";

  let libraryCards = [];

  const loadJson = (path) => fetch(path).then((response) => {
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  });

  function installLibraryStyles() {
    if (document.querySelector("#flashcardLibraryStyles")) return;
    const style = document.createElement("style");
    style.id = "flashcardLibraryStyles";
    style.textContent = `
      .flashcard-library-button{margin:0 0 14px}
      .flashcard-library-overlay{position:fixed;inset:0;z-index:1000;background:rgba(34,31,27,.48);padding:16px;display:flex;align-items:center;justify-content:center}
      .flashcard-library-overlay.hidden{display:none}
      .flashcard-library-panel{width:min(980px,100%);height:min(86vh,820px);background:var(--surface,#fff);border:1px solid var(--line,#ddd6c8);border-radius:20px;box-shadow:0 18px 55px rgba(0,0,0,.18);display:grid;grid-template-rows:auto auto 1fr;overflow:hidden}
      .flashcard-library-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 18px 10px}
      .flashcard-library-head h2{margin:0;font-size:1.25rem}
      .flashcard-library-close{border:0;background:transparent;font-size:1.65rem;line-height:1;cursor:pointer;padding:4px 8px}
      .flashcard-library-tools{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,220px);gap:10px;padding:0 18px 14px}
      .flashcard-library-tools input,.flashcard-library-tools select{width:100%;box-sizing:border-box}
      .flashcard-library-body{min-height:0;display:grid;grid-template-columns:minmax(260px,.9fr) minmax(0,1.35fr);border-top:1px solid var(--line,#ddd6c8)}
      .flashcard-library-list{overflow:auto;padding:10px;border-right:1px solid var(--line,#ddd6c8);background:var(--surface-soft,#faf7f0)}
      .flashcard-library-empty{padding:20px;color:var(--muted,#6f675d);text-align:center}
      .flashcard-library-item{width:100%;text-align:left;border:1px solid transparent;background:transparent;border-radius:12px;padding:11px 12px;margin:0 0 6px;cursor:pointer;color:inherit}
      .flashcard-library-item:hover,.flashcard-library-item.active{background:var(--surface,#fff);border-color:var(--line,#ddd6c8)}
      .flashcard-library-item strong{display:block;font-size:.94rem;line-height:1.45}
      .flashcard-library-item small{display:block;margin-top:5px;color:var(--muted,#6f675d);font-size:.75rem}
      .flashcard-library-detail{overflow:auto;padding:22px}
      .flashcard-library-detail h3{margin:6px 0 8px;font-size:1.25rem;line-height:1.45}
      .flashcard-library-meta{color:var(--muted,#6f675d);font-size:.8rem;line-height:1.5}
      .flashcard-library-prompt{margin:16px 0;padding:12px 14px;border-radius:12px;background:var(--surface-soft,#faf7f0);line-height:1.65}
      .flashcard-library-answer{white-space:pre-wrap;line-height:1.75;margin-top:14px;padding:14px;border:1px solid var(--line,#ddd6c8);border-radius:14px}
      .flashcard-library-answer.hidden{display:none}
      .flashcard-library-reveal{margin-top:6px}
      .flashcard-library-count{font-size:.8rem;color:var(--muted,#6f675d);font-weight:400}
      @media(max-width:720px){
        .flashcard-library-overlay{padding:0;align-items:stretch}
        .flashcard-library-panel{height:100%;max-height:none;border-radius:0;border-left:0;border-right:0}
        .flashcard-library-tools{grid-template-columns:1fr;padding-left:14px;padding-right:14px}
        .flashcard-library-body{grid-template-columns:1fr;grid-template-rows:minmax(190px,38%) minmax(0,1fr)}
        .flashcard-library-list{border-right:0;border-bottom:1px solid var(--line,#ddd6c8);padding:8px 10px}
        .flashcard-library-detail{padding:16px}
      }
    `;
    document.head.append(style);
  }

  function createLibraryUI() {
    installLibraryStyles();
    const dailyButton = $("#dailyReview");
    if (!dailyButton || $("#flashcardLibraryButton")) return;

    const libraryButton = document.createElement("button");
    libraryButton.id = "flashcardLibraryButton";
    libraryButton.className = "secondary wide flashcard-library-button";
    libraryButton.type = "button";
    libraryButton.disabled = true;
    libraryButton.textContent = "打开闪卡库 · 正在加载…";
    dailyButton.insertAdjacentElement("afterend", libraryButton);

    const overlay = document.createElement("section");
    overlay.id = "flashcardLibraryOverlay";
    overlay.className = "flashcard-library-overlay hidden";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="flashcard-library-panel" role="dialog" aria-modal="true" aria-labelledby="flashcardLibraryTitle">
        <div class="flashcard-library-head">
          <h2 id="flashcardLibraryTitle">闪卡库 <span id="flashcardLibraryCount" class="flashcard-library-count"></span></h2>
          <button id="flashcardLibraryClose" class="flashcard-library-close" type="button" aria-label="关闭闪卡库">×</button>
        </div>
        <div class="flashcard-library-tools">
          <input id="flashcardLibrarySearch" type="search" placeholder="搜索题目、口诀、关键词…" autocomplete="off">
          <select id="flashcardLibraryFilter" aria-label="筛选闪卡"><option value="all">全部闪卡</option></select>
        </div>
        <div class="flashcard-library-body">
          <div id="flashcardLibraryList" class="flashcard-library-list"></div>
          <article id="flashcardLibraryDetail" class="flashcard-library-detail">
            <p class="flashcard-library-empty">从左侧点一张闪卡，就能主动查看。</p>
          </article>
        </div>
      </div>
    `;
    document.body.append(overlay);

    const closeLibrary = () => {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    };
    const openLibrary = () => {
      refreshLibraryFilters();
      renderLibraryList();
      overlay.classList.remove("hidden");
      overlay.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      $("#flashcardLibrarySearch").focus();
    };

    libraryButton.addEventListener("click", openLibrary);
    $("#flashcardLibraryClose").addEventListener("click", closeLibrary);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeLibrary();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.classList.contains("hidden")) closeLibrary();
    });
    $("#flashcardLibrarySearch").addEventListener("input", renderLibraryList);
    $("#flashcardLibraryFilter").addEventListener("change", renderLibraryList);
  }

  function cardGroup(card) {
    if (card.libraryGroup) return card.libraryGroup;
    if (card.category) return `333故事链｜${card.category}`;
    if (card.chapter) return `${card.subject || "闪卡"}｜${card.chapter}`;
    return card.subject || "其他";
  }

  function refreshLibraryFilters() {
    const filter = $("#flashcardLibraryFilter");
    if (!filter) return;
    const current = filter.value;
    const groups = [...new Set(libraryCards.map(cardGroup).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    filter.innerHTML = '<option value="all">全部闪卡</option>';
    groups.forEach((group) => {
      const option = document.createElement("option");
      option.value = group;
      option.textContent = group;
      filter.append(option);
    });
    filter.value = groups.includes(current) ? current : "all";
  }

  function filteredLibraryCards() {
    const query = ($("#flashcardLibrarySearch")?.value || "").trim().toLowerCase();
    const group = $("#flashcardLibraryFilter")?.value || "all";
    return libraryCards.filter((card) => {
      if (group !== "all" && cardGroup(card) !== group) return false;
      if (!query) return true;
      const haystack = [
        card.title,
        card.prompt,
        card.answer,
        card.keywords,
        card.mnemonic,
        card.subject,
        card.category,
        card.chapter,
      ].filter(Boolean).join("\n").toLowerCase();
      return haystack.includes(query);
    });
  }

  function renderLibraryList() {
    const list = $("#flashcardLibraryList");
    const count = $("#flashcardLibraryCount");
    if (!list || !count) return;
    const cards = filteredLibraryCards();
    count.textContent = `· ${cards.length} / ${libraryCards.length} 张`;
    list.innerHTML = "";

    if (!cards.length) {
      list.innerHTML = '<p class="flashcard-library-empty">没有匹配的闪卡。</p>';
      $("#flashcardLibraryDetail").innerHTML = '<p class="flashcard-library-empty">换个关键词或分类试试。</p>';
      return;
    }

    cards.forEach((card, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "flashcard-library-item";
      item.dataset.id = card.id;
      const title = document.createElement("strong");
      title.textContent = card.title || "未命名闪卡";
      const meta = document.createElement("small");
      meta.textContent = cardGroup(card);
      item.append(title, meta);
      item.addEventListener("click", () => showLibraryCard(card));
      list.append(item);
      if (index === 0) showLibraryCard(card);
    });
  }

  function showLibraryCard(card) {
    document.querySelectorAll(".flashcard-library-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.id === card.id);
    });

    const detail = $("#flashcardLibraryDetail");
    detail.innerHTML = "";

    const meta = document.createElement("div");
    meta.className = "flashcard-library-meta";
    meta.textContent = [cardGroup(card), card.source].filter(Boolean).join(" · ");

    const title = document.createElement("h3");
    title.textContent = card.title || "未命名闪卡";

    const prompt = document.createElement("div");
    prompt.className = "flashcard-library-prompt";
    prompt.textContent = card.prompt || "先自己回忆，再翻面看答案。";

    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "primary flashcard-library-reveal";
    reveal.textContent = "翻面看答案 / 口诀";

    const answer = document.createElement("div");
    answer.className = "flashcard-library-answer hidden";
    answer.textContent = card.answer || "暂无答案";

    reveal.addEventListener("click", () => {
      const isHidden = answer.classList.toggle("hidden");
      reveal.textContent = isHidden ? "翻面看答案 / 口诀" : "收起答案 / 口诀";
    });

    detail.append(meta, title, prompt, reveal, answer);
  }

  function setLibraryCards(cards) {
    libraryCards = dedupeQuestions(cards).filter((card) => questionKind(card) === "flashcard");
    const button = $("#flashcardLibraryButton");
    if (button) {
      button.disabled = false;
      button.textContent = `打开闪卡库 · ${libraryCards.length} 张`;
    }
  }

  createLibraryUI();

  Promise.all([
    Promise.all(mnemonicFiles.map(loadJson)),
    loadJson(dailyReviewFile),
    loadJson(notionMnemonicFile),
  ])
    .then(([mnemonicGroups, dailyReviewCards, notionRawCards]) => {
      const mnemonicCards = mnemonicGroups.flat().map(([number, chapterIndex, importanceIndex, title, answer]) => {
        const chapter = CHAPTERS[chapterIndex] || "科二";
        const importance = IMPORTANCE[importanceIndex] || "未分级";
        return {
          id: `k2-mnemonic-${String(number).padStart(3, "0")}`,
          type: "flashcard",
          subject: "科二口诀",
          number,
          title,
          prompt: `${chapter}｜${importance}｜先回忆口诀和得分点，再翻面。`,
          answer,
          source: "中学科二大题合集-2026下【小烦口诀】",
          chapter,
          importance,
          libraryGroup: `科二口诀｜${chapter}`,
        };
      });

      const normalizedDailyCards = dailyReviewCards.map((card, index) => ({
        ...card,
        id: card.id || `daily-review-${String(index + 1).padStart(3, "0")}`,
        type: "flashcard",
        subject: card.subject || "每日复习",
        source: card.source || "每日综合复习卡",
        libraryGroup: card.libraryGroup || `每日复习｜${card.subject || "综合"}`,
      }));

      const notionCards = notionRawCards.map((card, index) => ({
        id: `notion-333-${String(index + 1).padStart(3, "0")}`,
        type: "flashcard",
        subject: "333故事链",
        number: index + 1,
        title: card.title,
        prompt: `${card.category || "333"}｜先回忆教材关键词，再想故事链；需要时再翻面。`,
        answer: `【教材关键词】\n${card.keywords || "（未填写）"}\n\n【故事链 / 助记】\n${card.mnemonic || "（未填写）"}`,
        source: "Notion｜333 故事链闪卡",
        chapter: card.category || "333",
        category: card.category || "未分类",
        keywords: card.keywords || "",
        mnemonic: card.mnemonic || "",
        libraryGroup: `333故事链｜${card.category || "未分类"}`,
      }));

      const allFlashcards = [...mnemonicCards, ...normalizedDailyCards, ...notionCards];
      setLibraryCards(allFlashcards);

      const installWhenReady = () => {
        if (!Array.isArray(state.questions) || state.questions.length === 0) {
          window.setTimeout(installWhenReady, 80);
          return;
        }
        state.questions = dedupeQuestions([...state.questions, ...allFlashcards]);
        populateSubjects();
      };
      installWhenReady();
    })
    .catch((error) => {
      console.error("闪卡加载失败：", error);
      const button = $("#flashcardLibraryButton");
      if (button) {
        button.disabled = true;
        button.textContent = "闪卡库加载失败 · 请刷新重试";
      }
    });

  const dailyButton = $("#dailyReview");
  if (dailyButton) {
    dailyButton.addEventListener("click", () => {
      const questionType = $("#questionType");
      const subject = $("#subject");
      const mode = $("#mode");
      const count = $("#count");

      questionType.value = "flashcard";
      subject.value = "all";
      mode.value = "random";
      count.value = "15";
      syncTimedSetup();
      startRound();
    });
  }
})();
