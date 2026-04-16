from __future__ import annotations

from pathlib import Path

from validate_project import run_checks

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'VALIDATION_RESULTS.md'


def fenced(text: str) -> str:
    return '```text\n' + (text.strip() or '(no output)') + '\n```'


def render() -> str:
    results = run_checks()
    passed = sum(1 for result in results if result.ok)
    total = len(results)
    lines: list[str] = [
        '# Validation Results',
        '',
        'This snapshot records the reproducible root-level validation path for the LPI repository.',
        '',
        f'- Checks run: `{total}`',
        f'- Checks passed: `{passed}`',
        f'- Checks failed: `{total - passed}`',
        '',
        '## Summary',
        '',
        '| Check | Status |',
        '|-------|--------|',
    ]
    for result in results:
        status = 'PASS' if result.ok else 'FAIL'
        lines.append(f'| {result.label} | `{status}` |')

    for result in results:
        command = ' '.join(result.command)
        lines.extend(
            [
                '',
                f'## {result.label}',
                '',
                f'- Working directory: `{result.cwd}`',
                f'- Command: `{command}`',
                f'- Exit code: `{result.returncode}`',
                '',
                '### Stdout',
                '',
                fenced(result.stdout),
            ]
        )
        if result.stderr:
            lines.extend(['', '### Stderr', '', fenced(result.stderr)])

    return '\n'.join(lines) + '\n'


if __name__ == '__main__':
    OUTPUT.write_text(render(), encoding='utf-8', newline='\n')
    print(f'Wrote {OUTPUT}')