"""Generate a small content-disjoint evaluation sample with the SFT adapter."""

from __future__ import annotations

import json
import os
from contextlib import nullcontext
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("TORCH_CUDA_ARCH_LIST", "12.0")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from unsloth import FastLanguageModel  # noqa: E402
import torch  # noqa: E402

ADAPTER_DIR = Path(
    os.environ.get(
        "ADAPTER_DIR",
        ROOT / "training" / "runs" / "sft-qwen2.5-coder-7b" / "adapter",
    )
)
DISABLE_ADAPTER = os.environ.get("DISABLE_ADAPTER") == "1"
OUTPUT_PATH = Path(
    os.environ.get(
        "EVAL_OUTPUT",
        ROOT
        / "training"
        / "runs"
        / "sft-qwen2.5-coder-7b"
        / ("heldout-base.jsonl" if DISABLE_ADAPTER else "heldout-sample.jsonl"),
    )
)


def main() -> None:
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=str(ADAPTER_DIR),
        max_seq_length=1024,
        dtype=None,
        load_in_4bit=True,
    )
    FastLanguageModel.for_inference(model)

    records = [
        json.loads(line)
        for line in (ROOT / "data" / "sft" / "test.jsonl")
        .read_text(encoding="utf-8")
        .splitlines()
        if line.strip()
    ]
    selected = []
    seen_kinds: set[str] = set()
    for record in records:
        kind = record["metadata"]["kind"]
        if kind not in seen_kinds:
            selected.append(record)
            seen_kinds.add(kind)

    outputs = []
    adapter_context = model.disable_adapter() if DISABLE_ADAPTER else nullcontext()
    with adapter_context:
        for record in selected:
            request_messages = record["messages"][:2]
            inputs = tokenizer.apply_chat_template(
                request_messages,
                tokenize=True,
                add_generation_prompt=True,
                return_tensors="pt",
                return_dict=True,
            ).to("cuda")
            with torch.inference_mode():
                generated = model.generate(
                    **inputs,
                    max_new_tokens=400,
                    do_sample=False,
                    use_cache=True,
                    pad_token_id=tokenizer.eos_token_id,
                )
            input_length = inputs["input_ids"].shape[-1]
            response = tokenizer.decode(
                generated[0, input_length:],
                skip_special_tokens=True,
            ).strip()
            outputs.append(
                {
                    "id": record["id"],
                    "kind": record["metadata"]["kind"],
                    "prompt": record["messages"][1]["content"],
                    "reference": record["messages"][2]["content"],
                    "response": response,
                }
            )
            print(f"generated {record['id']}")

    OUTPUT_PATH.write_text(
        "".join(f"{json.dumps(record)}\n" for record in outputs),
        encoding="utf-8",
    )
    print(json.dumps({"status": "success", "records": len(outputs)}))


if __name__ == "__main__":
    main()
