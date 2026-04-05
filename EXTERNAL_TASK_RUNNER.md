# External Task Runner

Ten runner jest przeznaczony do uruchamiania poza GitHub Actions jako osobny proces.

## Co robi

1. Czyta `TASK_QUEUE.md`.
2. Automatycznie przypisuje brakujących właścicieli do zadań `todo`.
3. Szuka zadań `todo` z przypisanym agentem i bez wcześniejszego dispatchu.
4. Wysyła zadanie do webhooka agenta albo odpala lokalną komendę.
5. Dopisuje do `TASK_QUEUE.md` ślad:
   - `Dispatch status`
   - `Dispatch time`
   - `Dispatch target`

## Start

```bash
pnpm run tasks:runner
```

Domyślnie runner robi jeden cykl na starcie i potem odpytuje kolejkę co 2 godziny.

## Ważne zmienne środowiskowe

### Interwał i tryb

```bash
TASK_RUNNER_INTERVAL_MS=7200000
TASK_RUNNER_ONCE=false
TASK_RUNNER_COMMAND_TIMEOUT_MS=900000
```

### Webhook per agent

```bash
TASK_AGENT_CODEX_WEBHOOK_URL=https://your-runner.example/codex
TASK_AGENT_QWEN_WEBHOOK_URL=https://your-runner.example/qwen
```

### Local command per agent

Jeśli nie używasz webhooka, możesz podać komendę.

```bash
TASK_AGENT_CODEX_COMMAND=python external/codex_runner.py
TASK_AGENT_QWEN_COMMAND=python external/qwen_runner.py
```

Komenda dostaje dane zadania przez env:

```bash
TASK_RUNNER_TASK_ID
TASK_RUNNER_AGENT
TASK_RUNNER_TASK_FILE
TASK_RUNNER_TASK_TITLE
```

`TASK_RUNNER_TASK_FILE` wskazuje na tymczasowy plik JSON z pełnym payloadem zadania.

## Ograniczenie

Ten runner nie “uruchamia Codexa z powietrza”. On potrzebuje prawdziwego targetu:
- webhooka, który wywoła Twojego agenta,
- albo lokalnej komendy/CLI, która umie przejąć zadanie.

Repo dostarcza więc gotowy orchestrator zewnętrzny, ale nie zawiera sekretnych kluczy ani prywatnego runtime Twojego agenta.
