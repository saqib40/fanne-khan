"""Sample several MotionSpec candidates per taste-review prompt."""

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
import torch  # noqa: E402

ADAPTER_DIR = Path(
    os.environ.get(
        "ADAPTER_DIR",
        ROOT / "training" / "runs" / "sft-stage3-boundaries" / "adapter",
    )
)
REQUESTS_PATH = Path(
    os.environ.get(
        "TASTE_REQUESTS",
        ROOT / ".cache" / "taste" / "requests.json",
    )
)
OUTPUT_PATH = Path(
    os.environ.get(
        "TASTE_CANDIDATES",
        ROOT / ".cache" / "taste" / "candidates.jsonl",
    )
)
TEMPERATURES = (0.45, 0.6, 0.75, 0.9)


def main() -> None:
    requests = json.loads(REQUESTS_PATH.read_text(encoding="utf-8"))
    if not requests:
        raise RuntimeError("No taste-review requests were supplied")

    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=str(ADAPTER_DIR),
        max_seq_length=1024,
        dtype=None,
        load_in_4bit=True,
    )
    FastLanguageModel.for_inference(model)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with OUTPUT_PATH.open("w", encoding="utf-8") as output_file:
        for request in requests:
            messages = [
                {"role": "system", "content": request["system"]},
                {"role": "user", "content": request["prompt"]},
            ]
            inputs = tokenizer.apply_chat_template(
                messages,
                tokenize=True,
                add_generation_prompt=True,
                return_tensors="pt",
                return_dict=True,
            ).to("cuda")
            input_length = inputs["input_ids"].shape[-1]

            for candidate_index, temperature in enumerate(TEMPERATURES):
                seed = int(request["seed"]) + candidate_index * 104729
                torch.manual_seed(seed)
                torch.cuda.manual_seed_all(seed)
                with torch.inference_mode():
                    generated = model.generate(
                        **inputs,
                        max_new_tokens=400,
                        do_sample=True,
                        temperature=temperature,
                        top_p=0.92,
                        top_k=50,
                        repetition_penalty=1.03,
                        use_cache=True,
                        pad_token_id=tokenizer.eos_token_id,
                    )
                response = tokenizer.decode(
                    generated[0, input_length:],
                    skip_special_tokens=True,
                ).strip()
                record = {
                    "promptId": request["id"],
                    "category": request["category"],
                    "prompt": request["prompt"],
                    "candidateIndex": candidate_index,
                    "seed": seed,
                    "temperature": temperature,
                    "response": response,
                }
                output_file.write(f"{json.dumps(record)}\n")
                output_file.flush()
                print(
                    f"sampled {request['id']} candidate {candidate_index + 1}",
                    flush=True,
                )

    print(
        json.dumps(
            {
                "status": "success",
                "prompts": len(requests),
                "candidates": len(requests) * len(TEMPERATURES),
                "output": str(OUTPUT_PATH),
            }
        )
    )


if __name__ == "__main__":
    main()
