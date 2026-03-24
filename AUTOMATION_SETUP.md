# 🤖 GitHub Automation Setup

Kompleksowa automatyzacja commitów, pushy i CI/CD dla audioRecorder.

---

## 📋 Spis treści

1. [Szybki start](#szybki-start)
2. [Autoryzacja GitHub](#autoryzacja-github)
3. [Skrypty automatyzujące](#skrypty-automatyzujące)
4. [GitHub Actions](#github-actions)
5. [Rozwiązywanie problemów](#rozwiązywanie-problemów)

---

## 🚀 Szybki start

### Krok 1: Skonfiguruj autoryzację

```bash
# Windows (Git Bash)
./scripts/setup-github-auth.sh

# Lub wybierz metodę:
./scripts/setup-github-auth.sh --token   # Personal Access Token
./scripts/setup-github-auth.sh --ssh     # SSH Key (zalecane)
```

### Krok 2: Przygotuj i wypchnij zmiany

```bash
# Interaktywnie (z potwierdzeniem)
./scripts/prepare-push.sh "feat: added performance optimization tasks"

# Automatycznie (bez potwierdzenia)
./scripts/prepare-push.sh "chore: update task queue" --no-confirm

# Podgląd zmian (bez commita)
./scripts/prepare-push.sh --dry-run
```

---

## 🔐 Autoryzacja GitHub

### Opcja 1: Personal Access Token (HTTPS)

**Jak uzyskać token:**

1. Wejdź na https://github.com/settings/tokens
2. Kliknij **Generate new token (classic)**
3. Nadaj nazwę: `audioRecorder-automation`
4. Zaznacz uprawnienia:
   - ✅ `repo` — Full control of private repositories
   - ✅ `workflow` — Update GitHub Action workflows
   - ✅ `read:org` — Read org membership (opcjonalne)
5. Kliknij **Generate token**
6. **Skopiuj token** (pokazany tylko raz!)

**Konfiguracja:**

```bash
# Windows PowerShell
$env:GH_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
git config --global credential.helper wincred

# Git Bash / Linux
export GH_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
git config --global credential.helper store
```

### Opcja 2: SSH Key (zalecane)

**Generowanie klucza:**

```bash
# Nowy klucz ed25519
ssh-keygen -t ed25519 -C "github-$(date +%Y%m%d)"

# Lub starszy RSA (jeśli ed25519 nie działa)
ssh-keygen -t rsa -b 4096 -C "github-$(date +%Y%m%d)"
```

**Dodaj klucz do GitHub:**

1. Skopiuj klucz publiczny:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   # lub Windows:
   type %USERPROFILE%\.ssh\id_ed25519.pub
   ```

2. Wejdź na https://github.com/settings/keys
3. Kliknij **New SSH key**
4. Wklej klucz i zapisz

**Test połączenia:**

```bash
ssh -T git@github.com
# Powinno wyświetlić: "Hi maniczko! You've successfully authenticated..."
```

---

## 📜 Skrypty automatyzujące

### `prepare-push.sh`

Automatyczne przygotowanie commita i pusha.

**Użycie:**

```bash
# Podstawowe
./scripts/prepare-push.sh

# Z custom commit message
./scripts/prepare-push.sh "fix: resolved merge conflicts"

# Bez potwierdzenia (CI/CD)
./scripts/prepare-push.sh "chore: automated update" --no-confirm

# Podgląd (dry-run)
./scripts/prepare-push.sh --dry-run
```

**Auto-generowanie commit message:**

Skrypt automatycznie wykrywa typ zmian:

| Zmienione pliki | Commit message |
|-----------------|----------------|
| `TASK_QUEUE.md` | `chore: update task queue` |
| `.github/workflows/` | `ci: update workflows` |
| `src/` | `feat: frontend updates` |
| `server/` | `feat: backend updates` |
| Inne | `chore: project updates` |

### `setup-github-auth.sh`

Interaktywna konfiguracja autoryzacji.

**Opcje:**

```bash
# Interaktywny menu
./scripts/setup-github-auth.sh

# Token setup
./scripts/setup-github-auth.sh --token

# SSH setup
./scripts/setup-github-auth.sh --ssh

# Test połączenia
./scripts/setup-github-auth.sh --test
```

---

## ⚙️ GitHub Actions

### `auto-push.yml`

Workflow do automatycznego commit i push przez GitHub Actions.

**Uruchomienie ręczne:**

1. Wejdź na https://github.com/maniczko/audioRecorder/actions
2. Wybierz **Auto Commit & Push**
3. Kliknij **Run workflow**
4. Wypełnij:
   - **Commit message**: (opcjonalne)
   - **Branch**: `main` (domyślnie)
5. Kliknij **Run workflow**

**Wywołanie z innego workflow:**

```yaml
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      
      - name: Make changes
        run: |
          echo "new content" >> file.txt
      
      - name: Auto commit and push
        uses: ./.github/workflows/auto-push.yml
        with:
          commit_message: "chore: automated update"
          branch: "main"
```

### `gpt-fix.yml`

Automatyczna naprawa failing CI tests z AI.

**Jak działa:**

1. CI wykrywa błędy
2. `ci-failure-triage.yml` tworzy issue
3. `gpt-fix.yml` analizuje błędy i sugeruje poprawki
4. Tworzony jest automaticzny PR

**Ręczne uruchomienie:**

1. Actions → **GPT Auto-Fix** → **Run workflow**
2. Wypełnij:
   - **Issue number**: numer zadania do naprawy
   - **Issue title**: tytuł błędu
   - **Issue body**: logi błędów

---

## 🔧 Rozwiązywanie problemów

### `git push` nie działa

**Problem:**
```
remote: Support for password authentication was removed
```

**Rozwiązanie:**

```bash
# Windows - wyczyść stare credentials
git credential-manager erase
# Wklej: protocol=https, host=github.com

# Ustaw nowy token
git config --global credential.helper wincred
git push
# Wklej token gdy poprosi
```

### `Permission denied (publickey)`

**Problem:**
```
git@github.com: Permission denied (publickey).
```

**Rozwiązanie:**

```bash
# Sprawdź czy ssh-agent działa
eval "$(ssh-agent -s)"

# Dodaj klucz do agenta
ssh-add ~/.ssh/id_ed25519

# Sprawdź czy klucz jest w GitHub
ssh -T git@github.com
```

### Branch diverged

**Problem:**
```
Your branch and 'origin/main' have diverged
```

**Rozwiązanie:**

```bash
# Opcja 1: Rebase (zachowuje liniową historię)
git pull --rebase
git push

# Opcja 2: Merge (zachowuje merge commit)
git pull
git push

# Opcja 3: Reset do remote (utrata lokalnych commitów!)
git fetch origin
git reset --hard origin/main
```

### Workflow nie działa

**Problem:**
GitHub Actions nie uruchamia się.

**Rozwiązanie:**

1. Sprawdź uprawnienia:
   - Settings → Actions → General
   - ✅ Allow all actions and reusable workflows

2. Sprawdź secrets:
   - Settings → Secrets and variables → Actions
   - Upewnij się że `GITHUB_TOKEN` jest dostępny

3. Sprawdź branch protection:
   - Settings → Branches → main → Edit
   - Jeśli wymagany PR, wyłącz dla automation

---

## 📊 Best Practices

### ✅ Commit messages

Stosuj Conventional Commits:

```
feat: new feature
fix: bug fix
docs: documentation update
chore: maintenance task
test: adding tests
refactor: code restructuring
```

### ✅ Push frequency

- **Lokalnie**: commituj często, pushuj co większe zmiany
- **CI/CD**: automatyczne pushy po testach

### ✅ Security

- Nigdy nie commituj `.env`, tokenów, haseł
- Używaj `.gitignore`
- Regularnie rotuj tokeny GitHub

---

## 🎯 Przykłady użycia

### Codzienna praca

```bash
# Rano: pull najnowszych zmian
git pull --rebase

# Po zmianach: commit i push
./scripts/prepare-push.sh "feat: added new feature"

# Wieczorem: sprawdź status
git status
git branch -vv
```

### Hotfix production

```bash
# Szybki fix
./scripts/prepare-push.sh "fix: critical production issue" --no-confirm

# Lub przez GitHub Actions:
# Actions → Auto Commit & Push → Run workflow
```

### Duże zmiany

```bash
# Nowy branch
git checkout -b feature/new-feature

# Praca i commity
# ... code changes ...
./scripts/prepare-push.sh "feat: wip new feature"

# Push brancha
git push -u origin feature/new-feature

# Po zakończeniu: PR przez GitHub UI
```

---

## 📞 Support

Jeśli napotkasz problemy:

1. Sprawdź logi: `git log --oneline -10`
2. Test connection: `./scripts/setup-github-auth.sh --test`
3. GitHub Status: https://www.githubstatus.com/

---

**Ostatnia aktualizacja:** 2026-03-24
