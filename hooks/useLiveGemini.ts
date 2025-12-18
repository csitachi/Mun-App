
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ChatMessage, Language, Proficiency, VoiceName, PracticeMode } from '../types';
import { base64ToUint8Array, createPcmBlob, decodeAudioData } from '../utils/audioUtils';

export const useLiveGemini = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const addMessage = useCallback((role: 'user' | 'model', text: string, isFinal: boolean) => {
    setMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === role && !lastMsg.isFinal) {
        return [
          ...prev.slice(0, -1),
          { ...lastMsg, text: lastMsg.text + text, isFinal }
        ];
      }
      return [
        ...prev,
        { id: Math.random().toString(36).substr(2, 9), role, text, timestamp: new Date(), isFinal }
      ];
    });
  }, []);

  const disconnect = useCallback(() => {
    console.log("LinguaLive: Cleaning up session...");
    if (sessionRef.current) {
        try { sessionRef.current.close(); } catch (e) {}
        sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    [inputAudioContextRef, audioContextRef].forEach(ref => {
      if (ref.current) {
        ref.current.close().catch(() => {});
        ref.current = null;
      }
    });
    sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    setIsConnected(false);
    setIsConnecting(false);
    setIsSpeaking(false);
    setVolume(0);
  }, []);

  const connect = useCallback(async (config: { language: Language, proficiency: Proficiency, voiceName: VoiceName, mode: PracticeMode }) => {
    setError(null);
    setIsConnecting(true);

    if (!window.isSecureContext) {
      setError("Microphone requires a secure context (HTTPS).");
      setIsConnecting(false);
      return;
    }

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey || apiKey === "undefined") {
        throw new Error("API Key is missing. Please check your environment variables.");
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      inputAudioContextRef.current = inputCtx;

      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      analyser.connect(outputCtx.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = `You are a native ${config.language} tutor. The student is at ${config.proficiency} level. Mode: ${config.mode}. Keep responses brief and conversational. Provide gentle corrections for mistakes.`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } } },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              sessionPromise.then(session => session.sendRealtimeInput({ media: createPcmBlob(inputData) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.outputTranscription) addMessage('model', msg.serverContent.outputTranscription.text, false);
            if (msg.serverContent?.inputTranscription) addMessage('user', msg.serverContent.inputTranscription.text, false);
            if (msg.serverContent?.turnComplete) setIsSpeaking(false);

            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              setIsSpeaking(true);
              const audioBuffer = await decodeAudioData(base64ToUint8Array(audioData), audioContextRef.current, 24000, 1);
              const currentTime = audioContextRef.current.currentTime;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(analyserRef.current!);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
            }
            if (msg.serverContent?.interrupted) {
               sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               setIsSpeaking(false);
            }
          },
          onerror: (e) => {
            console.error("WebSocket Error:", e);
            setError("Connection lost. Please ensure you are not using the Vercel Toolbar and your API key is correct.");
            disconnect();
          },
          onclose: () => disconnect()
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error("Connection error:", err);
      setError(err.message || "Failed to establish connection.");
      disconnect();
    }
  }, [disconnect, addMessage]);

  useEffect(() => {
    let animationFrameId: number;
    const updateVolume = () => {
        if (analyserRef.current && isConnected) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            setVolume(sum / dataArray.length / 255); 
        } 
        animationFrameId = requestAnimationFrame(updateVolume);
    };
    updateVolume();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isConnected]);

  return { connect, disconnect, isConnected, isConnecting, isSpeaking, messages, volume, error };
};
