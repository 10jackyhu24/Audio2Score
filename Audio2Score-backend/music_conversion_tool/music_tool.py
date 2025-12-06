import os
from pathlib import Path
from basic_pitch.inference import predict_and_save
from basic_pitch import ICASSP_2022_MODEL_PATH

def get_available_models():
    """
    獲取所有可用的模型列表，包含預訓練模型和自訓練模型
    Returns:
        list: 模型列表，每個模型包含 name 和 path
    """
    models = []
    
    # 添加 Basic Pitch 預訓練模型
    models.append({
        "name": "Basic Pitch (預訓練)",
        "path": "basic-pitch",
        "is_pretrained": True
    })
    
    # 獲取自訓練模型目錄
    trained_model_dir = Path(__file__).parent / "trained_model"
    
    if trained_model_dir.exists():
        # 遍歷所有子目錄尋找模型
        for model_folder in sorted(trained_model_dir.iterdir()):
            if model_folder.is_dir():
                # 檢查是否包含 model.best 資料夾
                model_best_path = model_folder / "model.best"
                if model_best_path.exists() and model_best_path.is_dir():
                    models.append({
                        "name": f"自訓練模型 - {model_folder.name}",
                        "path": str(model_best_path),
                        "is_pretrained": False
                    })
    
    return models

def wav_to_midi(input_audio_path, output_midi_dir, model_path=None):
    """
    Converts a WAV audio file to a MIDI file using the Basic Pitch model.
    Args:
        input_audio_path (str): 输入的 WAV 文件路径
        output_midi_dir (str): 输出的 MIDI 文件路径
        model_path (str, optional): 模型路徑，如果為 None 或 "basic-pitch" 則使用預訓練模型
    """
    try:
        # 檢查輸入文件
        if not os.path.exists(input_audio_path):
            print(f"錯誤：文件 {input_audio_path} 不存在")
            return
        
        # 確保輸出目錄存在
        os.makedirs(output_midi_dir, exist_ok=True)
        
        # 決定使用哪個模型
        if model_path is None or model_path == "basic-pitch":
            selected_model = ICASSP_2022_MODEL_PATH
            print(f"使用預訓練模型: Basic Pitch")
        else:
            selected_model = model_path
            print(f"使用自訓練模型: {model_path}")
        
        print(f"開始處理: {input_audio_path}")
        
        # 使用正確的參數
        predict_and_save(
            audio_path_list=[input_audio_path],  # 明確指定參數名
            output_directory=output_midi_dir,
            save_midi=True,
            sonify_midi=False,
            save_model_outputs=False,
            save_notes=False,
            model_or_model_path=selected_model
        )
        
        # 檢查輸出
        base_name = os.path.splitext(os.path.basename(input_audio_path))[0]
        expected_midi = os.path.join(output_midi_dir, f"{base_name}_basic_pitch.mid")
        
        if os.path.exists(expected_midi):
            print(f"✓ 轉換成功: {expected_midi}")
            return expected_midi
        else:
            print("⚠ 轉換完成，但未找到輸出文件")
            return None
            
    except Exception as e:
        print(f"❌ 轉換失敗: {e}")
        return None


if __name__ == "__main__":
    input_wav = "input_audio.wav"
    output_midi = "output_music.mid"
    
    if not os.path.exists(input_wav):
        print(f"{input_wav} not found. Please provide a valid WAV file.")
    else:
        wav_to_midi(input_wav, output_midi)
