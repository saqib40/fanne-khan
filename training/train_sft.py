"""QLoRA supervised fine-tuning for MotionSpec generation."""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("TORCH_CUDA_ARCH_LIST", "12.0")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

from unsloth import FastLanguageModel  # noqa: E402
from unsloth.chat_templates import train_on_responses_only  # noqa: E402
from datasets import load_dataset  # noqa: E402
import torch  # noqa: E402
from trl import SFTConfig, SFTTrainer  # noqa: E402

BASE_MODEL_ID = "unsloth/Qwen2.5-Coder-7B-Instruct-bnb-4bit"
MAX_LENGTH = 1024


def main() -> None:
    max_steps = int(os.environ.get("MAX_STEPS", "-1"))
    model_source = os.environ.get("MODEL_SOURCE", BASE_MODEL_ID)
    train_file = Path(
        os.environ.get("TRAIN_FILE", ROOT / "data" / "sft" / "train.jsonl")
    )
    validation_file = Path(
        os.environ.get(
            "VALIDATION_FILE",
            ROOT / "data" / "sft" / "validation.jsonl",
        )
    )
    learning_rate = float(os.environ.get("LEARNING_RATE", "1e-4"))
    eval_steps = int(os.environ.get("EVAL_STEPS", "20"))
    output_dir = Path(
        os.environ.get(
            "OUTPUT_DIR",
            ROOT / "training" / "runs" / "sft-qwen2.5-coder-7b",
        )
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=model_source,
        max_seq_length=MAX_LENGTH,
        dtype=None,
        load_in_4bit=True,
    )
    continuing_adapter = (Path(model_source) / "adapter_config.json").exists()
    if not continuing_adapter:
        model = FastLanguageModel.get_peft_model(
            model,
            r=16,
            target_modules=[
                "q_proj",
                "k_proj",
                "v_proj",
                "o_proj",
                "gate_proj",
                "up_proj",
                "down_proj",
            ],
            lora_alpha=16,
            lora_dropout=0,
            bias="none",
            use_gradient_checkpointing="unsloth",
            random_state=3407,
            use_rslora=False,
            loftq_config=None,
        )
    dataset = load_dataset(
        "json",
        data_files={
            "train": str(train_file),
            "validation": str(validation_file),
        },
    )
    smoke_run = max_steps > 0 and max_steps <= 2
    config = SFTConfig(
        output_dir=str(output_dir),
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=8,
        num_train_epochs=1,
        max_steps=max_steps,
        learning_rate=learning_rate,
        warmup_steps=0 if smoke_run else 3,
        lr_scheduler_type="cosine",
        optim="adamw_8bit",
        weight_decay=0.01,
        max_grad_norm=1.0,
        bf16=True,
        fp16=False,
        logging_steps=1,
        eval_strategy="no" if smoke_run else "steps",
        eval_steps=None if smoke_run else eval_steps,
        save_strategy="no" if smoke_run else "steps",
        save_steps=eval_steps,
        save_total_limit=2,
        report_to="none",
        seed=3407,
        data_seed=3407,
        max_length=MAX_LENGTH,
        packing=False,
        dataset_num_proc=4,
    )

    def format_messages(examples: dict[str, object]) -> list[str]:
        messages_batch = examples["messages"]
        if not isinstance(messages_batch, list):
            raise TypeError("Expected a list of chat messages")
        if messages_batch and isinstance(messages_batch[0], dict):
            messages_batch = [messages_batch]
        return [
            tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=False,
            )
            for messages in messages_batch
        ]

    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=dataset["train"],
        eval_dataset=None if smoke_run else dataset["validation"],
        args=config,
        formatting_func=format_messages,
    )
    trainer = train_on_responses_only(
        trainer,
        instruction_part="<|im_start|>user\n",
        response_part="<|im_start|>assistant\n",
    )

    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()
    result = trainer.train()
    adapter_dir = output_dir / "adapter"
    model.save_pretrained(adapter_dir)
    tokenizer.save_pretrained(adapter_dir)

    metrics = {
        **result.metrics,
        "model": model_source,
        "continuing_adapter": continuing_adapter,
        "train_file": str(train_file),
        "validation_file": str(validation_file),
        "learning_rate": learning_rate,
        "max_length": MAX_LENGTH,
        "lora_rank": 16,
        "gradient_accumulation_steps": 8,
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
