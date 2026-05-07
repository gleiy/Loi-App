/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, FormEvent } from "react";
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Send, 
  User, 
  GraduationCap, 
  Loader2, 
  Volume2, 
  VolumeX,
  RefreshCcw,
  MessageSquare,
  Sparkles,
  Mic,
  MicOff,
  Settings,
  Globe,
  Video,
  Phone,
  PhoneOff
} from "lucide-react";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface Voice {
  id: string;
  name: string;
  gender: "Female" | "Male";
  lang: string;
  locale: string;
}

const VOICES: Voice[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (ElevenLabs)", gender: "Female", lang: "English (US)", locale: "en-US" },
  { id: "TX3OmZsPIl5K0X8Q9cW9", name: "Josh (ElevenLabs)", gender: "Male", lang: "English (US)", locale: "en-US" },
  { id: "en-US-JennyNeural", name: "Jenny (Microsoft)", gender: "Female", lang: "English (US)", locale: "en-US" },
  { id: "en-US-AndrewNeural", name: "Andrew (Microsoft)", gender: "Male", lang: "English (US)", locale: "en-US" },
  { id: "en-GB-SoniaNeural", name: "Sonia (Microsoft)", gender: "Female", lang: "English (UK)", locale: "en-GB" },
  { id: "es-ES-ElviraNeural", name: "Elvira (Microsoft)", gender: "Female", lang: "Spanish (ES)", locale: "es-ES" },
];

type ThemeType = "midnight" | "library" | "cyber";

interface Theme {
  id: ThemeType;
  name: string;
  bg: string;
  sidebar: string;
  accent: string;
  card: string;
  text: string;
  ring: string;
}

const THEMES: Record<ThemeType, Theme> = {
  midnight: {
    id: "midnight",
    name: "Midnight Academy",
    bg: "bg-[#0F1016]",
    sidebar: "bg-[#1A1C26]",
    accent: "bg-[#4E5BFF]",
    card: "bg-white/5",
    text: "text-white",
    ring: "ring-[#4E5BFF]/50"
  },
  library: {
    id: "library",
    name: "Royal Library",
    bg: "bg-[#FDFCF8]",
    sidebar: "bg-[#F3EFE0]",
    accent: "bg-[#7A5C41]",
    card: "bg-[#FCFAF2] border-stone-200",
    text: "text-stone-900",
    ring: "ring-stone-200"
  },
  cyber: {
    id: "cyber",
    name: "Cyber Punk",
    bg: "bg-[#050505]",
    sidebar: "bg-[#0D0D0D]",
    accent: "bg-[#00FF41]",
    card: "bg-[#111111] border-[#00FF41]/30",
    text: "text-[#00FF41]",
    ring: "ring-[#00FF41]/40"
  }
};

interface Message {
  id: string;
  role: "user" | "tutor";
  text: string;
  videoUrl?: string;
  timestamp: Date;
}

const TUTOR_IMAGE = "https://i.ibb.co/1G0MXwFc/IMG-20260224-WA0017-jpg.jpg";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "tutor",
      text: "Hello! I am your English tutor. How can I help you practice today? I've set up our live video link!",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [currentTalkId, setCurrentTalkId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [lastVideoUrl, setLastVideoUrl] = useState<string | null>(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState<Voice>(VOICES[0]);
  const [currentTheme, setCurrentTheme] = useState<Theme>(THEMES.midnight);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"voices" | "themes">("voices");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef<string>("");

  const handleSubmitRef = useRef<any>(null);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  // Track the latest input for speech
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  // Call Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCallActive) {
      timer = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [isCallActive]);

  // Auto-Listening Logic
  const shouldBeListening = isCallActive && isMicEnabled && !isGeneratingVideo && !isGeneratingText && !isPlayingVideo && !micError;

  useEffect(() => {
    let restartTimer: NodeJS.Timeout;

    if (shouldBeListening && !isListening) {
      restartTimer = setTimeout(() => {
        if (!recognitionRef.current) return;
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error("Auto-start mic Error:", e);
        }
      }, 1000);
    } else if (!shouldBeListening && isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    }

    return () => clearTimeout(restartTimer);
  }, [isCallActive, isMicEnabled, isGeneratingVideo, isGeneratingText, isPlayingVideo, isListening, micError]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleCall = () => {
    if (isCallActive) {
      setIsCallActive(false);
      try { recognitionRef.current?.stop(); } catch(e) {}
      window.speechSynthesis.cancel();
    } else {
      // Unlock speech synthesis on user interaction
      const unlockUtterance = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(unlockUtterance);

      setMicError(null);
      setIsCallActive(true);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "tutor",
        text: "Call started. I'm listening!",
        timestamp: new Date()
      }]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Speech Recognition Setup
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const isSpeechSupported = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
    
    if (isSpeechSupported) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      try {
        recognition.lang = selectedVoice.locale;
      } catch (e) {
        recognition.lang = "en-US";
      }

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
        baseInputRef.current = inputRef.current.trim();
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentSpeech = (finalTranscript + " " + interimTranscript).trim();
        if (currentSpeech) {
          const prefix = baseInputRef.current ? baseInputRef.current + " " : "";
          const combinedText = prefix + currentSpeech;
          setInput(combinedText);

          // Reset silence timer whenever we get a result
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          
          silenceTimerRef.current = setTimeout(() => {
            if (combinedText) {
              if (handleSubmitRef.current) {
                handleSubmitRef.current(undefined, combinedText);
              }
              // Stop recognition to process and let the response play
              recognition.stop();
            }
          }, 1500); // 1.5 seconds of silence for natural flow
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'network') {
          if (event.error === 'network') {
            console.warn("Speech Recognition Network connection lost. Retrying quietly...");
          }
          setIsListening(false);
          return;
        }

        console.error("Speech Recognition Error:", event.error);
        setIsListening(false);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        
        const errorMessages: Record<string, string> = {
          'not-allowed': "Microphone access denied. Please check your browser/system permissions.",
          'language-not-supported': `Language ${selectedVoice.locale} is not supported by your browser.`,
          'aborted': "Recognition was stopped manually.",
          'service-not-allowed': "Speech service not allowed. Your browser might be blocking this feature."
        };

        const friendlyMsg = errorMessages[event.error] || `Microphone error: ${event.error}`;
        setMicError(friendlyMsg);
        
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsCallActive(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      recognitionRef.current = recognition;
    }
  }, [selectedVoice.locale]);

  // Poll for D-ID video status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentTalkId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/avatar/status/${currentTalkId}`);
          const data = await res.json();
          
          if (data.status === "done") {
            const videoUrl = data.result_url;
            setMessages(prev => prev.map(m => 
              m.id === currentTalkId ? { ...m, videoUrl } : m
            ));
            setLastVideoUrl(videoUrl);
            setCurrentTalkId(null);
            setIsGeneratingVideo(false);
            clearInterval(interval);
          } else if (data.status === "error") {
            setCurrentTalkId(null);
            setIsGeneratingVideo(false);
            clearInterval(interval);
            console.error("D-ID Error:", data);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [currentTalkId]);

  const clearChat = () => {
    setMessages([{
      id: "1",
      role: "tutor",
      text: "Chat cleared. How can I help you practice now?",
      timestamp: new Date(),
    }]);
    setLastVideoUrl(null);
  };

  const handleSubmit = async (e?: FormEvent, overrideText?: string) => {
    e?.preventDefault();
    const textToSubmit = (overrideText || input).trim();
    if (!textToSubmit || isGeneratingText || isGeneratingVideo) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      text: textToSubmit,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsGeneratingText(true);

    try {
      // Improved prompt with explicit instructions
      // Include the user message in context since state hasn't updated yet in this render cycle
      const context = [...messages, userMessage];
      const prompt = `You are a friendly and academic English tutor. 
      Help the user practice conversation, correct subtle mistakes, 
      and use interesting metaphors. Keep answers concise (max 2-3 sentences).
      
      Conversation History:
      ${context.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.text}`).join("\n")}
      
      USER: "${textToSubmit}"
      TUTOR:`;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      });
      
      const tutorText = response.text || "I'm sorry, I encountered an issue with my neural link. Could you repeat that?";
      setIsGeneratingText(false);
      
      const tutorMessageId = Date.now().toString();
      const tutorMessage: Message = {
        id: tutorMessageId,
        role: "tutor",
        text: tutorText,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, tutorMessage]);
      
      // Speak the text using Web Speech API as fallback/immediate response
      if (!isMuted) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(tutorText);
        utterance.lang = selectedVoice.locale || "en-US";
        window.speechSynthesis.speak(utterance);
      }

      setIsGeneratingVideo(true);

      const createRes = await fetch("/api/avatar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: tutorText,
          voiceId: selectedVoice.id 
        }),
      });
      
      if (!createRes.ok) {
        const errorData = await createRes.json().catch(() => ({}));
        throw new Error(`D-ID Error: ${errorData.error || createRes.status}`);
      }

      const createData = await createRes.json();
      
      if (createData.id) {
        setMessages(prev => prev.map(m => m.id === tutorMessageId ? { ...m, id: createData.id } : m));
        setCurrentTalkId(createData.id);
      } else {
        throw new Error(createData.error || "No talk ID returned from D-ID");
      }

    } catch (error: any) {
      console.error("Interaction Error Details:", error);
      setIsGeneratingText(false);
      setIsGeneratingVideo(false);
      
      const errorMessage = error.message.includes("D-ID") 
        ? `(System: Video generation failed - ${error.message})`
        : `(System: Neural connection interrupted - ${error.message || "Unknown Error"})`;

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "tutor",
        text: errorMessage,
        timestamp: new Date()
      }]);
    }
  };

  return (
    <div className={`h-screen ${currentTheme.bg} font-sans ${currentTheme.text} overflow-hidden flex flex-col-reverse md:flex-row transition-all duration-500`}>
      {/* Sidebar / Messages */}
      <aside className={`w-full md:w-[400px] h-[60vh] md:h-full ${currentTheme.sidebar} border-r border-white/5 flex flex-col z-20 shadow-2xl shrink-0`}>
        <header className="p-6 border-b border-white/5 bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`${currentTheme.accent} p-2 rounded-xl transition-all duration-500`}>
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-semibold text-lg tracking-tight">AI Practice</h1>
              <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">Interactive Session</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={clearChat}
              title="Clear Chat"
              className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors"
            >
              <RefreshCcw size={18} />
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-all duration-300 ${showSettings ? currentTheme.accent + ' text-white shadow-lg' : 'hover:bg-white/5 opacity-40 hover:opacity-100'}`}
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-black/10 border-b border-white/5 p-6 overflow-hidden"
          >
            <div className="flex gap-4 mb-6 border-b border-white/10">
              <button 
                onClick={() => setSettingsTab("voices")}
                className={`pb-2 text-[10px] font-bold uppercase tracking-widest transition-all ${settingsTab === "voices" ? "text-white border-b-2 border-white" : "text-white/40"}`}
              >
                Voices
              </button>
              <button 
                onClick={() => setSettingsTab("themes")}
                className={`pb-2 text-[10px] font-bold uppercase tracking-widest transition-all ${settingsTab === "themes" ? "text-white border-b-2 border-white" : "text-white/40"}`}
              >
                Themes
              </button>
            </div>

            {settingsTab === "voices" ? (
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                {VOICES.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedVoice.id === voice.id 
                        ? `${currentTheme.accent} border-transparent shadow-lg text-white` 
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <p className="text-xs font-bold">{voice.name}</p>
                    <p className="text-[10px] opacity-60 mt-1 uppercase tracking-tight">{voice.lang}</p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {Object.values(THEMES).map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setCurrentTheme(theme)}
                    className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                      currentTheme.id === theme.id 
                        ? `${currentTheme.accent} border-transparent text-white` 
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <span className="text-xs font-bold">{theme.name}</span>
                    <div className="flex gap-1">
                      <div className={`w-3 h-3 rounded-full ${theme.bg}`} />
                      <div className={`w-3 h-3 rounded-full ${theme.accent}`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex flex-col gap-2 ${message.role === "user" ? "items-end" : "items-start"}`}
              >
                <div className={`px-4 py-3 rounded-2xl max-w-[90%] text-sm leading-relaxed shadow-sm transition-all ${
                  message.role === "user" 
                    ? `${currentTheme.accent} text-white rounded-tr-none` 
                    : `${currentTheme.card} ${currentTheme.id === 'library' ? 'border' : 'border border-white/10'} rounded-tl-none`
                }`}>
                  {message.text}
                </div>
                <span className="text-[10px] opacity-20 font-medium px-2">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          {isGeneratingText && (
            <div className="flex gap-2 p-2">
              <div className={`w-1.5 h-1.5 ${currentTheme.accent} rounded-full animate-bounce [animation-delay:-0.3s]`} />
              <div className={`w-1.5 h-1.5 ${currentTheme.accent} rounded-full animate-bounce [animation-delay:-0.15s]`} />
              <div className={`w-1.5 h-1.5 ${currentTheme.accent} rounded-full animate-bounce`} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Improved Input */}
        <div className="p-6 bg-black/20 border-t border-white/5">
          {micError && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="mb-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col gap-2 text-red-500"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{micError}</span>
                </div>
                <button 
                  onClick={() => setMicError(null)}
                  className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
                >
                  Dismiss
                </button>
              </div>
              {micError.includes("Network") || micError.includes("Chrome") ? (
                <p className="text-[9px] opacity-70 leading-relaxed italic">
                  Tip: The Web Speech API works best on Desktop Chrome. Some other browsers require a stable connection to Google/Apple servers for real-time transcription.
                </p>
              ) : null}
            </motion.div>
          )}
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={shouldBeListening ? "Listening..." : "Message your tutor..."}
              disabled={isGeneratingText || isGeneratingVideo}
              className={`w-full ${currentTheme.card} border-white/10 rounded-2xl px-6 py-4 pr-24 text-sm outline-none transition-all disabled:opacity-50 focus:border-white/20`}
            />
            <div className="absolute right-2 top-2 bottom-2 flex gap-1">
              <button
                type="button"
                onClick={() => setIsMicEnabled(!isMicEnabled)}
                title={isMicEnabled ? "Mute Microphone" : "Unmute Microphone"}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  !isMicEnabled 
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" 
                    : shouldBeListening 
                      ? "bg-red-500 text-white shadow-lg shadow-red-500/25" 
                      : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {/* Make microphone throb gently when actually listening */}
                <div className={shouldBeListening ? "animate-pulse" : ""}>
                  {!isMicEnabled ? <MicOff size={18} /> : <Mic size={18} />}
                </div>
              </button>
              <button
                type="submit"
                disabled={!input.trim() || isGeneratingText || isGeneratingVideo}
                className={`w-10 h-10 rounded-xl ${currentTheme.accent} text-white flex items-center justify-center disabled:opacity-30 transition-all shadow-lg hover:brightness-110`}
              >
                {isGeneratingText || isGeneratingVideo ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </form>
        </div>
      </aside>

      {/* Main Content - Live Avatar Stage */}
      <main className="flex-1 relative bg-black flex flex-col items-center justify-center p-4 lg:p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
          <div className={`absolute top-[-10%] right-[-10%] w-[50%] h-[50%] ${currentTheme.accent} blur-[120px] rounded-full`} />
          <div className={`absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] ${currentTheme.accent} blur-[120px] rounded-full`} />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`relative w-full max-w-[340px] aspect-[9/16] ${currentTheme.id === 'library' ? 'bg-[#EBE7D9]' : 'bg-[#1A1C26]'} rounded-[3.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] border border-white/10 ring-8 ${currentTheme.id === 'library' ? 'ring-[#F3EFE0]' : 'ring-white/5'} transition-all duration-500`}
        >
          {/* Avatar Video Stage */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            {lastVideoUrl ? (
              <video
                key={lastVideoUrl}
                src={lastVideoUrl}
                autoPlay
                playsInline
                muted={isMuted}
                className="w-full h-full object-cover"
                onPlay={() => {
                  setIsPlayingVideo(true);
                  window.speechSynthesis.cancel();
                }}
                onEnded={() => {
                  setIsPlayingVideo(false);
                }}
              />
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <img 
                  src={TUTOR_IMAGE} 
                  alt="Tutor"
                  className="w-full h-full object-cover opacity-60 grayscale-[0.5] contrast-[1.1]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  {(isGeneratingText || isGeneratingVideo) ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <Loader2 size={40} className="text-white animate-spin" />
                        <div className="absolute inset-0 bg-white/20 blur-xl animate-pulse rounded-full" />
                      </div>
                      <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-white animate-pulse">
                        {isGeneratingText ? "Thinking..." : "Generating Video..."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center animate-pulse backdrop-blur-md border border-white/20">
                        <Video size={32} className="text-white/40" />
                      </div>
                      <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/40">Neural Link Ready</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Interface Overlays */}
          <div className="absolute top-10 left-8 flex items-center gap-3 z-30">
            <div className={`px-3 py-1 rounded-full flex items-center gap-2 shadow-lg transition-all ${isCallActive ? 'bg-red-500' : 'bg-white/10 backdrop-blur-md'}`}>
              <div className={`w-1.5 h-1.5 bg-white rounded-full ${isCallActive ? 'animate-pulse' : 'opacity-40'}`} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-white">
                {isCallActive ? 'Live Session' : 'Offline'}
              </span>
            </div>
          </div>

          <AnimatePresence>
            {!isCallActive && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]"
              >
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleCall}
                  className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.4)] transition-all group"
                >
                  <Phone className="text-white w-10 h-10 group-hover:rotate-12 transition-transform" />
                </motion.button>
                <div className="mt-8 text-center">
                  <h3 className="text-xl font-bold tracking-tight text-white">Call Tutor</h3>
                  <p className="text-xs text-white/40 uppercase tracking-[0.2em] mt-2 font-bold">Start voice practice</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-12 right-6 left-6 flex flex-col gap-4 z-30">
            <div className="bg-black/40 backdrop-blur-xl p-5 rounded-3xl border border-white/10 shadow-2xl">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 ${currentTheme.accent} rounded-full flex-shrink-0 ${isCallActive ? 'animate-pulse' : ''}`} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{selectedVoice.name} (Tutor)</span>
              </div>
              <p className="text-[13px] font-medium text-white/90 leading-relaxed italic">
                "{messages[messages.length - 1]?.role === 'tutor' ? messages[messages.length - 1].text : 'Ready for practice...'}"
              </p>
            </div>

            <div className="flex gap-4 justify-center">
              {isCallActive ? (
                <button 
                  onClick={toggleCall}
                  className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-red-600 transition-all active:scale-95"
                >
                  <PhoneOff size={28} />
                </button>
              ) : (
                <button 
                  onClick={toggleCall}
                  className="w-14 h-14 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-all active:scale-95"
                >
                  <Phone size={24} />
                </button>
              )}
              <button 
                onClick={() => setIsMuted(!isMuted)}
                className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
              >
                {isMuted ? (
                  <VolumeX size={24} className="text-white/60" />
                ) : (
                  <Volume2 size={24} className="text-white/60" />
                )}
              </button>
              <button 
                onClick={() => {
                  const currentIndex = VOICES.findIndex((v) => v.id === selectedVoice.id);
                  const nextIndex = (currentIndex + 1) % VOICES.length;
                  setSelectedVoice(VOICES[nextIndex]);
                }}
                className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
              >
                <RefreshCcw size={24} className="text-white/60" />
              </button>
            </div>
          </div>

          {/* Call Status Overlay */}
          <AnimatePresence>
            {isCallActive && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-10 right-8 flex items-center gap-4 bg-black/40 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 z-30"
              >
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-red-500">Call in Progress</span>
                  <span className="text-xs font-mono text-white/80">{formatDuration(callDuration)}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Animating Overlay */}
          <AnimatePresence>
            {isGeneratingVideo && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-6 z-20"
              >
                <div className="relative">
                  <div className={`w-24 h-24 border-8 border-white/5 rounded-full`} />
                  <div className={`absolute inset-0 w-24 h-24 border-t-8 ${currentTheme.accent} rounded-full animate-spin`} />
                </div>
                <div className="text-center px-8">
                  <p className="text-xs font-bold uppercase tracking-[0.3em] text-white animate-pulse">Syncing Avatar</p>
                  <p className="text-[10px] text-white/30 mt-2 font-medium">Generating visual response...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="mt-12 flex gap-8 md:gap-12 opacity-20 hidden md:flex">
          <div className="flex items-center gap-4">
            <MessageSquare size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Active NLP</span>
          </div>
          <div className="flex items-center gap-4">
            <Sparkles size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">GenAI Engine</span>
          </div>
          <div className="flex items-center gap-4">
            <Video size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Neural Vision</span>
          </div>
        </div>
      </main>
    </div>
  );
}
