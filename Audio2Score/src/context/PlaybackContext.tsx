// 全局播放控制 Context - 用於協調不同畫面的音訊播放
import React, { createContext, useContext, useRef, useCallback } from 'react';
import AudioManager from '../utils/AudioManager';

interface PlaybackContextType {
  registerPlayer: (id: string, stopCallback: () => void) => void;
  unregisterPlayer: (id: string) => void;
  notifyPlaybackStart: (playerId: string) => void;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

export const PlaybackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 儲存所有已註冊的播放器及其停止回調
  const playersRef = useRef<Map<string, () => void>>(new Map());
  const currentPlayingRef = useRef<string | null>(null);

  // 註冊播放器
  const registerPlayer = useCallback((id: string, stopCallback: () => void) => {
    console.log(`🎵 [PlaybackContext] 註冊播放器: ${id}`);
    playersRef.current.set(id, stopCallback);
  }, []);

  // 取消註冊播放器
  const unregisterPlayer = useCallback((id: string) => {
    console.log(`🎵 [PlaybackContext] 取消註冊播放器: ${id}`);
    playersRef.current.delete(id);
    if (currentPlayingRef.current === id) {
      currentPlayingRef.current = null;
    }
  }, []);

  // 通知開始播放（會停止其他所有播放器）
  const notifyPlaybackStart = useCallback((playerId: string) => {
    console.log(`🎵 [PlaybackContext] 播放器 ${playerId} 開始播放`);
    
    // 停止所有其他播放器（不包括自己）
    playersRef.current.forEach((stopCallback, id) => {
      if (id !== playerId) {
        console.log(`🛑 [PlaybackContext] 停止其他播放器: ${id}`);
        try {
          stopCallback();
        } catch (error) {
          console.error(`停止播放器 ${id} 時發生錯誤:`, error);
        }
      }
    });

    // 確保 AudioManager 也停止所有之前的音訊
    // 注意：這裡調用 stopAll 不會影響即將開始的播放
    AudioManager.stopAll();
    
    currentPlayingRef.current = playerId;
  }, []);

  return (
    <PlaybackContext.Provider value={{ registerPlayer, unregisterPlayer, notifyPlaybackStart }}>
      {children}
    </PlaybackContext.Provider>
  );
};

export const usePlayback = () => {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error('usePlayback must be used within PlaybackProvider');
  }
  return context;
};
