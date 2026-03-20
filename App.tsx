import React, { useState, useEffect, useCallback, createContext, useRef } from 'react';
import Scene3D from './components/Scene3D';
import UIOverlay from './components/UIOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import { ALL_GARDENS, GARDEN_COLLECTIONS } from './services/gardens';
import { Garden } from './types';
import allGardens from './src/data/all_gardens.json';

// Theme Context
type Theme = 'dark' | 'light';
export const ThemeContext = createContext<{ theme: Theme }>({
  theme: 'dark',
});

// Helper to get garden image
const SAFE_IMAGES = [
  'https://placehold.co/600x800/2e2e2e/white.png?text=Garden+1',
  'https://placehold.co/600x800/3e3e3e/white.png?text=Garden+2',
  'https://placehold.co/600x800/4e4e4e/white.png?text=Garden+3',
  'https://placehold.co/600x800/5e5e5e/white.png?text=Garden+4',
  'https://placehold.co/600x800/6e6e6e/white.png?text=Garden+5',
  'https://placehold.co/600x800/7e7e7e/white.png?text=Garden+6',
  'https://placehold.co/600x800/8e8e8e/white.png?text=Garden+7',
  'https://placehold.co/600x800/9e9e9e/white.png?text=Garden+8',
];
const getImage = (index: number) => SAFE_IMAGES[index % SAFE_IMAGES.length];
const NAVIGATION_LOCK_MS = 320;
const HORIZONTAL_SWIPE_THRESHOLD = 48;
const HORIZONTAL_INTENT_RATIO = 1.25;

// Process raw garden data to add images and fix types
const processGardens = (data: any[]): Garden[] => {
  return data.map((garden, index) => ({
    ...garden,
    imageUrl: getImage(index),
    status: garden.status as 'Open' | 'Closed' | 'Renovation'
  }));
};

const PROCESSED_ALL_GARDENS = processGardens(allGardens);

const App: React.FC = () => {
  const [isRandomMode, setIsRandomMode] = useState(true);
  const [collectionId, setCollectionId] = useState(GARDEN_COLLECTIONS[0].id);
  const lastNavigationTimeRef = useRef(0);
  
  // Determine base gardens based on mode
  const getBaseGardens = useCallback(() => {
    if (isRandomMode) {
      // Return a shuffled copy of all gardens
      return [...PROCESSED_ALL_GARDENS].sort(() => Math.random() - 0.5);
    } else {
      // Return specific collection
      return GARDEN_COLLECTIONS.find(c => c.id === collectionId)?.data || GARDEN_COLLECTIONS[0].data;
    }
  }, [isRandomMode, collectionId]);

  const [currentGardens, setCurrentGardens] = useState<Garden[]>(() => getBaseGardens());

  // Re-fetch/shuffle gardens when mode or collection changes
  useEffect(() => {
    setCurrentGardens(getBaseGardens());
    setCurrentIndex(0); // Reset index
    setDirection(0);
  }, [getBaseGardens]);

  const [currentIndex, setCurrentIndex] = useState(0);
  // isChanging removed, we just update index directly
  const [direction, setDirection] = useState(0);
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    SAFE_IMAGES.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);


  // Sync theme with system preference and update meta theme-color
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateThemeAndBg = (isDark: boolean) => {
      setTheme(isDark ? 'dark' : 'light');
    };

    // Initial check
    updateThemeAndBg(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => updateThemeAndBg(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Update body bg and meta theme-color when theme changes
  useEffect(() => {
      const bgColor = theme === 'dark' ? '#000000' : '#f1f5f9';
      
      // Apply to both html and body to ensure overscroll area is covered
      document.body.style.backgroundColor = bgColor;
      document.documentElement.style.backgroundColor = bgColor;
      
      // Update all meta theme-color tags (handling the multiple media-query ones)
      // First, remove all existing theme-color tags
      const existingTags = document.querySelectorAll('meta[name="theme-color"]');
      existingTags.forEach(tag => tag.remove());

      // Create a new single theme-color tag
        const metaThemeColor = document.createElement('meta');
        metaThemeColor.setAttribute('name', 'theme-color');
        metaThemeColor.setAttribute('content', bgColor);
        document.head.appendChild(metaThemeColor);

  }, [theme]);

  const canNavigate = useCallback(() => {
    const now = performance.now();
    if (now - lastNavigationTimeRef.current < NAVIGATION_LOCK_MS) {
      return false;
    }
    lastNavigationTimeRef.current = now;
    return true;
  }, []);

  const handleNext = useCallback(() => {
    if (currentGardens.length <= 1 || !canNavigate()) return;
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % currentGardens.length);
  }, [canNavigate, currentGardens.length]);

  const handlePrev = useCallback(() => {
    if (currentGardens.length <= 1 || !canNavigate()) return;
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + currentGardens.length) % currentGardens.length);
  }, [canNavigate, currentGardens.length]);

  // Touch handling for mobile swipe
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartRef.current.x;
    const deltaY = touchEndY - touchStartRef.current.y;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (
      horizontalDistance > HORIZONTAL_SWIPE_THRESHOLD &&
      horizontalDistance > verticalDistance * HORIZONTAL_INTENT_RATIO
    ) {
      if (deltaX < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartRef.current = null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  const currentGarden = currentGardens[currentIndex] ?? currentGardens[0];
  if (!currentGarden) return null;

  return (
    <ThemeContext.Provider value={{ theme }}>
      <div 
        className={`relative w-full h-[100dvh] overflow-hidden select-none transition-colors duration-500 ${theme === 'dark' ? 'bg-black text-white' : 'bg-slate-100 text-slate-900'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* 3D Background Scene */}
        <ErrorBoundary>
          <Scene3D 
            currentImage={currentGarden.imageUrl} 
            direction={direction}
            isChanging={false}
            theme={theme}
          />
        </ErrorBoundary>

        {/* Foreground UI */}
        <ErrorBoundary>
          <UIOverlay 
            garden={currentGarden} 
            allGardens={ALL_GARDENS}
            onPrev={handlePrev} 
            onNext={handleNext}
            direction={direction}
            totalGardens={currentGardens.length}
            currentIndex={currentIndex}
            currentCollectionId={collectionId}
            isRandomMode={isRandomMode}
            onToggleRandomMode={() => setIsRandomMode(prev => !prev)}
            onSelectGarden={(newCollectionId, index) => {
              if (isRandomMode) setIsRandomMode(false); // Exit random mode if selecting specific garden
              setCollectionId(newCollectionId);
              setCurrentIndex(index);
              setDirection(0);
            }}
          />
        </ErrorBoundary>
      </div>
    </ThemeContext.Provider>
  );
};

export default App;
