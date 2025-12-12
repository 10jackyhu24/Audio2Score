# verify_pretrained_actual.py
import tensorflow as tf
import numpy as np
import os

def verify_pretrained_model():
    """真正驗證預訓練模型是否有效"""
    
    model_path = "./basic-pitch-main/basic_pitch/saved_models/icassp_2022/nmp"
    
    print("=== 驗證預訓練模型 ===")
    
    # 1. 檢查文件
    print("\n1. 檢查模型文件:")
    files = []
    total_size = 0
    
    for root, dirs, filenames in os.walk(model_path):
        for f in filenames:
            file_path = os.path.join(root, f)
            size = os.path.getsize(file_path)
            files.append((f, size))
            total_size += size
    
    for f, size in sorted(files):
        print(f"   {f:30s} - {size:8,} bytes")
    
    print(f"\n   總大小: {total_size:,} bytes")
    
    # 2. 加載模型
    print("\n2. 加載模型...")
    try:
        model = tf.keras.models.load_model(model_path, compile=False)
        print("   ✅ 加載成功")
        
        # 3. 檢查模型信息
        print("\n3. 模型信息:")
        print(f"   輸入形狀: {model.input_shape}")
        print(f"   輸出:")
        for key, shape in model.output_shape.items():
            print(f"     {key}: {shape}")
        
        # 4. 檢查權重
        print("\n4. 檢查權重:")
        total_params = 0
        layers_with_weights = 0
        
        for i, layer in enumerate(model.layers):
            weights = layer.get_weights()
            if weights:
                layers_with_weights += 1
                layer_params = sum([w.size for w in weights])
                total_params += layer_params
                
                # 檢查權重值是否為零（未訓練的指標）
                all_zeros = True
                for w in weights:
                    if not np.allclose(w, 0):
                        all_zeros = False
                        break
                
                status = "✅ 已訓練" if not all_zeros else "❌ 可能未訓練"
                
                print(f"   層 {i:2d}: {layer.name:25s} - {len(weights):2d} 權重, "
                      f"{layer_params:6d} 參數 - {status}")
        
        print(f"\n   總結:")
        print(f"   總層數: {len(model.layers)}")
        print(f"   有權重的層: {layers_with_weights}")
        print(f"   總參數: {total_params:,}")
        
        # 5. 測試推理
        print("\n5. 測試推理...")
        test_input = np.random.randn(1, 43844, 1).astype(np.float32)
        
        print("   運行推理...")
        outputs = model.predict(test_input, verbose=0)
        
        print("   推理結果:")
        for key, value in outputs.items():
            mean_val = value.mean()
            std_val = value.std()
            zero_percent = np.mean(value == 0) * 100
            
            print(f"     {key}:")
            print(f"       形狀: {value.shape}")
            print(f"       平均值: {mean_val:.6f}")
            print(f"       標準差: {std_val:.6f}")
            print(f"       零值比例: {zero_percent:.2f}%")
            print(f"       範圍: [{value.min():.6f}, {value.max():.6f}]")
            
            # 分析輸出
            if mean_val < 0.1 or mean_val > 0.9:
                print(f"       ⚠️  平均值異常（可能模型有問題）")
            elif zero_percent > 90:
                print(f"       ⚠️  太多零值（可能模型未訓練）")
            else:
                print(f"       ✅ 輸出看起來正常")
        
        # 6. 檢查特定權重
        print("\n6. 檢查具體權重值（隨機抽樣）:")
        
        # 檢查幾個卷積層的權重
        conv_layers = [layer for layer in model.layers if 'conv2d' in layer.name.lower()]
        
        for i, layer in enumerate(conv_layers[:3]):  # 檢查前3個卷積層
            weights = layer.get_weights()
            if weights and len(weights) >= 2:  # 權重和偏置
                kernel = weights[0]
                bias = weights[1] if len(weights) > 1 else None
                
                print(f"   {layer.name}:")
                print(f"     核形狀: {kernel.shape}")
                print(f"     核平均值: {kernel.mean():.6f}")
                print(f"     核標準差: {kernel.std():.6f}")
                
                # 檢查是否接近隨機初始化
                if abs(kernel.mean()) < 0.001 and kernel.std() < 0.05:
                    print(f"     ⚠️  權重可能接近零初始化")
                else:
                    print(f"     ✅ 權重看起來已訓練")
                
                if bias is not None:
                    print(f"     偏置形狀: {bias.shape}")
                    print(f"     偏置平均值: {bias.mean():.6f}")
        
        return model
        
    except Exception as e:
        print(f"❌ 錯誤: {e}")
        import traceback
        traceback.print_exc()
        return None

def compare_with_random_model():
    """與隨機初始化模型比較"""
    
    print("\n=== 與隨機初始化模型比較 ===")
    
    try:
        from basic_pitch import models
        
        # 加載預訓練模型
        pretrained_model = tf.keras.models.load_model(
            "./basic-pitch-main/basic_pitch/saved_models/icassp_2022/nmp",
            compile=False
        )
        
        # 創建隨機初始化模型
        random_model = models.model(no_contours=False)
        
        # 構建隨機模型
        dummy_input = tf.keras.Input(shape=random_model.input_shape[1:])
        _ = random_model(dummy_input)
        
        # 相同輸入
        test_input = np.random.randn(1, 43844, 1).astype(np.float32)
        
        # 推理
        pretrained_output = pretrained_model.predict(test_input, verbose=0)
        random_output = random_model.predict(test_input, verbose=0)
        
        print("\n輸出比較:")
        for key in pretrained_output.keys():
            pretrained_val = pretrained_output[key]
            random_val = random_output[key]
            
            # 計算差異
            diff = np.abs(pretrained_val - random_val).mean()
            similarity = np.mean(np.isclose(pretrained_val, random_val, atol=1e-3))
            
            print(f"  {key}:")
            print(f"    平均差異: {diff:.6f}")
            print(f"    相似度 (<0.001): {similarity:.2%}")
            
            if diff < 0.01:
                print(f"    ⚠️  差異很小，可能權重未正確加載")
            else:
                print(f"    ✅ 差異明顯，預訓練模型有效")
        
        # 檢查權重差異
        print("\n權重差異檢查（第一個卷積層）:")
        for i, layer in enumerate(pretrained_model.layers):
            if 'conv2d' in layer.name.lower():
                pretrained_weights = layer.get_weights()
                if pretrained_weights and i < len(random_model.layers):
                    random_weights = random_model.layers[i].get_weights()
                    if random_weights and len(pretrained_weights) == len(random_weights):
                        
                        total_diff = 0
                        for pw, rw in zip(pretrained_weights, random_weights):
                            total_diff += np.abs(pw - rw).sum()
                        
                        print(f"  {layer.name}:")
                        print(f"    總權重差異: {total_diff:.6f}")
                        
                        if total_diff < 0.1:
                            print(f"    ⚠️  權重幾乎相同！")
                        else:
                            print(f"    ✅ 權重不同")
                        
                        break
        
    except Exception as e:
        print(f"❌ 比較錯誤: {e}")

if __name__ == "__main__":
    model = verify_pretrained_model()
    if model:
        compare_with_random_model()