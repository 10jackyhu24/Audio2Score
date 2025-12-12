#!/usr/bin/env python
# encoding: utf-8
#
# Simplified MAESTRO dataset processor for Basic Pitch format
# Processes MAESTRO v2.0.0 dataset to TFRecord format with 2-second windows

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import List, Tuple, Dict
import tempfile
import json

import numpy as np
import tensorflow as tf

# Basic Pitch constants
AUDIO_SAMPLE_RATE = 22050
AUDIO_N_SAMPLES = 43844  # 2 seconds of audio at 22050 Hz (約2秒)
AUDIO_WINDOW_LENGTH = 2.0  # 2 seconds
ANNOTATIONS_FPS = 86  # Frames per second for annotations
ANNOT_N_FRAMES = 172  # 2 seconds * 86 fps
N_FREQ_BINS_NOTES = 88
N_FREQ_BINS_CONTOURS = 264
HOP_SIZE = 1.0 / ANNOTATIONS_FPS  # 約 0.0116 seconds

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def setup_audio_processing():
    """Setup audio processing libraries"""
    try:
        import librosa
        import pretty_midi
        import soundfile as sf
        return librosa, pretty_midi, sf
    except ImportError as e:
        logger.error(f"Required library not found: {e}")
        logger.error("Please install: pip install librosa pretty_midi soundfile")
        sys.exit(1)


def load_maestro_metadata(source_dir: str) -> List[dict]:
    """Load MAESTRO metadata from JSON file"""
    metadata_path = Path(source_dir) / "maestro-v2.0.0.json"
    
    if not metadata_path.exists():
        logger.error(f"Metadata file not found: {metadata_path}")
        raise FileNotFoundError(f"MAESTRO metadata not found at {metadata_path}")
    
    with open(metadata_path, 'r') as f:
        metadata = json.load(f)
    
    logger.info(f"Loaded metadata for {len(metadata)} tracks")
    return metadata


def get_track_files(source_dir: str) -> List[dict]:
    """Get all audio and MIDI file pairs from MAESTRO dataset"""
    metadata = load_maestro_metadata(source_dir)
    
    tracks = []
    source_path = Path(source_dir)
    
    for entry in metadata:
        audio_path = source_path / entry['audio_filename']
        midi_path = source_path / entry['midi_filename']
        
        if audio_path.exists() and midi_path.exists():
            tracks.append({
                'track_id': entry.get('canonical_composer', 'unknown') + '_' + entry.get('canonical_title', 'unknown'),
                'audio_path': str(audio_path),
                'midi_path': str(midi_path),
                'split': entry.get('split', 'train'),
                'duration': entry.get('duration', 0),
                'year': entry.get('year', 0),
            })
        else:
            logger.warning(f"Missing files for {entry.get('midi_filename', 'unknown')}")
    
    logger.info(f"Found {len(tracks)} valid track pairs")
    return tracks


def extract_2s_windows(audio: np.ndarray, duration: float, midi_path: str, 
                       hop_ratio: float = 0.5) -> List[Dict]:
    """
    Extract 2-second windows from audio with 50% overlap
    
    Args:
        audio: Audio array
        duration: Duration in seconds
        midi_path: Path to MIDI file
        hop_ratio: Overlap ratio (0.5 = 50% overlap)
    
    Returns:
        List of window dictionaries
    """
    try:
        import pretty_midi
    except ImportError:
        logger.error("pretty_midi not installed. Run: pip install pretty_midi")
        sys.exit(1)
    
    # Load MIDI data
    try:
        midi_data = pretty_midi.PrettyMIDI(midi_path)
    except Exception as e:
        logger.error(f"Error loading MIDI file {midi_path}: {e}")
        return []
    
    # Calculate window parameters
    window_samples = AUDIO_N_SAMPLES
    hop_samples = int(window_samples * hop_ratio)
    
    # Extract windows
    windows = []
    
    # Precompute all note events for faster lookup
    all_notes = []
    min_note = 21  # A0
    max_note = 108  # C8
    
    for instrument in midi_data.instruments:
        if instrument.is_drum:
            continue
        for note in instrument.notes:
            # Skip notes outside range
            if min_note <= note.pitch <= max_note:
                all_notes.append({
                    'pitch': note.pitch,
                    'start': note.start,
                    'end': note.end,
                    'velocity': note.velocity / 127.0  # Normalize
                })
    
    # Process each window
    for window_idx, start_sample in enumerate(range(0, len(audio) - window_samples + 1, hop_samples)):
        end_sample = start_sample + window_samples
        
        # Calculate window times
        start_time = start_sample / AUDIO_SAMPLE_RATE
        end_time = end_sample / AUDIO_SAMPLE_RATE
        
        # Extract audio window
        audio_window = audio[start_sample:end_sample]
        
        # Ensure correct length (pad if needed)
        if len(audio_window) < window_samples:
            padding = window_samples - len(audio_window)
            audio_window = np.pad(audio_window, (0, padding), mode='constant')
        
        # Find notes in this window
        window_notes = []
        for note in all_notes:
            # Check if note overlaps with window
            if note['end'] >= start_time and note['start'] <= end_time:
                # Calculate note times relative to window start
                note_start_rel = max(note['start'] - start_time, 0)
                note_end_rel = min(note['end'] - start_time, AUDIO_WINDOW_LENGTH)
                
                if note_end_rel > 0:  # Only include if note is active in window
                    window_notes.append({
                        'pitch': note['pitch'],
                        'start': note_start_rel,
                        'end': note_end_rel,
                        'velocity': note['velocity']
                    })
        
        windows.append({
            'window_idx': window_idx,
            'start_sample': start_sample,
            'end_sample': end_sample,
            'start_time': start_time,
            'end_time': end_time,
            'audio': audio_window,
            'notes': window_notes
        })
    
    return windows


def create_labels_for_window(window_notes: List[Dict]) -> Tuple:
    """
    Create labels for a 2-second window in sparse format
    
    Args:
        window_notes: List of note dictionaries for the window
    
    Returns:
        Tuple of (notes_indices, notes_values, onsets_indices, onsets_values,
                  contours_indices, contours_values, notes_onsets_shape, contours_shape)
    """
    # Initialize dictionaries for sparse data
    notes_dict = {}  # (time_frame, freq_bin) -> velocity
    onsets_dict = {}  # (time_frame, freq_bin) -> velocity
    contours_dict = {}  # (time_frame, freq_bin) -> velocity
    
    min_note = 21  # A0
    max_note = 108  # C8
    n_semitones = max_note - min_note + 1
    notes_bins_per_semitone = 1
    contours_bins_per_semitone = 3
    
    # Process each note in the window
    for note in window_notes:
        pitch = note['pitch']
        
        # Calculate frequency bin indices
        semitone_idx = pitch - min_note
        note_freq_idx = semitone_idx * notes_bins_per_semitone
        contour_freq_idx = semitone_idx * contours_bins_per_semitone + (contours_bins_per_semitone // 2)
        
        # Calculate frame indices
        start_frame = int(note['start'] * ANNOTATIONS_FPS)
        end_frame = int(note['end'] * ANNOTATIONS_FPS)
        
        # Ensure frames are within bounds
        start_frame = max(0, min(start_frame, ANNOT_N_FRAMES - 1))
        end_frame = max(0, min(end_frame, ANNOT_N_FRAMES - 1))
        
        # Add onset (only at start frame)
        if start_frame < ANNOT_N_FRAMES and note_freq_idx < N_FREQ_BINS_NOTES:
            onsets_dict[(start_frame, note_freq_idx)] = note['velocity']
        
        # Add note frames (active frames)
        for frame in range(start_frame, end_frame + 1):
            if frame < ANNOT_N_FRAMES and note_freq_idx < N_FREQ_BINS_NOTES:
                notes_dict[(frame, note_freq_idx)] = note['velocity']
        
        # Add contour frames
        for frame in range(start_frame, end_frame + 1):
            if frame < ANNOT_N_FRAMES and contour_freq_idx < N_FREQ_BINS_CONTOURS:
                contours_dict[(frame, contour_freq_idx)] = note['velocity']
                # Add neighboring bins for smoother contours
                if contours_bins_per_semitone == 3:
                    if contour_freq_idx > 0:
                        contours_dict[(frame, contour_freq_idx - 1)] = note['velocity'] * 0.5
                    if contour_freq_idx < N_FREQ_BINS_CONTOURS - 1:
                        contours_dict[(frame, contour_freq_idx + 1)] = note['velocity'] * 0.5
    
    # Convert to sparse format
    notes_indices = [[frame, freq] for (frame, freq) in notes_dict.keys()]
    notes_values = list(notes_dict.values())
    
    onsets_indices = [[frame, freq] for (frame, freq) in onsets_dict.keys()]
    onsets_values = list(onsets_dict.values())
    
    contours_indices = [[frame, freq] for (frame, freq) in contours_dict.keys()]
    contours_values = list(contours_dict.values())
    
    # Define shapes (Basic Pitch expects these exact shapes)
    notes_onsets_shape = [ANNOT_N_FRAMES, N_FREQ_BINS_NOTES]
    contours_shape = [ANNOT_N_FRAMES, N_FREQ_BINS_CONTOURS]
    
    return (notes_indices, notes_values, onsets_indices, onsets_values,
            contours_indices, contours_values, notes_onsets_shape, contours_shape)


def to_tfrecord(file_id: str, source: str, audio_data: np.ndarray,
                notes_indices: List[List[int]], notes_values: List[float],
                onsets_indices: List[List[int]], onsets_values: List[float],
                contours_indices: List[List[int]], contours_values: List[float],
                notes_onsets_shape: List[int], contours_shape: List[int]) -> tf.train.Example:
    """
    Convert window data to TFRecord Example in Basic Pitch format
    """
    # Encode audio as WAV bytes
    audio_encoded = tf.audio.encode_wav(
        audio_data.reshape(-1, 1),
        AUDIO_SAMPLE_RATE
    ).numpy()
    
    # Helper function to create bytes feature
    def bytes_feature(value):
        return tf.train.Feature(bytes_list=tf.train.BytesList(value=[value]))
    
    # Create feature dictionary matching Basic Pitch format
    feature = {
        'file_id': bytes_feature(file_id.encode('utf-8')),
        'source': bytes_feature(source.encode('utf-8')),
        'audio_wav': bytes_feature(audio_encoded),
        'notes_indices': bytes_feature(tf.io.serialize_tensor(np.array(notes_indices, np.int64)).numpy()),
        'notes_values': bytes_feature(tf.io.serialize_tensor(np.array(notes_values, np.float32)).numpy()),
        'onsets_indices': bytes_feature(tf.io.serialize_tensor(np.array(onsets_indices, np.int64)).numpy()),
        'onsets_values': bytes_feature(tf.io.serialize_tensor(np.array(onsets_values, np.float32)).numpy()),
        'contours_indices': bytes_feature(tf.io.serialize_tensor(np.array(contours_indices, np.int64)).numpy()),
        'contours_values': bytes_feature(tf.io.serialize_tensor(np.array(contours_values, np.float32)).numpy()),
        'notes_onsets_shape': bytes_feature(tf.io.serialize_tensor(np.array(notes_onsets_shape, np.int64)).numpy()),
        'contours_shape': bytes_feature(tf.io.serialize_tensor(np.array(contours_shape, np.int64)).numpy()),
    }
    
    return tf.train.Example(features=tf.train.Features(feature=feature))


def process_track(track: dict, output_dir: str, max_duration: int = 900) -> Dict:
    """
    Process a single track into 2-second windows
    
    Args:
        track: Track information dictionary
        output_dir: Output directory for TFRecord files
        max_duration: Maximum track duration in seconds
    
    Returns:
        Dictionary with processing statistics
    """
    track_id = track['track_id']
    audio_path = track['audio_path']
    midi_path = track['midi_path']
    split = track['split']
    
    logger.info(f"Processing: {track_id}")
    
    try:
        import librosa
        
        # Load audio
        audio, sr = librosa.load(audio_path, sr=AUDIO_SAMPLE_RATE, mono=True)
        duration = len(audio) / sr
        
        # Skip tracks longer than max_duration
        if duration > max_duration:
            logger.info(f"⏭️  Skipping {track_id}: duration {duration:.1f}s exceeds {max_duration}s")
            return {'status': 'skipped_too_long', 'duration': duration}
        
        # Extract 2-second windows with 50% overlap
        windows = extract_2s_windows(audio, duration, midi_path, hop_ratio=0.5)
        
        if not windows:
            logger.warning(f"⚠️  No windows extracted from: {track_id}")
            return {'status': 'skipped_no_windows'}
        
        # Create output directory
        output_path = Path(output_dir) / "maestro" / "splits" / split
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Create a base filename for this track
        safe_track_id = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in track_id)
        
        windows_written = 0
        windows_with_notes = 0
        
        # Process each window
        for window in windows:
            window_idx = window['window_idx']
            
            # Create labels for this window
            (notes_indices, notes_values, onsets_indices, onsets_values,
             contours_indices, contours_values, notes_onsets_shape, contours_shape) = create_labels_for_window(window['notes'])
            
            # Skip windows with no notes
            if len(notes_values) == 0:
                continue
            
            windows_with_notes += 1
            
            # Create window ID
            window_id = f"{safe_track_id}_window_{window_idx:04d}"
            
            # Create TFRecord example
            example = to_tfrecord(
                window_id, "maestro", window['audio'],
                notes_indices, notes_values,
                onsets_indices, onsets_values,
                contours_indices, contours_values,
                notes_onsets_shape, contours_shape
            )
            
            # Write TFRecord file
            tfrecord_path = output_path / f"{window_id}.tfrecord"
            with tf.io.TFRecordWriter(str(tfrecord_path)) as writer:
                writer.write(example.SerializeToString())
            
            windows_written += 1
        
        logger.info(f"✓ Processed {track_id}: {windows_written}/{len(windows)} windows written ({windows_with_notes} with notes)")
        
        return {
            'status': 'success',
            'windows_total': len(windows),
            'windows_with_notes': windows_with_notes,
            'windows_written': windows_written
        }
        
    except Exception as e:
        logger.error(f"✗ Error processing {track_id}: {e}")
        import traceback
        traceback.print_exc()
        return {'status': 'error', 'error': str(e)}


def validate_tfrecord(tfrecord_path: str) -> bool:
    """
    Validate a TFRecord file to ensure it matches Basic Pitch format
    """
    try:
        # Define schema
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
        
        # Read and parse
        dataset = tf.data.TFRecordDataset(tfrecord_path)
        parsed = next(iter(dataset))
        example = tf.io.parse_single_example(parsed, schema)
        
        # Decode audio
        audio_decoded = tf.audio.decode_wav(
            example['audio_wav'],
            desired_channels=1,
            desired_samples=-1,
        )
        audio = audio_decoded.audio
        
        # Check audio length
        if audio.shape[0] != AUDIO_N_SAMPLES:
            logger.error(f"Audio length mismatch: {audio.shape[0]} != {AUDIO_N_SAMPLES}")
            return False
        
        # Check shapes
        notes_shape = tf.io.parse_tensor(
            example['notes_onsets_shape'],
            out_type=tf.int64
        ).numpy()
        
        contours_shape = tf.io.parse_tensor(
            example['contours_shape'],
            out_type=tf.int64
        ).numpy()
        
        if not np.array_equal(notes_shape, [ANNOT_N_FRAMES, N_FREQ_BINS_NOTES]):
            logger.error(f"Notes shape mismatch: {notes_shape} != [{ANNOT_N_FRAMES}, {N_FREQ_BINS_NOTES}]")
            return False
        
        if not np.array_equal(contours_shape, [ANNOT_N_FRAMES, N_FREQ_BINS_CONTOURS]):
            logger.error(f"Contours shape mismatch: {contours_shape} != [{ANNOT_N_FRAMES}, {N_FREQ_BINS_CONTOURS}]")
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Process MAESTRO v2.0.0 dataset to Basic Pitch TFRecord format with 2-second windows"
    )
    parser.add_argument(
        "--source",
        type=str,
        required=True,
        help="Path to MAESTRO v2.0.0 dataset directory"
    )
    parser.add_argument(
        "--destination",
        type=str,
        required=True,
        help="Output directory for TFRecord files"
    )
    parser.add_argument(
        "--max-duration",
        type=int,
        default=900,
        help="Maximum track duration in seconds (default: 900 = 15 minutes)"
    )
    parser.add_argument(
        "--max-tracks",
        type=int,
        default=None,
        help="Maximum number of tracks to process (for testing)"
    )
    parser.add_argument(
        "--split",
        type=str,
        default=None,
        choices=['train', 'validation', 'test'],
        help="Process only specific split (default: all splits)"
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate output files after processing"
    )
    
    args = parser.parse_args()
    
    # Setup
    logger.info("=" * 80)
    logger.info("MAESTRO to Basic Pitch TFRecord Converter (2-second windows)")
    logger.info("=" * 80)
    logger.info(f"Source: {args.source}")
    logger.info(f"Destination: {args.destination}")
    logger.info(f"Audio length: {AUDIO_N_SAMPLES} samples ({AUDIO_WINDOW_LENGTH}s)")
    logger.info(f"Annotations: {ANNOT_N_FRAMES} frames @ {ANNOTATIONS_FPS} FPS")
    logger.info(f"Max duration: {args.max_duration}s")
    
    # Setup libraries
    librosa, pretty_midi, sf = setup_audio_processing()
    
    # Create output directory
    os.makedirs(args.destination, exist_ok=True)
    
    # Get all tracks
    tracks = get_track_files(args.source)
    
    # Filter by split if specified
    if args.split:
        tracks = [t for t in tracks if t['split'] == args.split]
        logger.info(f"Filtered to {len(tracks)} tracks in '{args.split}' split")
    
    # Limit number of tracks if specified
    if args.max_tracks:
        tracks = tracks[:args.max_tracks]
        logger.info(f"Limited to {args.max_tracks} tracks for testing")
    
    # Process statistics
    stats = {
        'total_tracks': len(tracks),
        'success': 0,
        'failed': 0,
        'skipped': 0,
        'total_windows': 0,
        'windows_with_notes': 0,
        'windows_written': 0,
        'by_split': {}
    }
    
    # Process each track
    logger.info("=" * 80)
    logger.info(f"Processing {len(tracks)} tracks...")
    logger.info("=" * 80)
    
    for i, track in enumerate(tracks, 1):
        logger.info(f"\n[{i}/{len(tracks)}] Processing: {track['track_id']}")
        
        result = process_track(
            track,
            args.destination,
            args.max_duration
        )
        
        split = track['split']
        if split not in stats['by_split']:
            stats['by_split'][split] = {
                'tracks': 0,
                'windows': 0,
                'windows_with_notes': 0
            }
        
        status = result.get('status', 'error')
        
        if status == 'success':
            stats['success'] += 1
            stats['by_split'][split]['tracks'] += 1
            stats['total_windows'] += result.get('windows_total', 0)
            stats['windows_with_notes'] += result.get('windows_with_notes', 0)
            stats['windows_written'] += result.get('windows_written', 0)
            stats['by_split'][split]['windows'] += result.get('windows_written', 0)
            stats['by_split'][split]['windows_with_notes'] += result.get('windows_with_notes', 0)
        elif status == 'skipped_too_long':
            stats['skipped'] += 1
        elif status == 'skipped_no_windows':
            stats['skipped'] += 1
        else:  # error
            stats['failed'] += 1
    
    # Print summary
    logger.info("\n" + "=" * 80)
    logger.info("PROCESSING COMPLETE")
    logger.info("=" * 80)
    logger.info(f"Total tracks processed: {stats['total_tracks']}")
    logger.info(f"✅ Successful: {stats['success']}")
    logger.info(f"⏭️  Skipped: {stats['skipped']}")
    logger.info(f"❌ Failed: {stats['failed']}")
    logger.info(f"Total windows created: {stats['total_windows']}")
    logger.info(f"Windows with notes: {stats['windows_with_notes']}")
    logger.info(f"Windows written: {stats['windows_written']}")
    
    if stats['total_tracks'] > 0:
        success_rate = stats['success'] / stats['total_tracks'] * 100
        logger.info(f"\nSuccess rate: {success_rate:.1f}%")
    
    logger.info("\nBy split:")
    for split, split_stats in stats['by_split'].items():
        logger.info(f"  {split}:")
        logger.info(f"    Tracks: {split_stats['tracks']}")
        logger.info(f"    Windows written: {split_stats['windows']}")
        logger.info(f"    Windows with notes: {split_stats['windows_with_notes']}")
    
    # Validate output if requested
    if args.validate and stats['windows_written'] > 0:
        logger.info("\n" + "=" * 80)
        logger.info("VALIDATING OUTPUT FILES")
        logger.info("=" * 80)
        
        validation_passed = 0
        validation_failed = 0
        
        # Find and validate TFRecord files
        for root, dirs, files in os.walk(args.destination):
            for file in files:
                if file.endswith('.tfrecord'):
                    tfrecord_path = os.path.join(root, file)
                    if validate_tfrecord(tfrecord_path):
                        validation_passed += 1
                    else:
                        validation_failed += 1
        
        logger.info(f"Validation results:")
        logger.info(f"  ✅ Passed: {validation_passed}")
        logger.info(f"  ❌ Failed: {validation_failed}")
        
        if validation_failed == 0:
            logger.info("🎉 All files validated successfully!")
        else:
            logger.warning(f"⚠️  {validation_failed} files failed validation")
    
    logger.info(f"\nOutput directory: {args.destination}")
    logger.info("=" * 80)


if __name__ == "__main__":
    main()