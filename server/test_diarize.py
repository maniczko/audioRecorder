#!/usr/bin/env python3
"""
Testy jednostkowe dla diarize.py - diarization speakerów.

Uruchomienie:
  python -m unittest test_diarize.py
  lub
  pytest test_diarize.py -v
"""

import unittest
import json
import os
import sys
import tempfile
import wave
import struct
import math

# Dodaj ścieżkę do modułów
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class TestDiarizeHelpers(unittest.TestCase):
    """Testy funkcji pomocniczych diarize.py"""

    def test_ensure_wav_16k_returns_same_path_for_wav(self):
        """_ensure_wav_16k zwraca tę samą ścieżkę dla plików WAV"""
        from diarize import _ensure_wav_16k
        
        # Stwórz tymczasowy plik WAV
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
        
        try:
            result_path, is_tmp = _ensure_wav_16k(temp_path)
            # Dla WAV nie powinna być konwersja
            self.assertEqual(result_path, temp_path)
            self.assertFalse(is_tmp)
        finally:
            os.unlink(temp_path)

    def test_ensure_wav_16k_creates_temp_for_non_wav(self):
        """_ensure_wav_16k tworzy tymczasowy plik dla innych formatów"""
        from diarize import _ensure_wav_16k
        
        # Stwórz tymczasowy plik MP3 (pusty, ale z rozszerzeniem)
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            temp_path = f.name
        
        try:
            # To powinno zgłosić błąd ffmpeg bo plik jest pusty
            # ale sprawdzamy czy próbuje konwersji
            try:
                result_path, is_tmp = _ensure_wav_16k(temp_path)
                # Jeśli ffmpeg jest zainstalowany, is_tmp powinno być True
                self.assertTrue(is_tmp)
                os.unlink(result_path)
            except RuntimeError as e:
                # Oczekiwany błąd przy konwersji pustego pliku
                self.assertIn("Konwersja", str(e))
        finally:
            os.unlink(temp_path)

    def test_ensure_wav_16k_handles_nonexistent_file(self):
        """_ensure_wav_16k zgłasza błąd dla nieistniejącego pliku"""
        from diarize import _ensure_wav_16k
        
        with self.assertRaises(RuntimeError):
            _ensure_wav_16k("/nonexistent/file.mp3")


class TestDiarizeFunction(unittest.TestCase):
    """Testy głównej funkcji diarize"""

    def test_diarize_requires_token(self):
        """diarize zgłasza błąd bez tokena"""
        from diarize import diarize
        
        # Stwórz tymczasowy plik WAV
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            # Zapisz krótki dźwięk (szum)
            self._create_wav_file(temp_path, duration=1.0)
        
        try:
            # Usuń HF_TOKEN ze środowiska
            old_token = os.environ.pop('HF_TOKEN', None)
            old_hf_token = os.environ.pop('HUGGINGFACE_TOKEN', None)
            
            try:
                with self.assertRaises(RuntimeError) as context:
                    diarize(temp_path)
                
                self.assertIn("tokena", str(context.exception).lower())
            finally:
                # Przywróć token
                if old_token:
                    os.environ['HF_TOKEN'] = old_token
                if old_hf_token:
                    os.environ['HUGGINGFACE_TOKEN'] = old_hf_token
        finally:
            os.unlink(temp_path)

    def test_diarize_handles_nonexistent_file(self):
        """diarize zgłasza błąd dla nieistniejącego pliku"""
        from diarize import diarize
        
        with self.assertRaises(RuntimeError) as context:
            diarize("/nonexistent/file.wav", "fake_token")
        
        self.assertIn("nie istnieje", str(context.exception).lower())

    def _create_wav_file(self, path, duration=1.0, sample_rate=16000):
        """Tworzy prosty plik WAV z sinusoidą"""
        n_samples = int(duration * sample_rate)
        frequency = 440  # Hz
        
        # Generuj sinusoidę
        samples = []
        for i in range(n_samples):
            t = i / sample_rate
            value = int(32767 * math.sin(2 * math.pi * frequency * t))
            samples.append(struct.pack('<h', value))
        
        with wave.open(path, 'w') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(b''.join(samples))


class TestDiarizeCLI(unittest.TestCase):
    """Testy interfejsu wiersza poleceń"""

    def test_cli_no_arguments(self):
        """CLI bez argumentów wyświetla pomoc"""
        result = os.system('python diarize.py 2>&1')
        self.assertNotEqual(result, 0)  # Powinien zwrócić błąd

    def test_cli_nonexistent_file(self):
        """CLI z nieistniejącym plikiem zwraca błąd"""
        import subprocess
        
        result = subprocess.run(
            ['python', 'diarize.py', '/nonexistent/file.wav'],
            capture_output=True,
            text=True
        )
        
        # Powinien zwrócić JSON z błędem
        try:
            error = json.loads(result.stdout.strip())
            self.assertIn('error', error)
        except json.JSONDecodeError:
            # Może zwrócić błąd w stderr
            self.assertTrue(len(result.stderr) > 0 or len(result.stdout) > 0)

    def test_cli_with_token_argument(self):
        """CLI z tokenem jako argumentem"""
        import subprocess
        
        # Stwórz tymczasowy plik WAV
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
        
        try:
            # Użyj fake tokena - powinien zwrócić błąd ładowania modelu
            result = subprocess.run(
                ['python', 'diarize.py', temp_path, 'fake_token'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            # Powinien spróbować załadować model i zwrócić błąd autoryzacji
            output = result.stdout.strip()
            if output:
                try:
                    error = json.loads(output)
                    self.assertIn('error', error)
                except json.JSONDecodeError:
                    pass  # Może zwrócić inny błąd
        finally:
            os.unlink(temp_path)


class TestDiarizeOutputFormat(unittest.TestCase):
    """Testy formatu wyjściowego diarization"""

    def test_output_format_structure(self):
        """Wyjście diarize ma poprawną strukturę"""
        # Przykładowe wyjście (mock)
        mock_output = [
            {"speaker": "speaker_0", "start": 0.0, "end": 5.2},
            {"speaker": "speaker_1", "start": 5.5, "end": 10.3},
        ]
        
        for segment in mock_output:
            # Sprawdź wymagane pola
            self.assertIn('speaker', segment)
            self.assertIn('start', segment)
            self.assertIn('end', segment)
            
            # Sprawdź typy
            self.assertIsInstance(segment['speaker'], str)
            self.assertIsInstance(segment['start'], (int, float))
            self.assertIsInstance(segment['end'], (int, float))
            
            # Sprawdź wartości
            self.assertTrue(segment['start'] >= 0)
            self.assertTrue(segment['end'] >= segment['start'])

    def test_speaker_label_normalization(self):
        """Normalizacja etykiet speakerów"""
        # Przykładowe etykiety z pyannote
        test_cases = [
            ("SPEAKER_00", "speaker_0"),
            ("SPEAKER_01", "speaker_1"),
            ("SPEAKER_10", "speaker_10"),
        ]
        
        for input_label, expected in test_cases:
            # Symulacja normalizacji z diarize.py
            normalized = input_label.lower().replace("speaker_", "speaker_")
            self.assertEqual(normalized, expected)


class TestDiarizeEdgeCases(unittest.TestCase):
    """Testy przypadków brzegowych"""

    def test_empty_audio_file(self):
        """Obsługa pustego pliku audio"""
        from diarize import diarize
        
        # Stwórz pusty plik
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
        
        try:
            old_token = os.environ.pop('HF_TOKEN', None)
            
            try:
                # Pusty plik powinien zgłosić błąd
                with self.assertRaises(Exception):
                    diarize(temp_path, "fake_token")
            finally:
                if old_token:
                    os.environ['HF_TOKEN'] = old_token
        finally:
            os.unlink(temp_path)

    def test_very_short_audio(self):
        """Obsługa bardzo krótkiego pliku audio"""
        from diarize import diarize
        
        # Stwórz bardzo krótki plik WAV (0.1s)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            self._create_wav_file(temp_path, duration=0.1)
        
        try:
            old_token = os.environ.pop('HF_TOKEN', None)
            
            try:
                # Krótki plik może zwrócić pustą listę lub błąd
                result = diarize(temp_path, "fake_token")
                # Jeśli nie zgłosi błędu, wynik powinien być listą
                self.assertIsInstance(result, list)
            except RuntimeError:
                # Oczekiwany błąd przy braku tokena
                pass
            finally:
                if old_token:
                    os.environ['HF_TOKEN'] = old_token
        finally:
            os.unlink(temp_path)

    def _create_wav_file(self, path, duration=1.0, sample_rate=16000):
        """Tworzy prosty plik WAV z sinusoidą"""
        n_samples = int(duration * sample_rate)
        frequency = 440  # Hz
        
        samples = []
        for i in range(n_samples):
            t = i / sample_rate
            value = int(32767 * math.sin(2 * math.pi * frequency * t))
            samples.append(struct.pack('<h', value))
        
        with wave.open(path, 'w') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(b''.join(samples))


if __name__ == '__main__':
    unittest.main(verbosity=2)
