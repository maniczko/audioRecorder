#!/bin/bash
#
# prepare-push.sh — Automatyczne przygotowanie commita i pusha
#
# Użycie:
#   ./scripts/prepare-push.sh                    # commit wszystkich zmian
#   ./scripts/prepare-push.sh "custom message"   # własny commit message
#   ./scripts/prepare-push.sh --dry-run          # podgląd bez commita
#
# Wymagania:
#   - Git zainstalowany
#   - Autoryzacja GitHub (token lub SSH)
#

set -e

# Kolory dla outputu
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funkcje pomocnicze
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Sprawdź czy jesteśmy w repo Git
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Nie jesteś w repozytorium Git!"
    exit 1
fi

# Pobierz aktualny branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log_info "Current branch: $CURRENT_BRANCH"

# Sprawdź status
log_info "Sprawdzanie statusu Git..."
git status --short

# Dry run mode
if [ "$1" == "--dry-run" ]; then
    log_warning "Tryb podglądu — bez commita"
    echo ""
    log_info "Pliki do commita:"
    git status --short
    echo ""
    log_info "Ostatnie commity:"
    git log -n 3 --oneline
    exit 0
fi

# Sprawdź czy są zmiany do commita
CHANGES=$(git status --short)
if [ -z "$CHANGES" ]; then
    log_warning "Brak zmian do commita!"
    exit 0
fi

# Commit message
COMMIT_MSG="$1"

# Jeśli brak custom message, wygeneruj automatyczny
if [ -z "$COMMIT_MSG" ]; then
    # Sprawdź jakie pliki są zmienione
    if echo "$CHANGES" | grep -q "TASK_QUEUE.md"; then
        COMMIT_MSG="chore: update task queue with performance optimizations"
    elif echo "$CHANGES" | grep -q "\.github/workflows/"; then
        COMMIT_MSG="ci: update GitHub Actions workflows"
    elif echo "$CHANGES" | grep -q "src/"; then
        COMMIT_MSG="feat: frontend updates"
    elif echo "$CHANGES" | grep -q "server/"; then
        COMMIT_MSG="feat: backend updates"
    else
        COMMIT_MSG="chore: project updates"
    fi
    log_info "Auto-generated commit message: $COMMIT_MSG"
fi

# Dodaj wszystkie zmiany
log_info "Dodawanie zmian..."
git add -A

# Sprawdź czy coś zostało dodane
if git diff --cached --quiet; then
    log_warning "Brak zmian do commita (po git add)"
    exit 0
fi

# Pokaż co będzie commitowane
echo ""
log_info "Zmiany do commita:"
git diff --cached --stat
echo ""

# Potwierdzenie (można pominąć z --no-confirm)
if [ "$2" != "--no-confirm" ]; then
    read -p "Kontynuować commit? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "Anulowane przez użytkownika"
        git reset HEAD > /dev/null 2>&1
        exit 0
    fi
fi

# Commit
log_info "Tworzenie commita..."
git commit -m "$COMMIT_MSG"

# Sprawdź czy remote jest dostępny
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE_URL" ]; then
    log_error "Brak zdalnego repozytorium 'origin'"
    log_info "Dodaj remote: git remote add origin <URL>"
    exit 1
fi

# Sprawdź autoryzację
log_info "Sprawdzanie autoryzacji..."
if echo "$REMOTE_URL" | grep -q "https://github.com"; then
    log_info "Remote: GitHub (HTTPS)"
    log_warning "Upewnij się że masz skonfigurowany Git Credential Manager lub token"
elif echo "$REMOTE_URL" | grep -q "git@"; then
    log_info "Remote: GitHub (SSH)"
    log_warning "Upewnij się że masz dodany klucz SSH do GitHub"
fi

# Pytanie o push
echo ""
read -p "Wypchnąć zmiany na remote? [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Pushowanie na branch: $CURRENT_BRANCH"
    
    # Sprawdź czy trzeba zrobić pull first
    git fetch origin
    LOCAL=$(git rev-parse @)
    REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
    
    if [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
        log_warning "Twój branch diverged od remote!"
        log_info "Najpierw zrób: git pull --rebase"
        echo ""
        read -p "Zrobić git pull --rebase teraz? [y/N]: " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git pull --rebase
        else
            log_warning "Anulowano push. Zrób pull ręcznie."
            exit 0
        fi
    fi
    
    log_info "Uruchamianie release guard (testy krytyczne + build)..."
    if ! pnpm run test:release:guard; then
        log_error "Release guard nie przeszedl. Push zostal zablokowany."
        exit 1
    fi

    # Push
    if git push origin "$CURRENT_BRANCH"; then
        log_success "Push zakończony sukcesem!"
        echo ""
        log_info "URL do commita:"
        git log -n 1 --format="https://github.com/maniczko/audioRecorder/commit/%H"
    else
        log_error "Push nie powiódł się!"
        log_info "Sprawdź autoryzację lub spróbuj ręcznie: git push"
        exit 1
    fi
else
    log_warning "Anulowano push"
    log_info "Zmiany są commitowane lokalnie. Push możesz zrobić ręcznie: git push"
fi

echo ""
log_success "Gotowe!"
