import os
from pathlib import Path
import numpy as np
import librosa
import pretty_midi
from midiutil import MIDIFile
import tensorflow as tf
import keras
from keras import layers
import json
import glob
from matplotlib import pyplot as plt

print("Num GPUs Available: ", len(tf.config.list_physical_devices('GPU')))

class MaestroDataProcessor:
    def __init__(self, sr=22050, hop_length=512, n_mels=128, sequence_length=100):
        self.sr = sr
        self.hop_length = hop_length
        self.n_mels = n_mels
        self.sequence_length = sequence_length
        self.frames_per_second = sr / hop_length
        
    def load_audio_features(self, audio_path):
        """從WAV檔案提取音訊特徵"""
        try:
            # 載入音訊
            y, sr = librosa.load(audio_path, sr=self.sr)
            
            # 提取Mel頻譜圖
            mel_spec = librosa.feature.melspectrogram(
                y=y, sr=sr, n_mels=self.n_mels, hop_length=self.hop_length
            )
            log_mel_spec = librosa.power_to_db(mel_spec, ref=np.max)
            
            # 正規化
            log_mel_spec = (log_mel_spec - np.min(log_mel_spec)) / (np.max(log_mel_spec) - np.min(log_mel_spec))
            
            return log_mel_spec.T  # 轉置為 (時間幀, 頻率)
            
        except Exception as e:
            print(f"Error processing audio {audio_path}: {e}")
            return None
    
    def load_midi_data(self, midi_path):
        """從MIDI檔案提取鋼琴捲表示"""
        try:
            midi_data = pretty_midi.PrettyMIDI(midi_path)
            
            # 創建鋼琴捲 (128個音符，時間解析度基於音訊)
            total_frames = int(self.sequence_length * self.frames_per_second)
            piano_roll = np.zeros((total_frames, 128))
            
            for instrument in midi_data.instruments:
                for note in instrument.notes:
                    # 計算開始和結束幀
                    start_frame = int(note.start * self.frames_per_second)
                    end_frame = int(note.end * self.frames_per_second)
                    
                    # 確保在範圍內
                    start_frame = min(start_frame, total_frames - 1)
                    end_frame = min(end_frame, total_frames - 1)
                    
                    # 設置音符激活
                    pitch = int(note.pitch)
                    if 0 <= pitch < 128:
                        piano_roll[start_frame:end_frame, pitch] = 1.0
            
            return piano_roll
            
        except Exception as e:
            print(f"Error processing MIDI {midi_path}: {e}")
            return None
    
    def create_sequences(self, features, targets):
        """創建訓練序列"""
        X, y = [], []
        
        for i in range(0, len(features) - self.sequence_length, self.sequence_length // 2):
            X.append(features[i:i + self.sequence_length])
            y.append(targets[i:i + self.sequence_length])
        
        return np.array(X), np.array(y)
    
    def process_dataset(self, data_dir):
        """處理整個MAESTRO資料集"""
        audio_files = glob.glob(os.path.join(data_dir, "**/*.wav"), recursive=True)
        
        all_X, all_y = [], []
        
        for audio_path in audio_files:
            # 找到對應的MIDI檔案
            midi_path = audio_path.replace('.wav', '.midi')
            if not os.path.exists(midi_path):
                midi_path = audio_path.replace('.wav', '.mid')
            
            if not os.path.exists(midi_path):
                print(f"MIDI file not found for {audio_path}")
                continue
            
            print(f"Processing: {audio_path}")
            
            # 提取特徵
            audio_features = self.load_audio_features(audio_path)
            midi_targets = self.load_midi_data(midi_path)
            
            if audio_features is not None and midi_targets is not None:
                # 確保長度匹配
                min_length = min(len(audio_features), len(midi_targets))
                audio_features = audio_features[:min_length]
                midi_targets = midi_targets[:min_length]
                
                # 創建序列
                X_seq, y_seq = self.create_sequences(audio_features, midi_targets)
                
                if len(X_seq) > 0:
                    all_X.append(X_seq)
                    all_y.append(y_seq)
        
        # 合併所有資料
        if all_X:
            all_X = np.concatenate(all_X, axis=0)
            all_y = np.concatenate(all_y, axis=0)
            return all_X, all_y
        else:
            return None, None
        

class MidiGenerationModel:
    def __init__(self, input_shape, output_shape):
        self.input_shape = input_shape
        self.output_shape = output_shape
        self.model = self._build_model()
    
    def _build_model(self):
        """建立轉錄模型"""
        inputs = keras.Input(shape=self.input_shape)
        
        # 編碼器
        x = layers.Conv1D(64, 3, activation='relu', padding='same')(inputs)
        x = layers.BatchNormalization()(x)
        x = layers.MaxPooling1D(2)(x)
        
        x = layers.Conv1D(128, 3, activation='relu', padding='same')(x)
        x = layers.BatchNormalization()(x)
        x = layers.MaxPooling1D(2)(x)
        
        x = layers.Conv1D(256, 3, activation='relu', padding='same')(x)
        x = layers.BatchNormalization()(x)
        
        # LSTM層處理時間序列
        x = layers.Bidirectional(layers.LSTM(256, return_sequences=True))(x)
        x = layers.Bidirectional(layers.LSTM(128, return_sequences=True))(x)
        
        # 解碼器
        x = layers.Conv1DTranspose(128, 3, activation='relu', padding='same')(x)
        x = layers.UpSampling1D(2)(x)
        
        x = layers.Conv1DTranspose(64, 3, activation='relu', padding='same')(x)
        x = layers.UpSampling1D(2)(x)
        
        # 輸出層
        outputs = layers.Conv1D(128, 3, activation='sigmoid', padding='same')(x)
        
        model = keras.Model(inputs, outputs)
        
        # 編譯模型
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='binary_crossentropy',
            metrics=['accuracy']
        )
        
        return model
    
    def train(self, X_train, y_train, X_val=None, y_val=None, epochs=50, batch_size=32):
        """訓練模型"""
        callbacks = [
            keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5),
            keras.callbacks.ModelCheckpoint(
                './saved_models/best_model.keras', save_best_only=True, monitor='val_loss'
            )
        ]
        
        validation_data = (X_val, y_val) if X_val is not None else None
        
        history = self.model.fit(
            X_train, y_train,
            batch_size=batch_size,
            epochs=epochs,
            validation_data=validation_data,
            callbacks=callbacks,
            verbose=1
        )
        
        return history
    
    def save(self, filepath):
        """儲存模型"""
        self.model.save(filepath)
    
    def load(self, filepath):
        """載入模型"""
        self.model = keras.models.load_model(filepath)


class MidiGenerator:
    def __init__(self, model_path, processor):
        self.model = keras.models.load_model(model_path)
        self.processor = processor
    
    def wav_to_midi(self, wav_path, output_midi_path, threshold=0.5):
        """將WAV檔案轉換為MIDI檔案"""
        # 提取特徵
        features = self.processor.load_audio_features(wav_path)
        if features is None:
            print("Failed to extract features from audio")
            return
        
        # 預測
        sequences = []
        for i in range(0, len(features) - self.processor.sequence_length, self.processor.sequence_length):
            seq = features[i:i + self.processor.sequence_length]
            if len(seq) == self.processor.sequence_length:
                sequences.append(seq)
        
        if not sequences:
            print("Audio too short for processing")
            return
        
        sequences = np.array(sequences)
        predictions = self.model.predict(sequences, verbose=0)
        
        # 合併預測結果
        piano_roll = np.vstack(predictions)
        
        # 創建MIDI檔案
        self._piano_roll_to_midi(piano_roll, output_midi_path, threshold)
    
    def _piano_roll_to_midi(self, piano_roll, output_path, threshold=0.5):
        """將鋼琴捲轉換為MIDI檔案"""
        midi = MIDIFile(1)
        track = 0
        time = 0
        midi.addTrackName(track, time, "Generated MIDI")
        midi.addTempo(track, time, 120)
        
        # 偵測音符開始和結束
        active_notes = {}
        frames_per_second = self.processor.frames_per_second
        
        for frame_idx, frame in enumerate(piano_roll):
            current_time = frame_idx / frames_per_second
            
            for pitch in range(128):
                activation = frame[pitch]
                
                if activation > threshold:
                    if pitch not in active_notes:
                        # 音符開始
                        active_notes[pitch] = frame_idx
                else:
                    if pitch in active_notes:
                        # 音符結束
                        start_frame = active_notes[pitch]
                        start_time = start_frame / frames_per_second
                        duration = current_time - start_time
                        
                        # 添加音符到MIDI
                        midi.addNote(track, 0, pitch, start_time, duration, 64)
                        del active_notes[pitch]
        
        # 結束所有活躍的音符
        for pitch, start_frame in active_notes.items():
            start_time = start_frame / frames_per_second
            duration = (len(piano_roll) - start_frame) / frames_per_second
            midi.addNote(track, 0, pitch, start_time, duration, 64)
        
        # 儲存MIDI檔案
        with open(output_path, "wb") as output_file:
            midi.writeFile(output_file)
        
        print(f"MIDI file saved to: {output_path}")


def generate_midi_from_wav():
    # 初始化處理器
    processor = MaestroDataProcessor()
    
    # 載入訓練好的模型
    generator = MidiGenerator("./saved_models/midi_generation_model.keras", processor)
    
    # 轉換WAV到MIDI
    wav_file = "test2.wav"  # 替換為您的WAV檔案
    output_midi = "generated_midi.mid"
    
    generator.wav_to_midi(wav_file, output_midi)

def plot_training_history(history, figsize=(10, 5)):
    """
    繪製訓練歷史圖表
    
    Args:
        history: keras.callbacks.History 物件
        figsize: 圖表大小
    """
    output_dir = Path(__file__).resolve().parent / "plots"
    output_dir.mkdir(parents=True, exist_ok=True)

    hist = history.history
    epochs = range(len(hist['loss']))
    plt.figure(figsize=figsize)
    plt.plot(epochs, hist['loss'], label='Training Loss')
    plt.plot(epochs, hist['val_loss'], label='Validation Loss')
    plt.xlabel('Epochs')
    plt.ylabel('Loss')
    plt.legend()
    plt.title('Training History')
    plt.savefig(str(output_dir) + '/loss.png')
    plt.close()

    plt.figure(figsize=figsize)
    plt.plot(epochs, hist['accuracy'], label='Training Accuracy')
    plt.plot(epochs, hist['val_accuracy'], label='Validation Accuracy')
    plt.xlabel('Epochs')
    plt.ylabel('Accuracy')
    plt.legend()
    plt.title('Training History')
    plt.savefig(str(output_dir) + '/accuracy.png')
    plt.close()

def train():
    # 配置參數
    DATA_DIR = "maestro-v3.0.0"  # 修改為您的MAESTRO資料集路徑
    MODEL_SAVE_PATH = "./saved_models/midi_generation_model.keras"
    
    # 初始化資料處理器
    processor = MaestroDataProcessor(
        sr=22050,
        hop_length=512,
        n_mels=128,
        sequence_length=100
    )
    
    # 處理資料
    print("Processing dataset...")
    X, y = processor.process_dataset(DATA_DIR)
    
    if X is None:
        print("No data processed. Check your data directory.")
        return
    
    print(f"Dataset shape: X={X.shape}, y={y.shape}")
    
    # 分割資料集
    split_idx = int(0.8 * len(X))
    X_train, X_val = X[:split_idx], X[split_idx:]
    y_train, y_val = y[:split_idx], y[split_idx:]
    
    # 建立模型
    input_shape = (X.shape[1], X.shape[2])  # (sequence_length, n_mels)
    output_shape = (y.shape[1], y.shape[2])  # (sequence_length, 128)
    
    model = MidiGenerationModel(input_shape, output_shape)
    model.model.summary()
    
    # 訓練模型
    print("Starting training...")
    history = model.train(
        X_train, y_train,
        X_val, y_val,
        epochs=100,
        batch_size=32
    )

    # 繪製訓練歷史
    plot_training_history(history)
    
    # 儲存模型
    model.save(MODEL_SAVE_PATH)
    print(f"Model saved to {MODEL_SAVE_PATH}")

if __name__ == "__main__":
    train()
    # generate_midi_from_wav()
    # pass