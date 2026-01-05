"""Microbenchmarks comparing JSON+JWS vs CBOR+COSE for LCE envelopes."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path

import jcs
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from lpi import (
    LCE,
    base64url_decode,
    base64url_encode,
    create_cose_sign1,
    verify_cose_sign1,
)

FIXTURE_PATH = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "lce-cose-vector.json"


def load_fixture() -> tuple[LCE, bytes]:
    data = json.loads(FIXTURE_PATH.read_text())
    lce = LCE.model_validate(data["lce"])
    seed = bytes.fromhex(data["seed"])
    return lce, seed


def build_jws(lce: LCE, private_key: Ed25519PrivateKey) -> str:
    sanitized = lce.model_dump(mode="python", exclude_none=True)
    sanitized.pop("sig", None)
    canonical = jcs.canonicalize(sanitized)
    if isinstance(canonical, str):
        canonical_bytes = canonical.encode("utf-8")
    else:
        canonical_bytes = canonical
    header = base64url_encode(json.dumps({"alg": "EdDSA", "kid": "bench"}).encode("utf-8"))
    payload = base64url_encode(canonical_bytes)
    signing_input = f"{header}.{payload}".encode("utf-8")
    signature = base64url_encode(private_key.sign(signing_input))
    return f"{header}.{payload}.{signature}"


def run_benchmarks(iterations: int):
    lce, seed = load_fixture()
    private_key = Ed25519PrivateKey.from_private_bytes(seed)
    public_key = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )

    baseline_jws = build_jws(lce, private_key)
    cose, *_ = create_cose_sign1(lce, seed)

    json_size = len(baseline_jws.encode("utf-8"))
    cbor_size = len(cose)

    start = time.perf_counter()
    for _ in range(iterations):
        build_jws(lce, private_key)
    encode_json_time = (time.perf_counter() - start) / iterations

    start = time.perf_counter()
    for _ in range(iterations):
        create_cose_sign1(lce, seed)
    encode_cbor_time = (time.perf_counter() - start) / iterations

    header, payload, signature = baseline_jws.split(".")
    signing_input = f"{header}.{payload}".encode("utf-8")
    signature_bytes = base64url_decode(signature)

    start = time.perf_counter()
    for _ in range(iterations):
        private_key.public_key().verify(signature_bytes, signing_input)
    verify_json_time = (time.perf_counter() - start) / iterations

    start = time.perf_counter()
    for _ in range(iterations):
        verify_cose_sign1(cose, public_key)
    verify_cbor_time = (time.perf_counter() - start) / iterations

    return {
        "iterations": iterations,
        "json_size": json_size,
        "cbor_size": cbor_size,
        "size_savings_bytes": json_size - cbor_size,
        "size_savings_percent": (json_size - cbor_size) / json_size * 100,
        "encode_json_time": encode_json_time,
        "encode_cbor_time": encode_cbor_time,
        "verify_json_time": verify_json_time,
        "verify_cbor_time": verify_cbor_time,
    }


def format_us(value: float) -> str:
    return f"{value * 1_000_000:.2f} µs"


def main():
    iterations = int(os.environ.get("BENCH_ITERATIONS", "5000"))
    results = run_benchmarks(iterations)

    print("LCE CBOR/COSE microbenchmarks (Python)")
    print(f"Iterations: {results['iterations']}")
    print(f"JSON+JWS size: {results['json_size']} bytes")
    print(f"CBOR+COSE size: {results['cbor_size']} bytes")
    print(
        "Size savings: "
        f"{results['size_savings_bytes']} bytes ({results['size_savings_percent']:.2f}%)"
    )
    print(f"JSON+JWS encode: {format_us(results['encode_json_time'])}")
    print(f"CBOR+COSE encode: {format_us(results['encode_cbor_time'])}")
    print(f"JSON+JWS verify: {format_us(results['verify_json_time'])}")
    print(f"CBOR+COSE verify: {format_us(results['verify_cbor_time'])}")


if __name__ == "__main__":
    main()
