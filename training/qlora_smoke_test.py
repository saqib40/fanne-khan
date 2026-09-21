"""Load the target 7B model and run one real QLoRA backward pass."""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("TORCH_CUDA_ARCH_LIST", "12.0")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from unsloth import FastLanguageModel  # noqa: E402
import torch  # noqa: E402

MODEL_ID = "unsloth/Qwen2.5-Coder-7B-Instruct-bnb-4bit"


def main() -> None:
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is unavailable")

    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=MODEL_ID,
        max_seq_length=512,
        dtype=None,
        load_in_4bit=True,
    )
    model = FastLanguageModel.get_peft_model(
        model,
        r=8,
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
        lora_alpha=8,
        lora_dropout=0,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=3407,
        use_rslora=False,
        loftq_config=None,
    )
    messages = [
        {
            "role": "system",
            "content": "Return a concise MotionSpec JSON object.",
        },
        {
            "role": "user",
            "content": "Create a kinetic title reading Make ideas move.",
        },
        {
            "role": "assistant",
            "content": (
                '{"version":"1.0","name":"Make ideas move",'
                '"fps":30,"width":1920,"height":1080}'
            ),
        },
    ]
    input_ids = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=False,
        return_tensors="pt",
    ).to("cuda")

    model.train()
    model.zero_grad(set_to_none=True)
    output = model(
        input_ids=input_ids,
        labels=input_ids.clone(),
        use_cache=False,
    )
    output.loss.backward()
    torch.cuda.synchronize()

    trainable = sum(
        parameter.numel()
        for parameter in model.parameters()
        if parameter.requires_grad
    )
    report = {
        "status": "success",
        "model": MODEL_ID,
        "tokens": input_ids.shape[-1],
        "loss": round(output.loss.item(), 4),
        "trainable_parameters": trainable,
        "peak_vram_gib": round(torch.cuda.max_memory_allocated() / 1024**3, 3),
        "reserved_vram_gib": round(torch.cuda.max_memory_reserved() / 1024**3, 3),
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
