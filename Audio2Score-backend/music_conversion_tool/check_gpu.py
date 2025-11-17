import tensorflow as tf
import sys

def check_gpu_availability():
    print("=" * 50)
    print("TensorFlow GPU 檢測腳本")
    print("=" * 50)
    
    # 基本資訊
    print(f"TensorFlow 版本: {tf.__version__}")
    print(f"Python 版本: {sys.version}")
    
    # 檢查 GPU 設備
    print("\n可用的物理設備:")
    physical_devices = tf.config.list_physical_devices()
    for device in physical_devices:
        print(f"  - {device}")
    
    # 檢查 GPU
    print("\nGPU 設備:")
    gpus = tf.config.list_physical_devices('GPU')
    if gpus:
        print("找到以下 GPU:")
        for gpu in gpus:
            print(f"  - {gpu}")
            # 顯示 GPU 詳細資訊
            try:
                details = tf.config.experimental.get_device_details(gpu)
                print(f"    詳細資訊: {details}")
            except:
                print("    無法獲取詳細資訊")
    else:
        print("未找到 GPU 設備")
        return False
    
    # 檢查 TensorFlow 是否能識別 GPU
    print("\nTensorFlow GPU 支援:")
    print(f"GPU 是否可用: {tf.test.is_gpu_available()}")
    print(f"建置時是否包含 GPU 支援: {tf.test.is_built_with_gpu_support()}")
    print(f"建置時是否包含 CUDA 支援: {tf.test.is_built_with_cuda()}")
    
    # 測試 GPU 運算
    print("\nGPU 運算測試:")
    try:
        with tf.device('/GPU:0'):
            a = tf.constant([[1.0, 2.0], [3.0, 4.0]])
            b = tf.constant([[1.0, 1.0], [0.0, 1.0]])
            c = tf.matmul(a, b)
            print(f"矩陣乘法結果: {c}")
            print("GPU 運算測試成功!")
    except Exception as e:
        print(f"GPU 運算測試失敗: {e}")
        return False
    
    return True

if __name__ == "__main__":
    check_gpu_availability()