/**
 * localWhisper.ts
 * 
 * Lokalna transkrypcja przy użyciu Whisper.cpp lub faster-whisper
 * Działa w pełni offline, bez wymagania kluczy API
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { config } from '../config.ts';
import { logger } from '../logger.ts';

const execPromise = promisify(exec);

const execAsync = promisify(exec);

interface LocalWhisperConfig {
  whisperPath: string;
  modelPath: string;
  language: string;
  threads: number;
}

function getLocalWhisperConfig(): LocalWhisperConfig | null {
  const whisperPath = config.WHISPER_CPP_PATH || process.env.WHISPER_CPP_PATH || '';
  const modelPath = config.WHISPER_MODEL_PATH || process.env.WHISPER_MODEL_PATH || '';
  
  // Sprawdź czy whisper.cpp jest dostępny
  if (!whisperPath || !fs.existsSync(whisperPath)) {
    return null;
  }
  
  return {
    whisperPath,
    modelPath: modelPath || './models/ggml-base.bin',
    language: config.AUDIO_LANGUAGE || 'pl',
    threads: parseInt(config.WHISPER_THREADS || '4'),
  };
}

export async function transcribeWithLocalWhisper(
  audioPath: string,
  config?: LocalWhisperConfig
): Promise<{
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  language: string;
  duration: number;
}> {
  const whisperConfig = config || getLocalWhisperConfig();
  
  if (!whisperConfig) {
    throw new Error('Whisper.cpp nie jest skonfigurowany. Ustaw WHISPER_CPP_PATH i WHISPER_MODEL_PATH.');
  }

  const outputJson = path.join(tmpdir(), `whisper-${Date.now()}.json`);
  
  try {
    // Uruchom whisper.cpp z outputem JSON
    const command = `"${whisperConfig.whisperPath}" -m "${whisperConfig.modelPath}" -f "${audioPath}" -oj -of "${outputJson}" -l "${whisperConfig.language}" -t ${whisperConfig.threads}`;
    
    logger.info(`[local-whisper] Running: ${command}`);
    
    const { stdout, stderr } = await execPromise(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    
    if (stderr && !stderr.includes('warning')) {
      logger.warn(`[local-whisper] stderr: ${stderr}`);
    }
    
    // Wczytaj wynik JSON
    if (!fs.existsSync(outputJson)) {
      throw new Error('Whisper.cpp nie wygenerował pliku wyjściowego');
    }
    
    const result = JSON.parse(fs.readFileSync(outputJson, 'utf-8'));
    
    // Parsuj segmenty
    const segments = (result.transcription || []).map((seg: any) => ({
      start: Math.floor(seg.offset_from / 1000), // ms -> seconds
      end: Math.floor(seg.offset_to / 1000),
      text: seg.text,
    }));
    
    return {
      text: segments.map((s: any) => s.text).join(' '),
      segments,
      language: whisperConfig.language,
      duration: result.duration || 0,
    };
  } catch (error: any) {
    logger.error(`[local-whisper] Error: ${error.message}`);
    throw error;
  } finally {
    // Cleanup
    if (fs.existsSync(outputJson)) {
      fs.unlinkSync(outputJson);
    }
  }
}

/**
 * Alternatywa: faster-whisper (Python)
 */
export async function transcribeWithFasterWhisper(
  audioPath: string,
  options?: {
    model?: string;
    language?: string;
    device?: 'cpu' | 'cuda';
  }
): Promise<{
  text: string;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  language: string;
  duration: number;
}> {
  const model = options?.model || 'base';
  const language = options?.language || config.AUDIO_LANGUAGE || 'pl';
  const device = options?.device || 'cpu';
  
  const scriptPath = path.join(__dirname, '../whisper_local.py');
  
  if (!fs.existsSync(scriptPath)) {
    throw new Error('Skrypt whisper_local.py nie istnieje');
  }
  
  try {
    const command = `python "${scriptPath}" --model "${model}" --language "${language}" --device "${device}" "${audioPath}"`;
    
    logger.info(`[faster-whisper] Running: ${command}`);
    
    const { stdout, stderr } = await execAsync(command, {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    });
    
    if (stderr) {
      logger.warn(`[faster-whisper] stderr: ${stderr}`);
    }
    
    // Parsuj JSON z stdout
    const result = JSON.parse(stdout);
    
    return {
      text: result.text || '',
      segments: result.segments || [],
      language: result.language || language,
      duration: result.duration || 0,
    };
  } catch (error: any) {
    logger.error(`[faster-whisper] Error: ${error.message}`);
    throw new Error(`Faster-Whisper failed: ${error.message}`);
  }
}

/**
 * Sprawdź czy lokalny Whisper jest dostępny
 */
export function isLocalWhisperAvailable(): boolean {
  const config = getLocalWhisperConfig();
  if (!config) return false;
  
  return fs.existsSync(config.whisperPath) && fs.existsSync(config.modelPath);
}

/**
 * Sprawdź czy faster-whisper (Python) jest dostępny
 */
export async function isFasterWhisperAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('python -c "import faster_whisper"');
    return true;
  } catch {
    return false;
  }
}
