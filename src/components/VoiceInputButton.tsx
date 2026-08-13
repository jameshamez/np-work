import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  buttonText?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  className = '',
  buttonText = 'ถอดความเสียง (Voice-to-Text)',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [unsupportedMsg, setUnsupportedMsg] = useState('');

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
    }
  }, []);

  const toggleListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setUnsupportedMsg('เบราว์เซอร์นี้ยังไม่รองรับระบบถอดความเสียงภาษาไทย (Speech Recognition)');
      setTimeout(() => setUnsupportedMsg(''), 4000);
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'th-TH';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcriptText = event.results[0][0].transcript;
        if (transcriptText) {
          onTranscript(transcriptText);
        }
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
        isListening
          ? 'bg-red-500 text-white animate-pulse shadow-md'
          : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
      } ${className}`}
      title={supported ? 'กดพูดเพื่อแปลงเสียงเป็นข้อความ' : 'เบราว์เซอร์ไม่รองรับ'}
    >
      {isListening ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>กำลังฟังเสียง...</span>
        </>
      ) : (
        <>
          <Mic className="w-3.5 h-3.5 text-orange-600" />
          <span>{buttonText}</span>
        </>
      )}
    </button>
  );
};
