# 学习测验

手机 / 平板优先的个人刷题器。目前主体题库是 **333 主观 200 题**，同时已经支持选择题与自定义主观题。

## 当前功能

- 题型可分开选择：**选择题** / **简答与论述题** / 全部题型
- 选择题支持 A/B/C/D 作答、自动判分、答案解析、错题复习
- 主观题支持输入关键词骨架，再查看参考答案并自评“会 / 模糊 / 不会”
- 按科目、顺序或随机抽题
- 自定义每轮题量（默认 5 题）
- 只练错题 / 模糊 / 不会，或只练收藏题
- 收藏题目，并单独练习收藏题
- 每道题可写个人笔记，自动保存在本机
- 保存作答、评分、笔记、收藏和轮次记录
- 完成一轮后可生成 GitHub Issue 报告给 ChatGPT
- 首页可补交“今天全部记录”
- 可导出本机学习记录 JSON 作为备份

## 给 ChatGPT / Work 追加题目

仓库预留两个独立文件：

- `questions/custom-choice.json`：自定义选择题
- `questions/custom-subjective.json`：自定义简答 / 论述题

以后可以直接让 ChatGPT / Work 往这两个文件追加题目，不需要改网页代码。

### 选择题数据格式

```json
{
  "id": "choice-001",
  "type": "choice",
  "subject": "中国教育史",
  "number": 1,
  "title": "题目标题",
  "prompt": "题干",
  "options": {
    "A": "选项A",
    "B": "选项B",
    "C": "选项C",
    "D": "选项D"
  },
  "correct": "C",
  "explanation": "答案解析",
  "source": "来源"
}
```

### 主观题数据格式

```json
{
  "id": "subjective-001",
  "type": "subjective",
  "subject": "教育学原理",
  "number": 1,
  "title": "题目标题",
  "prompt": "题干",
  "answer": "参考答案",
  "source": "来源"
}
```

已有 333 主观题没有 `type` 字段时，网页会自动按主观题处理，因此旧题库和旧学习记录都兼容。

## 本地运行

由于浏览器不允许 `file://` 页面读取 JSON，请在仓库目录启动一个静态服务器：

```bash
python3 -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 更新原始 333 主观题库

题库数据由规范化 EPUB 自动提取：

```bash
python3 scripts/extract_questions.py /path/to/333主观200题.epub questions
```
