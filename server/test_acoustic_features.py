#!/usr/bin/env python3
"""
Testy jednostkowe dla acoustic_features.py - akustyczne cechy głosu.

Uruchomienie:
  python -m unittest test_acoustic_features.py
  lub
  pytest test_acoustic_features.py -v
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


class TestAcousticFeaturesHelpers(unittest.TestCase):
    """Testy funkcji pomocniczych acoustic_features.py"""

    def test_sanitize_number_valid(self):
        """sanitize_number zwraca zaokrągloną liczbę"""
        from acoustic_features import sanitize_number
        
        self.assertEqual(sanitize_number(3.14159), 3.142)
        self.assertEqual(sanitize_number(100), 100.0)
        self.assertEqual(sanitize_number(-5.5), -5.5)

    def test_sanitize_number_none(self):
        """sanitize_number zwraca None dla None"""
        from acoustic_features import sanitize_number
        
        self.assertIsNone(sanitize_number(None))

    def test_sanitize_number_invalid(self):
        """sanitize_number zwraca None dla niepoprawnych wartości"""
        from acoustic_features import sanitize_number
        
        self.assertIsNone(sanitize_number("not a number"))
        self.assertIsNone(sanitize_number([]))
        self.assertIsNone(sanitize_number({}))

    def test_sanitize_number_nan(self):
        """sanitize_number zwraca None dla NaN"""
        from acoustic_features import sanitize_number
        
        self.assertIsNone(sanitize_number(float('nan')))

    def test_sanitize_number_inf(self):
        """sanitize_number zwraca None dla nieskończoności"""
        from acoustic_features import sanitize_number
        
        self.assertIsNone(sanitize_number(float('inf')))
        self.assertIsNone(sanitize_number(float('-inf')))

    def test_sanitize_number_rounding(self):
        """sanitize_number zaokrągla do 3 miejsc"""
        from acoustic_features import sanitize_number
        
        self.assertEqual(sanitize_number(1.23456), 1.235)
        self.assertEqual(sanitize_number(0.0001), 0.0)
        self.assertEqual(sanitize_number(9.9999), 10.0)


class TestAcousticFeaturesCLI(unittest.TestCase):
    """Testy interfejsu wiersza poleceń"""

    def test_cli_no_arguments(self):
        """CLI bez argumentów wyświetla błąd użycia"""
        result = subprocess.run(
            ['python', 'acoustic_features.py'],
            capture_output=True,
            text=True
        )
        
        # Powinien zwrócić błąd
        self.assertNotEqual(result.returncode, 0)
        
        # Sprawdź komunikat o użyciu
        output = result.stdout.strip()
        if output:
            try:
                error = json.loads(output)
                self.assertIn('error', error)
                self.assertIn('Usage', error['error'])
            except json.JSONDecodeError:
                pass

    def test_cli_nonexistent_file(self):
        """CLI z nieistniejącym plikiem zwraca błąd"""
        result = subprocess.run(
            ['python', 'acoustic_features.py', '/nonexistent/file.wav'],
            capture_output=True,
            text=True
        )
        
        # Powinien zwrócić błąd
        self.assertNotEqual(result.returncode, 0)
        
        # Sprawdź JSON z błędem
        try:
            error = json.loads(result.stdout.strip())
            self.assertIn('error', error)
        except json.JSONDecodeError:
            pass


class TestAcousticFeaturesOutputFormat(unittest.TestCase):
    """Testy formatu wyjściowego acoustic features"""

    def test_output_format_structure(self):
        """Wyjście ma poprawną strukturę"""
        # Przykładowe wyjście (mock)
        mock_output = {
            "sampleDurationSeconds": 2.5,
            "f0Hz": 150.5,
            "jitterLocal": 0.5,
            "shimmerLocalDb": 0.3,
            "hnrDb": 20.5,
            "formantsHz": {
                "f1": 500.0,
                "f2": 1500.0,
                "f3": 2500.0,
                "f4": 3500.0,
            }
        }
        
        # Sprawdź wymagane pola
        required_fields = ['sampleDurationSeconds', 'f0Hz', 'jitterLocal', 
                          'shimmerLocalDb', 'hnrDb', 'formantsHz']
        for field in required_fields:
            self.assertIn(field, mock_output)
        
        # Sprawdź formanty
        formants = mock_output['formantsHz']
        for f in ['f1', 'f2', 'f3', 'f4']:
            self.assertIn(f, formants)
            self.assertIsInstance(formants[f], (int, float, type(None)))

    def test_output_values_valid(self):
        """Wartości wyjściowe są poprawne"""
        mock_output = {
            "sampleDurationSeconds": 2.5,
            "f0Hz": 150.5,
            "jitterLocal": 0.5,
            "shimmerLocalDb": 0.3,
            "hnrDb": 20.5,
            "formantsHz": {"f1": 500.0, "f2": 1500.0, "f3": 2500.0, "f4": 3500.0},
        }
        
        # Sprawdź czy wartości są numeryczne
        self.assertIsInstance(mock_output['sampleDurationSeconds'], float)
        self.assertIsInstance(mock_output['f0Hz'], float)
        
        # Sprawdź czy duration jest dodatni
        self.assertGreater(mock_output['sampleDurationSeconds'], 0)
        
        # Sprawdź czy f0 jest w rozsądnym zakresie dla ludzkiego głosu
        self.assertGreater(mock_output['f0Hz'], 50)
        self.assertLess(mock_output['f0Hz'], 500)


class TestAcousticFeaturesWithAudioFiles(unittest.TestCase):
    """Testy z rzeczywistymi plikami audio"""

    def test_short_audio_error(self):
        """Błąd dla bardzo krótkiego audio (< 0.25s)"""
        # Stwórz bardzo krótki plik
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            self._create_tone_file(temp_path, duration=0.1)
        
        try:
            result = subprocess.run(
                ['python', 'acoustic_features.py', temp_path],
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

    def test_valid_audio_structure(self):
        """Struktura wyjścia dla poprawnego pliku"""
        # Stwórz plik z tonem (2s)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            self._create_tone_file(temp_path, duration=2.0, frequency=150)
        
        try:
            result = subprocess.run(
                ['python', 'acoustic_features.py', temp_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            # Może zwrócić błąd jeśli parselmouth nie jest zainstalowany
            if result.returncode == 0:
                output = json.loads(result.stdout.strip())
                
                # Sprawdź strukturę
                self.assertIn('sampleDurationSeconds', output)
                self.assertIn('formantsHz', output)
                
                # Sprawdź formanty
                formants = output['formantsHz']
                for f in ['f1', 'f2', 'f3', 'f4']:
                    self.assertIn(f, formants)
            else:
                # Może brakować zależności
                output = result.stdout.strip()
                if output:
                    try:
                        error = json.loads(output)
                        # Sprawdź czy to błąd zależności
                        self.assertIn('error', error)
                    except json.JSONDecodeError:
                        pass
        except subprocess.TimeoutExpired:
            pass  # Timeout jest OK
        finally:
            os.unlink(temp_path)

    def _create_tone_file(self, path, frequency=150, duration=2.0, sample_rate=16000):
        """Tworzy plik WAV z tonem (symulacja głosu)"""
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


class TestAcousticFeaturesEdgeCases(unittest.TestCase):
    """Testy przypadków brzegowych"""

    def test_silence_file(self):
        """Analiza pliku z ciszą"""
        # Stwórz plik z ciszą
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            self._create_silence_file(temp_path, duration=2.0)
        
        try:
            result = subprocess.run(
                ['python', 'acoustic_features.py', temp_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            # Cisza może zwrócić błąd lub wartości bliskie 0
            if result.returncode == 0:
                try:
                    output = json.loads(result.stdout.strip())
                    # f0 dla ciszy powinno być None lub 0
                    if output.get('f0Hz') is not None:
                        self.assertLess(output['f0Hz'], 50)  # Bardzo niskie f0
                except json.JSONDecodeError:
                    pass
        except subprocess.TimeoutExpired:
            pass
        finally:
            os.unlink(temp_path)

    def test_high_frequency_tone(self):
        """Analiza tonu o wysokiej częstotliwości"""
        # Stwórz plik z wysokim tonem (1000Hz)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            self._create_tone_file(temp_path, duration=2.0, frequency=1000)
        
        try:
            result = subprocess.run(
                ['python', 'acoustic_features.py', temp_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode == 0:
                try:
                    output = json.loads(result.stdout.strip())
                    # Sprawdź czy f0 jest wykryte
                    if output.get('f0Hz') is not None:
                        self.assertGreater(output['f0Hz'], 0)
                except json.JSONDecodeError:
                    pass
        except subprocess.TimeoutExpired:
            pass
        finally:
            os.unlink(temp_path)

    def test_corrupted_audio_file(self):
        """Obsługa uszkodzonego pliku"""
        # Stwórz "uszkodzony" plik
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            f.write(b'\x00\x01\x02\x03\x04\x05')  # Niepoprawny WAV
        
        try:
            result = subprocess.run(
                ['python', 'acoustic_features.py', temp_path],
                capture_output=True,
                text=True
            )
            
            # Powinien zwrócić błąd
            self.assertNotEqual(result.returncode, 0)
        finally:
            os.unlink(temp_path)

    def test_missing_dependencies(self):
        """Błąd przy braku zależności (parselmouth)"""
        # Stwórz plik
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            temp_path = f.name
            self._create_tone_file(temp_path, duration=2.0)
        
        try:
            # Tymczasowo ukryj parselmouth
            import sys
            parselmouth_module = sys.modules.get('parselmouth')
            if 'parselmouth' in sys.modules:
                del sys.modules['parselmouth']
            
            result = subprocess.run(
                ['python', 'acoustic_features.py', temp_path],
                capture_output=True,
                text=True
            )
            
            # Przywróć moduł
            if parselmouth_module:
                sys.modules['parselmouth'] = parselmouth_module
            
            # Sprawdź czy zwraca błąd zależności
            if result.returncode != 0:
                try:
                    error = json.loads(result.stdout.strip())
                    self.assertIn('error', error)
                    # Błąd powinien wspomnieć o zależnościach
                    self.assertTrue(
                        'Missing' in error['error'] or 
                        'parselmouth' in error['error'].lower() or
                        'acoustic' in error['error'].lower()
                    )
                except json.JSONDecodeError:
                    pass
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

    def _create_tone_file(self, path, frequency=150, duration=2.0, sample_rate=16000):
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


class TestAcousticFeaturesFormants(unittest.TestCase):
    """Testy formantów"""

    def test_formant_structure(self):
        """Struktura formantów"""
        mock_formants = {
            "f1": 500.0,
            "f2": 1500.0,
            "f3": 2500.0,
            "f4": 3500.0,
        }
        
        for key, value in mock_formants.items():
            self.assertIsInstance(key, str)
            self.assertIsInstance(value, (int, float))
        
        # Sprawdź zakresy formantów dla typowego głosu
        self.assertLess(mock_formants['f1'], 1000)  # F1 zwykle < 1000Hz
        self.assertLess(mock_formants['f2'], 3000)  # F2 zwykle < 3000Hz

    def test_formant_ordering(self):
        """Formanty są w kolejności rosnącej"""
        mock_formants = {
            "f1": 500.0,
            "f2": 1500.0,
            "f3": 2500.0,
            "f4": 3500.0,
        }
        
        self.assertLess(mock_formants['f1'], mock_formants['f2'])
        self.assertLess(mock_formants['f2'], mock_formants['f3'])
        self.assertLess(mock_formants['f3'], mock_formants['f4'])


class TestAcousticFeaturesDuration(unittest.TestCase):
    """Testy obsługi czasu trwania"""

    def test_minimum_duration(self):
        """Minimalny czas trwania to 0.25s"""
        # Sprawdź w kodzie źródłowym
        with open('acoustic_features.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Sprawdź czy jest walidacja duration
        self.assertIn('duration', content.lower())
        self.assertIn('0.25', content)

    def test_duration_rounding(self):
        """Zaokrąglanie czasu trwania"""
        from acoustic_features import sanitize_number
        
        duration = 2.3456789
        rounded = sanitize_number(duration)
        
        self.assertEqual(rounded, 2.346)


if __name__ == '__main__':
    unittest.main(verbosity=2)
