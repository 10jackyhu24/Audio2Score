# test_tfrecord_with_official_parser.py
import tensorflow as tf
import numpy as np
import os

def test_official_parser():
    """使用 Basic Pitch 官方的 TFRecord 解析器測試"""
    
    print("=== 使用 Basic Pitch 官方解析器測試 ===")
    
    try:
        # 直接從 tf_example_deserialization 導入解析函數
        # 由於我們已經有原始碼，可以直接定義或導入
        
        print("1. 定義/導入解析函數...")
        
        # 從提供的代碼中複製相關函數
        def parse_transcription_tfexample(serialized_example):
            """解析 TFRecord 示例 - 從 tf_example_deserialization.py 複製"""
            schema = {
                "file_id": tf.io.FixedLenFeature((), tf.string),
                "source": tf.io.FixedLenFeature((), tf.string),
                "audio_wav": tf.io.FixedLenFeature((), tf.string),
                "notes_indices": tf.io.FixedLenFeature((), tf.string),
                "notes_values": tf.io.FixedLenFeature((), tf.string),
                "onsets_indices": tf.io.FixedLenFeature((), tf.string),
                "onsets_values": tf.io.FixedLenFeature((), tf.string),
                "contours_indices": tf.io.FixedLenFeature((), tf.string),
                "contours_values": tf.io.FixedLenFeature((), tf.string),
                "notes_onsets_shape": tf.io.FixedLenFeature((), tf.string),
                "contours_shape": tf.io.FixedLenFeature((), tf.string),
            }
            example = tf.io.parse_single_example(serialized_example, schema)
            return (
                example["file_id"],
                example["source"],
                example["audio_wav"],
                tf.io.parse_tensor(example["notes_indices"], out_type=tf.int64),
                tf.io.parse_tensor(example["notes_values"], out_type=tf.float32),
                tf.io.parse_tensor(example["onsets_indices"], out_type=tf.int64),
                tf.io.parse_tensor(example["onsets_values"], out_type=tf.float32),
                tf.io.parse_tensor(example["contours_indices"], out_type=tf.int64),
                tf.io.parse_tensor(example["contours_values"], out_type=tf.float32),
                tf.io.parse_tensor(example["notes_onsets_shape"], out_type=tf.int64),
                tf.io.parse_tensor(example["contours_shape"], out_type=tf.int64),
            )
        
        def sparse2dense(values, indices, dense_shape):
            """將稀疏張量轉換為密集張量"""
            if tf.rank(indices) != 2 and tf.size(indices) == 0:
                indices = tf.zeros([0, 1], dtype=indices.dtype)
            sp = tf.SparseTensor(indices=indices, values=values, dense_shape=dense_shape)
            return tf.sparse.to_dense(sp, validate_indices=False)
        
        print("✅ 解析函數定義完成")
        
        # 找到 TFRecord 文件
        print("\n2. 尋找 TFRecord 文件...")
        tfrecord_files = []
        for root, dirs, files in os.walk("./output_tfrecord"):
            for file in files:
                if file.endswith('.tfrecord'):
                    tfrecord_files.append(os.path.join(root, file))
        
        print(f"找到 {len(tfrecord_files)} 個 TFRecord 文件")
        
        if not tfrecord_files:
            print("❌ 沒有找到 TFRecord 文件")
            return
        
        # 測試第一個文件
        test_file = tfrecord_files[0]
        print(f"\n3. 測試文件: {os.path.basename(test_file)}")
        
        # 創建數據集
        raw_dataset = tf.data.TFRecordDataset(test_file)
        
        # 解析數據
        parsed_dataset = raw_dataset.map(parse_transcription_tfexample)
        
        # 檢查第一個樣本
        print("\n4. 檢查第一個樣本:")
        for (
            file_id, source, audio_wav, 
            notes_indices, notes_values,
            onsets_indices, onsets_values,
            contours_indices, contours_values,
            notes_onsets_shape, contours_shape
        ) in parsed_dataset.take(1):
            
            print(f"   file_id: {file_id.numpy().decode('utf-8')}")
            print(f"   source: {source.numpy().decode('utf-8')}")
            
            # 解碼音頻
            print("\n   解碼音頻...")
            audio_decoded = tf.audio.decode_wav(
                audio_wav,
                desired_channels=1,  # Basic Pitch 使用單聲道
                desired_samples=-1,
            )
            audio = audio_decoded.audio
            sample_rate = audio_decoded.sample_rate
            
            print(f"   音頻形狀: {audio.shape}")
            print(f"   採樣率: {sample_rate}")
            print(f"   音頻範圍: [{audio.numpy().min():.3f}, {audio.numpy().max():.3f}]")
            
            # 解析註釋
            print("\n   解析註釋...")
            
            # 解析 notes
            notes_dense = sparse2dense(notes_values, notes_indices, notes_onsets_shape)
            print(f"   notes 形狀: {notes_dense.shape}")
            print(f"   notes 非零比例: {np.mean(notes_dense.numpy() > 0):.2%}")
            
            # 解析 onsets
            onsets_dense = sparse2dense(onsets_values, onsets_indices, notes_onsets_shape)
            print(f"   onsets 形狀: {onsets_dense.shape}")
            print(f"   onsets 非零比例: {np.mean(onsets_dense.numpy() > 0):.2%}")
            
            # 解析 contours
            contours_dense = sparse2dense(contours_values, contours_indices, contours_shape)
            print(f"   contours 形狀: {contours_dense.shape}")
            print(f"   contours 非零比例: {np.mean(contours_dense.numpy() > 0):.2%}")
            
            # 檢查形狀是否正確
            print(f"\n   形狀檢查:")
            print(f"   notes_onsets_shape: {notes_onsets_shape.numpy()}")
            print(f"   contours_shape: {contours_shape.numpy()}")
            
            return True
        
    except Exception as e:
        print(f"❌ 測試失敗: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_multiple_samples():
    """測試多個樣本"""
    
    print("\n=== 測試多個樣本 ===")
    
    try:
        # 簡化的解析函數
        def parse_tfrecord(serialized_example):
            schema = {
                "file_id": tf.io.FixedLenFeature((), tf.string),
                "source": tf.io.FixedLenFeature((), tf.string),
                "audio_wav": tf.io.FixedLenFeature((), tf.string),
                "notes_indices": tf.io.FixedLenFeature((), tf.string),
                "notes_values": tf.io.FixedLenFeature((), tf.string),
                "onsets_indices": tf.io.FixedLenFeature((), tf.string),
                "onsets_values": tf.io.FixedLenFeature((), tf.string),
                "contours_indices": tf.io.FixedLenFeature((), tf.string),
                "contours_values": tf.io.FixedLenFeature((), tf.string),
                "notes_onsets_shape": tf.io.FixedLenFeature((), tf.string),
                "contours_shape": tf.io.FixedLenFeature((), tf.string),
            }
            return tf.io.parse_single_example(serialized_example, schema)
        
        # 找到文件
        tfrecord_files = []
        for root, dirs, files in os.walk("./output_tfrecord"):
            for file in files:
                if file.endswith('.tfrecord'):
                    tfrecord_files.append(os.path.join(root, file))
                    if len(tfrecord_files) >= 3:  # 只取3個文件
                        break
            if len(tfrecord_files) >= 3:
                break
        
        print(f"測試 {len(tfrecord_files)} 個文件")
        
        all_stats = {
            'audio_lengths': [],
            'notes_density': [],
            'onsets_density': [],
            'contours_density': []
        }
        
        for i, file_path in enumerate(tfrecord_files):
            print(f"\n--- 文件 {i+1}: {os.path.basename(file_path)} ---")
            
            dataset = tf.data.TFRecordDataset(file_path)
            parsed_dataset = dataset.map(parse_tfrecord)
            
            sample_count = 0
            for example in parsed_dataset.take(3):  # 每個文件取3個樣本
                sample_count += 1
                
                # 解碼音頻
                audio_decoded = tf.audio.decode_wav(
                    example['audio_wav'],
                    desired_channels=1,
                    desired_samples=-1,
                )
                audio_length = audio_decoded.audio.shape[0]
                all_stats['audio_lengths'].append(audio_length)
                
                print(f"   樣本 {sample_count}:")
                print(f"     音頻長度: {audio_length} 採樣點")
                print(f"     文件ID: {example['file_id'].numpy().decode('utf-8')[:50]}...")
                
                # 解析稀疏張量
                def parse_sparse_tensor(values_str, indices_str, shape_str):
                    values = tf.io.parse_tensor(values_str, out_type=tf.float32)
                    indices = tf.io.parse_tensor(indices_str, out_type=tf.int64)
                    shape = tf.io.parse_tensor(shape_str, out_type=tf.int64)
                    
                    if tf.size(indices) == 0:
                        return 0.0
                    
                    # 計算密度
                    total_elements = tf.reduce_prod(shape)
                    non_zero_count = tf.shape(values)[0]
                    density = non_zero_count / tf.cast(total_elements, tf.float32)
                    return density.numpy()
                
                # 計算註釋密度
                notes_density = parse_sparse_tensor(
                    example['notes_values'],
                    example['notes_indices'],
                    example['notes_onsets_shape']
                )
                onsets_density = parse_sparse_tensor(
                    example['onsets_values'],
                    example['onsets_indices'],
                    example['notes_onsets_shape']
                )
                contours_density = parse_sparse_tensor(
                    example['contours_values'],
                    example['contours_indices'],
                    example['contours_shape']
                )
                
                all_stats['notes_density'].append(notes_density)
                all_stats['onsets_density'].append(onsets_density)
                all_stats['contours_density'].append(contours_density)
                
                print(f"     notes 密度: {notes_density:.4%}")
                print(f"     onsets 密度: {onsets_density:.4%}")
                print(f"     contours 密度: {contours_density:.4%}")
        
        # 統計信息
        print("\n📊 總體統計:")
        print(f"   平均音頻長度: {np.mean(all_stats['audio_lengths']):.0f} 採樣點")
        print(f"   平均 notes 密度: {np.mean(all_stats['notes_density']):.4%}")
        print(f"   平均 onsets 密度: {np.mean(all_stats['onsets_density']):.4%}")
        print(f"   平均 contours 密度: {np.mean(all_stats['contours_density']):.4%}")
        
        # 檢查是否有數據問題
        if np.mean(all_stats['notes_density']) < 0.001:
            print("\n⚠️  警告: notes 密度非常低，可能數據有問題")
        if np.mean(all_stats['onsets_density']) < 0.001:
            print("⚠️  警告: onsets 密度非常低，可能數據有問題")
        
        return True
        
    except Exception as e:
        print(f"❌ 測試失敗: {e}")
        return False

if __name__ == "__main__":
    print("開始測試 TFRecord 數據格式...")
    
    # 測試單個樣本
    success1 = test_official_parser()
    
    if success1:
        # 測試多個樣本
        test_multiple_samples()
        
        print("\n✅ 測試完成！")
        print("\n🎯 下一步:")
        print("1. 如果數據看起來正常，可以繼續訓練")
        print("2. 如果註釋密度太低，可能需要檢查數據生成過程")
        print("3. 使用修正的微調腳本開始訓練")