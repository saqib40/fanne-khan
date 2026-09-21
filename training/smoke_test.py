"""Verify the CUDA/Unsloth stack before downloading model weights."""

from __future__ import annotations

import importlib.metadata
import json
import os
import sys

os.environ.setdefault("TORCH_CUDA_ARCH_LIST", "12.0")

import unsloth  # noqa: F401,E402 - must patch libraries before transformers
import bitsandbytes as bnb  # noqa: E402
import torch  # noqa: E402


def version(package: str) -> str:
    return importlib.metadata.version(package)


def main() -> None:
    if not torch.cuda.is_available():
        raise RuntimeError("PyTorch cannot access CUDA")

    device = torch.device("cuda:0")
    properties = torch.cuda.get_device_properties(device)
    if properties.major < 12:
        raise RuntimeError(
            f"Expected a Blackwell-class GPU, got capability "
            f"{properties.major}.{properties.minor}"
        )

    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats(device)

    source = torch.randn(
        (1024, 1024),
        device=device,
        dtype=torch.bfloat16,
        requires_grad=True,
    )
    loss = (source @ source.transpose(0, 1)).square().mean()
    loss.backward()
    torch.cuda.synchronize(device)

    layer = bnb.nn.Linear4bit(
        1024,
        1024,
        bias=False,
        compute_dtype=torch.bfloat16,
        quant_type="nf4",
        compress_statistics=True,
    ).to(device)
    sample = torch.randn(
        (8, 1024),
        device=device,
        dtype=torch.bfloat16,
        requires_grad=True,
    )
    quantized_loss = layer(sample).float().square().mean()
    quantized_loss.backward()
    torch.cuda.synchronize(device)

    report = {
        "status": "success",
        "python": sys.version.split()[0],
        "torch": torch.__version__,
        "torch_cuda": torch.version.cuda,
        "unsloth": version("unsloth"),
        "transformers": version("transformers"),
        "trl": version("trl"),
        "peft": version("peft"),
        "bitsandbytes": version("bitsandbytes"),
        "triton": version("triton"),
        "device": properties.name,
        "compute_capability": f"{properties.major}.{properties.minor}",
        "total_vram_gib": round(properties.total_memory / 1024**3, 2),
        "bf16_supported": torch.cuda.is_bf16_supported(),
        "peak_test_vram_gib": round(
            torch.cuda.max_memory_allocated(device) / 1024**3,
            3,
        ),
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
