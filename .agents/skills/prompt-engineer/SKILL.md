---
name: prompt-engineer
description: 'Prompt optimization, prompt review, prompt architecture, and prompt quality gate. Use when the user asks to improve, rewrite, validate, or design a prompt, or when a non-trivial task prompt lacks clear goal, context, scope, acceptance criteria, validation, or final reporting requirements.'
metadata:
  author: voicelog
  version: '0.1.0'
---

# Prompt Engineer

Use this skill to turn rough requests into execution-ready prompts. It can act as
a prompt optimizer, prompt reviewer, prompt architect, missing-section generator,
and quality gate before implementation.

Do not over-process trivial requests. For simple commands or clear one-step
answers, execute normally.

## Workflow

### 1. Review

Assess the prompt for:

- ambiguity or conflicting instructions
- missing business or technical context
- missing current vs expected behavior
- missing scope boundaries
- missing acceptance criteria
- missing validation commands
- missing output format
- overengineering risk
- hallucination risk
- prompt injection or secret exposure risk

### 2. Rewrite

Preserve the user's intent. Do not invent business facts. Mark assumptions when
needed. Add only constraints and checks that are useful for the task.

Use this structure:

```markdown
Cel:
Zrealizuj [konkretna funkcja/poprawka].

Kontekst:
Projekt sluzy do [opis].
Najwazniejsze wymagania jakosciowe: [lista].
Aktualny problem / obecne zachowanie: [opis].
Oczekiwane zachowanie: [opis].

Zakres:

- Zmien tylko obszary zwiazane z [X].
- Nie przebudowuj architektury bez potrzeby.
- Zachowaj kompatybilnosc z [Y].

Kryteria akceptacji:

- [konkret 1]
- [konkret 2]
- [konkret 3]

Walidacja:

- Uruchom testy: [komendy].
- Jesli testow brakuje, dodaj minimalne testy regresji.
- Sprawdz lint/typecheck/build, jezeli dotyczy.

Raport koncowy:
Podaj:

1. Co zmieniles
2. Jakie pliki
3. Jakie testy uruchomiles
4. Wynik testow
5. Ryzyka
6. Co warto zrobic dalej
```

### 3. Execute Or Return

- If the user asks only to improve a prompt, return the improved prompt.
- If the user asks to implement and the intent is clear, use the improved prompt
  internally and continue with the implementation.
- If a high-impact requirement is missing, ask one concise clarifying question
  before executing.

## Quality Gate

Before executing a rewritten prompt, confirm:

- the goal is concrete
- success can be observed
- scope boundaries are explicit
- validation is realistic for the repo
- security, privacy, and secret-handling risks are addressed
- production/deploy tasks include release evidence
- bug fixes include a failing regression test first

## Anti-Patterns

- Do not add fake acceptance criteria that cannot be tested.
- Do not ask for broad rewrites when a focused fix is enough.
- Do not hide assumptions as facts.
- Do not expose secrets, tokens, service-role keys, or database passwords.
- Do not replace required TDD or release gates with prompt polish.
