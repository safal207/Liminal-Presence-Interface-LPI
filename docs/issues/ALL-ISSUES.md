# LRI - All GitHub Issues

This document contains all 22 planned GitHub issues for the LRI project.
Copy each issue to GitHub individually.

---

## Issue #1: RFC-000: The Liminal Resonance Interface (LRI) — Overview

**Labels:** `spec`, `rfc`, `v0.1`

**Goal:** Описать цели LRI, терминологию и границы слоя (L8 поверх L7).

**Acceptance Criteria:**

- Разделы: Problem, Scope, Non-Goals, Terminology (LCE, LHS, LSS, LTP), On-wire.
- Диаграмма слоёв (classic OSI vs LRI).
- Правила совместимости: инкапсуляция в HTTP/WS/gRPC.
- Media types: `application/liminal.lce+json`, `+cbor`.

---

## Issue #2: LCE v0.1 — JSON Schema (on-wire контракт)

**Labels:** `spec`, `schema`, `good first issue`

**Goal:** Утвердить JSON Schema для конверта смысла.

**Tasks:**

- Схема `schemas/lce-v0.1.json` ✅
- Примеры `examples/lce/*.json` ✅
- Валидация в CI

**Schema location:** `/schemas/lce-v0.1.json` (already created)

---

## Issue #3: Intent/Affect vocab v0.1 (YAML → JSON build)

**Labels:** `spec`, `vocab`, `build`

**Goal:** Человеко-читаемый словарь интентов/аффекта.

**Tasks:**
- `vocab/intent.yaml` ✅
- `vocab/affect.yaml` ✅
- Build-скрипт конвертит в JSON в `dist/vocab/`

**Acceptance:** Примеры и unit-тест на загрузку.

---

## Issue #4: LHS — Handshake протокол (spec + примеры)

**Labels:** `spec`, `ws`, `security`

**Goal:** Определить шаги Hello/Mirror/Bind/Seal/Flow.

**Acceptance:** JSON-примеры первого фрейма WS и заголовков HTTP.

**Description:**

Define the Liminal Handshake Sequence (LHS) protocol:

1. **Hello** - Client announces capabilities
2. **Mirror** - Server reflects and negotiates
3. **Bind** - Establish session context
4. **Seal** - Cryptographic commitment
5. **Flow** - Regular LCE exchange

Create examples for:
- WebSocket first frame
- HTTP headers for LHS negotiation

---

## Issue #5: Node SDK: Express middleware (HTTP)

**Labels:** `sdk`, `node`, `good first issue`

**Goal:** `packages/node-lri` — middleware, который:

- Читает/пишет заголовок LCE ✅
- Валидирует по JSON Schema ✅
- Экспортирует типы, helper'ы ✅

**Acceptance:** Пример в `examples/express-app` ✅

**Status:** Base implementation completed. Needs tests and documentation.

---

## Issue #6: Python SDK: FastAPI dependency (HTTP)

**Labels:** `sdk`, `python`

**Goal:** `packages/python-lri` — Depends, валидация, ошибки 422, примеры.

**Acceptance:** `examples/fastapi-app` ✅

**Status:** Base implementation completed. Needs tests and documentation.

---

## Issue #7: WS adapter (Node): LCE-фрейм + LHS

**Labels:** `sdk`, `ws`

**Goal:** Обёртка над ws/uWebSockets.js: первый фрейм — LHS, далее — префикс LCE.

**Acceptance:** Эхо-сервер + клиент, e2e-тест.

**Description:**

Create WebSocket adapter that:
- Implements LHS handshake on connection
- Prefixes each message with LCE metadata
- Provides easy API for WS servers/clients

Example:
```typescript
import { LRIWebSocket } from 'node-lri/ws';

const server = new LRIWebSocket({ port: 8080 });
server.on('message', (lce, payload) => {
  console.log('Intent:', lce.intent.type);
  server.send({ v:1, intent:{type:'tell'}, policy:{consent:'private'} }, payload);
});
```

---

## Issue #8: LTP — подписи JWS + JCS (Ed25519)

**Labels:** `crypto`, `security`

**Goal:** Канонизация JSON (RFC 8785), подпись/проверка JWS.

**Acceptance:** Кросс-тест Node↔Python на одинаковом LCE.

**Description:**

Implement Liminal Trust Protocol (LTP):

1. **JCS** (JSON Canonicalization Scheme, RFC 8785) for deterministic JSON
2. **JWS** (JSON Web Signature) with Ed25519
3. Sign/verify LCE envelopes
4. Cross-language compatibility tests

Libraries:
- Node: `@noble/ed25519`, `canonicalize`
- Python: `PyNaCl`, `jcs`

---

## Issue #9: CBOR/COSE режим (IoT)

**Labels:** `cbor`, `iot`

**Goal:** Альтернативный бинарный on-wire: `+cbor` + COSE-подписи.

**Acceptance:** Флаг `mode: "json"|"cbor"`, совместимые тесты.

**Description:**

Add CBOR encoding for LCE:
- Media type: `application/liminal.lce+cbor`
- COSE signatures instead of JWS
- Smaller payload for IoT/embedded systems
- Schema validation still applies

---

## Issue #10: LSS — session store + coherence score

**Labels:** `runtime`, `metrics`

**Goal:** Память сессии (thread, согласованные словари) + вычисление coherence (0..1).

**Acceptance:** Алгоритм: cosine-сходство intent'ов + стабильность affect-вектора.

**Description:**

Liminal Session Store (LSS):

1. **Session memory** - store conversation threads
2. **Coherence calculation**:
   - Intent consistency (cosine similarity)
   - Affect stability (vector variance)
   - Semantic drift detection
3. **QoS metrics** - populate `lce.qos.coherence`

Formula:
```
coherence = α·intent_similarity + β·affect_stability + γ·semantic_alignment
```

---

## Issue #11: Sidecar-proxy (Node): HTTP/WS инжектор LCE

**Labels:** `proxy`, `sidecar`, `runtime`

**Goal:** Мини-прокси, который:

- Вставляет LCE в исходящий трафик
- Логирует audit (policy/consent)
- Экспортит Prometheus-метрики: `lri_coherence`, `lri_drift`

**Acceptance:** Dockerfile, пример docker-compose.

**Description:**

Transparent LRI sidecar proxy:

```yaml
# docker-compose.yml
services:
  app:
    image: myapp
  lri-sidecar:
    image: lri/sidecar:latest
    environment:
      - UPSTREAM=http://app:3000
      - LRI_MODE=inject
    ports:
      - "8080:8080"
```

Features:
- Inject LCE into requests without app changes
- Audit log for compliance
- Prometheus `/metrics` endpoint

---

## Issue #12: Demo: "plain chat" vs "LRI chat"

**Labels:** `demo`, `ui`

**Goal:** Веб-демо с двумя колонками: обычный чат и LRI-чат (тон, intent-фильтры, coherence).

**Acceptance:** GIF в README.

**Description:**

Interactive web demo showing LRI benefits:

**Left column:** Plain text chat
**Right column:** LRI-enhanced chat with:
- Intent type indicators
- Affect visualization (PAD chart)
- Real-time coherence score
- Intent filters (show only "ask", "propose", etc.)

Tech: React + WebSocket + node-lri

---

## Issue #13: Consent & provenance audit

**Labels:** `security`, `compliance`

**Goal:** Журнал: кто/когда/с каким policy передал LCE; экспорт для проверок.

**Acceptance:** Подпись audit-строки, неизменяемость.

**Description:**

Audit trail for LCE exchanges:

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "from": "user@example.com",
  "to": "ai-service",
  "consent": "team",
  "thread": "550e8400-e29b-41d4-a716-446655440000",
  "sig": "ed25519:..."
}
```

Features:
- Append-only log
- Cryptographic signatures
- Export for GDPR/compliance reviews
- Policy violation detection

---

## Issue #14: gRPC/HTTP2 metadata adapter

**Labels:** `sdk`, `grpc`

**Goal:** Прокладка для grpc/grpc-web: LCE внутри метаданных.

**Acceptance:** Интеграционный тест с сервером-заглушкой.

**Description:**

LRI support for gRPC:

**Server:**
```typescript
import { lriInterceptor } from 'node-lri/grpc';

const server = new grpc.Server();
server.use(lriInterceptor());
```

**Client:**
```typescript
const metadata = new grpc.Metadata();
metadata.set('lce', createLCEHeader(lce));
client.method(request, metadata, callback);
```

LCE transported in gRPC metadata fields.

---

## Issue #15: CLI: lrictl

**Labels:** `tooling`

**Goal:** Инспекция/валидация/подпись LCE, генерация примеров, конверсия YAML→JSON.

**Acceptance:** `lrictl validate/sign/convert`, бинарники через pkg/pyinstaller.

**Description:**

Command-line tool for LRI:

```bash
# Validate LCE
lrictl validate lce.json

# Sign LCE
lrictl sign lce.json --key ed25519.key > signed.json

# Generate example
lrictl generate --intent ask --consent private > lce.json

# Convert vocab
lrictl convert vocab/intent.yaml -o dist/intent.json

# Inspect
lrictl inspect lce.json
```

Distribute as standalone binary.

---

## Issue #16: CI/CD: lint, test, schema-validate, packages

**Labels:** `ci`, `infra`

**Goal:** GitHub Actions:

- Lint (TS+Py), unit/e2e, schema-validation
- Паблиш в npm+PyPI (dry-run в PR)

**Acceptance:** Зеленый pipeline, бэйджи в README.

**Tasks:**

- `.github/workflows/ci.yml`
- Node: ESLint, TypeScript, Jest
- Python: Ruff, MyPy, Pytest
- Schema validation against examples
- Publish workflow with provenance

---

## Issue #17: Security: threat model (STRIDE) & mitigations

**Labels:** `security`, `spec`

**Goal:** Модель угроз: spoofing, tampering, replay, consent-bypass, privacy leaks.

**Acceptance:** Таблица рисков + меры (nonce, exp, JTI, DP-параметры).

**Description:**

STRIDE threat analysis for LRI:

| Threat | Risk | Mitigation |
|--------|------|------------|
| **Spoofing** | High | JWS signatures, PKI |
| **Tampering** | High | JCS canonicalization, signatures |
| **Repudiation** | Medium | Audit log, non-repudiation |
| **Info disclosure** | High | Consent policy, encryption |
| **DoS** | Medium | Rate limiting, TTL |
| **Elevation** | Low | Least privilege, consent checks |

Add to `/docs/security/THREAT-MODEL.md`

---

## Issue #18: Benchmarks: HTTP/WS overhead (JSON vs CBOR)

**Labels:** `perf`

**Goal:** Замеры накладных расходов LCE: размер/латентность/CPU.

**Acceptance:** Отчёт + диаграммы, целевые бюджеты.

**Description:**

Performance benchmarks:

1. **Size overhead**
   - Plain JSON: 100 bytes
   - With LCE (JSON): +80 bytes (180 total)
   - With LCE (CBOR): +50 bytes (150 total)

2. **Latency**
   - Parse time: <1ms
   - Validation: <2ms
   - Signature verify: <5ms

3. **CPU**
   - Overhead per request: <5%

Target: <10% overhead for 95th percentile.

---

## Issue #19: Docs site (Docusaurus) + versioned specs

**Labels:** `docs`

**Goal:** Сайт `/docs` с версионированием: RFC-000, LCE-schema, SDK-гайды, FAQ.

**Acceptance:** Автодеплой на GitHub Pages.

**Structure:**

```
docs/
  ├── intro.md
  ├── concepts/
  │   ├── layer-8.md
  │   ├── lce.md
  │   ├── lhs.md
  │   └── ltp.md
  ├── guides/
  │   ├── quickstart.md
  │   ├── node-sdk.md
  │   ├── python-sdk.md
  │   └── websockets.md
  ├── api/
  └── rfcs/
      └── rfc-000.md
```

---

## Issue #20: Versioning & media types policy

**Labels:** `spec`

**Goal:** Семвер для схем и SDK, стратегия деградации, совместимость с `+json`/`+cbor`.

**Acceptance:** Таблица совместимости.

**Description:**

Versioning strategy:

| Version | Schema | SDK | Breaking Changes |
|---------|--------|-----|------------------|
| 0.1.x | v1 | alpha | Allowed |
| 0.2.x | v1 | beta | Minimized |
| 1.0.x | v1 | stable | Never* |

**Media type negotiation:**
```http
Accept: application/liminal.lce+json; version=1
Accept: application/liminal.lce+cbor; version=1
```

**Degradation:** Older clients ignore new optional fields.

---

## Issue #21: Governance: RFC-процесс (ADR/RFC шаблоны)

**Labels:** `process`

**Goal:** Шаблоны RFC/ADR, правила принятия изменений, роли мейнтейнеров.

**Acceptance:** `.github/ISSUE_TEMPLATE/rfc.md`, `CONTRIBUTING.md`.

**Description:**

Establish governance:

1. **RFC process** - for major changes
2. **ADR (Architecture Decision Records)** - for design choices
3. **Maintainer roles** - committers, reviewers, BDFL
4. **Contribution guidelines** - code style, review process

Templates:
- `.github/ISSUE_TEMPLATE/rfc.md`
- `.github/ISSUE_TEMPLATE/adr.md`

---

## Issue #22: README v1 — позиционирование и быстрый старт

**Labels:** `docs`, `good first issue`

**Goal:** Чёткий README: что такое LRI, зачем, demo-скрин, установка, quickstart.

**Acceptance:** Copy-paste пример Express и FastAPI, ссылки на demo.

**Structure:**

1. **What is LRI?** - Layer 8 for human-AI communication
2. **Why?** - Intent, affect, consent, coherence
3. **Quick start** - Express + FastAPI examples
4. **Demo** - Link to interactive demo
5. **Documentation** - Links to guides
6. **Contributing** - How to get involved

Target: Developers understand LRI in <2 minutes.

---

## Summary

**Total issues:** 22

**Categories:**
- **Spec/RFC:** 6 issues (#1, #2, #3, #4, #17, #20)
- **SDK:** 5 issues (#5, #6, #7, #8, #14)
- **Runtime/Infra:** 4 issues (#10, #11, #16, #18)
- **Security:** 2 issues (#8, #13)
- **Tooling:** 2 issues (#9, #15)
- **Docs/Demo:** 3 issues (#12, #19, #22)

**Priority:**
- **P0 (Critical):** #1, #2, #5, #6, #22
- **P1 (High):** #3, #4, #7, #16, #19
- **P2 (Medium):** #8, #10, #12, #13, #14, #15, #17, #20, #21
- **P3 (Low):** #9, #11, #18

---

**Next steps:**
1. Copy each issue to GitHub
2. Add appropriate labels
3. Assign to milestones (v0.1, v0.2, v1.0)
4. Start with P0 issues
