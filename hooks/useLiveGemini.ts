
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ChatMessage, Language, Proficiency, VoiceName, PracticeMode } from '../types';
import { base64ToUint8Array, createPcmBlob, decodeAudioData } from '../utils/audioUtils';

interface UseLiveGeminiProps {
  language: Language;
  proficiency: Proficiency;
  voiceName: VoiceName;
  mode: PracticeMode;
}

export const useLiveGemini = ({ language, proficiency, voiceName, mode }: UseLiveGeminiProps) => {
  const [isConnected, setIsConnected] = useState(false);
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
        { id: Date.now().toString(), role, text, timestamp: new Date(), isFinal }
      ];
    });
  }, []);

  const disconnect = useCallback(() => {
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

    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close().catch(() => {});
      inputAudioContextRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    sourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();

    setIsConnected(false);
    setIsSpeaking(false);
    setVolume(0);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    try {
      // Kiểm tra API Key từ process.env.API_KEY theo yêu cầu
      const apiKey = process.env.API_KEY;
      
      if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
        throw new Error("MISSING_API_KEY");
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      if (outputCtx.state === 'suspended') await outputCtx.resume();
      audioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      inputAudioContextRef.current = inputCtx;

      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      analyser.connect(outputCtx.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey });
      
      const systemInstruction = `You are a helpful and patient language tutor. Help the user practice ${language}. Proficiency: ${proficiency}. Practice Mode: ${mode}. Focus on natural conversation and provide gentle corrections only when necessary.`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.outputTranscription) {
               addMessage('model', msg.serverContent.outputTranscription.text, false);
            } else if (msg.serverContent?.inputTranscription) {
               addMessage('user', msg.serverContent.inputTranscription.text, false);
            }
            
            if (msg.serverContent?.turnComplete) {
               setIsSpeaking(false);
            }

            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputCtx) {
              setIsSpeaking(true);
              const audioBuffer = await decodeAudioData(base64ToUint8Array(audioData), outputCtx, 24000, 1);
              
              const currentTime = outputCtx.currentTime;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, currentTime);
              
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(analyser);
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
          onclose: () => disconnect(),
          onerror: (e) => {
            console.error("Live session error", e);
            setError("Lỗi kết nối Gemini. Vui lòng kiểm tra lại API Key hoặc mạng.");
            disconnect();
          }
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (error: any) {
      console.error("Connection error:", error);
      if (error.message === "MISSING_API_KEY") {
        setError("API Key chưa được cấu hình. Hãy đổi tên GEMINI_API_KEY thành API_KEY trong Vercel Settings.");
      } else if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setError("Không thể truy cập Microphone. Vui lòng tắt Vercel Toolbar hoặc dùng domain trực tiếp.");
      } else {
        setError(error.message || "Lỗi không xác định khi kết nối.");
      }
      disconnect();
      throw error;
    }
  }, [language, proficiency, voiceName, mode, disconnect, addMessage]);

  useEffect(() => {
    let animationFrameId: number;
    const updateVolume = () => {
        if (analyserRef.current && isConnected) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
            setVolume(sum / dataArray.length / 128); 
        } 
        animationFrameId = requestAnimationFrame(updateVolume);
    };
    updateVolume();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isConnected]);

  return { connect, disconnect, isConnected, isSpeaking, messages, volume, error };
};
