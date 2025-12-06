#!/usr/bin/env python
# encoding: utf-8
#
# Simplified MAESTRO dataset processor for local execution (no Docker required)
# Processes MAESTRO v2.0.0 dataset to TFRecord format

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import List, Tuple
import tempfile
import json

import numpy as np
import tensorflow as tf

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
        return librosa, pretty_midi
    except ImportError as e:
        logger.error(f"Required library not found: {e}")
        logger.error("Please install: pip install librosa pretty_midi")
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


def create_note_labels(midi_path: str, duration: float, hop_size: float = 0.01, 
                       min_note: int = 21, max_note: int = 108) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Create note, onset, and contour labels from MIDI file
    
    Args:
        midi_path: Path to MIDI file
        duration: Duration of audio in seconds
        hop_size: Time resolution in seconds (default: 10ms)
        min_note: Minimum MIDI note number (default: A0 = 21)
        max_note: Maximum MIDI note number (default: C8 = 108)
    
    Returns:
        Tuple of (note_labels, onset_labels, contour_labels) as numpy arrays
    """
    try:
        import pretty_midi
    except ImportError:
        logger.error("pretty_midi not installed. Run: pip install pretty_midi")
        sys.exit(1)
    
    # Load MIDI file
    try:
        midi_data = pretty_midi.PrettyMIDI(midi_path)
    except Exception as e:
        logger.error(f"Error loading MIDI file {midi_path}: {e}")
        raise
    
    # Calculate time frames
    n_frames = int(np.ceil(duration / hop_size))
    n_pitches = max_note - min_note + 1
    
    # Initialize labels
    note_labels = np.zeros((n_frames, n_pitches), dtype=np.float32)
    onset_labels = np.zeros((n_frames, n_pitches), dtype=np.float32)
    contour_labels = np.zeros((n_frames, n_pitches), dtype=np.float32)
    
    # Process all notes from all instruments
    for instrument in midi_data.instruments:
        if instrument.is_drum:
            continue
            
        for note in instrument.notes:
            pitch = note.pitch
            
            # Skip notes outside range
            if pitch < min_note or pitch > max_note:
                continue
            
            pitch_idx = pitch - min_note
            
            # Calculate frame indices
            start_frame = int(note.start / hop_size)
            end_frame = int(note.end / hop_size)
            
            # Ensure frames are within bounds
            start_frame = max(0, min(start_frame, n_frames - 1))
            end_frame = max(0, min(end_frame, n_frames - 1))
            
            # Set note active for duration
            note_labels[start_frame:end_frame + 1, pitch_idx] = 1.0
            
            # Set onset
            onset_labels[start_frame, pitch_idx] = 1.0
            
            # Set contour (simplified - same as note for now)
            contour_labels[start_frame:end_frame + 1, pitch_idx] = 1.0
    
    return note_labels, onset_labels, contour_labels


def process_audio(audio_path: str, target_sr: int = 22050) -> Tuple[np.ndarray, float]:
    """
    Load and process audio file
    
    Args:
        audio_path: Path to audio file
        target_sr: Target sample rate
    
    Returns:
        Tuple of (audio_data, duration)
    """
    try:
        import librosa
    except ImportError:
        logger.error("librosa not installed. Run: pip install librosa")
        sys.exit(1)
    
    try:
        # Load audio
        audio, sr = librosa.load(audio_path, sr=target_sr, mono=True)
        duration = len(audio) / sr
        
        return audio, duration
    except Exception as e:
        logger.error(f"Error loading audio file {audio_path}: {e}")
        raise


def to_tfrecord(track_id: str, audio_path: str, midi_path: str, 
                note_labels: np.ndarray, onset_labels: np.ndarray, 
                contour_labels: np.ndarray, duration: float) -> tf.train.Example:
    """
    Convert track data to TFRecord Example
    
    Args:
        track_id: Unique track identifier
        audio_path: Path to audio file
        midi_path: Path to MIDI file
        note_labels: Note activation labels
        onset_labels: Note onset labels
        contour_labels: Contour labels
        duration: Audio duration in seconds
    
    Returns:
        tf.train.Example
    """
    # Read audio file as bytes
    with open(audio_path, 'rb') as f:
        audio_bytes = f.read()
    
    # Create feature dictionary
    feature = {
        'track_id': tf.train.Feature(bytes_list=tf.train.BytesList(value=[track_id.encode('utf-8')])),
        'audio': tf.train.Feature(bytes_list=tf.train.BytesList(value=[audio_bytes])),
        'note_labels': tf.train.Feature(bytes_list=tf.train.BytesList(value=[note_labels.tobytes()])),
        'onset_labels': tf.train.Feature(bytes_list=tf.train.BytesList(value=[onset_labels.tobytes()])),
        'contour_labels': tf.train.Feature(bytes_list=tf.train.BytesList(value=[contour_labels.tobytes()])),
        'note_shape': tf.train.Feature(int64_list=tf.train.Int64List(value=note_labels.shape)),
        'onset_shape': tf.train.Feature(int64_list=tf.train.Int64List(value=onset_labels.shape)),
        'contour_shape': tf.train.Feature(int64_list=tf.train.Int64List(value=contour_labels.shape)),
        'duration': tf.train.Feature(float_list=tf.train.FloatList(value=[duration])),
    }
    
    return tf.train.Example(features=tf.train.Features(feature=feature))


def process_track(track: dict, output_dir: str, hop_size: float = 0.01, 
                  target_sr: int = 22050, max_duration: int = 900) -> bool:
    """
    Process a single track and write to TFRecord
    
    Args:
        track: Track information dictionary
        output_dir: Output directory for TFRecord files
        hop_size: Time resolution in seconds
        target_sr: Target sample rate
        max_duration: Maximum duration in seconds (15 minutes default)
    
    Returns:
        True if successful, False otherwise
    """
    track_id = track['track_id']
    audio_path = track['audio_path']
    midi_path = track['midi_path']
    split = track['split']
    
    logger.info(f"Processing: {track_id}")
    
    try:
        # Load audio
        audio, duration = process_audio(audio_path, target_sr)
        
        # Skip tracks longer than max_duration
        if duration > max_duration:
            logger.info(f"Skipping {track_id}: duration {duration:.1f}s exceeds {max_duration}s")
            return False
        
        # Create labels from MIDI
        note_labels, onset_labels, contour_labels = create_note_labels(
            midi_path, duration, hop_size
        )
        
        # Create TFRecord example
        example = to_tfrecord(
            track_id, audio_path, midi_path,
            note_labels, onset_labels, contour_labels, duration
        )
        
        # Write to TFRecord file
        output_path = Path(output_dir) / split
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Create a unique filename for this track
        safe_track_id = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in track_id)
        tfrecord_path = output_path / f"{safe_track_id}.tfrecord"
        
        with tf.io.TFRecordWriter(str(tfrecord_path)) as writer:
            writer.write(example.SerializeToString())
        
        logger.info(f"✓ Successfully processed: {track_id} -> {tfrecord_path}")
        return True
        
    except Exception as e:
        logger.error(f"✗ Error processing {track_id}: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Process MAESTRO v2.0.0 dataset to TFRecord format (local execution)"
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
        "--hop-size",
        type=float,
        default=0.01,
        help="Time resolution in seconds (default: 0.01)"
    )
    parser.add_argument(
        "--sample-rate",
        type=int,
        default=22050,
        help="Target audio sample rate (default: 22050)"
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
    
    args = parser.parse_args()
    
    # Setup
    logger.info("=" * 80)
    logger.info("MAESTRO v2.0.0 TFRecord Converter (Local Version)")
    logger.info("=" * 80)
    logger.info(f"Source: {args.source}")
    logger.info(f"Destination: {args.destination}")
    logger.info(f"Hop size: {args.hop_size}s")
    logger.info(f"Sample rate: {args.sample_rate} Hz")
    logger.info(f"Max duration: {args.max_duration}s")
    
    # Setup libraries
    librosa, pretty_midi = setup_audio_processing()
    
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
        'total': len(tracks),
        'success': 0,
        'failed': 0,
        'skipped': 0,
        'by_split': {}
    }
    
    # Process each track
    logger.info("=" * 80)
    logger.info(f"Processing {len(tracks)} tracks...")
    logger.info("=" * 80)
    
    for i, track in enumerate(tracks, 1):
        logger.info(f"\n[{i}/{len(tracks)}] Processing: {track['track_id']}")
        
        success = process_track(
            track,
            args.destination,
            args.hop_size,
            args.sample_rate,
            args.max_duration
        )
        
        split = track['split']
        if split not in stats['by_split']:
            stats['by_split'][split] = {'success': 0, 'failed': 0, 'skipped': 0}
        
        if success:
            stats['success'] += 1
            stats['by_split'][split]['success'] += 1
        else:
            stats['failed'] += 1
            stats['by_split'][split]['failed'] += 1
    
    # Print summary
    logger.info("\n" + "=" * 80)
    logger.info("PROCESSING COMPLETE")
    logger.info("=" * 80)
    logger.info(f"Total tracks: {stats['total']}")
    logger.info(f"Successful: {stats['success']}")
    logger.info(f"Failed: {stats['failed']}")
    logger.info(f"Success rate: {stats['success']/stats['total']*100:.1f}%")
    logger.info("\nBy split:")
    for split, split_stats in stats['by_split'].items():
        total = split_stats['success'] + split_stats['failed']
        logger.info(f"  {split}: {split_stats['success']}/{total} successful")
    logger.info(f"\nOutput directory: {args.destination}")
    logger.info("=" * 80)


if __name__ == "__main__":
    main()
