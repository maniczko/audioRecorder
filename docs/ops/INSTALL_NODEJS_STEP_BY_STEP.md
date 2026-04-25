# 📥 INSTALACJA NODE.JS 22.x - KROK PO KROKU

## KROK 1: Odinstaluj Node.js 24.x

### Metoda A: Przez Panel Sterowania (najłatwiej)

1. **Naciśnij klawisz Windows + R**
2. **Wpisz:** `appwiz.cpl`
3. **Naciśnij ENTER**
4. **Znajdź na liście:** `Node.js` (może być v24.x.x)
5. **Kliknij prawym przyciskiem** → **Odinstaluj**
6. **Potwierdź** odinstalowanie
7. **Poczekaj** aż proces się zakończy

### Metoda B: Przez Ustawienia Windows

1. **Start** → **Ustawienia** (koło zębate)
2. **Aplikacje** → **Aplikacje i funkcje**
3. **Wyszukaj:** `Node.js`
4. **Kliknij** trzy kropki **...**
5. **Wybierz:** **Odinstaluj**

---

## KROK 2: Pobierz Node.js 22.x

### Opcja A: Kliknij i pobierz (najłatwiej)

**Kliknij ten link:**

```
https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi
```

Plik zapisze się w folderze **Pobrane**.

### Opcja B: Przez przeglądarkę

1. Otwórz: https://nodejs.org/en/download/
2. Kliknij zielony przycisk **"Node.js 22.x LTS"**
3. Pobierze się plik `.msi`

---

## KROK 3: Zainstaluj Node.js 22.x

1. **Otwórz folder Pobrane**
2. **Znajdź plik:** `node-v22.14.0-x64.msi`
3. **Kliknij dwukrotnie**
4. **Kliknij:** **Next** → **Next**
5. **Zaznacz:** "Automatically install necessary tools" (opcjonalnie)
6. **Kliknij:** **Install**
7. **Poczekaj** (~30 sekund)
8. **Kliknij:** **Finish**

---

## KROK 4: Restart komputera (WAŻNE!)

**Zrestartuj komputer** aby zmiany zostały zastosowane.

---

## KROK 5: Sprawdź wersję

1. **Otwórz nowy terminal** (ważne - nie stary!)
2. **Wpisz:**
   ```bash
   node --version
   ```
3. **Powinno być:** `v22.14.0`

Jeśli widzisz `v22.14.0` - **gratulacje!** ✅

Jeśli nadal widzisz `v24.x.x`:

- Zamknij **wszystkie** terminale
- Otwórz **nowy** terminal
- Spróbuj ponownie

---

## KROK 6: Uruchom VoiceLog OS

### Opcja A: Uruchom skrypt

1. Otwórz folder: `c:\Users\user\new\audioRecorder`
2. **Kliknij dwukrotnie:** `start.bat`

### Opcja B: Ręcznie

**Terminal 1 - Backend:**

```bash
cd c:\Users\user\new\audioRecorder
pnpm run start:server
```

**Terminal 2 - Frontend:**

```bash
cd c:\Users\user\new\audioRecorder
pnpm start
```

---

## KROK 7: Sprawdź czy działa

### Frontend:

Otwórz w przeglądarce:

```
http://localhost:3000
```

### Backend:

Otwórz w przeglądarce:

```
http://127.0.0.1:4000/health
```

**Powinno zwrócić:**

```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

## 🐛 ROZWIĄZYWANIE PROBLEMÓW

### Problem: "node nie jest rozpoznawany"

**Rozwiązanie:**

1. Zamknij terminal
2. Otwórz **NOWY** terminal
3. Spróbuj ponownie

### Problem: "v24.x nadal"

**Rozwiązanie:**

1. Zrestartuj komputer (ważne!)
2. Otwórz nowy terminal
3. Sprawdź: `node --version`

### Problem: "Port 3000 zajęty"

**Rozwiązanie:**

```bash
# Zabij proces na porcie 3000
netstat -ano | findstr :3000
taskkill /F /PID <NUMER_Z_PRAWA>
```

### Problem: "Brak uprawnień"

**Rozwiązanie:**

1. Kliknij prawym na terminal
2. **Uruchom jako administrator**

---

## ✅ GOTOWE!

Gdy widzisz `v22.14.0` i oba serwery działają:

1. ✅ Otwórz http://localhost:3000
2. ✅ Zaloguj się
3. ✅ Importuj nagranie
4. ✅ Ciesz się transkrypcją!

---

## 📞 POTRZEBUJESZ POMOCY?

Jeśli utknąłeś na którymś kroku:

1. Zrób zrzut ekranu (Windows + Shift + S)
2. Wyślij mi informację gdzie utknąłeś
3. Pomogę rozwiązać problem!
