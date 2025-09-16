import React, { createContext, useContext, useState, ReactNode } from 'react';

// This exists because the canvas component that renders the playback control keeps the history document
// copy local and that history document's tree manager tracks the playback time. We need to
// know the playback time in the chat panel which is a distant sibling of the canvas and can't react
// to the local history document copy, so we must put this in a context of the nearest ancestor component
// which is the nav tab panel.  The naming of this context is generic in case it is needed for other
// uses in the nav tab panel in the future.

type NavTabPanelInfoContextType = {
  playbackTime: Date | undefined;
  setPlaybackTime: (time: Date | undefined) => void;
};

const NavTabPanelInfoContext = createContext<NavTabPanelInfoContextType | undefined>(undefined);

export const NavTabPanelInfoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [playbackTime, setPlaybackTime] = useState<Date | undefined>(undefined);

  return (
    <NavTabPanelInfoContext.Provider value={{ playbackTime, setPlaybackTime }}>
      {children}
    </NavTabPanelInfoContext.Provider>
  );
};

export const useNavTabPanelInfo = (): NavTabPanelInfoContextType => {
  const context = useContext(NavTabPanelInfoContext);
  if (!context) {
    throw new Error('useNavTabPanelInfo must be used within a NavTabPanelInfoProvider');
  }
  return context;
};
