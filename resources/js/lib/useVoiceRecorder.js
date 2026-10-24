import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_VOICE_SECONDS = 300;

/**
 * Records a voice clip with the browser's MediaRecorder.
 * start() asks for the microphone; stop() resolves to { file, seconds } (or null if cancelled/empty).
 * Microphone access only works on https:// pages or on localhost.
 */
export default function useVoiceRecorder() {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState('');
    const recorder = useRef(null);
    const chunks = useRef([]);
    const stream = useRef(null);
    const timer = useRef(null);
    const startedAt = useRef(0);
    const resolver = useRef(null);
    const discard = useRef(false);
    const starting = useRef(false);

    const cleanup = useCallback(() => {
        clearInterval(timer.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = null;
        recorder.current = null;
        setRecording(false);
    }, []);

    const start = useCallback(async () => {
        if (starting.current || recorder.current) return;
        setError('');
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            setError('Voice recording needs a modern browser and an https:// (or localhost) page.');
            return;
        }
        starting.current = true;
        try {
            const media = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.current = media;
            const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
                .find((t) => MediaRecorder.isTypeSupported?.(t));
            const rec = new MediaRecorder(media, type ? { mimeType: type } : undefined);
            chunks.current = [];
            discard.current = false;
            rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data); };
            rec.onstop = () => {
                const secs = Math.min(MAX_VOICE_SECONDS, Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
                const mime = (rec.mimeType || type || 'audio/webm').split(';')[0];
                const blob = new Blob(chunks.current, { type: mime });
                const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
                cleanup();
                const result = discard.current || blob.size === 0 ? null : { file: new File([blob], `voice-${Date.now()}.${ext}`, { type: mime }), seconds: secs };
                resolver.current?.(result);
                resolver.current = null;
            };
            recorder.current = rec;
            startedAt.current = Date.now();
            setSeconds(0);
            rec.start();
            setRecording(true);
            timer.current = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 250);
        } catch (e) {
            stream.current?.getTracks().forEach((t) => t.stop());
            stream.current = null;
            setError(e?.name === 'NotAllowedError' ? 'Microphone permission was blocked. Allow it in your browser settings and try again.'
                : e?.name === 'NotFoundError' ? 'No microphone was found on this device.' : 'Could not start recording.');
        } finally {
            starting.current = false;
        }
    }, [cleanup]);

    const stop = useCallback((cancel = false) => new Promise((resolve) => {
        const rec = recorder.current;
        if (!rec || rec.state === 'inactive') { resolve(null); return; }
        discard.current = cancel;
        resolver.current = resolve;
        rec.stop();
    }), []);

    // Leaving the page while recording releases the microphone and drops the clip.
    useEffect(() => () => {
        discard.current = true;
        if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
        else cleanup();
    }, [cleanup]);

    return { recording, seconds, error, start, stop, clearError: () => setError('') };
}
