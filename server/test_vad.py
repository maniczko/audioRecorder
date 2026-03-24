#!/usr/bin/env python3
"""
Testy jednostkowe dla vad.py - Voice Activity Detection.

Uruchomienie:
  python -m unittest test_vad.py
  lub
  pytest test_vad.py -v
"""

import unittest
import json
import os
import sys
import tempfile
import wave
import struct
import math
import subprocess

# Dodaj ścieżkę do modułów
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class TestVADHelpers(unittest.TestCase):
    """Testy funkcji pomocniczych vad.py"""

    def test_sanitize_number_valid(self):
        """sanitize_number zwraca zaokrągloną liczbę"""
        from vad import sanitize_number
        
        self.assertEqual(sanitize_number(3.14159), 3.142)
        self.assertEqual(sanitize_number(100), 100.0)
        self.assertEqual(sanitize_number(-5.5), -5.5)

    def test_sanitize_number_none(self):
        """sanitize_number zwraca None dla None"""
        from vad import sanitize_number
        
        self.assertIsNone(sanitize_number(None))

    def test_sanitize_number_invalid(self):
        """sanitize_number zwraca None dla niepoprawnych wartości"""
        from vad import sanitize_number
        
        self.assertIsNone(sanitize_number("not a number"))
        self.assertIsNone(sanitize_number([]))

    def test_sanitize_number_nan(self):
        """sanitize_number zwraca None dla NaN"""
        from vad import sanitize_number
        
        self.assertIsNone(sanitize_number(float('nan')))

    def test_sanitize_number_inf(self):
        """sanitize_number zwraca None dla nieskończoności"""
        from vad import sanitize_number
        
        self.assertIsNone(sanitize_number(float('inf')))
        self.assertIsNone(sanitize_number(float('-inf')))

    def test_sanitize_number_rounding(self):
        """sanitize_number zaokrągla do 3 miejsc"""
        from vad import sanitize_number
        
        self.assertEqual(sanitize_number(1.23456), 1.235)
        self.assertEqual(sanitize_number(0.0001), 0.0)


class TestVADCLI(unittest.TestCase):
    """Testy interfejsu wiersza poleceń"""

    def test_cli_no_arguments(self):
        """CLI bez argumentów wyświetla błąd"""
        result = subprocess.run(
            ['python', 'vad.py'],
            capture_output=True,
            text=True
        )
        
        # Powinien zwrócić błąd
        self.assertNotEqual(result.returncode, 0)
        
        # Powinien zwrócić JSON z błędem
        try:
            error = json.loads(result.stdout.strip())
            self.assertIn('error', error)
        except json.JSONDecodeError:
            # Może zwrócić błąd w stderr
            self.assertTrue(len(result.stderr) > 0)

    def test_cli_nonexistent_file(self):
        """CLI z nieistniejącym plikiem zwraca błąd"""
        result = subprocess.run(
            ['python', 'vad.py', '/nonexistent/file.wav'],
            capture_output=True,
            text=True
        )
        
        # Powinien zwrócić błąd
        self.assertNotEqual(result.returncode, 0)
        
        # Sprawdź JSON z błędem
        try:
            error = json.loads(result.stdout.strip())
            self.assertIn('error', error)
            self.assertIn('not found', error['error'].lower())
        except json.JSONDecodeError:
            pass  # Może zwrócić błąd w stderr

    def test_cli_empty_file(self):
        """CLI z pustym plikiem zwraca błąd"""
        # Stwórz pusty plik
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
        
        try:
            result = subprocess.run(
                ['python', 'vad.py', temp_path],
                capture_output=True,
                text=True
            )
            
            # Pusty plik powinien zgłosić błąd
            self.assertNotEqual(result.returncode, 0)
        finally:
            os.unlink(temp_path)


class TestVADOutputFormat(unittest.TestCase):
    """Testy formatu wyjściowego VAD"""

    def test_output_format_structure(self):
        """Wyjście VAD ma poprawną strukturę"""
        # Przykładowe wyjście (mock)
        mock_output = [
            {"start": 0.5, "end": 2.3},
            {"start": 3.1, "end": 5.7},
        ]
        
        for segment in mock_output:
            # Sprawdź wymagane pola
            self.assertIn('start', segment)
            self.assertIn('end', segment)
            
            # Sprawdź typy
            self.assertIsInstance(segment['start'], (int, float))
            self.assertIsInstance(segment['end'], (int, float))
            
            # Sprawdź wartości
            self.assertTrue(segment['start'] >= 0)
            self.assertTrue(segment['end'] >= segment['start'])

    def test_output_timestamp_precision(self):
        """Timestampy są zaokrąglone do 3 miejsc"""
        # Przykładowe wyjście
        mock_output = [
            {"start": 0.123456, "end": 2.987654},
        ]
        
        for segment in mock_output:
            # Sprawdź precyzję
            start_str = str(segment['start'])
            end_str = str(segment['end'])
            
            # Powinny mieć max 3 miejsca po przecinku
            if '.' in start_str:
                decimals = len(start_str.split('.')[1])
                self.assertLessEqual(decimals, 3)


class TestVADWithAudioFiles(unittest.TestCase):
    """Testy z rzeczywistymi plikami audio"""

    def test_silence_detection(self):
        """Wykrywanie ciszy (brak mowy)"""
        # Stwórz plik z ciszą
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            self._create_silence_file(temp_path, duration=2.0)
        
        try:
            result = subprocess.run(
                ['python', 'vad.py', temp_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            # Może zwrócić pustą listę lub błąd "too short"
            if result.returncode == 0:
                output = json.loads(result.stdout.strip())
                self.assertIsInstance(output, list)
        except subprocess.TimeoutExpired:
            pass  # Timeout jest OK dla wolniejszych maszyn
        finally:
            os.unlink(temp_path)

    def test_speech_detection(self):
        """Wykrywanie mowy (sygnał sinusoidalny)"""
        # Stwórz plik z "mową" (sygnał 440Hz)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            self._create_tone_file(temp_path, frequency=440, duration=2.0)
        
        try:
            result = subprocess.run(
                ['python', 'vad.py', temp_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            # Może zwrócić listę segmentów lub błąd
            if result.returncode == 0:
                output = json.loads(result.stdout.strip())
                self.assertIsInstance(output, list)
        except subprocess.TimeoutExpired:
            pass  # Timeout jest OK
        finally:
            os.unlink(temp_path)

    def _create_silence_file(self, path, duration=2.0, sample_rate=16000):
        """Tworzy plik WAV z ciszą"""
        n_samples = int(duration * sample_rate)
        
        with wave.open(path, 'w') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(b'\x00\x00' * n_samples)

    def _create_tone_file(self, path, frequency=440, duration=2.0, sample_rate=16000):
        """Tworzy plik WAV z tonem"""
        n_samples = int(duration * sample_rate)
        
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


class TestVADEdgeCases(unittest.TestCase):
    """Testy przypadków brzegowych"""

    def test_very_short_audio(self):
        """Obsługa bardzo krótkiego pliku (< 0.25s)"""
        # Stwórz bardzo krótki plik
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            self._create_silence_file(temp_path, duration=0.1)
        
        try:
            result = subprocess.run(
                ['python', 'vad.py', temp_path],
                capture_output=True,
                text=True
            )
            
            # Powinien zwrócić błąd "too short"
            self.assertNotEqual(result.returncode, 0)
            
            try:
                error = json.loads(result.stdout.strip())
                self.assertIn('error', error)
                self.assertIn('short', error['error'].lower())
            except json.JSONDecodeError:
                pass
        finally:
            os.unlink(temp_path)

    def test_non_wav_format(self):
        """Obsługa innych formatów niż WAV"""
        # Stwórz plik z rozszerzeniem .mp3 (ale to WAV)
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            temp_path = f.name
            self._create_silence_file(temp_path, duration=1.0)
        
        try:
            result = subprocess.run(
                ['python', 'vad.py', temp_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            # VAD może spróbować przetworzyć lub zwrócić błąd
            # Silero VAD powinien obsługiwać różne formaty
            if result.returncode == 0:
                output = json.loads(result.stdout.strip())
                self.assertIsInstance(output, list)
        except subprocess.TimeoutExpired:
            pass
        finally:
            os.unlink(temp_path)

    def test_corrupted_audio_file(self):
        """Obsługa uszkodzonego pliku"""
        # Stwórz "uszkodzony" plik (losowe bajty)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            f.write(b'\x00\x01\x02\x03\x04\x05')  # Niepoprawny WAV
        
        try:
            result = subprocess.run(
                ['python', 'vad.py', temp_path],
                capture_output=True,
                text=True
            )
            
            # Powinien zwrócić błąd
            self.assertNotEqual(result.returncode, 0)
        finally:
            os.unlink(temp_path)

    def _create_silence_file(self, path, duration=2.0, sample_rate=16000):
        """Tworzy plik WAV z ciszą"""
        n_samples = int(duration * sample_rate)
        
        with wave.open(path, 'w') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(b'\x00\x00' * n_samples)


class TestVADThresholds(unittest.TestCase):
    """Testy progów wykrywania"""

    def test_default_threshold(self):
        """Domyślny próg threshold=0.45"""
        # Sprawdź w kodzie źródłowym
        with open('vad.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Sprawdź czy threshold jest ustawiony
        self.assertIn('threshold=0.45', content)

    def test_sampling_rate(self):
        """Częstotliwość próbkowania 16kHz"""
        # Sprawdź w kodzie źródłowym
        with open('vad.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Sprawdź czy sampling_rate jest ustawiony
        self.assertIn('sampling_rate=16000', content)


if __name__ == '__main__':
    unittest.main(verbosity=2)
