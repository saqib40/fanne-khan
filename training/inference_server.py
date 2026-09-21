"""Persistent local inference server for the winning DPO adapter."""

from __future__ import annotations

import json
import os
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

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
        ROOT / "training" / "runs" / "dpo-taste" / "adapter",
    )
).resolve()
HOST = os.environ.get("INFERENCE_HOST", "127.0.0.1")
PORT = int(os.environ.get("INFERENCE_PORT", "8788"))
MAX_REQUEST_BYTES = 128 * 1024
generation_lock = threading.Lock()


def load_runtime():
    if not ADAPTER_DIR.exists():
        raise FileNotFoundError(f"Adapter does not exist: {ADAPTER_DIR}")
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is unavailable")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=str(ADAPTER_DIR),
        max_seq_length=1024,
        dtype=None,
        load_in_4bit=True,
    )
    FastLanguageModel.for_inference(model)
    return model, tokenizer


MODEL, TOKENIZER = load_runtime()


class Handler(BaseHTTPRequestHandler):
    server_version = "FanneKhanInference/1.0"

    def send_json(self, status: HTTPStatus, value: object) -> None:
        payload = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(payload)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def read_json(self) -> Any:
        length = int(self.headers.get("content-length", "0"))
        if length <= 0 or length > MAX_REQUEST_BYTES:
            raise ValueError("Invalid request size")
        return json.loads(self.rfile.read(length))

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path != "/health":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        properties = torch.cuda.get_device_properties(0)
        self.send_json(
            HTTPStatus.OK,
            {
                "status": "ready",
                "backend": "unsloth",
                "model": str(ADAPTER_DIR),
                "device": properties.name,
                "vramGiB": round(properties.total_memory / 1024**3, 2),
            },
        )

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        if self.path != "/chat":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        if not generation_lock.acquire(blocking=False):
            self.send_json(
                HTTPStatus.CONFLICT,
                {"error": "A generation is already running"},
            )
            return
        try:
            body = self.read_json()
            messages = body.get("messages")
            if not isinstance(messages, list) or not messages:
                raise ValueError("messages must be a non-empty array")
            seed = int(body.get("seed", 20260918))
            temperature = float(body.get("temperature", 0.7))
            max_new_tokens = min(
                600,
                max(64, int(body.get("maxNewTokens", 400))),
            )

            torch.manual_seed(seed)
            torch.cuda.manual_seed_all(seed)
            inputs = TOKENIZER.apply_chat_template(
                messages,
                tokenize=True,
                add_generation_prompt=True,
                return_tensors="pt",
                return_dict=True,
            ).to("cuda")
            input_length = inputs["input_ids"].shape[-1]
            started_at = time.perf_counter()
            with torch.inference_mode():
                generated = MODEL.generate(
                    **inputs,
                    max_new_tokens=max_new_tokens,
                    do_sample=temperature > 0,
                    temperature=max(0.05, temperature),
                    top_p=0.9,
                    top_k=50,
                    repetition_penalty=1.03,
                    use_cache=True,
                    pad_token_id=TOKENIZER.eos_token_id,
                )
            output_ids = generated[0, input_length:]
            content = TOKENIZER.decode(
                output_ids,
                skip_special_tokens=True,
            ).strip()
            self.send_json(
                HTTPStatus.OK,
                {
                    "message": {"role": "assistant", "content": content},
                    "eval_count": int(output_ids.shape[-1]),
                    "total_duration": int(
                        (time.perf_counter() - started_at) * 1_000_000_000
                    ),
                },
            )
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except Exception as error:  # Keep the sidecar alive after one bad request.
            self.send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": f"{type(error).__name__}: {error}"},
            )
        finally:
            generation_lock.release()

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}", flush=True)


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(
        json.dumps(
            {
                "status": "ready",
                "url": f"http://{HOST}:{PORT}",
                "adapter": str(ADAPTER_DIR),
            }
        ),
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
