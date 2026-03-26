import time
import subprocess
import re
from pathlib import Path
from datetime import datetime

TASK_QUEUE_FILE = Path("TASK_QUEUE.md")
TASK_DONE_FILE = Path("TASK_DONE.md")
INTERVAL_SECONDS = 3600  # Odpytywanie co 60 minut

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")

def get_first_todo_task():
    """
    Parsuje TASK_QUEUE.md, szukając pierwszego zadania oznaczonego jako `todo`.
    Spodziewany format: - `ID` [P1] `todo` - Nazwa zadania
    Zbiera też zagnieżdżone linie (np. - Cel:, - Zakres:).
    Zwraca: (task_text, task_lines_start, task_lines_end) lub None
    """
    if not TASK_QUEUE_FILE.exists():
        return None

    with open(TASK_QUEUE_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()

    task_start = -1
    task_end = -1
    task_lines = []
    
    # Regex szukający początku zadania: np. - `412` [P1] `todo` - ...
    todo_pattern = re.compile(r"^-\s+`\d+`\s+\[P\d+\]\s+`todo`", re.IGNORECASE)

    for i, line in enumerate(lines):
        if task_start == -1:
            if todo_pattern.match(line):
                task_start = i
                task_lines.append(line)
        else:
            # Sprawdzamy, czy to kolejna zagnieżdżona linia (spacje na początku)
            # Jeśli linia jest pusta lub zaczyna się od znaku innej sekcji/nowego zadania
            # bez wcięcia, uznajemy koniec zadania.
            if line.strip() == "" or (not line.startswith("  ") and not line.startswith("\t")):
                task_end = i
                break
            task_lines.append(line)

    # Jeśli zadanie było na samym końcu pliku
    if task_start != -1 and task_end == -1:
        task_end = len(lines)

    if task_start != -1:
        return "".join(task_lines), task_start, task_end, lines
    return None

def move_task_to_done(task_text, all_lines, start_idx, end_idx):
    """
    Usuwa zadanie z TASK_QUEUE.md i przenosi do TASK_DONE.md zmieniając `todo` na `done`.
    """
    # Usuwamy linie zadania z pliku wejściowego
    new_queue_lines = all_lines[:start_idx] + all_lines[end_idx:]
    with open(TASK_QUEUE_FILE, "w", encoding="utf-8") as f:
        f.writelines(new_queue_lines)

    # Zmieniamy `todo` na `done` albo oznaczamy jako zakończone
    completed_task_text = task_text.replace("`todo`", "`done`")
    
    # Dodajemy wygenerowaną datę ukończenia
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    completed_task_text = completed_task_text.rstrip() + f" (Zakończono: {now_str})\n\n"

    # Dopisz do TASK_DONE.md
    if TASK_DONE_FILE.exists():
        with open(TASK_DONE_FILE, "a", encoding="utf-8") as f:
            f.write(completed_task_text)
    else:
        with open(TASK_DONE_FILE, "w", encoding="utf-8") as f:
            f.write("# Zakończone zadania\n\n" + completed_task_text)

def execute_agent(task_text):
    """
    Odpalenie agenta programistycznego.
    Zmień `command` by odpalić rzeczywisty skrypt, którego używasz.
    """
    log("Uruchamiam agenta dla zadania:")
    print(task_text.strip())

    # TUTAJ KONFIGURUJESZ KOMENDĘ DLA AGENTA (np. Aider, Cline, Gemini API script)
    # Dla przykładu symulujemy komendę:
    command = ["echo", "Symulacja działania agenta Gemini..."]

    try:
        # Odpalamy agenta (używamy subprocess) i dajemy limit czasowy np. 15 minut
        process = subprocess.run(command, capture_output=True, text=True, timeout=900)
        
        if process.returncode == 0:
            log("Agent zakończył pracę z sukcesem.")
            return True
        else:
            log(f"Agent zwrócił błąd!\n{process.stderr}")
            return False
    except subprocess.TimeoutExpired:
        log("TIMEOUT: Czas przeznaczony dla agenta minął.")
        return False
    except Exception as e:
        log(f"Nieudane uruchomienie procesu agenta: {e}")
        return False

def main():
    log("=== Gemini Task Watcher START ===")
    
    while True:
        task_data = get_first_todo_task()
        
        if task_data:
            task_text, start_idx, end_idx, all_lines = task_data
            log("Znaleziono nowe zadnie w TASK_QUEUE.md")
            
            # Odpalenie agenta
            success = execute_agent(task_text)
            
            if success:
                # Jeśli praca wykonana, przesuwamy do TASK_DONE.md
                move_task_to_done(task_text, all_lines, start_idx, end_idx)
                log("Zadanie przeniesione do TASK_DONE.md.")
                log("Sprawdzam, czy są kolejne zadania w kolejce...")
                time.sleep(2) # Krotka przerwa przed pobraniem nastepnego w kolejce
            else:
                log("Zadanie nie powiodło się. Weryfikacja za godzinę...")
                time.sleep(INTERVAL_SECONDS)
                
        else:
            log("Brak zadań w statusie `todo` w TASK_QUEUE.md.")
            log(f"Idę spać na {INTERVAL_SECONDS // 3600} godzinę.")
            time.sleep(INTERVAL_SECONDS)

if __name__ == "__main__":
    main()
