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
from sklearn.model_selection import train_test_split

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
            
            # 正規化到 [0, 1]
            log_mel_spec = (log_mel_spec - np.min(log_mel_spec)) / (np.max(log_mel_spec) - np.min(log_mel_spec) + 1e-8)
            
            return log_mel_spec.T  # 轉置為 (時間幀, 頻率)
            
        except Exception as e:
            print(f"Error processing audio {audio_path}: {e}")
            return None
    
    def load_midi_data(self, midi_path):
        """從MIDI檔案提取鋼琴捲表示"""
        try:
            midi_data = pretty_midi.PrettyMIDI(midi_path)
            
            # 使用更精細的時間解析度
            total_frames = int(self.sequence_length * self.frames_per_second)
            piano_roll = np.zeros((total_frames, 128))
            
            for instrument in midi_data.instruments:
                # 只處理鋼琴樂器
                if not instrument.is_drum:
                    for note in instrument.notes:
                        # 計算開始和結束幀
                        start_frame = int(note.start * self.frames_per_second)
                        end_frame = int(note.end * self.frames_per_second)
                        
                        # 確保在範圍內
                        start_frame = min(start_frame, total_frames - 1)
                        end_frame = min(end_frame, total_frames - 1)
                        
                        if start_frame < end_frame:  # 確保有效的音符範圍
                            pitch = int(note.pitch)
                            if 0 <= pitch < 128:
                                # 使用velocity信息（歸一化到0-1）
                                velocity_norm = note.velocity / 127.0
                                piano_roll[start_frame:end_frame, pitch] = velocity_norm
            
            return piano_roll
            
        except Exception as e:
            print(f"Error processing MIDI {midi_path}: {e}")
            return None
    
    def create_sequences(self, features, targets):
        """創建訓練序列 - 改進版本"""
        X, y = [], []
        
        # 使用重疊滑動窗口
        step_size = self.sequence_length // 4  # 75% 重疊
        
        for i in range(0, len(features) - self.sequence_length, step_size):
            X.append(features[i:i + self.sequence_length])
            y.append(targets[i:i + self.sequence_length])
        
        return np.array(X), np.array(y)
    
    def process_dataset(self, data_dir, max_files=None):
        """處理整個MAESTRO資料集 - 改進版本"""
        audio_files = glob.glob(os.path.join(data_dir, "**/*.wav"), recursive=True)
        
        if max_files:
            audio_files = audio_files[:max_files]
        
        all_X, all_y = [], []
        processed_count = 0
        
        for audio_path in audio_files:
            # 找到對應的MIDI檔案
            midi_path = audio_path.replace('.wav', '.midi')
            if not os.path.exists(midi_path):
                midi_path = audio_path.replace('.wav', '.mid')
            
            if not os.path.exists(midi_path):
                print(f"MIDI file not found for {audio_path}")
                continue
            
            print(f"Processing: {os.path.basename(audio_path)}")
            
            # 提取特徵
            audio_features = self.load_audio_features(audio_path)
            midi_targets = self.load_midi_data(midi_path)
            
            if audio_features is not None and midi_targets is not None:
                # 確保長度匹配
                min_length = min(len(audio_features), len(midi_targets))
                if min_length > self.sequence_length:  # 確保有足夠的長度
                    audio_features = audio_features[:min_length]
                    midi_targets = midi_targets[:min_length]
                    
                    # 創建序列
                    X_seq, y_seq = self.create_sequences(audio_features, midi_targets)
                    
                    if len(X_seq) > 0:
                        all_X.append(X_seq)
                        all_y.append(y_seq)
                        processed_count += 1
                        print(f"  Added {len(X_seq)} sequences")
        
        # 合併所有資料
        if all_X:
            all_X = np.concatenate(all_X, axis=0)
            all_y = np.concatenate(all_y, axis=0)
            print(f"Processed {processed_count} files, total sequences: {len(all_X)}")
            return all_X, all_y
        else:
            print("No data processed. Check your data directory.")
            return None, None
        

class MidiGenerationModel:
    def __init__(self, input_shape, output_shape):
        self.input_shape = input_shape
        self.output_shape = output_shape
        self.model = self._build_improved_model()
    
    def _build_improved_model(self):
        """建立改進的轉錄模型 - 專注於防止過度擬合"""
        inputs = keras.Input(shape=self.input_shape)
        
        # 編碼器部分 - 使用更多正則化
        x = layers.Conv1D(64, 5, activation='relu', padding='same')(inputs)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(0.2)(x)
        x = layers.MaxPooling1D(2)(x)
        
        x = layers.Conv1D(128, 5, activation='relu', padding='same')(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(0.3)(x)
        x = layers.MaxPooling1D(2)(x)
        
        x = layers.Conv1D(256, 3, activation='relu', padding='same')(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(0.4)(x)
        
        # LSTM層處理時間序列 - 簡化結構
        x = layers.Bidirectional(layers.LSTM(128, return_sequences=True, dropout=0.3))(x)
        x = layers.Bidirectional(layers.LSTM(64, return_sequences=True, dropout=0.3))(x)
        
        # 解碼器部分
        x = layers.Conv1DTranspose(128, 3, activation='relu', padding='same')(x)
        x = layers.UpSampling1D(2)(x)
        x = layers.Dropout(0.3)(x)
        
        x = layers.Conv1DTranspose(64, 3, activation='relu', padding='same')(x)
        x = layers.UpSampling1D(2)(x)
        x = layers.Dropout(0.2)(x)
        
        # 輸出層 - 使用sigmoid激活處理多標籤分類
        outputs = layers.Conv1D(128, 3, activation='sigmoid', padding='same')(x)
        
        model = keras.Model(inputs, outputs)
        
        # 使用更保守的學習率
        optimizer = keras.optimizers.Adam(
            learning_rate=0.0005,
            beta_1=0.9,
            beta_2=0.999,
            epsilon=1e-7
        )
        
        # 編譯模型 - 使用更適合多標籤分類的損失函數
        model.compile(
            optimizer=optimizer,
            loss='binary_crossentropy',
            metrics=['accuracy', 'binary_accuracy']
        )
        
        return model
    
    def train(self, X_train, y_train, X_val=None, y_val=None, epochs=100, batch_size=16):
        """訓練模型 - 改進版本"""
        # 創建保存目錄
        os.makedirs(THIS_DIR / 'saved_models', exist_ok=True)

        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor='val_loss',
                patience=15,
                restore_best_weights=True,
                verbose=1
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=8,
                min_lr=1e-7,
                verbose=1
            ),
            keras.callbacks.ModelCheckpoint(
                THIS_DIR / 'saved_models/best_model.keras',
                monitor='val_loss',
                save_best_only=True,
                save_weights_only=False,
                verbose=1
            ),
            keras.callbacks.TensorBoard(
                log_dir=THIS_DIR / 'logs',
                histogram_freq=1
            )
        ]
        
        validation_data = (X_val, y_val) if X_val is not None else None
        
        print(f"Starting training with {len(X_train)} samples")
        print(f"Input shape: {X_train.shape}, Target shape: {y_train.shape}")
        
        history = self.model.fit(
            X_train, y_train,
            batch_size=batch_size,
            epochs=epochs,
            validation_data=validation_data,
            callbacks=callbacks,
            verbose=1,
            shuffle=True
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
    
    def wav_to_midi(self, wav_path, output_midi_path, threshold=0.3):
        """將WAV檔案轉換為MIDI檔案 - 改進版本"""
        # 提取特徵
        features = self.processor.load_audio_features(wav_path)
        if features is None:
            print("Failed to extract features from audio")
            return
        
        # 預測 - 使用滑動窗口
        sequences = []
        step_size = self.processor.sequence_length // 2  # 50% 重疊
        
        for i in range(0, len(features) - self.processor.sequence_length, step_size):
            seq = features[i:i + self.processor.sequence_length]
            if len(seq) == self.processor.sequence_length:
                sequences.append(seq)
        
        if not sequences:
            print("Audio too short for processing")
            return
        
        sequences = np.array(sequences)
        print(f"Predicting {len(sequences)} sequences...")
        predictions = self.model.predict(sequences, verbose=1, batch_size=8)
        
        # 合併預測結果（平均重疊部分）
        piano_roll = np.zeros((len(features), 128))
        count_roll = np.zeros((len(features), 128))
        
        for i, pred in enumerate(predictions):
            start_idx = i * step_size
            end_idx = start_idx + self.processor.sequence_length
            actual_end = min(end_idx, len(features))
            
            segment_length = actual_end - start_idx
            piano_roll[start_idx:actual_end] += pred[:segment_length]
            count_roll[start_idx:actual_end] += 1
        
        # 平均化重疊部分
        piano_roll = np.divide(piano_roll, count_roll, where=count_roll != 0)
        
        # 創建MIDI檔案
        self._piano_roll_to_midi(piano_roll, output_midi_path, threshold)
    
    def _piano_roll_to_midi(self, piano_roll, output_path, threshold=0.3):
        """將鋼琴捲轉換為MIDI檔案 - 改進版本"""
        midi = MIDIFile(1)
        track = 0
        time = 0
        midi.addTrackName(track, time, "Generated MIDI")
        midi.addTempo(track, time, 120)
        
        # 改進的音符偵測
        active_notes = {}
        frames_per_second = self.processor.frames_per_second
        min_note_duration = 0.05  # 最小音符持續時間（秒）
        
        for frame_idx, frame in enumerate(piano_roll):
            current_time = frame_idx / frames_per_second
            
            for pitch in range(128):
                activation = frame[pitch]
                
                if activation > threshold:
                    if pitch not in active_notes:
                        # 音符開始
                        active_notes[pitch] = {
                            'start_frame': frame_idx,
                            'max_activation': activation
                        }
                    else:
                        # 更新最大激活值
                        active_notes[pitch]['max_activation'] = max(
                            active_notes[pitch]['max_activation'], activation
                        )
                else:
                    if pitch in active_notes:
                        # 音符結束
                        note_info = active_notes[pitch]
                        start_frame = note_info['start_frame']
                        start_time = start_frame / frames_per_second
                        duration = current_time - start_time
                        
                        # 只添加持續時間足夠的音符
                        if duration >= min_note_duration:
                            # 根據激活值計算velocity
                            velocity = int(note_info['max_activation'] * 100 + 27)
                            velocity = min(max(velocity, 30), 127)
                            
                            midi.addNote(track, 0, pitch, start_time, duration, velocity)
                        
                        del active_notes[pitch]
        
        # 結束所有活躍的音符
        for pitch, note_info in active_notes.items():
            start_frame = note_info['start_frame']
            start_time = start_frame / frames_per_second
            duration = (len(piano_roll) - start_frame) / frames_per_second
            
            if duration >= min_note_duration:
                velocity = int(note_info['max_activation'] * 100 + 27)
                velocity = min(max(velocity, 30), 127)
                midi.addNote(track, 0, pitch, start_time, duration, velocity)
        
        # 儲存MIDI檔案
        with open(output_path, "wb") as output_file:
            midi.writeFile(output_file)
        
        print(f"MIDI file saved to: {output_path}")


def plot_training_history(history, figsize=(12, 8)):
    """
    繪製訓練歷史圖表
    
    Args:
        history: keras.callbacks.History 物件
        figsize: 圖表大小
    """
    output_dir = THIS_DIR / "plots"

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
    DATA_DIR = THIS_DIR / "maestro-v3.0.0"  # 修改為您的MAESTRO資料集路徑
    MODEL_SAVE_PATH = THIS_DIR / "saved_models/midi_generation_model.keras"

    # 初始化資料處理器
    processor = MaestroDataProcessor(
        sr=22050,
        hop_length=512,
        n_mels=128,
        sequence_length=100
    )
    
    # 處理資料（可以限制檔案數量進行測試）
    print("Processing dataset...")
    X, y = processor.process_dataset(DATA_DIR, max_files=50)  # 先測試用少量檔案
    
    if X is None:
        print("No data processed. Check your data directory.")
        return
    
    print(f"Dataset shape: X={X.shape}, y={y.shape}")
    print(f"Input range: [{X.min():.3f}, {X.max():.3f}]")
    print(f"Target range: [{y.min():.3f}, {y.max():.3f}]")
    
    # 改進的資料分割
    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.2, random_state=42, shuffle=True
    )
    
    print(f"Training set: {X_train.shape}, Validation set: {X_val.shape}")
    
    # 建立模型
    input_shape = (X.shape[1], X.shape[2])  # (sequence_length, n_mels)
    output_shape = (y.shape[1], y.shape[2])  # (sequence_length, 128)
    
    print(f"Input shape: {input_shape}, Output shape: {output_shape}")
    
    model = MidiGenerationModel(input_shape, output_shape)
    model.model.summary()
    
    # 訓練模型
    print("Starting training...")
    history = model.train(
        X_train, y_train,
        X_val, y_val,
        epochs=5,
        batch_size=16  # 使用更小的批次大小
    )

    # 繪製訓練歷史
    plot_training_history(history)
    
    # 儲存最終模型
    model.save(MODEL_SAVE_PATH)
    print(f"Model saved to {MODEL_SAVE_PATH}")


def generate_midi_from_wav():
    """生成MIDI的測試函數"""
    # 初始化處理器
    processor = MaestroDataProcessor()
    
    # 載入訓練好的模型
    generator = MidiGenerator(THIS_DIR / "saved_models/best_model.keras", processor)

    # 轉換WAV到MIDI
    wav_file = THIS_DIR / "test2.wav"  # 替換為您的WAV檔案
    output_midi = THIS_DIR / "generated_midi.mid"

    generator.wav_to_midi(wav_file, output_midi)


if __name__ == "__main__":
    # 創建必要的目錄
    THIS_DIR = Path(__file__).resolve().parent
    os.makedirs(THIS_DIR / 'saved_models', exist_ok=True)
    os.makedirs(THIS_DIR / 'plots', exist_ok=True)
    os.makedirs(THIS_DIR / 'logs', exist_ok=True)

    train()
    # generate_midi_from_wav()