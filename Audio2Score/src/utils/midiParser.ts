// utils/midiParser.ts
import { MIDIData, MIDINote } from '../types/midi';

// 簡單的 MIDI 解析器（不需要外部庫）
export class MIDIParser {
  static async parseMidiFile(midiFilePath: string): Promise<MIDIData> {
    try {
      console.log('解析 MIDI 文件:', midiFilePath);
      
      const response = await fetch(midiFilePath);
      const arrayBuffer = await response.arrayBuffer();
      
      return this.parseMidiBuffer(arrayBuffer);
    } catch (error) {
      console.error('MIDI 文件解析失敗:', error);
      throw error;
    }
  }

  static async parseMidiUrl(midiUrl: string, token?: string): Promise<MIDIData> {
    try {
      console.log('從 URL 載入 MIDI:', midiUrl);
      
      const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': 'true',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(midiUrl, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      return this.parseMidiBuffer(arrayBuffer);
    } catch (error) {
      console.error('從 URL 載入 MIDI 失敗:', error);
      throw error;
    }
  }

  static parseMidiBuffer(buffer: ArrayBuffer): MIDIData {
    try {
      console.log('解析 MIDI buffer, 大小:', buffer.byteLength);
      
      const view = new DataView(buffer);
      const notes: MIDINote[] = [];
      let duration = 0;
      let tempo = 500000; // 默認 500000 微秒每拍 (120 BPM)
      
      // 檢查 MIDI 文件頭 "MThd"
      const header = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      if (header !== 'MThd') {
        throw new Error('不是有效的 MIDI 文件');
      }
      
      // 讀取 header 信息
      const formatType = view.getUint16(8);
      const trackCount = view.getUint16(10);
      const timeDivision = view.getUint16(12);
      
      console.log('MIDI 格式:', formatType, '軌道數:', trackCount, '時間分辨率:', timeDivision);
      
      let offset = 14; // header 之後
      const ticksPerBeat = timeDivision & 0x7FFF;
      
      // 解析所有軌道
      const noteEvents: Array<{note: string, startTick: number, endTick: number, velocity: number}> = [];
      const activeNotes: Map<number, {startTick: number, velocity: number}> = new Map();
      
      for (let track = 0; track < trackCount; track++) {
        // 讀取軌道頭 "MTrk"
        const trackHeader = String.fromCharCode(
          view.getUint8(offset), 
          view.getUint8(offset + 1), 
          view.getUint8(offset + 2), 
          view.getUint8(offset + 3)
        );
        
        if (trackHeader !== 'MTrk') {
          console.warn('無效的軌道頭:', trackHeader);
          break;
        }
        
        const trackLength = view.getUint32(offset + 4);
        offset += 8;
        const trackEnd = offset + trackLength;
        
        let currentTick = 0;
        let lastStatus = 0;
        
        while (offset < trackEnd && offset < view.byteLength) {
          // 讀取 delta time (variable length)
          const { value: deltaTime, bytesRead } = this.readVariableLength(view, offset);
          offset += bytesRead;
          currentTick += deltaTime;
          
          if (offset >= view.byteLength) break;
          
          let status = view.getUint8(offset);
          
          // 處理 running status
          if (status < 0x80) {
            status = lastStatus;
          } else {
            offset++;
            lastStatus = status;
          }
          
          const messageType = status & 0xF0;
          const channel = status & 0x0F;
          
          // Note On (0x90)
          if (messageType === 0x90) {
            const note = view.getUint8(offset);
            const velocity = view.getUint8(offset + 1);
            offset += 2;
            
            if (velocity > 0) {
              // Note on
              activeNotes.set(note, { startTick: currentTick, velocity });
            } else {
              // Note off (velocity = 0)
              const noteOn = activeNotes.get(note);
              if (noteOn) {
                noteEvents.push({
                  note: this.midiNoteToName(note),
                  startTick: noteOn.startTick,
                  endTick: currentTick,
                  velocity: noteOn.velocity
                });
                activeNotes.delete(note);
              }
            }
          }
          // Note Off (0x80)
          else if (messageType === 0x80) {
            const note = view.getUint8(offset);
            const velocity = view.getUint8(offset + 1);
            offset += 2;
            
            const noteOn = activeNotes.get(note);
            if (noteOn) {
              noteEvents.push({
                note: this.midiNoteToName(note),
                startTick: noteOn.startTick,
                endTick: currentTick,
                velocity: noteOn.velocity
              });
              activeNotes.delete(note);
            }
          }
          // Control Change (0xB0)
          else if (messageType === 0xB0) {
            offset += 2;
          }
          // Program Change (0xC0)
          else if (messageType === 0xC0) {
            offset += 1;
          }
          // Channel Pressure (0xD0)
          else if (messageType === 0xD0) {
            offset += 1;
          }
          // Pitch Bend (0xE0)
          else if (messageType === 0xE0) {
            offset += 2;
          }
          // Meta Event (0xFF)
          else if (status === 0xFF) {
            const metaType = view.getUint8(offset);
            offset++;
            const { value: length, bytesRead: lengthBytes } = this.readVariableLength(view, offset);
            offset += lengthBytes;
            
            // Set Tempo (0x51)
            if (metaType === 0x51 && length === 3) {
              tempo = (view.getUint8(offset) << 16) | (view.getUint8(offset + 1) << 8) | view.getUint8(offset + 2);
            }
            
            offset += length;
          }
          // SysEx (0xF0, 0xF7)
          else if (status === 0xF0 || status === 0xF7) {
            const { value: length, bytesRead } = this.readVariableLength(view, offset);
            offset += bytesRead + length;
          }
        }
        
        offset = trackEnd;
      }
      
      // 轉換 tick 為秒
      const microsecondsPerBeat = tempo;
      const secondsPerBeat = microsecondsPerBeat / 1000000;
      const secondsPerTick = secondsPerBeat / ticksPerBeat;
      
      noteEvents.forEach(event => {
        const startTime = event.startTick * secondsPerTick;
        const endTime = event.endTick * secondsPerTick;
        const noteDuration = endTime - startTime;
        
        notes.push({
          note: event.note,
          startTime: startTime,
          duration: noteDuration,
          velocity: event.velocity / 127
        });
        
        duration = Math.max(duration, endTime);
      });
      
      console.log('✅ MIDI 解析完成:', notes.length, '個音符, 總時長:', duration.toFixed(2), '秒');
      
      return {
        notes: notes.sort((a, b) => a.startTime - b.startTime),
        duration,
        tempo: Math.round(60000000 / tempo),
        timeSignature: [4, 4],
        tracks: []
      };
    } catch (error) {
      console.error('MIDI buffer 解析失敗:', error);
      throw error;
    }
  }

  // 讀取可變長度數值
  private static readVariableLength(view: DataView, offset: number): { value: number, bytesRead: number } {
    let value = 0;
    let bytesRead = 0;
    let byte = 0;
    
    do {
      if (offset + bytesRead >= view.byteLength) break;
      byte = view.getUint8(offset + bytesRead);
      value = (value << 7) | (byte & 0x7F);
      bytesRead++;
    } while (byte & 0x80 && bytesRead < 4);
    
    return { value, bytesRead };
  }

  // 將 MIDI 音符號碼轉換為音符名稱 (C4 = 60)
  private static midiNoteToName(midiNote: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];
    return `${noteName}${octave}`;
  }
}
