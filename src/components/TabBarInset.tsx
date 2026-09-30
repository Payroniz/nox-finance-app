import React, { createContext, useContext, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HeightContext = createContext(90);
const MeasureContext = createContext<(height: number) => void>(() => {});

export function TabBarInsetProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(80 + Math.max(insets.bottom, 10));
  return <HeightContext.Provider value={height}>
    <MeasureContext.Provider value={setHeight}>{children}</MeasureContext.Provider>
  </HeightContext.Provider>;
}

export const useTabBarInset = () => useContext(HeightContext);
export const useMeasureTabBar = () => useContext(MeasureContext);