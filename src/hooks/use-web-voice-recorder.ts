import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Web-native voice recorder hook. Uses MediaRecorder for audio capture and
 * AudioContext + AnalyserNode for real-time frequency-band visualization
 * (聲紋波形). Gated on `window` so SSR/RN-native skip cleanly.
 *
 * Returns base64-encoded audio on stop, ready to send to the tRPC
 * voice.transcribe endpoint.
 */
export type RecorderState = 'idle' | 'recording' | 'stopping' | 'error';

const BAND_COUNT = 24; // bars in the waveform visualizer

export function useWebVoiceRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [bands, setBands] = useState<number[]>(() => new Array(BAND_COUNT).fill(0));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopResolveRef = useRef<((b64: { audioBase64: string; mimeType: string } | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setBands(new Array(BAND_COUNT).fill(0));
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async (): Promise<boolean> => {
    setErrorMsg(null);
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      setState('error');
      setErrorMsg('Microphone API not available in this browser');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Spectrum visualizer
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx: AudioContext = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // 32 bins, we use 24 to ignore the highest noise band
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buffer);
        const next = new Array(BAND_COUNT).fill(0);
        for (let i = 0; i < BAND_COUNT; i++) next[i] = (buffer[i] ?? 0) / 255;
        setBands(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      // Recorder
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        const ab = await blob.arrayBuffer();
        // Convert to base64 without exploding the call stack on large buffers
        let binary = '';
        const bytes = new Uint8Array(ab);
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const b64 = btoa(binary);
        cleanup();
        setState('idle');
        stopResolveRef.current?.({ audioBase64: b64, mimeType: mime });
        stopResolveRef.current = null;
      };
      recorder.start();
      recorderRef.current = recorder;
      setState('recording');
      return true;
    } catch (err: any) {
      console.error('[voice] start failed', err);
      setErrorMsg(err?.message || 'Microphone permission denied');
      setState('error');
      cleanup();
      return false;
    }
  }, [cleanup]);

  const stop = useCallback((): Promise<{ audioBase64: string; mimeType: string } | null> => {
    return new Promise(resolve => {
      const rec = recorderRef.current;
      if (!rec || rec.state === 'inactive') {
        cleanup(); setState('idle'); resolve(null); return;
      }
      setState('stopping');
      stopResolveRef.current = resolve;
      try {
        rec.stop();
      } catch (err) {
        console.error('[voice] stop failed', err);
        cleanup(); setState('idle'); resolve(null);
      }
    });
  }, [cleanup]);

  return { state, bands, errorMsg, start, stop };
}
