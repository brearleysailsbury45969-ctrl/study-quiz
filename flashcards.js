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
      reveal.textContent = "翻面看口诀 + 得分点";
      $("#toggleMine").classList.add("hidden");
      $("#answerHeading").textContent = "口诀 + 得分点";
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
    option.textContent = "闪卡（科二口诀）";
    typeSelect.append(option);
  }

  const flashcardFiles = [
    "questions/k2-mnemonic-一级.json",
    "questions/k2-mnemonic-二级.json",
    "questions/k2-mnemonic-三级.json",
  ];

  Promise.all(flashcardFiles.map((path) => fetch(path).then((response) => {
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  })))
    .then((groups) => {
      const flashcards = groups.flat();
      const installWhenReady = () => {
        if (!Array.isArray(state.questions) || state.questions.length === 0) {
          window.setTimeout(installWhenReady, 80);
          return;
        }
        state.questions = dedupeQuestions([...state.questions, ...flashcards]);
        populateSubjects();
      };
      installWhenReady();
    })
    .catch((error) => {
      console.error("科二口诀闪卡加载失败：", error);
    });
})();
