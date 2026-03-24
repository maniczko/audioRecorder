#!/bin/bash
#
# setup-github-auth.sh — Konfiguracja autoryzacji GitHub
#
# Opcje:
#   ./scripts/setup-github-auth.sh          # interaktywny
#   ./scripts/setup-github-auth.sh --token  # konfiguracja tokena
#   ./scripts/setup-github-auth.sh --ssh    # konfiguracja SSH
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

REPO_URL="https://github.com/maniczko/audioRecorder"

show_menu() {
    echo ""
    echo "════════════════════════════════════════"
    echo "   GitHub Authorization Setup"
    echo "════════════════════════════════════════"
    echo ""
    echo "Wybierz metodę autoryzacji:"
    echo ""
    echo "  1) 🔑 GitHub Personal Access Token (HTTPS)"
    echo "  2) 🗝️  SSH Key (zalecane)"
    echo "  3) 🧪 Test connection"
    echo "  4) ❌ Anuluj"
    echo ""
}

setup_token_auth() {
    echo ""
    log_info "Konfiguracja GitHub Personal Access Token"
    echo ""
    echo "Instrukcja:"
    echo "  1. Wejdź na: https://github.com/settings/tokens"
    echo "  2. Kliknij 'Generate new token (classic)'"
    echo "  3. Zaznacz uprawnienia:"
    echo "     ✓ repo (Full control of private repositories)"
    echo "     ✓ workflow (Update GitHub Action workflows)"
    echo "  4. Skopiuj wygenerowany token"
    echo ""
    
    read -p "Wklej swój GitHub token: " -s GH_TOKEN
    echo ""
    
    if [ -z "$GH_TOKEN" ]; then
        log_error "Token nie może być pusty!"
        return 1
    fi
    
    # Zapisz token w git credential helper
    log_info "Konfigurowanie Git Credential Manager..."
    
    # Sprawdź czy remote używa HTTPS
    CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
    
    if echo "$CURRENT_REMOTE" | grep -q "git@"; then
        log_warning "Remote używa SSH. Zmieniam na HTTPS..."
        git remote set-url origin "$REPO_URL"
    fi
    
    # Windows: użyj Git Credential Manager
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        log_info "Windows detected — konfiguracja Git Credential Manager"
        echo ""
        log_warning "Teraz przy następnym push Git poprosi o token i zapamięta go."
        echo ""
        log_info "Możesz też ustawić token w zmiennej środowiskowej:"
        echo "   setx GH_TOKEN \"twój_token\""
    else
        # Linux/Mac: zapisz w credential helper
        git config --global credential.helper store
        log_info "Credential helper ustawiony na 'store'"
    fi
    
    log_success "Token skonfigurowany!"
    log_warning "Token jest zapisany lokalnie. Nie udostępniaj go nikomu."
}

setup_ssh_auth() {
    echo ""
    log_info "Konfiguracja klucza SSH"
    echo ""
    
    # Sprawdź czy klucz już istnieje
    if [ -f ~/.ssh/id_ed25519.pub ]; then
        log_warning "Klucz SSH już istnieje: ~/.ssh/id_ed25519.pub"
        read -p "Wygenerować nowy? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Używam istniejącego klucza"
        else
            ssh-keygen -t ed25519 -C "github-$(date +%Y%m%d)"
        fi
    else
        log_info "Generowanie nowego klucza SSH..."
        ssh-keygen -t ed25519 -C "github-$(date +%Y%m%d)"
    fi
    
    # Wyświetl klucz publiczny
    echo ""
    log_info "Twój klucz publiczny:"
    echo "─────────────────────────────────────────"
    cat ~/.ssh/id_ed25519.pub
    echo "─────────────────────────────────────────"
    echo ""
    
    log_info "Instrukcja dodania klucza do GitHub:"
    echo "  1. Skopiuj powyższy klucz (całą linię od 'ssh-ed25519')"
    echo "  2. Wejdź na: https://github.com/settings/keys"
    echo "  3. Kliknij 'New SSH key'"
    echo "  4. Wklej klucz i zapisz"
    echo ""
    
    read -p "Naciśnij Enter gdy dodasz klucz do GitHub..."
    
    # Zmień remote na SSH
    SSH_URL="git@github.com:maniczko/audioRecorder.git"
    git remote set-url origin "$SSH_URL" 2>/dev/null || git remote add origin "$SSH_URL"
    
    log_info "Remote URL zmieniony na: $SSH_URL"
    
    # Test połączenia
    test_ssh_connection
}

test_ssh_connection() {
    echo ""
    log_info "Testowanie połączenia SSH z GitHub..."
    
    if ssh -T -o BatchMode=yes -o ConnectTimeout=5 git@github.com 2>&1 | grep -q "successfully authenticated"; then
        log_success "Połączenie SSH działa!"
    else
        log_warning "Połączenie SSH nie powiodło się."
        log_info "Sprawdź:"
        echo "  1. Czy klucz jest dodany do GitHub: https://github.com/settings/keys"
        echo "  2. Czy ssh-agent działa: eval \"\$(ssh-agent -s)\""
        echo "  3. Dodaj klucz do agenta: ssh-add ~/.ssh/id_ed25519"
    fi
}

test_connection() {
    echo ""
    log_info "Testowanie połączenia z GitHub..."
    
    REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
    
    if [ -z "$REMOTE_URL" ]; then
        log_error "Brak skonfigurowanego remote 'origin'"
        return 1
    fi
    
    log_info "Remote URL: $REMOTE_URL"
    
    # Sprawdź czy można fetchować
    if git fetch --dry-run origin 2>/dev/null; then
        log_success "Połączenie z GitHub działa!"
        
        # Pokaż aktualny status
        echo ""
        log_info "Status brancha:"
        git status --short
        git branch -vv
    else
        log_error "Nie można połączyć z GitHub"
        log_info "Sprawdź:"
        echo "  - Czy masz dostęp do internetu"
        echo "  - Czy token/klucz SSH jest poprawny"
        echo "  - Czy repozytorium istnieje: $REPO_URL"
    fi
}

# Main script
case "$1" in
    --token)
        setup_token_auth
        ;;
    --ssh)
        setup_ssh_auth
        ;;
    --test)
        test_connection
        ;;
    *)
        while true; do
            show_menu
            read -p "Wybierz opcję: " choice
            case $choice in
                1) setup_token_auth ;;
                2) setup_ssh_auth ;;
                3) test_connection ;;
                4) log_info "Anulowano"; exit 0 ;;
                *) log_error "Nieprawidłowy wybór" ;;
            esac
        done
        ;;
esac

log_success "Konfiguracja zakończona!"
