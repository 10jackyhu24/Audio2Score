// utils/AudioManager.ts
// 跨平台音頻管理器：Web 使用 Web Audio API，手機使用 Expo AV
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

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
  private soundObjects: Map<string, Audio.Sound>;
  private isInitialized: boolean;
  private noteFrequencies: NoteFrequency;
  private isWeb: boolean;
  private soundPool: Audio.Sound[];
  private maxPoolSize: number;
  private currentPoolIndex: number;
  private initProgress: number;
  private onInitProgressCallback: ((progress: number) => void) | null;
  private activeSounds: Set<Audio.Sound>; // 追蹤活躍的音頻實例

  constructor() {
    this.audioContext = null;
    this.gainNode = null;
    this.activeOscillators = new Map();
    this.soundObjects = new Map();
    this.isInitialized = false;
    this.isWeb = Platform.OS === 'web';
    this.soundPool = [];
    this.maxPoolSize = 20; // 增加到 20 個實例以支持更多同時播放的音符
    this.currentPoolIndex = 0;
    this.initProgress = 0;
    this.onInitProgressCallback = null;
    this.activeSounds = new Set();
    
    // 定義所有音符的頻率（從C0到C8）
    this.noteFrequencies = this.generateNoteFrequencies();
  }

  // 設置初始化進度回調
  setOnInitProgress(callback: (progress: number) => void): void {
    this.onInitProgressCallback = callback;
  }

  // 更新初始化進度
  private updateInitProgress(progress: number): void {
    this.initProgress = progress;
    if (this.onInitProgressCallback) {
      this.onInitProgressCallback(progress);
    }
  }

  // 獲取當前初始化進度
  getInitProgress(): number {
    return this.initProgress;
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
    if (this.isInitialized) {
      this.updateInitProgress(100);
      return;
    }

    // 防止重複初始化
    if (this.initProgress > 0 && this.initProgress < 100) {
      console.log('⚠️ AudioManager 正在初始化中，請稍候...');
      return;
    }

    try {
      this.updateInitProgress(10);
      
      if (this.isWeb) {
        // Web 環境：使用 Web Audio API
        // @ts-ignore - Web Audio API 可能不在所有環境中可用
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        
        if (AudioContextClass) {
          this.updateInitProgress(30);
          this.audioContext = new AudioContextClass();
          
          // 添加動態壓縮器以減少雜訊和削波
          const compressor = this.audioContext.createDynamicsCompressor();
          compressor.threshold.value = -24; // 壓縮閾值
          compressor.knee.value = 30;       // 漸進壓縮
          compressor.ratio.value = 12;      // 壓縮比
          compressor.attack.value = 0.003;  // 快速響應
          compressor.release.value = 0.25;  // 釋放時間
          
          this.updateInitProgress(60);
          this.gainNode = this.audioContext.createGain();
          this.gainNode.gain.value = 0.25; // 全局音量
          
          // 連接：增益 -> 壓縮器 -> 輸出
          this.gainNode.connect(compressor);
          compressor.connect(this.audioContext.destination);
          
          this.updateInitProgress(100);
          this.isInitialized = true;
          console.log('✅ AudioManager 初始化成功 (Web - Web Audio API)');
        } else {
          console.warn('Web Audio API 不可用');
        }
      } else {
        // React Native 環境：設置音頻模式
        this.updateInitProgress(20);
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false, // 使用揚聲器
          interruptionModeIOS: 1, // 混合模式
          interruptionModeAndroid: 1, // 不中斷其他音頻
        });
        
        this.updateInitProgress(40);
        // 預載音頻池
        await this.initializeSoundPool();
        
        this.updateInitProgress(100);
        this.isInitialized = true;
        console.log('✅ AudioManager 初始化成功 (Mobile - Expo AV)');
      }
    } catch (error) {
      console.error('AudioManager 初始化失敗:', error);
      this.updateInitProgress(100); // 即使失敗也標記為完成
    }
  }

  // 初始化音頻池（預載多個 Sound 實例）
  private async initializeSoundPool(): Promise<void> {
    try {
      console.log('🎵 正在初始化音頻池...');
      
      // 先檢查音頻文件是否存在
      const audioAsset = require('../../assets/piano-c4.wav');
      console.log('📦 音頻資源:', audioAsset);
      
      for (let i = 0; i < this.maxPoolSize; i++) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            audioAsset,
            { 
              shouldPlay: false,
              volume: 0.3,
              rate: 1.0,
              shouldCorrectPitch: false,
              isLooping: false,
            }
          );
          
          this.soundPool.push(sound);
          
          // 更新進度：40% + (50% * 進度)
          const poolProgress = ((i + 1) / this.maxPoolSize) * 50;
          this.updateInitProgress(40 + poolProgress);
          
          console.log(`✅ 音頻實例 ${i + 1}/${this.maxPoolSize} 載入完成`);
        } catch (soundError) {
          console.error(`❌ 載入音頻實例 ${i + 1} 失敗:`, soundError);
          // 繼續嘗試載入其他實例
        }
      }
      
      if (this.soundPool.length > 0) {
        console.log(`✅ 音頻池初始化完成，共 ${this.soundPool.length}/${this.maxPoolSize} 個實例`);
      } else {
        throw new Error('無法載入任何音頻實例');
      }
    } catch (error) {
      console.error('❌ 音頻池初始化失敗:', error);
      console.log('💡 將使用簡化模式（無聲音）');
      // 即使失敗也設置進度為完成
      this.updateInitProgress(90);
    }
  }

  async playNote(noteName: string, duration: number = 0.5): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isWeb) {
      // Web 環境使用 Web Audio API
      this.playNoteWeb(noteName, duration);
    } else {
      // Mobile 環境使用簡化的音效（震動反饋）
      this.playNoteMobile(noteName, duration);
    }
  }

  private playNoteWeb(noteName: string, duration: number): void {
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

      // 創建振盪器（音源）和濾波器（減少雜訊）
      const oscillator = this.audioContext.createOscillator();
      const noteGain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      
      // 使用 sine 波形（最純淨，雜訊最少）
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      
      // 添加低通濾波器以減少高頻雜訊
      filter.type = 'lowpass';
      filter.frequency.value = Math.min(frequency * 4, 8000); // 限制高頻
      filter.Q.value = 0.5; // 低 Q 值，平滑過渡
      
      // 連接音頻節點：振盪器 -> 濾波器 -> 增益 -> 主增益
      oscillator.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(this.gainNode);
      
      // 設置音量包絡（ADSR - 極度優化版，完全消除爆音和雜訊）
      const now = this.audioContext.currentTime;
      const attackTime = 0.003;  // 3ms 快速起音
      const decayTime = 0.03;    // 30ms 衰減
      const sustainLevel = 0.1;  // 持續音量（進一步降低）
      const releaseTime = 0.08;  // 80ms 釋放（更長的釋放）
      
      // 使用更平滑的音量曲線
      noteGain.gain.setValueAtTime(0, now); // 從 0 開始
      noteGain.gain.linearRampToValueAtTime(0.15, now + attackTime); // Attack（降低峰值）
      noteGain.gain.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.001), now + attackTime + decayTime); // Decay
      
      const sustainStart = now + attackTime + decayTime;
      const sustainEnd = now + Math.max(duration - releaseTime, attackTime + decayTime);
      noteGain.gain.setValueAtTime(Math.max(sustainLevel, 0.001), sustainStart);
      noteGain.gain.setValueAtTime(Math.max(sustainLevel, 0.001), sustainEnd);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Release
      
      // 開始播放
      oscillator.start(now);
      oscillator.stop(now + duration + 0.05); // 稍微延長確保釋放完整
      
      // 保存到活動振盪器列表
      this.activeOscillators.set(noteName, oscillator);
      
      // 播放結束後清理
      oscillator.onended = () => {
        try {
          oscillator.disconnect();
          filter.disconnect();
          noteGain.disconnect();
        } catch (e) {
          // 忽略斷開連接的錯誤
        }
        this.activeOscillators.delete(noteName);
      };
      
    } catch (error) {
      console.error(`播放音符 ${noteName} 失敗:`, error);
    }
  }

  private async playNoteMobile(noteName: string, duration: number): Promise<void> {
    try {
      // 如果音頻池未初始化，靜音播放
      if (this.soundPool.length === 0) {
        return;
      }

      const frequency = this.noteFrequencies[noteName];
      if (!frequency) {
        return;
      }

      // 計算播放速率（相對於 C4 = 261.63Hz）
      const baseFrequency = 261.63; // C4
      let playbackRate = frequency / baseFrequency;
      
      // 限制播放速率範圍，避免音質下降
      playbackRate = Math.min(Math.max(playbackRate, 0.5), 2.0);
      
      // 從音頻池中獲取下一個可用的 Sound 實例（輪詢方式）
      const sound = this.soundPool[this.currentPoolIndex];
      this.currentPoolIndex = (this.currentPoolIndex + 1) % this.maxPoolSize;

      // 優化的播放方式（減少卡頓）
      try {
        const status = await sound.getStatusAsync();
        
        // 如果正在播放且時間很短，創建新實例（避免截斷）
        if (status.isLoaded && status.isPlaying && status.positionMillis && status.positionMillis < 100) {
          // 創建臨時音頻實例來播放這個音符
          this.playTemporarySound(frequency, playbackRate, duration);
          return;
        }
        
        // 只在必要時停止
        if (status.isLoaded && status.isPlaying) {
          try {
            await sound.stopAsync();
          } catch (stopError) {
            // 停止失敗，使用臨時實例
            this.playTemporarySound(frequency, playbackRate, duration);
            return;
          }
        }
        
        if (!status.isLoaded) {
          return;
        }
        
        // 重設到開始位置
        await sound.setPositionAsync(0);
        
        // 使用批量設置減少操作次數
        await sound.setStatusAsync({
          rate: playbackRate,
          shouldCorrectPitch: false,
          volume: 0.3,
          isLooping: false,
          positionMillis: 0,
        });
        
        // 播放
        await sound.playAsync();
        
      } catch (e) {
        // 如果出錯，嘗試使用臨時實例
        this.playTemporarySound(frequency, playbackRate, duration);
      }

    } catch (error) {
      // 靜默失敗，不顯示錯誤（避免刷屏）
    }
  }

  // 創建臨時音頻實例來播放音符（當音頻池繁忙時）
  private async playTemporarySound(frequency: number, playbackRate: number, duration: number): Promise<void> {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/piano-c4.wav'),
        { 
          shouldPlay: false,
          volume: 0.3,
          rate: playbackRate,
          shouldCorrectPitch: false,
        }
      );
      
      this.activeSounds.add(sound);
      
      await sound.playAsync();
      
      // 播放完成後自動卸載
      setTimeout(async () => {
        try {
          await sound.unloadAsync();
          this.activeSounds.delete(sound);
        } catch (e) {
          // 忽略卸載錯誤
        }
      }, duration * 1000 + 200);
      
    } catch (error) {
      // 靜默失敗
    }
  }

  private async stopNoteMobile(noteName: string): Promise<void> {
    // 使用音頻池後，不需要手動管理單個音符的停止
    // 音符會自然結束或被新音符覆蓋
  }

  stopNote(noteName: string): void {
    if (this.isWeb) {
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
    } else {
      this.stopNoteMobile(noteName);
    }
  }

  async stopAll(): Promise<void> {
    try {
      if (this.isWeb) {
        for (const [noteName, oscillator] of this.activeOscillators.entries()) {
          try {
            oscillator.stop();
            oscillator.disconnect();
          } catch (error) {
            // 忽略已經停止的振盪器
          }
        }
        this.activeOscillators.clear();
      } else {
        // 停止音頻池中的所有音效
        for (const sound of this.soundPool) {
          try {
            await sound.stopAsync();
          } catch (error) {
            // 忽略錯誤
          }
        }
      }
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

      // 清理音頻池
      for (const sound of this.soundPool) {
        try {
          await sound.unloadAsync();
        } catch (error) {
          // 忽略錯誤
        }
      }
      this.soundPool = [];
      
      // 清理臨時音頻實例
      for (const sound of this.activeSounds) {
        try {
          await sound.unloadAsync();
        } catch (error) {
          // 忽略錯誤
        }
      }
      this.activeSounds.clear();
      
      this.gainNode = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('清理 AudioManager 失敗:', error);
    }
  }
}

export default new AudioManager();
