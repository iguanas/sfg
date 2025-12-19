'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  maxDuration?: number; // in seconds
}

type RecordingState = 'idle' | 'recording' | 'transcribing';

export function VoiceRecorder({
  onTranscription,
  disabled = false,
  maxDuration = 60,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (mediaRecorderRef.current && state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [state]);

  // Analyze audio levels for visualization
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average level
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(average / 255); // Normalize to 0-1

    if (state === 'recording') {
      animationRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, [state]);

  const startRecording = async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio analysis
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Create blob from chunks
        const audioBlob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType,
        });

        // Transcribe
        await transcribeAudio(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms

      setState('recording');
      setDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((d) => {
          if (d >= maxDuration - 1) {
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);

      // Start audio analysis
      analyzeAudio();
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setAudioLevel(0);
  }, []);

  const transcribeAudio = async (audioBlob: Blob) => {
    setState('transcribing');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Transcription failed');
      }

      const { text } = await response.json();

      if (text && text.trim()) {
        onTranscription(text.trim());
      } else {
        setError('No speech detected. Please try again.');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError(err instanceof Error ? err.message : 'Failed to transcribe audio');
    } finally {
      setState('idle');
      setDuration(0);
    }
  };

  const handleClick = () => {
    if (state === 'idle') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {/* Audio level ring */}
        {state === 'recording' && (
          <div
            className="absolute inset-0 rounded-full bg-red-500 opacity-30 transition-transform"
            style={{
              transform: `scale(${1 + audioLevel * 0.5})`,
            }}
          />
        )}

        <Button
          type="button"
          variant={state === 'recording' ? 'destructive' : 'outline'}
          size="icon"
          className={cn(
            'relative h-12 w-12 rounded-full transition-all',
            state === 'recording' && 'animate-pulse'
          )}
          onClick={handleClick}
          disabled={disabled || state === 'transcribing'}
        >
          {state === 'transcribing' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : state === 'recording' ? (
            <Square className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Status text */}
      <div className="text-xs text-center">
        {state === 'idle' && !error && (
          <span className="text-gray-500">Tap to record</span>
        )}
        {state === 'recording' && (
          <span className="text-red-500 font-medium">
            Recording {formatDuration(duration)}
          </span>
        )}
        {state === 'transcribing' && (
          <span className="text-blue-500">Transcribing...</span>
        )}
        {error && (
          <span className="text-red-500">{error}</span>
        )}
      </div>

      {/* Waveform visualization */}
      {state === 'recording' && (
        <div className="flex items-center gap-0.5 h-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-red-500 rounded-full transition-all"
              style={{
                height: `${Math.max(4, audioLevel * 16 * (1 + Math.random() * 0.5))}px`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
