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

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<Promise<any> | null>(null);
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
        sessionRef.current.then((session: any) => {
             if(session.close) session.close();
        }).catch(() => {});
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
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();

    setIsConnected(false);
    setIsSpeaking(false);
    setVolume(0);
  }, []);

  const connect = useCallback(async () => {
    try {
      if (!process.env.API_KEY) {
        console.error("API Key not found");
        return;
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      // CRITICAL for iOS: Resume context on user interaction
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume();
      }
      audioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }
      inputAudioContextRef.current = inputCtx;

      const analyser = outputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      analyser.connect(outputCtx.destination);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let systemInstruction = `You are a helpful and patient language tutor. Your goal is to help the user practice speaking ${language}. The user's proficiency level is ${proficiency}. `;

      switch (mode) {
        case PracticeMode.ROLE_PLAY:
          systemInstruction += `Mode: Role Play. Stay in character.`;
          break;
        case PracticeMode.GRAMMAR_FOCUS:
          systemInstruction += `Mode: Grammar Focus. Correct mistakes explicitly.`;
          break;
        default:
          systemInstruction += `Mode: Free Talk. Natural conversation.`;
          break;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
          systemInstruction: systemInstruction,
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
              sessionPromise.then((session: any) => {
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
              if (nextStartTimeRef.current < currentTime) {
                nextStartTimeRef.current = currentTime;
              }
              
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
               sourcesRef.current.forEach(s => s.stop());
               sourcesRef.current.clear();
               nextStartTimeRef.current = 0;
               setIsSpeaking(false);
            }
          },
          onclose: () => disconnect(),
          onerror: () => disconnect()
        }
      });

      sessionRef.current = sessionPromise;

    } catch (error) {
      console.error("Connection failed", error);
      disconnect();
    }
  }, [language, proficiency, voiceName, mode, disconnect, addMessage]);

  useEffect(() => {
    let animationFrameId: number;
    const updateVolume = () => {
        if (analyserRef.current) {
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
  }, [isSpeaking]);

  return { connect, disconnect, isConnected, isSpeaking, messages, volume };
};