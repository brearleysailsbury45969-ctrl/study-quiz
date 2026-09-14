(() => {
  if (typeof state === "undefined" || !state.progress) return;

  const SOURCE = "2026-09-14截图编码";
  const cards = [
    {
      id: "seed-20260914-zh-bailudong",
      subject: "中国教育史",
      title: "白鹿洞书院学规",
      mnemonic: "勿学神事物",
      answer: "教之目：父子有亲，君臣有义，夫妇有别，长幼有序，朋友有信。\n为学之序：博学之，审问之，慎思之，明辨之，笃行之。\n修身之要：言忠信，行笃敬，惩忿窒欲，迁善改过。\n处事之要：正其谊不谋其利，明其道不计其功。\n接物之要：己所不欲，勿施于人；行有不得，反求诸己。",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-zh-yanyuan-six",
      subject: "中国教育史",
      title: "颜元的“六斋”",
      mnemonic: "经理文武可以（括艺）",
      answer: "文事斋：课礼、乐、书、数、天文、地理等科。\n武备斋：课兵法、射御、技击等科。\n经史斋：课《十三经》等科。\n艺能斋：课水学、火学、工学等科。\n理学斋：课程、朱、陆、王之学等科。\n帖括斋：课八股举业。",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-zh-wangshouren",
      subject: "中国教育史",
      title: "王守仁：致良知、教育原则与教学",
      mnemonic: "良人静时省过",
      answer: "致良知与教育作用：学以去昏蔽；存天理灭人欲。\n教育原则：随人分限所及。\n论教学：主张学习儒家经典以明人伦；静处体悟；事上磨练；省察克治；贵于改过。",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-principles-direct-moral",
      subject: "教育学原理",
      title: "直接的道德教学",
      mnemonic: "德育课程",
      answer: "直接的道德教学是通过专门的德育课程系统地向学生有目的、有计划、有组织地传授道德知识和道德观念的教育活动。",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-principles-teacher-rights",
      subject: "教育学原理",
      title: "教师的权利",
      mnemonic: "教学只报33",
      answer: "（教）教育教学自主权\n（学）学术自由权\n（指）指导评价权\n（报）报酬待遇休假权\n（参）参与民主管理权\n（参）参加进修培训权",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-principles-teacher-duties",
      subject: "教育学原理",
      title: "教师的义务",
      mnemonic: "守仁教育止步",
      answer: "（守）法履德，为人师表\n完成教育教学工作（任）务\n对学生进行全面（教）育\n（关）心爱护和尊重学生\n（制）止、批评、抵制有害于学生的行为\n（不）断提高思想政治觉悟和教育教学业务水平",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-principles-teacher-student-feature",
      subject: "教育学原理",
      title: "师生关系的特征",
      mnemonic: "尊享平和教心",
      answer: "尊师爱生，相互配合\n民主平等，和谐亲密\n教学相长，心理相容",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-principles-teacher-student-function",
      subject: "教育学原理",
      title: "师生关系的作用",
      mnemonic: "生活化",
      answer: "（生）生活质量重要指标\n（活）活动顺利进行\n文（化）",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-principles-teacher-student-build",
      subject: "教育学原理",
      title: "建立良好师生关系",
      mnemonic: "解救新冠\n共对失信\n狗叫\n修民（小明）",
      answer: "了解研究学生，树立新型教师观。\n公平对待学生，建立教师威信。\n主动与学生沟通交流，善于与学生交往。\n努力提高自身修养，发扬教育民主。",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-psych-problem-factors",
      subject: "教育心理学",
      title: "影响问题解决的因素",
      mnemonic: "制动问思源",
      answer: "知识经验\n智力、动机\n问题情境及表征方式\n思维定式、功能固着\n原型启发、酝酿效应",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-psych-memory-techniques",
      subject: "教育心理学",
      title: "记忆术",
      mnemonic: "首位写诗词",
      answer: "（首）字连词\n（位）置记忆法\n（谐）音联想法\n（视）觉想象\n关键（词）法、琴栓单词法",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-foreign-comenius-moral",
      subject: "外国教育史",
      title: "夸美纽斯的德育内容",
      mnemonic: "紧致意义",
      answer: "德育的内容：谨慎、节制、刚毅、正义；把劳动教育纳入德育。",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-foreign-herbart-psych",
      subject: "外国教育史",
      title: "赫尔巴特的心理学基础",
      mnemonic: "统觉、兴趣",
      answer: "心理学基础：统觉、兴趣。",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-foreign-herbart-moral",
      subject: "外国教育史",
      title: "赫尔巴特的道德教育",
      mnemonic: "职道教学",
      answer: "教育目的：①可能的目的——职业，发展兴趣；②必要的目的——道德观念养成。\n教育性教学。",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    },
    {
      id: "seed-20260914-foreign-herbart-teaching",
      subject: "外国教育史",
      title: "赫尔巴特的教学框架",
      mnemonic: "教进阶五三",
      answer: "教学过程：单纯提示、分析、综合。\n教学阶段：教学——明了、联合、系统、方法；兴趣——注意、期待、要求、行动；心理活动——专心、专心、审思、审思；心理状态——静止、动态、静止、动态。\n五段教学法：预备、提示、联合、总结、应用。\n三中心：教师、教材、课堂。",
      source: SOURCE,
      createdAt: "2026-09-14T17:34:00+08:00"
    }
  ];

  if (!Array.isArray(state.progress.customMnemonics)) state.progress.customMnemonics = [];
  const existing = new Set(state.progress.customMnemonics.map((card) => card?.id).filter(Boolean));
  cards.forEach((card) => {
    if (!existing.has(card.id)) state.progress.customMnemonics.push(card);
  });

  if (!state.progress.mnemonicOverrides || typeof state.progress.mnemonicOverrides !== "object") {
    state.progress.mnemonicOverrides = {};
  }
  const overrides = state.progress.mnemonicOverrides;

  if (!overrides["mn116-zh-17"]) {
    overrides["mn116-zh-17"] = {
      mnemonic: "演讲闭声多事",
      content: "1.教学与研究相结合\n2.盛行讲会制度\n3.教学上实行门户开放\n4.书院的师生关系融洽\n5.教学形式多样，注重学生自学\n6.注重讲明义理，躬亲实践",
      updatedAt: "2026-09-14T17:34:00+08:00"
    };
  }

  if (!overrides["mn116-principles-11"]) {
    overrides["mn116-principles-11"] = {
      mnemonic: "环协管，活脚趾",
      content: "教学育人\n指导育人\n管理育人\n活动育人\n环境育人\n协同育人",
      updatedAt: "2026-09-14T17:34:00+08:00"
    };
  }

  if (typeof saveProgress === "function") saveProgress();
  document.dispatchEvent(new CustomEvent("mn333:custom-updated"));
})();