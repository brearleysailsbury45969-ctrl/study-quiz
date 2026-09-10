#!/usr/bin/env python3
"""Extract the 333 subjective question bank from the normalized EPUB."""

from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def node_text(node: ET.Element) -> str:
    return clean_text("".join(node.itertext()))


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_questions.py INPUT.epub OUTPUT_DIR")

    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    questions: list[dict[str, object]] = []
    subject = ""
    subject_index = 0

    with zipfile.ZipFile(source) as archive:
        chapters = sorted(
            name
            for name in archive.namelist()
            if re.fullmatch(r"EPUB/text/ch\d+\.xhtml", name)
        )

        for chapter in chapters:
            root = ET.fromstring(archive.read(chapter))
            nodes = list(root.iter())
            heading1 = next((node for node in nodes if local_name(node.tag) == "h1"), None)
            heading2 = next((node for node in nodes if local_name(node.tag) == "h2"), None)

            if heading1 is not None:
                candidate = node_text(heading1)
                if candidate in {"中国教育史", "外国教育史", "教育心理学", "教育学原理"}:
                    subject = candidate
                    subject_index = 0
                continue

            if heading2 is None or not subject:
                continue

            subject_index += 1
            raw_title = node_text(heading2)
            title = re.sub(r"^第\s*\d+\s*题\s*[｜|:：]?\s*", "", raw_title)
            heading_index = nodes.index(heading2)
            content = [
                node for node in nodes[heading_index + 1 :]
                if local_name(node.tag) in {"p", "ol", "ul"}
            ]

            marker_index = next(
                (i for i, node in enumerate(content) if "【参考答案】" in node_text(node)),
                None,
            )
            if marker_index is None:
                prompt_nodes = content
                answer_nodes = []
            else:
                prompt_nodes = content[:marker_index]
                answer_nodes = content[marker_index + 1 :]

            prompt_nodes = [
                node
                for node in prompt_nodes
                if "冬青答题四步走" not in node_text(node)
            ]
            prompt = "\n".join(
                node_text(node) for node in prompt_nodes
            ).strip()
            answer = "\n".join(
                node_text(node) for node in answer_nodes
            ).strip()

            questions.append(
                {
                    "id": f"333-{len(questions) + 1:03d}",
                    "subject": subject,
                    "number": subject_index,
                    "title": title,
                    "prompt": prompt,
                    "answer": answer,
                    "source": "333主观200题（冬青老师）",
                }
            )

    destination.mkdir(parents=True, exist_ok=True)
    subject_files = {
        "中国教育史": "chinese-education-history.json",
        "外国教育史": "foreign-education-history.json",
        "教育心理学": "educational-psychology.json",
        "教育学原理": "education-principles.json",
    }
    print(f"extracted {len(questions)} questions to {destination}")
    for name, filename in subject_files.items():
        group = [question for question in questions if question["subject"] == name]
        (destination / filename).write_text(
            json.dumps(group, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        print(f"  {name}: {len(group)}")


if __name__ == "__main__":
    main()
