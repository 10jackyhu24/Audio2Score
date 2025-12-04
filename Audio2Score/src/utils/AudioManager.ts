// utils/AudioManager.ts
// 跨平台音頻管理器：Web 使用 Web Audio API，手機使用 Expo AV
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';

interface NoteFrequency {
  [key: string]: number;
}

// 定義 Web Audio API 類型（避免 TypeScript 錯誤）
type AudioContextType = any;
type GainNodeType = any;
type OscillatorNodeType = any;
type AudioBufferSourceNodeType = any;
type AudioBufferType = any;

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
  
  // Web 端音頻緩衝相關
  private audioBuffers: Map<string, AudioBufferType>; // 存儲所有音符的音頻緩衝
  private activeBufferSources: Map<string, AudioBufferSourceNodeType>;
  
  // 音頻文件映射
  private audioFileMap: { [key: string]: any };
  private currentVolume: number;

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
    this.audioBuffers = new Map();
    this.activeBufferSources = new Map();
    this.audioFileMap = {};
    this.currentVolume = 0.5;
    
    // 定義所有音符的頻率（從C0到C8）
    this.noteFrequencies = this.generateNoteFrequencies();
    
    // 初始化音頻文件映射
    this.initAudioFileMap();
  }

  // 初始化音頻文件映射（將音符名稱映射到音頻文件）
  private initAudioFileMap(): void {
    // 靜態導入所有音頻文件（不能使用動態 require）
    this.audioFileMap = {
      // A0, A#0, B0
      'A0': require('../../assets/piano-sound/a0.wav'),
      'A#0': require('../../assets/piano-sound/a0_.wav'),
      'B0': require('../../assets/piano-sound/b0.wav'),
      
      // C1 - B1
      'C1': require('../../assets/piano-sound/c1.wav'),
      'C#1': require('../../assets/piano-sound/c1_.wav'),
      'D1': require('../../assets/piano-sound/d1.wav'),
      'D#1': require('../../assets/piano-sound/d1_.wav'),
      'E1': require('../../assets/piano-sound/e1.wav'),
      'F1': require('../../assets/piano-sound/f1.wav'),
      'F#1': require('../../assets/piano-sound/f1_.wav'),
      'G1': require('../../assets/piano-sound/g1.wav'),
      'G#1': require('../../assets/piano-sound/g1_.wav'),
      'A1': require('../../assets/piano-sound/a1.wav'),
      'A#1': require('../../assets/piano-sound/a1_.wav'),
      'B1': require('../../assets/piano-sound/b1.wav'),
      
      // C2 - B2
      'C2': require('../../assets/piano-sound/c2.wav'),
      'C#2': require('../../assets/piano-sound/c2_.wav'),
      'D2': require('../../assets/piano-sound/d2.wav'),
      'D#2': require('../../assets/piano-sound/d2_.wav'),
      'E2': require('../../assets/piano-sound/e2.wav'),
      'F2': require('../../assets/piano-sound/f2.wav'),
      'F#2': require('../../assets/piano-sound/f2_.wav'),
      'G2': require('../../assets/piano-sound/g2.wav'),
      'G#2': require('../../assets/piano-sound/g2_.wav'),
      'A2': require('../../assets/piano-sound/a2.wav'),
      'A#2': require('../../assets/piano-sound/a2_.wav'),
      'B2': require('../../assets/piano-sound/b2.wav'),
      
      // C3 - B3
      'C3': require('../../assets/piano-sound/c3.wav'),
      'C#3': require('../../assets/piano-sound/c3_.wav'),
      'D3': require('../../assets/piano-sound/d3.wav'),
      'D#3': require('../../assets/piano-sound/d3_.wav'),
      'E3': require('../../assets/piano-sound/e3.wav'),
      'F3': require('../../assets/piano-sound/f3.wav'),
      'F#3': require('../../assets/piano-sound/f3_.wav'),
      'G3': require('../../assets/piano-sound/g3.wav'),
      'G#3': require('../../assets/piano-sound/g3_.wav'),
      'A3': require('../../assets/piano-sound/a3.wav'),
      'A#3': require('../../assets/piano-sound/a3_.wav'),
      'B3': require('../../assets/piano-sound/b3.wav'),
      
      // C4 - B4
      'C4': require('../../assets/piano-sound/c4.wav'),
      'C#4': require('../../assets/piano-sound/c4_.wav'),
      'D4': require('../../assets/piano-sound/d4.wav'),
      'D#4': require('../../assets/piano-sound/d4_.wav'),
      'E4': require('../../assets/piano-sound/e4.wav'),
      'F4': require('../../assets/piano-sound/f4.wav'),
      'F#4': require('../../assets/piano-sound/f4_.wav'),
      'G4': require('../../assets/piano-sound/g4.wav'),
      'G#4': require('../../assets/piano-sound/g4_.wav'),
      'A4': require('../../assets/piano-sound/a4.wav'),
      'A#4': require('../../assets/piano-sound/a4_.wav'),
      'B4': require('../../assets/piano-sound/b4.wav'),
      
      // C5 - B5
      'C5': require('../../assets/piano-sound/c5.wav'),
      'C#5': require('../../assets/piano-sound/c5_.wav'),
      'D5': require('../../assets/piano-sound/d5.wav'),
      'D#5': require('../../assets/piano-sound/d5_.wav'),
      'E5': require('../../assets/piano-sound/e5.wav'),
      'F5': require('../../assets/piano-sound/f5.wav'),
      'F#5': require('../../assets/piano-sound/f5_.wav'),
      'G5': require('../../assets/piano-sound/g5.wav'),
      'G#5': require('../../assets/piano-sound/g5_.wav'),
      'A5': require('../../assets/piano-sound/a5.wav'),
      'A#5': require('../../assets/piano-sound/a5_.wav'),
      'B5': require('../../assets/piano-sound/b5.wav'),
      
      // C6 - B6
      'C6': require('../../assets/piano-sound/c6.wav'),
      'C#6': require('../../assets/piano-sound/c6_.wav'),
      'D6': require('../../assets/piano-sound/d6.wav'),
      'D#6': require('../../assets/piano-sound/d6_.wav'),
      'E6': require('../../assets/piano-sound/e6.wav'),
      'F6': require('../../assets/piano-sound/f6.wav'),
      'F#6': require('../../assets/piano-sound/f6_.wav'),
      'G6': require('../../assets/piano-sound/g6.wav'),
      'G#6': require('../../assets/piano-sound/g6_.wav'),
      'A6': require('../../assets/piano-sound/a6.wav'),
      'A#6': require('../../assets/piano-sound/a6_.wav'),
      'B6': require('../../assets/piano-sound/b6.wav'),
      
      // C7 - B7
      'C7': require('../../assets/piano-sound/c7.wav'),
      'C#7': require('../../assets/piano-sound/c7_.wav'),
      'D7': require('../../assets/piano-sound/d7.wav'),
      'D#7': require('../../assets/piano-sound/d7_.wav'),
      'E7': require('../../assets/piano-sound/e7.wav'),
      'F7': require('../../assets/piano-sound/f7.wav'),
      'F#7': require('../../assets/piano-sound/f7_.wav'),
      'G7': require('../../assets/piano-sound/g7.wav'),
      'G#7': require('../../assets/piano-sound/g7_.wav'),
      'A7': require('../../assets/piano-sound/a7.wav'),
      'A#7': require('../../assets/piano-sound/a7_.wav'),
      'B7': require('../../assets/piano-sound/b7.wav'),
      
      // C8
      'C8': require('../../assets/piano-sound/c8.wav'),
    };

    console.log(`✅ 音頻文件映射初始化完成，共 ${Object.keys(this.audioFileMap).length} 個音符`);
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
    // 強制重置初始化狀態，確保每次呼叫都能重新執行載入邏輯
    if (this.isInitialized) {
        console.log('🔄 AudioManager 已初始化，重新檢查資源...');
        // 資源檢查：如果緩衝區數量正確，則直接返回
        if ((this.isWeb && this.audioBuffers.size > 80) || (!this.isWeb && this.soundObjects.size > 80)) {
             this.updateInitProgress(100);
             return;
        }
    }

    try {
      this.updateInitProgress(5);
      console.log('🎵 開始初始化 AudioManager...');
      
      if (this.isWeb) {
        // --- WEB 初始化邏輯 ---
        // 使用 globalThis 作為安全替代
        const env: any = typeof globalThis !== 'undefined' ? globalThis : {};
        const AudioContextClass = env.AudioContext || env.webkitAudioContext;
        
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
          
          // 🔥 修正重點：移除這裡的 await resume() 區塊。
          // 移除原因：瀏覽器在重新整理後會將 AudioContext 設為 'suspended'。
          // 在沒有使用者互動的情況下對其使用 await resume() 會導致程式無限等待，載入卡在 5%。
          // 資源載入 (loadAudioBuffer) 可以在 suspended 狀態下正常完成。
          
          // 設置壓縮器與 Gain
          const compressor = this.audioContext.createDynamicsCompressor();
          // ... (壓縮器設定保持不變) ...
          compressor.threshold.value = -24;
          compressor.knee.value = 30;
          compressor.ratio.value = 12;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.25;

          this.gainNode = this.audioContext.createGain();
          this.gainNode.gain.value = 0.5; // 預設音量 50%
          this.gainNode.connect(compressor);
          compressor.connect(this.audioContext.destination);

          this.updateInitProgress(20);
          
          // 載入音頻緩衝 (現在它會立即執行，不會被 AudioContext 阻塞)
          await this.loadAudioBuffer();
          
          this.isInitialized = true;
          this.updateInitProgress(100);
        }
      } else {
        // --- MOBILE 初始化邏輯 ---
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          interruptionModeIOS: 1,
          interruptionModeAndroid: 1,
        });

        this.updateInitProgress(20);
        
        // 載入 Sound 對象
        await this.initializeSoundObjects();
        
        this.isInitialized = true;
        this.updateInitProgress(100);
      }
    } catch (error) {
      console.error('初始化失敗:', error);
      this.updateInitProgress(100); // 失敗也設為 100 讓 App 進入
    }
  }

  // 加載音頻采樣文件（Web端）- 加載所有 88 個鋼琴音符
  private async loadAudioBuffer(): Promise<void> {
    try {
      console.log('🎹 [Web] 開始載入 88 個鋼琴音符...');
      const noteNames = Object.keys(this.audioFileMap);
      const totalNotes = noteNames.length;
      let loadedCount = 0;

      // 使用 Promise.all 進行並行下載 (Concurrency)
      // 為了避免瀏覽器請求過多卡死，我們將其分成小塊 (Chunks)
      const chunkSize = 10; // 每次同時下載 10 個
      for (let i = 0; i < noteNames.length; i += chunkSize) {
        const chunk = noteNames.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (noteName) => {
            try {
                const module = this.audioFileMap[noteName];
                // 1. 使用 Expo Asset 解析真實 URI
                const asset = Asset.fromModule(module);
                await asset.downloadAsync(); // 確保下載完成
                
                // 2. Fetch 二進制資料
                const response = await fetch(asset.uri || asset.localUri || '');
                const arrayBuffer = await response.arrayBuffer();
                
                // 3. Decode
                const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.audioBuffers.set(noteName, buffer);
                
                loadedCount++;
            } catch (e) {
                console.warn(`載入音符失敗: ${noteName}`, e);
            }
        }));

        // 更新進度
        const progress = 20 + (loadedCount / totalNotes) * 80;
        this.updateInitProgress(progress);
      }
      
      console.log(`✅ [Web] 音頻載入完成: ${loadedCount}/${totalNotes}`);
    } catch (error) {
      console.error('Web 音頻載入嚴重錯誤:', error);
    }
  }

  // 初始化音頻池（預載多個 Sound 實例）
  private async initializeSoundPool(): Promise<void> {
    try {
      console.log('🎵 正在初始化音頻池...');
      
      const audioAsset = require('../../assets/piano-c4.wav');
      
      for (let i = 0; i < this.maxPoolSize; i++) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            audioAsset,
            { 
              shouldPlay: false,
              volume: 0.5, // 預設音量 50%
              rate: 1.0,
              shouldCorrectPitch: false,
              isLooping: false,
            }
          );
          
          // 預載音頻到內存
          await sound.setPositionAsync(0);
          
          this.soundPool.push(sound);
          
          const poolProgress = ((i + 1) / this.maxPoolSize) * 50;
          this.updateInitProgress(40 + poolProgress);
          
          console.log(`✅ 音頻實例 ${i + 1}/${this.maxPoolSize} 載入完成`);
        } catch (soundError) {
          console.error(`❌ 載入音頻實例 ${i + 1} 失敗:`, soundError);
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
      this.updateInitProgress(90);
    }
  }

  // 初始化所有音符的 Sound 對象（Mobile 端）
  private async initializeSoundObjects(): Promise<void> {
    try {
      console.log('🎹 [Mobile] 開始載入 88 個鋼琴音符...');
      const noteNames = Object.keys(this.audioFileMap);
      const totalNotes = noteNames.length;
      let loadedCount = 0;

      // Mobile 端並行處理：分批載入以避免記憶體瞬間飆升
      const chunkSize = 5; // 手機端保守一點，一次 5 個
      for (let i = 0; i < noteNames.length; i += chunkSize) {
        const chunk = noteNames.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (noteName) => {
            try {
                const module = this.audioFileMap[noteName];
                
                // 建立 Sound 物件
                const { sound } = await Audio.Sound.createAsync(
                    module,
                    { shouldPlay: false, volume: 0.5 } // 預設音量 50%
                );
                
                this.soundObjects.set(noteName, sound);
                loadedCount++;
            } catch (e) {
                console.warn(`載入音符失敗: ${noteName}`, e);
            }
        }));

        // 更新進度
        const progress = 20 + (loadedCount / totalNotes) * 80;
        this.updateInitProgress(progress);
        
        // 小小的延遲讓 UI 有機會渲染進度條
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      console.log(`✅ [Mobile] 音頻載入完成: ${loadedCount}/${totalNotes}`);
      
      if (loadedCount === 0) throw new Error('沒有任何音符被載入');

    } catch (error) {
      console.error('Mobile 音頻載入嚴重錯誤:', error);
    }
  }

  async playNote(noteName: string, duration: number = 0.5): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isWeb) {
      // ✅ 這裡才是正確喚醒 AudioContext 的地方
      // 因為 playNote 通常是由使用者點擊觸發的，瀏覽器允許這裡 resume
      if (this.audioContext && this.audioContext.state === 'suspended') {
        try {
          // 不使用 await，避免阻塞播放，讓它在背景恢復
          this.audioContext.resume().catch(() => {});
        } catch (e) {
          console.warn('AudioContext resume 失敗:', e);
        }
      }
      
      this.playNoteWeb(noteName, duration);
    } else {
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

      // 檢查是否有對應的音頻緩衝
      const audioBuffer = this.audioBuffers.get(noteName);
      
      if (audioBuffer) {
        // 使用對應音符的采樣播放（原始音高，不需要變速）
        this.playNoteWithBuffer(noteName, audioBuffer, duration);
      } else {
        // 否則使用振盪器（後備方案）
        console.warn(`⚠️ 音符 ${noteName} 沒有音頻緩衝，使用振盪器`);
        this.playNoteWithOscillator(noteName, frequency, duration);
      }
      
    } catch (error) {
      console.error(`播放音符 ${noteName} 失敗:`, error);
    }
  }

  // 使用音頻緩衝播放（直接播放原始音高，不需要變速）
  private playNoteWithBuffer(noteName: string, buffer: AudioBufferType, duration: number): void {
    if (!this.audioContext || !this.gainNode) return;

    try {
      const now = this.audioContext.currentTime;
      
      // 創建音頻源節點
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      
      // 不需要調整播放速率，因為每個音符都有自己的采樣
      source.playbackRate.value = 1.0;
      
      // 創建增益節點控制音量包絡
      const noteGain = this.audioContext.createGain();
      
      // 添加輕微的低通濾波器以減少雜音
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 8000; // 固定截止頻率，因為不需要變速
      filter.Q.value = 0.7;
      
      // 連接：音頻源 -> 濾波器 -> 音符增益 -> 主增益
      source.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(this.gainNode);
      
      // 設置音量包絡（ADSR）- 鋼琴自然延音效果
      const attackTime = 0.005;    // 5ms 快速起音
      const decayTime = 0.1;       // 100ms 衰減
      const sustainLevel = 0.8;    // 較高的持續音量
      const releaseTime = 0.3;     // 300ms 較長的釋放時間，讓聲音自然消失
      
      // 計算實際播放時長（至少保證音符的原始時長 + 額外的延音）
      const minDuration = Math.max(duration, 0.5); // 至少播放 0.5 秒
      const totalDuration = minDuration + releaseTime; // 總時長包含釋放時間
      
      // 音量包絡設置 - 更平滑自然
      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.linearRampToValueAtTime(1.0, now + attackTime); // Attack 到最大音量
      noteGain.gain.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.001), now + attackTime + decayTime); // Decay 到持續音量
      
      const sustainStart = now + attackTime + decayTime;
      const sustainEnd = now + minDuration; // 持續到音符結束
      
      // 維持持續音量
      noteGain.gain.setValueAtTime(Math.max(sustainLevel, 0.001), sustainStart);
      noteGain.gain.setValueAtTime(Math.max(sustainLevel, 0.001), sustainEnd);
      
      // 緩慢釋放，模擬鋼琴自然延音
      noteGain.gain.exponentialRampToValueAtTime(0.001, sustainEnd + releaseTime);
      
      // 開始播放 - 讓音頻完整播放，包含自然延音
      source.start(now);
      source.stop(sustainEnd + releaseTime + 0.1); // 稍微延長以確保完整釋放
      
      // 保存到活動音源列表
      this.activeBufferSources.set(noteName, source);
      
      // 播放結束後清理
      source.onended = () => {
        try {
          source.disconnect();
          filter.disconnect();
          noteGain.disconnect();
        } catch (e) {
          // 忽略
        }
        this.activeBufferSources.delete(noteName);
      };
      
    } catch (error) {
      console.error(`使用緩衝播放音符 ${noteName} 失敗:`, error);
    }
  }

  // 使用振盪器播放（後備方案）
  private playNoteWithOscillator(noteName: string, frequency: number, duration: number): void {
    if (!this.audioContext || !this.gainNode) return;

    try {
      // 創建振盪器（音源）和濾波器
      const oscillator = this.audioContext.createOscillator();
      const noteGain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      
      filter.type = 'lowpass';
      filter.frequency.value = Math.min(frequency * 4, 8000);
      filter.Q.value = 0.5;
      
      oscillator.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(this.gainNode);
      
      const now = this.audioContext.currentTime;
      const attackTime = 0.003;
      const decayTime = 0.03;
      const sustainLevel = 0.1;
      const releaseTime = 0.08;
      
      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.linearRampToValueAtTime(0.15, now + attackTime);
      noteGain.gain.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.001), now + attackTime + decayTime);
      
      const sustainStart = now + attackTime + decayTime;
      const sustainEnd = now + Math.max(duration - releaseTime, attackTime + decayTime);
      noteGain.gain.setValueAtTime(Math.max(sustainLevel, 0.001), sustainStart);
      noteGain.gain.setValueAtTime(Math.max(sustainLevel, 0.001), sustainEnd);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      oscillator.start(now);
      oscillator.stop(now + duration + 0.05);
      
      this.activeOscillators.set(noteName, oscillator);
      
      oscillator.onended = () => {
        try {
          oscillator.disconnect();
          filter.disconnect();
          noteGain.disconnect();
        } catch (e) {
          // 忽略
        }
        this.activeOscillators.delete(noteName);
      };
      
    } catch (error) {
      console.error(`使用振盪器播放音符 ${noteName} 失敗:`, error);
    }
  }

  private async playNoteMobile(noteName: string, duration: number): Promise<void> {
    // 如果沒有 Sound 對象，靜音播放
    if (this.soundObjects.size === 0) {
      return;
    }

    // 獲取對應音符的 Sound 對象
    const sound = this.soundObjects.get(noteName);
    
    if (!sound) {
      console.warn(`⚠️ 未找到音符 ${noteName} 的 Sound 對象`);
      return;
    }

    // 直接播放，不需要調整播放速率（因為每個音符都有自己的音頻文件）
    try {
      // 快速重置並播放（不等待，減少延遲）
      sound.setPositionAsync(0).catch(() => {});
      sound.setStatusAsync({
        rate: 1.0, // 原始速率
        shouldCorrectPitch: false,
        volume: this.currentVolume,
        isLooping: false,
      }).catch(() => {});
      sound.playAsync().catch(() => {});
    } catch (error) {
      // 靜默失敗，繼續下一個音符
    }
  }

  stopNote(noteName: string): void {
    if (this.isWeb) {
      // 停止緩衝音源
      const bufferSource = this.activeBufferSources.get(noteName);
      if (bufferSource) {
        try {
          bufferSource.stop();
          bufferSource.disconnect();
          this.activeBufferSources.delete(noteName);
        } catch (error) {
          // 音源可能已經停止
        }
      }
      
      // 停止振盪器
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
      // 移動端不需要手動停止單個音符
    }
  }

  async stopAll(): Promise<void> {
    try {
      if (this.isWeb) {
        // 停止所有緩衝音源
        for (const [noteName, source] of this.activeBufferSources.entries()) {
          try {
            source.stop();
            source.disconnect();
          } catch (error) {
            // 忽略
          }
        }
        this.activeBufferSources.clear();
        
        // 停止所有振盪器
        for (const [noteName, oscillator] of this.activeOscillators.entries()) {
          try {
            oscillator.stop();
            oscillator.disconnect();
          } catch (error) {
            // 忽略
          }
        }
        this.activeOscillators.clear();
      } else {
        // 停止所有音符的 Sound 對象
        for (const [noteName, sound] of this.soundObjects.entries()) {
          try {
            await sound.stopAsync();
          } catch (error) {
            // 忽略錯誤
          }
        }
        
        // 停止音頻池中的所有音效（舊版，保留以防萬一）
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

  // 設置主音量（0.0 - 1.0）
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.currentVolume = clampedVolume;
    
    if (this.isWeb) {
      if (this.gainNode) {
        this.gainNode.gain.value = clampedVolume;
        console.log(`🔊 [Web] 音量設置為: ${(clampedVolume * 100).toFixed(0)}%`);
      }
    } else {
      // Mobile 端：更新所有 Sound 對象的音量
      for (const [noteName, sound] of this.soundObjects.entries()) {
        try {
          sound.setVolumeAsync(clampedVolume).catch(() => {});
        } catch (error) {
          // 忽略錯誤
        }
      }
      console.log(`🔊 [Mobile] 音量設置為: ${(clampedVolume * 100).toFixed(0)}%`);
    }
  }

  // 獲取當前音量
  getVolume(): number {
    return this.currentVolume;
  }

  async cleanup(): Promise<void> {
    try {
      await this.stopAll();
      
      if (this.audioContext) {
        await this.audioContext.close();
        this.audioContext = null;
      }

      // 清理音頻緩衝
      this.audioBuffers.clear();

      // 清理音頻池（舊版，保留以防萬一）
      for (const sound of this.soundPool) {
        try {
          await sound.unloadAsync();
        } catch (error) {
          // 忽略錯誤
        }
      }
      this.soundPool = [];
      
      // 清理所有音符的 Sound 對象
      for (const [noteName, sound] of this.soundObjects.entries()) {
        try {
          await sound.unloadAsync();
        } catch (error) {
          console.warn(`清理音符 ${noteName} 失敗:`, error);
        }
      }
      this.soundObjects.clear();
      
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
