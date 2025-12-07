#!/usr/bin/env python
# encoding: utf-8
#
# Copyright 2024 Spotify AB
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import argparse
import os
import logging
from datetime import datetime, timezone
from typing import List

import numpy as np
import tensorflow as tf

from basic_pitch import models
from basic_pitch.callbacks import VisualizeCallback
from basic_pitch.constants import DATASET_SAMPLING_FREQUENCY
from basic_pitch.data import tf_example_deserialization

logging.basicConfig(level=logging.INFO)


def main(
    source: str,
    output: str,
    batch_size: int,
    shuffle_size: int,
    learning_rate: float,
    epochs: int,
    steps_per_epoch: int,
    validation_steps: int,
    size_evaluation_callback_datasets: int,
    datasets_to_use: List[str],
    dataset_sampling_frequency: np.ndarray,
    no_sonify: bool,
    no_contours: bool,
    weighted_onset_loss: bool,
    positive_onset_weight: float,
    pretrained_model_path: str = None,
    freeze_layers: bool = True,
) -> None:
    """Parse config and run training or evaluation.

    Args:
        source: source directory for data
        output: output directory for trained model / checkpoints / tensorboard
        batch_size: batch size for data.
        shuffle_size: size of shuffle buffer (only for training set) for the data shuffling mechanism
        learning_rate: learning_rate for training
        epochs: number of epochs to train for
        steps_per_epoch: the number of batches to process per epoch during training
        validation_steps: the number of validation batches to evaluate on per epoch
        size_evaluation_callback_datasets: the batch size to use for visualization / logging
        datasets_to_use: which datasets to train / evaluate on e.g. guitarset, medleydb_pitch, slakh
        dataset_sampling_frequency: distribution weighting vector corresponding to datasets determining how they
            are sampled from during training / validation dataset creation.
        no_sonify: Whether or not to include sonifications in tensorboard.
        no_contours: Whether or not to include contours in the output.
        weighted_onset_loss: whether or not to use a weighted cross entropy loss.
        positive_onset_weight: weighting factor for the positive labels.
        pretrained_model_path: path to pre-trained model
        freeze_layers: whether to freeze early layers for fine-tuning
    """
    # configuration.add_externals()
    logging.info(f"source directory: {source}")
    logging.info(f"output directory: {output}")
    logging.info(f"tensorflow version: {tf.__version__}")
    logging.info("parameters to train.main() function:")
    logging.info(f"batch_size: {batch_size}")
    logging.info(f"shuffle_size: {shuffle_size}")
    logging.info(f"learning_rate: {learning_rate}")
    logging.info(f"epochs: {epochs}")
    logging.info(f"steps_per_epoch: {steps_per_epoch}")
    logging.info(f"validation_steps: {validation_steps}")
    logging.info(f"size_evaluation_callback_datasets: {size_evaluation_callback_datasets}")
    logging.info(f"using datasets: {datasets_to_use} with frequencies {dataset_sampling_frequency}")
    logging.info(f"no_contours: {no_contours}")
    logging.info(f"weighted_onset_loss: {weighted_onset_loss}")
    logging.info(f"positive_onset_weight: {positive_onset_weight}")

    # ==================== 修正的模型加載部分 ====================
    
    # 預訓練模型路徑
    if pretrained_model_path:
        model_path = pretrained_model_path
    else:
        model_path = "D:/Programing/Artificial_Intelligence/Audio2Score/Audio2Score-backend/music_conversion_tool/basic-pitch-main/basic_pitch/saved_models/icassp_2022/nmp"
    
    logging.info(f"Loading pre-trained model from: {model_path}")
    
    try:
        # 方法1：直接加載整個預訓練模型（推薦）
        logging.info("Method 1: Loading entire pre-trained model...")
        
        # 定義自定義對象（解決 lambda 函數問題）
        from basic_pitch import models as bp_models
        custom_objects = {
            'loss': bp_models.loss,
            'onset_loss': bp_models.onset_loss,
            'transcription_loss': bp_models.transcription_loss,
            'weighted_transcription_loss': bp_models.weighted_transcription_loss,
            'get_cqt': bp_models.get_cqt,
        }
        
        # 使用自定義對象加載模型
        with tf.keras.utils.custom_object_scope(custom_objects):
            model = tf.keras.models.load_model(model_path, compile=False)
        
        logging.info("✅ Pre-trained model loaded successfully via direct loading!")
        
        # 檢查模型輸出
        print(f"Model input shape: {model.input_shape}")
        print(f"Model output: {model.output_shape}")
        
        # 設置微調策略
        if freeze_layers and len(model.layers) > 15:
            # 凍結前2/3的層，只訓練後1/3的層
            freeze_threshold = int(len(model.layers) * 2 / 3)
            
            for i, layer in enumerate(model.layers):
                if i < freeze_threshold:
                    layer.trainable = False
                else:
                    layer.trainable = True
            
            trainable_count = sum([1 for layer in model.layers if layer.trainable])
            logging.info(f"🔒 Freezing enabled: {trainable_count}/{len(model.layers)} layers are trainable")
        else:
            # 所有層都可訓練
            for layer in model.layers:
                layer.trainable = True
            logging.info(f"🔓 All {len(model.layers)} layers are trainable")
        
    except Exception as e:
        logging.error(f"❌ Method 1 failed: {e}")
        logging.info("Trying Method 2: Creating new model and loading weights...")
        
        # 方法2：創建新模型並嘗試加載權重
        try:
            model = models.model(no_contours=no_contours)
            
            # 構建模型
            dummy_input = tf.keras.Input(shape=model.input_shape[1:])
            _ = model(dummy_input)
            
            # 加載預訓練模型
            pretrained_model = tf.keras.models.load_model(model_path, compile=False)
            
            # 打印層信息進行調試
            print(f"New model layers: {len(model.layers)}")
            print(f"Pretrained model layers: {len(pretrained_model.layers)}")
            
            # 嘗試加載權重
            successfully_loaded = 0
            for i, new_layer in enumerate(model.layers):
                new_weights = new_layer.get_weights()
                if not new_weights:
                    continue
                    
                # 尋找對應的層
                for pretrained_layer in pretrained_model.layers:
                    if pretrained_layer.name == new_layer.name:
                        pretrained_weights = pretrained_layer.get_weights()
                        if pretrained_weights:
                            try:
                                # 檢查形狀是否匹配
                                if len(new_weights) == len(pretrained_weights):
                                    shapes_match = True
                                    for nw, pw in zip(new_weights, pretrained_weights):
                                        if nw.shape != pw.shape:
                                            shapes_match = False
                                            break
                                    
                                    if shapes_match:
                                        new_layer.set_weights(pretrained_weights)
                                        successfully_loaded += 1
                                        print(f"✅ Loaded weights for layer {i}: {new_layer.name}")
                                    else:
                                        print(f"⚠️  Shape mismatch for layer {i}: {new_layer.name}")
                                        print(f"    New: {[w.shape for w in new_weights]}")
                                        print(f"    Pretrained: {[w.shape for w in pretrained_weights]}")
                                else:
                                    print(f"⚠️  Weight count mismatch for layer {i}: {new_layer.name}")
                            except Exception as layer_error:
                                print(f"❌ Error loading layer {i}: {layer_error}")
                        break
            
            logging.info(f"Loaded {successfully_loaded} layers successfully")
            
            if successfully_loaded == 0:
                logging.warning("⚠️  No weights loaded! Training from scratch.")
        
        except Exception as e2:
            logging.error(f"❌ Method 2 failed: {e2}")
            logging.info("Creating new model from scratch...")
            model = models.model(no_contours=no_contours)
    
    # ==================== 計算初始損失 ====================
    
    input_shape = list(model.input_shape)
    if input_shape[0] is None:
        input_shape[0] = batch_size
    logging.info("input_shape" + str(input_shape))

    output_shape = model.output_shape
    for k, v in output_shape.items():
        output_shape[k] = list(v)
        if v[0] is None:
            output_shape[k][0] = batch_size
    logging.info("output_shape" + str(output_shape))
    
    # ==================== 數據加載 ====================
    
    logging.info("Preparing datasets...")
    train_ds, validation_ds = tf_example_deserialization.prepare_datasets(
        source,
        shuffle_size,
        batch_size,
        validation_steps,
        datasets_to_use,
        dataset_sampling_frequency,
    )

    MAX_EVAL_CBF_BATCH_SIZE = 4
    (
        train_visualization_ds,
        validation_visualization_ds,
    ) = tf_example_deserialization.prepare_visualization_datasets(
        source,
        batch_size=min(size_evaluation_callback_datasets, MAX_EVAL_CBF_BATCH_SIZE),
        validation_steps=max(1, size_evaluation_callback_datasets // MAX_EVAL_CBF_BATCH_SIZE),
        datasets_to_use=datasets_to_use,
        dataset_sampling_frequency=dataset_sampling_frequency,
    )

    # ==================== 計算初始損失（重要！） ====================
    
    logging.info("Calculating initial loss...")
    try:
        # 從訓練集取一個批次
        for inputs, targets in train_ds.take(1):
            # 進行預測
            predictions = model.predict(inputs, verbose=0)
            
            # 計算損失
            loss_fn = models.loss
            initial_loss = loss_fn(targets, predictions)
            
            logging.info(f"🎯 Initial loss: {initial_loss.numpy():.4f}")
            
            if initial_loss.numpy() < 0.5:
                logging.info("✅ Initial loss is low, pre-trained weights are likely loaded!")
            else:
                logging.warning("⚠️  Initial loss is high, may be training from scratch")
            
            break
    except Exception as e:
        logging.warning(f"Could not calculate initial loss: {e}")

    # ==================== 設置回調和訓練 ====================
    
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    tensorboard_log_dir = os.path.join(output, timestamp, "tensorboard")
    callbacks = [
        tf.keras.callbacks.TensorBoard(log_dir=tensorboard_log_dir, histogram_freq=1),
        tf.keras.callbacks.EarlyStopping(patience=25, verbose=2),
        tf.keras.callbacks.ReduceLROnPlateau(verbose=1, patience=10, factor=0.5),
        tf.keras.callbacks.ModelCheckpoint(filepath=os.path.join(output, timestamp, "model.best"), save_best_only=True),
        tf.keras.callbacks.ModelCheckpoint(
            filepath=os.path.join(output, timestamp, "checkpoints", "model.{epoch:02d}")
        ),
        tf.keras.callbacks.CSVLogger(os.path.join(output, timestamp, "training_log.csv")),
    ]
    
    # 添加可視化回調（如果可用）
    try:
        callbacks.append(
            VisualizeCallback(
                train_visualization_ds,
                validation_visualization_ds,
                tensorboard_log_dir,
                not no_sonify,
                not no_contours,
            )
        )
    except:
        logging.warning("VisualizeCallback not available")

    # 損失函數
    if no_contours:
        loss = models.loss_no_contour(weighted=weighted_onset_loss, positive_weight=positive_onset_weight)
    else:
        loss = models.loss(weighted=weighted_onset_loss, positive_weight=positive_onset_weight)

    # 編譯模型（使用較小的學習率進行微調）
    fine_tune_lr = learning_rate * 0.1  # 微調時使用更小的學習率
    
    model.compile(
        loss=loss,
        optimizer=tf.keras.optimizers.Adam(fine_tune_lr),
        sample_weight_mode={"contour": None, "note": None, "onset": None},
    )

    logging.info("--- Model Training specs ---")
    logging.info(f"  train_ds: {train_ds}")
    logging.info(f"  validation_ds: {validation_ds}")
    logging.info(f"  Fine-tuning learning rate: {fine_tune_lr}")
    model.summary()

    # 訓練
    logging.info("Starting training...")
    model.fit(
        train_ds,
        epochs=epochs,
        callbacks=callbacks,
        steps_per_epoch=steps_per_epoch,
        validation_data=validation_ds,
        validation_steps=validation_steps,
    )


def console_entry_point() -> None:
    """From pip installed script."""
    parser = argparse.ArgumentParser(description="")
    parser.add_argument("--source", required=True, help="Path to directory containing train/validation splits.")
    parser.add_argument("--output", required=True, help="Directory to save the model in.")
    parser.add_argument("-e", "--epochs", type=int, default=500, help="Number of training epochs.")
    parser.add_argument(
        "-b",
        "--batch-size",
        type=int,
        default=16,
        help="batch size of training. Unlike Estimator API, this specifies the batch size per-GPU.",
    )
    parser.add_argument(
        "-l",
        "--learning-rate",
        type=float,
        default=0.001,
        help="ADAM optimizer learning rate",
    )
    parser.add_argument(
        "-s",
        "--steps-per-epoch",
        type=int,
        default=100,
        help="steps_per_epoch (batch) of each training loop",
    )
    parser.add_argument(
        "-v",
        "--validation-steps",
        type=int,
        default=10,
        help="validation steps (number of BATCHES) for each validation run. MUST be a positive integer",
    )
    parser.add_argument(
        "-z",
        "--training-shuffle-size",
        type=int,
        default=100,
        help="training dataset shuffle size",
    )
    parser.add_argument(
        "--size-evaluation-callback-datasets",
        type=int,
        default=4,
        help="number of elements in the dataset used by the evaluation callback function",
    )
    for dataset in DATASET_SAMPLING_FREQUENCY.keys():
        parser.add_argument(
            f"--{dataset.lower()}",
            action="store_true",
            default=False,
            help=f"Use {dataset} dataset in training",
        )
    parser.add_argument(
        "--no-sonify",
        action="store_true",
        default=False,
        help="if given, exclude sonifications from the tensorboard / data visualization",
    )
    parser.add_argument(
        "--no-contours",
        action="store_true",
        default=False,
        help="if given, trains without supervising the contour layer",
    )
    parser.add_argument(
        "--weighted-onset-loss",
        action="store_true",
        default=False,
        help="if given, trains onsets with a class-weighted loss",
    )
    parser.add_argument(
        "--positive-onset-weight",
        type=float,
        default=0.5,
        help="Positive class onset weight. Only applies when weignted onset loss is true.",
    )
    parser.add_argument(
        "--pretrained-model",
        type=str,
        default="D:/Programing/Artificial_Intelligence/Audio2Score/Audio2Score-backend/music_conversion_tool/basic-pitch-main/basic_pitch/saved_models/icassp_2022/nmp",
        help="Path to the pre-trained model directory.",
    )
    parser.add_argument(
        "--no-freeze",
        action="store_true",
        default=False,
        help="Do not freeze any layers (train all layers)",
    )
    parser.add_argument(
        "--debug-initial-loss",
        action="store_true",
        default=False,
        help="Debug initial loss calculation",
    )

    args = parser.parse_args()
    datasets_to_use = [
        dataset.lower()
        for dataset in DATASET_SAMPLING_FREQUENCY.keys()
        if getattr(args, dataset.lower().replace("-", "_"))
    ]
    dataset_sampling_frequency = np.array(
        [
            frequency
            for dataset, frequency in DATASET_SAMPLING_FREQUENCY.items()
            if getattr(args, dataset.lower().replace("-", "_"))
        ]
    )
    dataset_sampling_frequency = dataset_sampling_frequency / np.sum(dataset_sampling_frequency)

    assert args.steps_per_epoch is not None
    assert args.validation_steps > 0

    main(
        args.source,
        args.output,
        args.batch_size,
        args.training_shuffle_size,
        args.learning_rate,
        args.epochs,
        args.steps_per_epoch,
        args.validation_steps,
        args.size_evaluation_callback_datasets,
        datasets_to_use,
        dataset_sampling_frequency,
        args.no_sonify,
        args.no_contours,
        args.weighted_onset_loss,
        args.positive_onset_weight,
        args.pretrained_model,
        not args.no_freeze,
    )


if __name__ == "__main__":
    console_entry_point()