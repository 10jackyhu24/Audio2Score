// utils/AudioManager.ts
// 注意: 需要安裝 expo-av: npx expo install expo-av
// 或使用 Web Audio API 作為替代方案

interface Sound {
  stopAsync: () => Promise<void>;
  setPositionAsync: (position: number) => Promise<void>;
  playAsync: () => Promise<void>;
  unloadAsync: () => Promise<void>;
}

class AudioManager {
  private sounds: Map<string, Sound>;
  private isInitialized: boolean;

  constructor() {
    this.sounds = new Map();
    this.isInitialized = false;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // TODO: 設置音頻模式 (需要安裝 expo-av)
      // await Audio.setAudioModeAsync({
      //   allowsRecordingIOS: false,
      //   playsInSilentModeIOS: true,
      //   staysActiveInBackground: false,
      //   shouldDuckAndroid: true,
      // });
      
      this.isInitialized = true;
      console.log('AudioManager 初始化成功');
    } catch (error) {
      console.error('AudioManager 初始化失敗:', error);
    }
  }

  async loadSounds(): Promise<void> {
    // 加載鋼琴音色樣本
    const notes = [
      'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
      'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5'
    ];

    // 注意：你需要準備對應的音頻文件並放在 assets 目錄下
    for (const note of notes) {
      try {
        // 示例: 假設音頻文件在 assets/sounds/ 目錄下
        // const { sound } = await Audio.Sound.createAsync(
        //   require(`../../assets/sounds/${note}.mp3`)
        // );
        // this.sounds.set(note, sound);
        
        console.log(`音符 ${note} 準備加載 (需要實際音頻文件)`);
      } catch (error) {
        console.error(`加載音符 ${note} 失敗:`, error);
      }
    }
  }

  async playNote(noteName: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const sound = this.sounds.get(noteName);
      if (sound) {
        // 停止當前播放並重新開始
        await sound.stopAsync();
        await sound.setPositionAsync(0);
        await sound.playAsync();
      } else {
        console.warn(`音符 ${noteName} 未加載`);
        // 暫時使用系統聲音或其他替代方案
        this.playSystemBeep();
      }
    } catch (error) {
      console.error(`播放音符 ${noteName} 失敗:`, error);
    }
  }

  async stopAll(): Promise<void> {
    try {
      for (const [noteName, sound] of this.sounds.entries()) {
        await sound.stopAsync();
      }
    } catch (error) {
      console.error('停止所有音符失敗:', error);
    }
  }

  private playSystemBeep(): void {
    // 播放系統提示音作為替代
    console.log('🔔 播放提示音 (替代音符)');
  }

  async cleanup(): Promise<void> {
    try {
      for (const [noteName, sound] of this.sounds.entries()) {
        await sound.unloadAsync();
      }
      this.sounds.clear();
      this.isInitialized = false;
    } catch (error) {
      console.error('清理 AudioManager 失敗:', error);
    }
  }
}

export default new AudioManager();
