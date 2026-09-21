"""Memory-efficient DPO training from the final SFT adapter."""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("TORCH_CUDA_ARCH_LIST", "12.0")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from unsloth import FastLanguageModel  # noqa: E402
from datasets import load_dataset  # noqa: E402
import torch  # noqa: E402
from trl import DPOConfig, DPOTrainer  # noqa: E402

SFT_ADAPTER = (
    ROOT / "training" / "runs" / "sft-stage3-boundaries" / "adapter"
)
MAX_LENGTH = 832
MAX_PROMPT_LENGTH = 576
MAX_COMPLETION_LENGTH = 256


def main() -> None:
    max_steps = int(os.environ.get("MAX_STEPS", "-1"))
    output_dir = Path(
        os.environ.get(
            "OUTPUT_DIR",
            ROOT / "training" / "runs" / "dpo-taste",
        )
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=str(SFT_ADAPTER),
        max_seq_length=MAX_LENGTH,
        dtype=None,
        load_in_4bit=True,
    )
    model.load_adapter(
        str(SFT_ADAPTER),
        adapter_name="reference",
        is_trainable=False,
    )
    model.set_adapter("default")

    dataset = load_dataset(
        "json",
        data_files={
            "train": str(
                ROOT / "data" / "preferences" / "dpo-train.jsonl"
            ),
            "validation": str(
                ROOT / "data" / "preferences" / "dpo-validation.jsonl"
            ),
        },
    )
    smoke_run = max_steps > 0 and max_steps <= 1
    config = DPOConfig(
        output_dir=str(output_dir),
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=4,
        num_train_epochs=1,
        max_steps=max_steps,
        learning_rate=5e-6,
        warmup_steps=0 if smoke_run else 2,
        lr_scheduler_type="cosine",
        optim="adamw_8bit",
        weight_decay=0.01,
        max_grad_norm=1.0,
        bf16=True,
        fp16=False,
        logging_steps=1,
        eval_strategy="no" if smoke_run else "epoch",
        save_strategy="no" if smoke_run else "epoch",
        save_total_limit=2,
        report_to="none",
        seed=3407,
        data_seed=3407,
        max_length=MAX_LENGTH,
        max_prompt_length=MAX_PROMPT_LENGTH,
        max_completion_length=MAX_COMPLETION_LENGTH,
        truncation_mode="keep_end",
        beta=0.1,
        loss_type="sigmoid",
        model_adapter_name="default",
        ref_adapter_name="reference",
        dataset_num_proc=4,
    )
    trainer = DPOTrainer(
        model=model,
        ref_model=None,
        args=config,
        processing_class=tokenizer,
        train_dataset=dataset["train"],
        eval_dataset=None if smoke_run else dataset["validation"],
    )

    trainable = sum(
        parameter.numel()
        for parameter in model.parameters()
        if parameter.requires_grad
    )
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()
    result = trainer.train()

    adapter_dir = output_dir / "adapter"
    model.set_adapter("default")
    model.save_pretrained(adapter_dir, selected_adapters=["default"])
    tokenizer.save_pretrained(adapter_dir)
    metrics = {
        **result.metrics,
        "source_adapter": str(SFT_ADAPTER),
        "reference_adapter": "reference",
        "trainable_parameters": trainable,
        "beta": config.beta,
        "learning_rate": config.learning_rate,
        "max_length": MAX_LENGTH,
        "max_prompt_length": MAX_PROMPT_LENGTH,
        "max_completion_length": MAX_COMPLETION_LENGTH,
        "peak_vram_gib": round(torch.cuda.max_memory_allocated() / 1024**3, 3),
        "reserved_vram_gib": round(torch.cuda.max_memory_reserved() / 1024**3, 3),
        "adapter_dir": str(adapter_dir),
    }
    (output_dir / "metrics.json").write_text(
        json.dumps(metrics, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
