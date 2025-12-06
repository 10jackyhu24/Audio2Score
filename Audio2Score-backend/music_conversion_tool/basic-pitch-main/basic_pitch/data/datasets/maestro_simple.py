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
        import soundfile
        return librosa, pretty_midi, soundfile
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


def create_note_labels(midi_path: str, duration: float, hop_size: float = 0.01, 
                       min_note: int = 21, max_note: int = 108,
                       notes_bins_per_semitone: int = 1,
                       contours_bins_per_semitone: int = 3):
    """
    Create note, onset, and contour labels from MIDI file in sparse format
    
    Args:
        midi_path: Path to MIDI file
        duration: Duration of audio in seconds
        hop_size: Time resolution in seconds (default: 10ms)
        min_note: Minimum MIDI note number (default: A0 = 21)
        max_note: Maximum MIDI note number (default: C8 = 108)
        notes_bins_per_semitone: Bins per semitone for notes (default: 1)
        contours_bins_per_semitone: Bins per semitone for contours (default: 3)
    
    Returns:
        Tuple of (notes_indices, notes_values, onsets_indices, onsets_values, 
                  contours_indices, contours_values, notes_onsets_shape, contours_shape)
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
    n_semitones = max_note - min_note + 1
    n_freq_bins_notes = n_semitones * notes_bins_per_semitone  # 88 * 1 = 88
    n_freq_bins_contours = n_semitones * contours_bins_per_semitone  # 88 * 3 = 264
    
    # Use dictionaries to store sparse data
    notes_dict = {}  # (time, freq) -> value
    onsets_dict = {}  # (time, freq) -> value
    contours_dict = {}  # (time, freq) -> value
    
    # Process all notes from all instruments
    for instrument in midi_data.instruments:
        if instrument.is_drum:
            continue
            
        for note in instrument.notes:
            pitch = note.pitch
            
            # Skip notes outside range
            if pitch < min_note or pitch > max_note:
                continue
            
            # Calculate frequency bin index for notes (1 bin per semitone)
            semitone_idx = pitch - min_note
            note_freq_idx = semitone_idx * notes_bins_per_semitone
            
            # For contours, we use finer resolution (3 bins per semitone)
            # Use the center bin of the 3 bins for each semitone
            contour_freq_idx = semitone_idx * contours_bins_per_semitone + (contours_bins_per_semitone // 2)
            
            velocity = note.velocity / 127.0  # Normalize velocity to [0, 1]
            
            # Calculate frame indices
            start_frame = int(note.start / hop_size)
            end_frame = int(note.end / hop_size)
            
            # Ensure frames are within bounds
            start_frame = max(0, min(start_frame, n_frames - 1))
            end_frame = max(0, min(end_frame, n_frames - 1))
            
            # Set note active for duration (using notes resolution)
            for frame in range(start_frame, end_frame + 1):
                notes_dict[(frame, note_freq_idx)] = velocity
                onsets_dict[(start_frame, note_freq_idx)] = velocity  # Only at start
            
            # Set contour active for duration (using contours resolution)
            for frame in range(start_frame, end_frame + 1):
                # Set the center bin and optionally neighboring bins for smoother contours
                contours_dict[(frame, contour_freq_idx)] = velocity
                # Optionally add neighboring bins with lower intensity for smoother contours
                if contours_bins_per_semitone == 3:
                    if contour_freq_idx > 0:
                        contours_dict[(frame, contour_freq_idx - 1)] = velocity * 0.5
                    if contour_freq_idx < n_freq_bins_contours - 1:
                        contours_dict[(frame, contour_freq_idx + 1)] = velocity * 0.5
    
    # Convert to sparse format (indices and values)
    notes_indices = list(notes_dict.keys())
    notes_values = list(notes_dict.values())
    
    onsets_indices = list(onsets_dict.keys())
    onsets_values = list(onsets_dict.values())
    
    contours_indices = list(contours_dict.keys())
    contours_values = list(contours_dict.values())
    
    notes_onsets_shape = (n_frames, n_freq_bins_notes)  # (172, 88)
    contours_shape = (n_frames, n_freq_bins_contours)    # (172, 264)
    
    return (notes_indices, notes_values, onsets_indices, onsets_values,
            contours_indices, contours_values, notes_onsets_shape, contours_shape)


def process_audio(audio_path: str, target_sr: int = 22050, target_channels: int = 1) -> Tuple[str, float]:
    """
    Load and process audio file, convert to WAV format if needed
    
    Args:
        audio_path: Path to audio file
        target_sr: Target sample rate
        target_channels: Target number of channels (1=mono, 2=stereo)
    
    Returns:
        Tuple of (wav_file_path, duration)
    """
    try:
        import librosa
        import soundfile as sf
    except ImportError:
        logger.error("librosa and soundfile not installed. Run: pip install librosa soundfile")
        sys.exit(1)
    
    try:
        # Load audio
        audio, sr = librosa.load(audio_path, sr=target_sr, mono=(target_channels == 1))
        duration = len(audio) / sr
        
        # Create temporary WAV file
        import tempfile
        temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        temp_wav_path = temp_wav.name
        temp_wav.close()
        
        # Save as WAV with correct format
        sf.write(temp_wav_path, audio, target_sr)
        
        return temp_wav_path, duration
    except Exception as e:
        logger.error(f"Error loading audio file {audio_path}: {e}")
        raise


def to_tfrecord(file_id: str, source: str, audio_wav_path: str,
                notes_indices: List[Tuple[int, int]], notes_values: List[float],
                onsets_indices: List[Tuple[int, int]], onsets_values: List[float],
                contours_indices: List[Tuple[int, int]], contours_values: List[float],
                notes_onsets_shape: Tuple[int, int], contours_shape: Tuple[int, int]) -> tf.train.Example:
    """
    Convert track data to TFRecord Example in Basic Pitch format
    
    Args:
        file_id: Unique track identifier
        source: Source dataset name (e.g., "maestro")
        audio_wav_path: Path to WAV audio file
        notes_indices: List of (time, freq) tuples for notes
        notes_values: List of values for notes
        onsets_indices: List of (time, freq) tuples for onsets
        onsets_values: List of values for onsets
        contours_indices: List of (time, freq) tuples for contours
        contours_values: List of values for contours
        notes_onsets_shape: Shape tuple (n_frames, n_pitches)
        contours_shape: Shape tuple (n_frames, n_pitches)
    
    Returns:
        tf.train.Example
    """
    # Read WAV file as bytes
    with open(audio_wav_path, 'rb') as f:
        encoded_wav = f.read()
    
    # Helper function to create bytes feature
    def bytes_feature(value):
        return tf.train.Feature(bytes_list=tf.train.BytesList(value=[value]))
    
    # Create feature dictionary matching Basic Pitch format
    feature = {
        'file_id': bytes_feature(file_id.encode('utf-8')),
        'source': bytes_feature(source.encode('utf-8')),
        'audio_wav': bytes_feature(encoded_wav),
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
    
    temp_wav_path = None
    try:
        # Load and convert audio to WAV
        temp_wav_path, duration = process_audio(audio_path, target_sr, target_channels=1)
        
        # Skip tracks longer than max_duration
        if duration > max_duration:
            logger.info(f"Skipping {track_id}: duration {duration:.1f}s exceeds {max_duration}s")
            if temp_wav_path and os.path.exists(temp_wav_path):
                os.unlink(temp_wav_path)
            return False
        
        # Create labels from MIDI (now returns sparse format)
        (notes_indices, notes_values, onsets_indices, onsets_values,
         contours_indices, contours_values, notes_onsets_shape, contours_shape) = create_note_labels(
            midi_path, duration, hop_size
        )
        
        # Create TFRecord example in Basic Pitch format
        example = to_tfrecord(
            track_id, "maestro", temp_wav_path,
            notes_indices, notes_values,
            onsets_indices, onsets_values,
            contours_indices, contours_values,
            notes_onsets_shape, contours_shape
        )
        
        # Write to TFRecord file
        output_path = Path(output_dir) / "maestro" / "splits" / split
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Create a unique filename for this track
        safe_track_id = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in track_id)
        tfrecord_path = output_path / f"{safe_track_id}.tfrecord"
        
        with tf.io.TFRecordWriter(str(tfrecord_path)) as writer:
            writer.write(example.SerializeToString())
        
        logger.info(f"✓ Successfully processed: {track_id} -> {tfrecord_path}")
        
        # Clean up temp WAV file
        if temp_wav_path and os.path.exists(temp_wav_path):
            os.unlink(temp_wav_path)
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Error processing {track_id}: {e}")
        import traceback
        traceback.print_exc()
        
        # Clean up temp WAV file on error
        if temp_wav_path and os.path.exists(temp_wav_path):
            try:
                os.unlink(temp_wav_path)
            except:
                pass
        
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
    librosa, pretty_midi, soundfile = setup_audio_processing()
    
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
