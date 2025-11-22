// utils/AudioManager.ts
// 使用 Web Audio API 生成音符聲音

interface NoteFrequency {
  [key: string]: number;
}

// 定義 Web Audio API 類型（避免 TypeScript 錯誤）
type AudioContextType = any;
type GainNodeType = any;
type OscillatorNodeType = any;

class AudioManager {
  private audioContext: AudioContextType | null;
  private gainNode: GainNodeType | null;
  private activeOscillators: Map<string, OscillatorNodeType>;
  private isInitialized: boolean;
  private noteFrequencies: NoteFrequency;

  constructor() {
    this.audioContext = null;
    this.gainNode = null;
    this.activeOscillators = new Map();
    this.isInitialized = false;
    
    // 定義所有音符的頻率（從C0到C8）
    this.noteFrequencies = this.generateNoteFrequencies();
  }

  // 生成所有音符的頻率表
  private generateNoteFrequencies(): NoteFrequency {
    const frequencies: NoteFrequency = {};
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // A4 = 440 Hz 作為參考
    const A4 = 440;
    const A4_INDEX = 57; // C0 為 0，A4 為第57個半音
    
    for (let octave = 0; octave <= 8; octave++) {
      for (let i = 0; i < noteNames.length; i++) {
        const noteName = `${noteNames[i]}${octave}`;
        const noteIndex = octave * 12 + i;
        const frequency = A4 * Math.pow(2, (noteIndex - A4_INDEX) / 12);
        frequencies[noteName] = frequency;
      }
    }
    
    return frequencies;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 創建 Web Audio Context
      // @ts-ignore - Web Audio API 可能不在所有環境中可用
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.gain.value = 0.3; // 設置音量為30%
        
        this.isInitialized = true;
        console.log('AudioManager 初始化成功 (使用 Web Audio API)');
      } else {
        console.warn('Web Audio API 不可用');
      }
    } catch (error) {
      console.error('AudioManager 初始化失敗:', error);
    }
  }

  async playNote(noteName: string, duration: number = 0.5): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.audioContext || !this.gainNode) {
      console.warn('AudioContext 未初始化');
      return;
    }

    try {
      const frequency = this.noteFrequencies[noteName];
      if (!frequency) {
        console.warn(`未找到音符頻率: ${noteName}`);
        return;
      }

      // 如果該音符已經在播放，先停止
      this.stopNote(noteName);

      // 創建振盪器（音源）
      const oscillator = this.audioContext.createOscillator();
      const noteGain = this.audioContext.createGain();
      
      oscillator.type = 'sine'; // 使用正弦波（鋼琴音色可以用更複雜的波形）
      oscillator.frequency.value = frequency;
      
      // 連接音頻節點
      oscillator.connect(noteGain);
      noteGain.connect(this.gainNode);
      
      // 設置音量包絡（ADSR - 簡化版）
      const now = this.audioContext.currentTime;
      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.linearRampToValueAtTime(0.3, now + 0.01); // Attack
      noteGain.gain.linearRampToValueAtTime(0.2, now + 0.1); // Decay to Sustain
      noteGain.gain.linearRampToValueAtTime(0, now + duration); // Release
      
      // 開始播放
      oscillator.start(now);
      oscillator.stop(now + duration);
      
      // 保存到活動振盪器列表
      this.activeOscillators.set(noteName, oscillator);
      
      // 播放結束後清理
      oscillator.onended = () => {
        this.activeOscillators.delete(noteName);
      };
      
    } catch (error) {
      console.error(`播放音符 ${noteName} 失敗:`, error);
    }
  }

  stopNote(noteName: string): void {
    const oscillator = this.activeOscillators.get(noteName);
    if (oscillator) {
      try {
        oscillator.stop();
        oscillator.disconnect();
        this.activeOscillators.delete(noteName);
      } catch (error) {
        // 振盪器可能已經停止
      }
    }
  }

  async stopAll(): Promise<void> {
    try {
      for (const [noteName, oscillator] of this.activeOscillators.entries()) {
        try {
          oscillator.stop();
          oscillator.disconnect();
        } catch (error) {
          // 忽略已經停止的振盪器
        }
      }
      this.activeOscillators.clear();
    } catch (error) {
      console.error('停止所有音符失敗:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.stopAll();
      
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }
      
      this.gainNode = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('清理 AudioManager 失敗:', error);
    }
  }
}

export default new AudioManager();
