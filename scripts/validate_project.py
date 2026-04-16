from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON_LRI = ROOT / 'packages' / 'python-lri'


@dataclass
class CheckResult:
    key: str
    label: str
    command: list[str]
    cwd: Path
    returncode: int
    stdout: str
    stderr: str

    @property
    def ok(self) -> bool:
        return self.returncode == 0


CHECKS: list[tuple[str, str, Path, list[str]]] = [
    (
        'build_vocab',
        'Build vocabulary artifacts',
        ROOT,
        ['node', 'tools/build-vocab.mjs'],
    ),
    (
        'vocab_artifacts',
        'Verify vocabulary artifacts',
        ROOT,
        ['node', '--test', 'tests/vocab.artifacts.test.mjs'],
    ),
    (
        'python_sdk_subset',
        'Run Python SDK validation subset',
        PYTHON_LRI,
        [
            sys.executable,
            '-m',
            'pytest',
            '-q',
            'tests/test_lri.py',
            'tests/test_lss.py',
            'tests/test_validator.py',
        ],
    ),
]


def run_check(key: str, label: str, cwd: Path, command: list[str]) -> CheckResult:
    completed = subprocess.run(
        command,
        cwd=cwd,
        text=True,
        capture_output=True,
        check=False,
    )
    return CheckResult(
        key=key,
        label=label,
        command=command,
        cwd=cwd,
        returncode=completed.returncode,
        stdout=completed.stdout.strip(),
        stderr=completed.stderr.strip(),
    )


def run_checks() -> list[CheckResult]:
    return [run_check(key, label, cwd, command) for key, label, cwd, command in CHECKS]


def print_results(results: list[CheckResult]) -> None:
    for result in results:
        status = 'PASS' if result.ok else 'FAIL'
        command = ' '.join(result.command)
        print(f'[{status}] {result.label}')
        print(f'  cwd: {result.cwd}')
        print(f'  cmd: {command}')
        if result.stdout:
            print('  stdout:')
            for line in result.stdout.splitlines():
                print(f'    {line}')
        if result.stderr:
            print('  stderr:')
            for line in result.stderr.splitlines():
                print(f'    {line}')


if __name__ == '__main__':
    results = run_checks()
    print_results(results)
    sys.exit(0 if all(result.ok for result in results) else 1)