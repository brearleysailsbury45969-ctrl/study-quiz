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
  const flashcardFiles = [
    "questions/k2-mnemonic-a.json",
    "questions/k2-mnemonic-b.json",
  ];

  Promise.all(flashcardFiles.map((path) => fetch(path).then((response) => {
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  })))
    .then((groups) => {
      const flashcards = groups.flat().map(([number, chapterIndex, importanceIndex, title, answer]) => {
        const chapter = CHAPTERS[chapterIndex] || "科二";
        const importance = IMPORTANCE[importanceIndex] || "未分级";
        return {
          id: `k2-mnemonic-${String(number).padStart(3, "0")}`,
          type: "flashcard",
          subject: `科二口诀·${importance}`,
          number,
          title,
          prompt: `${chapter}｜${importance}｜先回忆口诀和得分点，再翻面。`,
          answer,
          source: "中学科二大题合集-2026下【小烦口诀】",
          chapter,
          importance,
        };
      });

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
