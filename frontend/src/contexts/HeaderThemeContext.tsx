import React, { createContext, useContext, useState, type ReactNode } from 'react';

type HeaderTheme = 'light' | 'dark';

interface HeaderThemeContextType {
  theme: HeaderTheme;
  setTheme: (theme: HeaderTheme) => void;
}

const HeaderThemeContext = createContext<HeaderThemeContextType | undefined>(undefined);

export const HeaderThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<HeaderTheme>('light');

  return (
    <HeaderThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </HeaderThemeContext.Provider>
  );
};

export const useHeaderTheme = () => {
  const context = useContext(HeaderThemeContext);
  if (!context) {
    throw new Error('useHeaderTheme must be used within a HeaderThemeProvider');
  }
  return context;
};
