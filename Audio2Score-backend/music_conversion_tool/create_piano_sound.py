#!/usr/bin/env python3
"""
生成簡單的鋼琴音符音頻文件
這個腳本會生成一個 C4 (中央 C) 音符的 WAV 文件
然後可以通過調整播放速率來播放其他音符
"""

import numpy as np
import wave
import struct

def generate_piano_note(frequency=261.63, duration=0.5, sample_rate=44100):
    """
    生成一個簡單的鋼琴音符 - 優化版（減少雜訊和削波）
    
    Args:
        frequency: 頻率 (Hz)，默認 261.63 為 C4
        duration: 持續時間（秒）
        sample_rate: 採樣率
    """
    # 生成時間軸
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    
    # 使用更柔和的波形組合（減少高頻雜訊）
    # 基礎波形使用正弦波
    note = np.sin(2 * np.pi * frequency * t)
    
    # 添加泛音以模擬鋼琴音色（降低泛音強度以減少雜訊）
    note += 0.3 * np.sin(2 * np.pi * frequency * 2 * t)  # 第二泛音（降低從 0.5）
    note += 0.15 * np.sin(2 * np.pi * frequency * 3 * t)  # 第三泛音（降低從 0.25）
    note += 0.08 * np.sin(2 * np.pi * frequency * 4 * t)  # 第四泛音（降低從 0.125）
    
    # 添加低通濾波效果（平滑高頻）
    # 簡單的移動平均濾波
    window_size = 5
    note = np.convolve(note, np.ones(window_size)/window_size, mode='same')
    
    # 正規化（避免超過範圍）
    max_val = np.max(np.abs(note))
    if max_val > 0:
        note = note / max_val
    
    # 添加優化的 ADSR 包絡（更平滑的過渡）
    envelope = np.ones_like(t)
    
    # Attack (快速上升到最大音量) - 使用指數曲線更平滑
    attack_samples = int(0.005 * sample_rate)  # 5ms attack (更快的起音)
    if attack_samples > 0:
        envelope[:attack_samples] = 1 - np.exp(-5 * np.linspace(0, 1, attack_samples))
    
    # Decay (衰減到持續音量) - 使用指數衰減
    decay_samples = int(0.03 * sample_rate)  # 30ms decay
    decay_end = attack_samples + decay_samples
    if decay_end < len(envelope):
        envelope[attack_samples:decay_end] = 0.85 * np.exp(-2 * np.linspace(0, 1, decay_samples)) + 0.15
    
    # Sustain (維持較低音量以減少雜訊)
    sustain_level = 0.5  # 降低持續音量（從 0.7）
    sustain_end = int(duration * sample_rate) - int(0.08 * sample_rate)
    if sustain_end > decay_end:
        envelope[decay_end:sustain_end] = sustain_level
    
    # Release (更長的釋放以避免爆音) - 使用指數衰減
    release_samples = int(0.08 * sample_rate)  # 80ms release
    if release_samples > 0:
        envelope[-release_samples:] = sustain_level * np.exp(-5 * np.linspace(0, 1, release_samples))
    
    # 應用包絡
    note = note * envelope
    
    # 應用淡入淡出以完全避免爆音
    fade_samples = int(0.002 * sample_rate)  # 2ms 淡入淡出
    if fade_samples > 0:
        fade_in = np.linspace(0, 1, fade_samples)
        fade_out = np.linspace(1, 0, fade_samples)
        note[:fade_samples] *= fade_in
        note[-fade_samples:] *= fade_out
    
    # 轉換為 16-bit PCM（降低音量以避免削波和雜訊）
    audio = (note * 32767 * 0.5).astype(np.int16)  # 降低到 0.5（從 0.8）
    
    return audio, sample_rate

def save_wav(filename, audio, sample_rate):
    """保存為 WAV 文件"""
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)  # 單聲道
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio.tobytes())

if __name__ == "__main__":
    # 生成 C4 音符 (261.63 Hz)
    print("正在生成鋼琴音符 C4 (261.63 Hz)...")
    audio, sample_rate = generate_piano_note(frequency=261.63, duration=0.5)
    
    # 保存到 assets 目錄
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # 往上兩層到專案根目錄，然後進入 Audio2Score/assets
    output_path = os.path.join(script_dir, "..", "..", "Audio2Score", "assets", "piano-c4.wav")
    
    # 確保目錄存在
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    save_wav(output_path, audio, sample_rate)
    
    print(f"✓ 音頻文件已生成: {output_path}")
    print(f"  - 頻率: 261.63 Hz (C4)")
    print(f"  - 持續時間: 0.5 秒")
    print(f"  - 採樣率: {sample_rate} Hz")
    print(f"  - 格式: 16-bit PCM WAV")
    print("\n提示:")
    print("  - 通過調整播放速率可以播放其他音符")
    print("  - 例如：播放 C5 需要 rate=2.0，播放 C3 需要 rate=0.5")
