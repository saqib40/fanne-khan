"""Measure prompt and completion lengths for DPO configuration."""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from transformers import AutoTokenizer  # noqa: E402

TOKENIZER_PATH = (
    ROOT / "training" / "runs" / "sft-stage3-boundaries" / "adapter"
)


def token_ids(tokenizer, messages: list[dict[str, str]]) -> list[int]:
    encoded = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=False,
    )
    return encoded["input_ids"] if hasattr(encoded, "keys") else encoded


def summarize(values: list[int]) -> dict[str, int]:
    ordered = sorted(values)
    return {
        "minimum": ordered[0],
        "median": ordered[len(ordered) // 2],
        "maximum": ordered[-1],
    }


def main() -> None:
    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_PATH)
    report: dict[str, object] = {}

    for split in ("train", "validation"):
        records = [
            json.loads(line)
            for line in (
                ROOT / "data" / "preferences" / f"dpo-{split}.jsonl"
            )
            .read_text(encoding="utf-8")
            .splitlines()
            if line.strip()
        ]
        prompt_lengths = []
        completion_lengths = []
        total_lengths = []
        for record in records:
            prompt_length = len(token_ids(tokenizer, record["prompt"]))
            chosen_length = len(
                token_ids(tokenizer, record["prompt"] + record["chosen"])
            )
            rejected_length = len(
                token_ids(tokenizer, record["prompt"] + record["rejected"])
            )
            prompt_lengths.append(prompt_length)
            completion_lengths.extend(
                [chosen_length - prompt_length, rejected_length - prompt_length]
            )
            total_lengths.extend([chosen_length, rejected_length])
        report[split] = {
            "records": len(records),
            "prompt": summarize(prompt_lengths),
            "completion": summarize(completion_lengths),
            "total": summarize(total_lengths),
        }

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
