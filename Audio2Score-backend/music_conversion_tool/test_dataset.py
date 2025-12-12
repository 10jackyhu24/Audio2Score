# test_dataset.py
import tensorflow as tf
import numpy as np
import os

def test_tfrecord_data(tfrecord_dir):
    """測試TFRecord數據"""
    
    print("=== TFRecord數據測試 ===")
    
    if not os.path.exists(tfrecord_dir):
        print(f"❌ 目錄不存在: {tfrecord_dir}")
        return
    
    # 查找TFRecord文件
    tfrecord_files = []
    for root, dirs, files in os.walk(tfrecord_dir):
        for file in files:
            if file.endswith('.tfrecord') or file.endswith('.tfrecords'):
                tfrecord_files.append(os.path.join(root, file))
    
    print(f"找到 {len(tfrecord_files)} 個TFRecord文件")
    
    if not tfrecord_files:
        print("❌ 沒有找到TFRecord文件")
        return
    
    # 測試第一個文件
    test_file = tfrecord_files[0]
    print(f"\n測試文件: {test_file}")
    
    # 創建數據集
    raw_dataset = tf.data.TFRecordDataset(test_file)
    
    # 定義解析函數（根據Basic Pitch的格式）
    feature_description = {
        'audio': tf.io.FixedLenFeature([], tf.string),
        'contours': tf.io.FixedLenFeature([], tf.string),
        'notes': tf.io.FixedLenFeature([], tf.string),
        'onsets': tf.io.FixedLenFeature([], tf.string),
    }
    
    def parse_example(example_proto):
        parsed = tf.io.parse_single_example(example_proto, feature_description)
        
        # 解析音頻
        audio = tf.io.parse_tensor(parsed['audio'], out_type=tf.float32)
        audio = tf.reshape(audio, [43844, 1])
        
        # 解析標籤
        contours = tf.io.parse_tensor(parsed['contours'], out_type=tf.float32)
        notes = tf.io.parse_tensor(parsed['notes'], out_type=tf.float32)
        onsets = tf.io.parse_tensor(parsed['onsets'], out_type=tf.float32)
        
        return audio, {'contour': contours, 'note': notes, 'onset': onsets}
    
    dataset = raw_dataset.map(parse_example)
    
    # 檢查幾個樣本
    print("\n檢查數據樣本:")
    count = 0
    for audio, labels in dataset.take(3):
        print(f"\n樣本 {count + 1}:")
        print(f"  音頻形狀: {audio.shape}, 範圍: [{audio.numpy().min():.3f}, {audio.numpy().max():.3f}]")
        
        for label_name, label in labels.items():
            label_np = label.numpy()
            print(f"  {label_name}: 形狀 {label.shape}, "
                  f"非零比例: {np.mean(label_np > 0):.2%}, "
                  f"範圍: [{label_np.min():.3f}, {label_np.max():.3f}]")
        
        count += 1
    
    # 統計信息
    print(f"\n📊 數據統計:")
    total_samples = 0
    audio_stats = []
    label_stats = {'contour': [], 'note': [], 'onset': []}
    
    for audio, labels in dataset.take(100):  # 檢查前100個
        total_samples += 1
        audio_stats.append(audio.numpy())
        
        for label_name, label in labels.items():
            label_stats[label_name].append(label.numpy())
    
    print(f"   檢查了 {total_samples} 個樣本")
    
    if audio_stats:
        all_audio = np.concatenate([a.flatten() for a in audio_stats])
        print(f"   音頻 - 平均值: {all_audio.mean():.6f}, 標準差: {all_audio.std():.6f}")
    
    for label_name, stats in label_stats.items():
        if stats:
            all_labels = np.concatenate([s.flatten() for s in stats])
            pos_ratio = np.mean(all_labels > 0.5)  # 閾值0.5
            print(f"   {label_name} - 正樣本比例: {pos_ratio:.2%}, "
                  f"平均值: {all_labels.mean():.6f}")

if __name__ == "__main__":
    test_tfrecord_data("./output_tfrecord")