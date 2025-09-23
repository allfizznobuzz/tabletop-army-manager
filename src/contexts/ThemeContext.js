import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : true; // Default to dark mode
  });

  useEffect(() => {
    // Save theme preference to localStorage
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    
    // Apply theme class to document root
    document.documentElement.className = isDarkMode ? 'dark-theme' : 'light-theme';
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const theme = {
    isDarkMode,
    toggleTheme,
    colors: isDarkMode ? darkTheme : lightTheme
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

// Dark theme colors
const darkTheme = {
  // Main backgrounds
  primary: '#1a1a1a',
  secondary: '#2c3e50',
  tertiary: '#34495e',
  
  // Text colors
  textPrimary: '#ecf0f1',
  textSecondary: '#bdc3c7',
  textMuted: '#95a5a6',
  
  // Accent colors
  accent: '#4a6741',
  accentLight: '#5dade2',
  success: '#27ae60',
  warning: '#f39c12',
  danger: '#e74c3c',
  
  // UI elements
  border: '#4a6741',
  borderLight: 'rgba(93, 173, 226, 0.3)',
  shadow: 'rgba(0, 0, 0, 0.3)',
  
  // Gradients
  gradient: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
  headerGradient: 'linear-gradient(90deg, #34495e 0%, #2c3e50 100%)'
};

// Light theme colors
const lightTheme = {
  // Main backgrounds
  primary: '#f8f9fa',
  secondary: '#ffffff',
  tertiary: '#e9ecef',
  
  // Text colors
  textPrimary: '#2c3e50',
  textSecondary: '#495057',
  textMuted: '#6c757d',
  
  // Accent colors
  accent: '#007bff',
  accentLight: '#0056b3',
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  
  // UI elements
  border: '#dee2e6',
  borderLight: 'rgba(0, 123, 255, 0.3)',
  shadow: 'rgba(0, 0, 0, 0.1)',
  
  // Gradients
  gradient: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
  headerGradient: 'linear-gradient(90deg, #007bff 0%, #0056b3 100%)'
};
