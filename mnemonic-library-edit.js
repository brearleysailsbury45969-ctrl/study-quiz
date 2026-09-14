(() => {
  const FILES = [
    "questions/333-mnemonics-principles.json",
    "questions/333-mnemonics-chinese.json",
    "questions/333-mnemonics-foreign.json",
    "questions/333-mnemonics-psychology.json",
    "questions/333-mnemonics-dense-old.json",
  ];
  const cardMap = new Map();

  const loadJson = (path) => fetch(path).then((response) => {
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  });

  function customCards() {
    if (typeof state !== "undefined" && state.progress && Array.isArray(state.progress.customMnemonics)) {
      return state.progress.customMnemonics;
    }
    try {
      const saved = JSON.parse(localStorage.getItem("study-quiz-progress-v1")) || {};
      return Array.isArray(saved.customMnemonics) ? saved.customMnemonics : [];
    } catch {
      return [];
    }
  }

  function overrides() {
    if (typeof state !== "undefined" && state.progress) {
      if (!state.progress.mnemonicOverrides || typeof state.progress.mnemonicOverrides !== "object") {
        state.progress.mnemonicOverrides = {};
      }
      return state.progress.mnemonicOverrides;
    }
    try {
      const saved = JSON.parse(localStorage.getItem("study-quiz-progress-v1")) || {};
      if (!saved.mnemonicOverrides || typeof saved.mnemonicOverrides !== "object") saved.mnemonicOverrides = {};
      return saved.mnemonicOverrides;
    } catch {
      return {};
    }
  }

  function persistFallback(store) {
    if (typeof state !== "undefined" && state.progress && typeof saveProgress === "function") {
      saveProgress();
      return;
    }
    try {
      const saved = JSON.parse(localStorage.getItem("study-quiz-progress-v1")) || {};
      saved.mnemonicOverrides = store;
      localStorage.setItem("study-quiz-progress-v1", JSON.stringify(saved));
    } catch (error) {
      console.error("口诀修改保存失败：", error);
    }
  }

  function activeId() {
    return document.querySelector("#mn333List .mn333-item.active")?.dataset.id || "";
  }

  function valuesFor(id) {
    const source = cardMap.get(id) || {};
    const custom = overrides()[id];
    return {
      mnemonic: custom?.mnemonic ?? source.mnemonic ?? "",
      content: custom?.content ?? source.answer ?? source.content ?? "",
      customized: Boolean(custom),
    };
  }

  function syncCopies(id, mnemonic, content) {
    if (typeof state === "undefined") return;
    [state.questions || [], state.round || []].forEach((list) => {
      list.forEach((item) => {
        if (item?.id !== id) return;
        item.mnemonic = mnemonic;
        item.mnemonicContent = content;
        item.answer = content;
      });
    });
  }

  function ensureEditor() {
    const detail = document.querySelector("#mn333Detail");
    if (!detail) return null;
    let editor = detail.querySelector("#mn333InlineEditor");
    if (editor) return editor;

    editor = document.createElement("section");
    editor.id = "mn333InlineEditor";
    editor.className = "hidden";
    editor.style.cssText = "margin-top:16px;padding:14px;border:1px solid var(--line,#ddd6c8);border-radius:14px;background:var(--surface-soft,#faf7f0);";
    editor.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px">修改这张口诀卡</div>
      <label for="mn333EditMnemonic" style="display:block;font-size:.84rem;margin:8px 0 5px">口诀</label>
      <textarea id="mn333EditMnemonic" rows="4" style="width:100%;box-sizing:border-box"></textarea>
      <label for="mn333EditContent" style="display:block;font-size:.84rem;margin:10px 0 5px">口诀内容 / 得分点</label>
      <textarea id="mn333EditContent" rows="8" style="width:100%;box-sizing:border-box"></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button id="mn333EditSave" class="primary" type="button">保存修改</button>
        <button id="mn333EditCancel" class="secondary" type="button">取消</button>
        <button id="mn333EditRestore" class="text-button" type="button">恢复资料原文</button>
      </div>
      <p style="margin:9px 0 0;font-size:.78rem;color:var(--muted,#6f675d)">修改会同步到刷题闪卡，并保存在这台设备的学习记录里。</p>`;
    detail.append(editor);

    editor.querySelector("#mn333EditSave")?.addEventListener("click", () => {
      const id = activeId();
      if (!id) return;
      const store = overrides();
      const mnemonic = editor.querySelector("#mn333EditMnemonic")?.value ?? "";
      const content = editor.querySelector("#mn333EditContent")?.value ?? "";
      store[id] = { mnemonic, content, updatedAt: new Date().toISOString() };
      syncCopies(id, mnemonic, content);
      persistFallback(store);
      editor.classList.add("hidden");
      applyDetail();
      const button = document.querySelector("#mn333EditButton");
      if (button) {
        button.textContent = "✓ 已保存 · 再修改";
        window.setTimeout(() => { if (button) button.textContent = "✎ 修改口诀 / 内容"; }, 1200);
      }
    });

    editor.querySelector("#mn333EditCancel")?.addEventListener("click", () => editor.classList.add("hidden"));
    editor.querySelector("#mn333EditRestore")?.addEventListener("click", () => {
      const id = activeId();
      if (!id) return;
      const store = overrides();
      if (!store[id]) return;
      if (!confirm("恢复成这张卡最初保存的口诀和内容吗？")) return;
      delete store[id];
      const source = cardMap.get(id) || {};
      syncCopies(id, source.mnemonic || "", source.answer || source.content || "");
      persistFallback(store);
      editor.classList.add("hidden");
      applyDetail();
    });
    return editor;
  }

  function fillEditor(id) {
    const editor = ensureEditor();
    if (!editor) return;
    const values = valuesFor(id);
    const mnemonicBox = editor.querySelector("#mn333EditMnemonic");
    const contentBox = editor.querySelector("#mn333EditContent");
    const restore = editor.querySelector("#mn333EditRestore");
    if (mnemonicBox) mnemonicBox.value = values.mnemonic;
    if (contentBox) contentBox.value = values.content;
    if (restore) restore.disabled = !values.customized;
  }

  function applyDetail() {
    const detail = document.querySelector("#mn333Detail");
    const id = activeId();
    if (!detail || !id || !cardMap.has(id)) return;
    const values = valuesFor(id);
    const stages = detail.querySelectorAll(".mn333-stage");
    const mnemonicStage = detail.querySelector(".mn333-stage.mnemonic");
    const answerStage = [...stages].find((node) => !node.classList.contains("mnemonic"));
    if (mnemonicStage) mnemonicStage.textContent = values.mnemonic || "（这条还没有口诀，可以点“修改口诀 / 内容”补上）";
    if (answerStage) answerStage.textContent = values.content || "（这条还没有内容，可以点“修改口诀 / 内容”补上）";

    let button = detail.querySelector("#mn333EditButton");
    if (!button) {
      button = document.createElement("button");
      button.id = "mn333EditButton";
      button.type = "button";
      button.className = "text-button";
      button.style.cssText = "margin-top:14px";
      button.textContent = "✎ 修改口诀 / 内容";
      detail.append(button);
      button.addEventListener("click", () => {
        const currentId = activeId();
        if (!currentId) return;
        const editor = ensureEditor();
        if (!editor) return;
        fillEditor(currentId);
        const opening = editor.classList.contains("hidden");
        editor.classList.toggle("hidden", !opening);
        if (opening) editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
    ensureEditor();
  }

  function scheduleApply() {
    window.setTimeout(applyDetail, 0);
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest?.("#mn333Launch,#mn333List .mn333-item,#mn333Detail .mn333-button-row button")) scheduleApply();
  });
  document.addEventListener("input", (event) => {
    if (event.target.matches?.("#mn333Search")) scheduleApply();
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches?.("#mn333Subject")) scheduleApply();
  });
  document.addEventListener("mn333:detail-shown", (event) => {
    const card = event.detail?.card;
    if (card?.id) cardMap.set(card.id, card);
    scheduleApply();
  });
  document.addEventListener("mn333:custom-updated", (event) => {
    const card = event.detail?.card;
    if (card?.id) cardMap.set(card.id, card);
    scheduleApply();
  });

  Promise.all(FILES.map(loadJson))
    .then((groups) => {
      groups.flat().forEach((card) => cardMap.set(card.id, card));
      customCards().forEach((card) => cardMap.set(card.id, card));
      scheduleApply();
    })
    .catch((error) => console.error("333口诀库编辑数据加载失败：", error));
})();