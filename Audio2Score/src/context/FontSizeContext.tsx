import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from 'react';

type FontSizeContextType = {
  scale: number;                // 1 = normal, 0.9 = small, 1.1 = large
  setScale: (value: number) => void;
};

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

export const FontSizeProvider = ({ children }: { children: ReactNode }) => {
  const [scale, setScale] = useState(1); // default: medium

  return (
    <FontSizeContext.Provider value={{ scale, setScale }}>
      {children}
    </FontSizeContext.Provider>
  );
};

export const useFontSize = () => {
  const ctx = useContext(FontSizeContext);
  if (!ctx) {
    throw new Error('useFontSize must be used inside FontSizeProvider');
  }
  return ctx;
};
