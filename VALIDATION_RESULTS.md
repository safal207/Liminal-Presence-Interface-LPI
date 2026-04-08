# Validation Results

This snapshot records the reproducible root-level validation path for the LPI repository.

- Checks run: `3`
- Checks passed: `3`
- Checks failed: `0`

## Summary

| Check | Status |
|-------|--------|
| Build vocabulary artifacts | `PASS` |
| Verify vocabulary artifacts | `PASS` |
| Run Python SDK validation subset | `PASS` |

## Build vocabulary artifacts

- Working directory: `C:\Users\safal\OneDrive\Documente\GitHub\Liminal-Presence-Interface-LPI`
- Command: `node tools/build-vocab.mjs`
- Exit code: `0`

### Stdout

```text
Converted vocab\affect.yaml -> vocab\dist\affect.json
Converted vocab\intent.yaml -> vocab\dist\intent.json
Vocabulary build complete. 2 file(s) written.
```

## Verify vocabulary artifacts

- Working directory: `C:\Users\safal\OneDrive\Documente\GitHub\Liminal-Presence-Interface-LPI`
- Command: `node --test tests/vocab.artifacts.test.mjs`
- Exit code: `0`

### Stdout

```text
TAP version 13
# Subtest: intent vocabulary artifact mirrors YAML source
ok 1 - intent vocabulary artifact mirrors YAML source
  ---
  duration_ms: 146.0334
  ...
# Subtest: affect vocabulary artifact mirrors YAML source
ok 2 - affect vocabulary artifact mirrors YAML source
  ---
  duration_ms: 66.5397
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1194.799
```

## Run Python SDK validation subset

- Working directory: `C:\Users\safal\OneDrive\Documente\GitHub\Liminal-Presence-Interface-LPI\packages\python-lri`
- Command: `C:\Users\safal\AppData\Local\Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\python.exe -m pytest -q tests/test_lri.py tests/test_lss.py tests/test_validator.py`
- Exit code: `0`

### Stdout

```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0
rootdir: C:\Users\safal\OneDrive\Documente\GitHub\Liminal-Presence-Interface-LPI\packages\python-lri
configfile: pytest.ini
plugins: allure-pytest-2.15.0, anyio-4.9.0, Faker-40.4.0, asyncio-0.23.8, cov-7.1.0, html-4.1.1, json-report-1.5.0, metadata-3.1.1
asyncio: mode=Mode.AUTO
collected 48 items

tests\test_lri.py ....................                                   [ 41%]
tests\test_lss.py .....                                                  [ 52%]
tests\test_validator.py .......................                          [100%]

============================== warnings summary ===============================
..\..\..\..\..\..\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\LocalCache\local-packages\Python311\site-packages\starlette\formparsers.py:12
  C:\Users\safal\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\LocalCache\local-packages\Python311\site-packages\starlette\formparsers.py:12: PendingDeprecationWarning: Please use `import python_multipart` instead.
    import multipart

-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
======================== 48 passed, 1 warning in 7.76s ========================
```
