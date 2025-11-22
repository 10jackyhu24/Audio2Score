// MIDI 相關的類型定義
export interface MIDINote {
  note: string;
  startTime: number;
  duration: number;
  velocity?: number;
}

export interface MIDIData {
  notes: MIDINote[];
  duration: number;
  tempo?: number;
  timeSignature?: [number, number];
  tracks?: any[];
}

export interface MIDIViewerProps {
  midiFilePath?: string;
  midiUrl?: string | null;
  midiData?: MIDIData | null;
  autoPlay?: boolean;
  speed?: number;
  onLoadComplete?: (data: MIDIData) => void;
  onPlaybackEnd?: () => void;
  showControls?: boolean;
  height?: number;
}

export interface FallingNotesProps {
  notes?: MIDINote[];
  currentTime?: number;
  speed?: number;
  onSeek?: (time: number) => void;
}

export interface PianoKeyboardProps {
  onNotePress?: (noteName: string) => void;
  activeNotes?: string[];
}
