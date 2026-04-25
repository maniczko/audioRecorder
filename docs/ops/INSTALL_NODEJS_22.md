# 📥 Instalacja Node.js 22.x

## Projektowy pin runtime

Ten projekt jest przypiety do Node.js 22.x:

- `package.json` deklaruje `engines.node = 22.x`
- `.nvmrc` wskazuje `22`
- `.node-version` wskazuje `22`

Jesli uzywasz menedzera wersji:

```bash
nvm use
```

albo:

```bash
fnm use
```

Po przelaczeniu wersji sprawdz:

```bash
node --version
# Oczekiwane: v22.x
```

---

## Automatyczna instalacja (PowerShell)

### Krok 1: Pobierz i zainstaluj Node.js 22.x

Otwórz **PowerShell jako Administrator** i uruchom:

```powershell
# Pobierz Node.js 22.x LTS (Windows Installer)
$installerUrl = "https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi"
$installerPath = "$env:TEMP\node-v22.14.0-x64.msi"

Write-Host "Pobieranie Node.js 22.14.0 LTS..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath

Write-Host "Instalacja Node.js 22.14.0..." -ForegroundColor Cyan
Start-Process msiexec.exe -Wait -ArgumentList "/i $installerPath /quiet"

Write-Host "✅ Instalacja zakończona!" -ForegroundColor Green
Write-Host "⚠️  Zamknij wszystkie terminale i otwórz nowy!" -ForegroundColor Yellow
```

### Krok 2: Sprawdź wersję

Otwórz **nowy terminal** (ważne!) i sprawdź:

```bash
node --version
# Powinno być: v22.14.0
```

---

## Ręczna instalacja (przez przeglądarkę)

### Krok 1: Pobierz

Wejdź na: https://nodejs.org/en/download/

Lub bezpośrednio:

- **Node.js 22.14.0 LTS**: https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi

### Krok 2: Zainstaluj

1. Uruchom pobrany plik `.msi`
2. Kliknij "Next" → "Next" → "Install"
3. Zaznacz "Automatically install necessary tools" (opcjonalnie)
4. Poczekaj na zakończenie instalacji

### Krok 3: Restart

**WAŻNE:** Zamknij wszystkie terminale i otwórz nowy!

### Krok 4: Sprawdź

```bash
node --version
# Powinno być: v22.14.0

npm --version
# Powinno być: 10.x.x
```

---

## Odinstalowanie Node.js 24.x (opcjonalne)

Jeśli chcesz najpierw odinstalować 24.x:

1. Otwórz **Panel Sterowania** → **Programy i funkcje**
2. Znajdź "Node.js"
3. Kliknij "Odinstaluj"
4. Zainstaluj 22.x jak wyżej

---

## Weryfikacja

Po instalacji sprawdź:

```bash
# Wersja Node.js
node --version
# ✅ Powinno być: v22.14.0

# Wersja npm
npm --version
# ✅ Powinno być: 10.x.x

# Wersja pnpm
pnpm --version
# ✅ Powinno być: 9.12.1
```

---

## Następne kroki

Gdy już masz Node.js 22.x:

```bash
# 1. Przejdź do projektu
cd c:\Users\user\new\audioRecorder

# 2. Zainstaluj zależności (jeśli trzeba)
pnpm install

# 3. Uruchom backend
pnpm run start:server

# 4. W drugim terminalu uruchom frontend
pnpm start
```

---

## Problemy?

### "node nie jest rozpoznawany"

**Rozwiązanie:**

1. Zamknij terminal
2. Otwórz nowy terminal
3. Spróbuj ponownie

### "Access denied"

**Rozwiązanie:**

1. Uruchom PowerShell jako **Administrator**
2. Spróbuj ponownie

### "Port 4000 zajęty"

**Rozwiązanie:**

```bash
# Zabij proces na porcie 4000
netstat -ano | findstr :4000
taskkill /F /PID <PID>
```
