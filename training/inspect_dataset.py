"""Measure token lengths for the canonical SFT dataset."""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from transformers import AutoTokenizer  # noqa: E402

MODEL_ID = "unsloth/Qwen2.5-Coder-7B-Instruct-bnb-4bit"


def percentile(values: list[int], fraction: float) -> int:
    ordered = sorted(values)
    index = round((len(ordered) - 1) * fraction)
    return ordered[index]


def main() -> None:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    report: dict[str, object] = {"model": MODEL_ID, "splits": {}}

    for split in ("train", "validation", "test"):
        path = ROOT / "data" / "sft" / f"{split}.jsonl"
        records = [
            json.loads(line)
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
        lengths = []
        for record in records:
            encoded = tokenizer.apply_chat_template(
                record["messages"],
                tokenize=True,
                add_generation_prompt=False,
            )
            input_ids = (
                encoded["input_ids"]
                if hasattr(encoded, "keys") and "input_ids" in encoded
                else encoded
            )
            lengths.append(len(input_ids))
        report["splits"][split] = {
            "records": len(lengths),
            "minimum": min(lengths),
            "median": percentile(lengths, 0.5),
            "p95": percentile(lengths, 0.95),
            "maximum": max(lengths),
            "fits_1024": sum(length <= 1024 for length in lengths),
        }

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
