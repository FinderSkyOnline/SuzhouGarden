import React, { useState, useContext, useEffect } from 'react';
import { Garden } from '../types';
import { Map, Clock, ChevronDown, Navigation, BookOpen, X, Layers, Shuffle, AlertTriangle } from 'lucide-react';
import { openAppleMaps, openGoogleMaps, openAmap, canNavigate } from '../services/navigation';
import { ThemeContext } from '../App';
import { GARDEN_COLLECTIONS } from '../services/gardens';
import GardensMapOverlay from './GardensMapOverlay';

interface UIOverlayProps {
  garden: Garden;
  allGardens: Garden[];
  onPrev: () => void;
  onNext: () => void;
  direction: number;
  totalGardens: number;
  currentIndex: number;
  currentCollectionId: string;
  onSelectGarden: (collectionId: string, index: number) => void;
  isRandomMode: boolean;
  onToggleRandomMode: () => void;
}

const InfoCard: React.FC<{ garden: Garden; isDark: boolean; className?: string }> = ({ garden, isDark, className }) => {
  const [showNavMenu, setShowNavMenu] = useState(false);
  const navigationEnabled = canNavigate(garden);
  const displayAddress = garden.location.address && garden.location.address.trim() ? garden.location.address : '地址不详';
  const locationApproximate = Boolean(garden.location.approximate);
  const approximateNote = garden.location.approximateNote || '该坐标为近似位置，需要先询问确认具体地点。';

  const handleOpenNav = () => {
    if (!navigationEnabled) return;
    if (locationApproximate) {
      const ok = window.confirm(`${approximateNote}\n是否继续导航？`);
      if (!ok) return;
    }
    setShowNavMenu(true);
  };

  // Height adjusted to avoid overlapping with top controls on small screens
  // Added top margin (top-16) on mobile to clear the header area
  const cardStyle = `
    ${isDark ? 'bg-white/10 border-white/20 text-white' : 'bg-black/5 border-black/10 text-gray-900'}
    backdrop-blur-md border shadow-xl rounded-[32px] overflow-hidden 
    h-full w-full flex flex-col pointer-events-auto
    transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]
  `;

  const btnStyle = `
    flex items-center justify-center gap-2 px-6 py-3 rounded-full transition-all duration-200 active:scale-95 font-medium text-sm
    ${isDark ? 'bg-white/20 hover:bg-white/30 active:bg-white/40' : 'bg-black/5 hover:bg-black/10 active:bg-black/20'}
    backdrop-blur-sm
  `;

  const statusStyle = (status: string) => {
    if (status === 'Open') {
      return isDark ? 'text-green-300 bg-green-900/20' : 'text-green-700 bg-green-100';
    }
    return isDark ? 'text-orange-300 bg-orange-900/20' : 'text-orange-700 bg-orange-100';
  };

  return (
    <div className={`${cardStyle} ${className || ''}`}>
      <div className="p-6 md:p-8 flex flex-col gap-4 h-full">
        <div className={`flex flex-wrap gap-2 text-xs font-semibold tracking-wider ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
          <span className={`px-2 py-1 rounded-md backdrop-blur-sm flex items-center gap-1 ${isDark ? 'bg-black/20' : 'bg-black/5'}`}>
            <Clock className="w-3 h-3" /> {garden.year}
          </span>
          <span className={`px-2 py-1 rounded-md backdrop-blur-sm border ${isDark ? 'border-white/10' : 'border-black/5'} ${statusStyle(garden.status)}`}>
            {garden.status === 'Open' ? '开放中' : '已关闭'}
          </span>
        </div>

        <h1 className={`text-3xl md:text-3xl font-bold drop-shadow-sm leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {garden.name}
        </h1>

        <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
            <Map className="w-4 h-4" />
            <span className="truncate">{displayAddress}</span>
        </div>
        {locationApproximate && (
          <div className={`flex items-start gap-2 text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{approximateNote}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
            <div className={`text-sm leading-relaxed ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
              <p className="mb-2">{garden.description}</p>
              <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                <h4 className={`text-xs uppercase mb-1 ${isDark ? 'text-white/50' : 'text-gray-400'}`}>历史渊源</h4>
                <p className={`italic ${isDark ? 'text-white/70' : 'text-gray-600'}`}>{garden.history}</p>
              </div>
            </div>
        </div>

        <div className="flex gap-3 mt-2 pt-2 relative shrink-0">
          <button 
            onClick={handleOpenNav}
            className={`${btnStyle} flex-1 ${isDark ? 'text-sky-100 bg-sky-500/30 hover:bg-sky-500/40' : 'text-sky-900 bg-sky-100 hover:bg-sky-200'} ${navigationEnabled ? '' : 'opacity-50 cursor-not-allowed'}`}
            disabled={!navigationEnabled}
          >
            <Navigation className="w-4 h-4" />
            导航
          </button>
          <button 
              className={`${btnStyle} flex-1 opacity-50 cursor-not-allowed hidden`}
          >
              <BookOpen className="w-4 h-4" />
              详情
          </button>

          {showNavMenu && (
            <div className={`absolute bottom-full left-0 right-0 mb-4 backdrop-blur-2xl rounded-2xl p-2 border shadow-2xl z-50 flex flex-col gap-1 animate-in slide-in-from-bottom-2 duration-200 ${isDark ? 'bg-black/90 border-white/10' : 'bg-white/90 border-black/5'}`}>
              <div className={`flex justify-between items-center px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b ${isDark ? 'text-white/50 border-white/10' : 'text-gray-400 border-black/5'}`}>
                  <span>选择地图导航</span>
                  <button onClick={(e) => { e.stopPropagation(); setShowNavMenu(false); }} className={`p-1 ${isDark ? 'hover:text-white' : 'hover:text-black'}`}><X className="w-4 h-4"/></button>
              </div>
              <button 
                  onClick={(e) => { e.stopPropagation(); openAmap(garden); setShowNavMenu(false); }}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm text-left transition-colors ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-gray-900'}`}
              >
                  <Map className="w-4 h-4 text-orange-400" /> 高德地图 (Amap)
              </button>
              <button 
                  onClick={(e) => { e.stopPropagation(); openGoogleMaps(garden); setShowNavMenu(false); }}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm text-left transition-colors ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-gray-900'}`}
              >
                  <Map className="w-4 h-4 text-blue-400" /> Google Maps
              </button>
              <button 
                  onClick={(e) => { e.stopPropagation(); openAppleMaps(garden); setShowNavMenu(false); }}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm text-left transition-colors ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-black/5 text-gray-900'}`}
              >
                  <Map className="w-4 h-4 text-gray-400" /> Apple Maps
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const UIOverlay: React.FC<UIOverlayProps> = ({ garden, allGardens, onPrev, onNext, direction, totalGardens, currentIndex, currentCollectionId, onSelectGarden, isRandomMode, onToggleRandomMode }) => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  const [showCatalog, setShowCatalog] = useState(false);
  const [showMapOverlay, setShowMapOverlay] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Double buffer for animation
  const [activeGarden, setActiveGarden] = useState(garden);
  const [prevGarden, setPrevGarden] = useState<Garden | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Add state for expanded collections in the catalog
  const [expandedCollections, setExpandedCollections] = useState<string[]>([currentCollectionId]);

  useEffect(() => {
    if (garden.id !== activeGarden.id) {
      setPrevGarden(activeGarden);
      setActiveGarden(garden);
      setIsAnimating(true);
      
      const timer = setTimeout(() => {
        setPrevGarden(null);
        setIsAnimating(false);
      }, 500); // Match CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [garden, activeGarden]);

  // Update expanded collections when currentCollectionId changes
  useEffect(() => {
    if (!expandedCollections.includes(currentCollectionId)) {
      setExpandedCollections(prev => [...prev, currentCollectionId]);
    }
  }, [currentCollectionId]);

  const toggleCollection = (id: string) => {
    setExpandedCollections(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // Pagination Logic (Sliding Window)
  const visibleDotCount = 5;
  let startDot = Math.max(0, currentIndex - Math.floor(visibleDotCount / 2));
  let endDot = Math.min(totalGardens, startDot + visibleDotCount);
  
  if (endDot - startDot < visibleDotCount) {
    startDot = Math.max(0, endDot - visibleDotCount);
  }

  const dots = [];
  for (let i = startDot; i < endDot; i++) {
    dots.push(i);
  }

  return (
    <div className="absolute inset-0 flex flex-col justify-end pb-safe-bottom px-4 md:px-0 items-center pointer-events-none overflow-hidden">
      
      {/* Top Gradient */}
      <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b pointer-events-none transition-colors duration-500 ${isDark ? 'from-black/60 to-transparent' : 'from-slate-100/80 to-transparent'}`} />
      
      {/* Header Info - Shifted down slightly to ensure safe area */}
      <div className={`absolute top-safe-top left-6 mt-4 font-medium text-sm tracking-wide uppercase pointer-events-auto ${isDark ? 'text-white/80' : 'text-black/80'}`}>
        苏州园林 • 雅集
      </div>

      {/* Top Right Controls: Catalog & Theme */}
      <div className="absolute top-safe-top right-6 mt-4 flex gap-3 pointer-events-auto z-50">
        <button 
          onClick={onToggleRandomMode}
          className={`p-2 rounded-full backdrop-blur-md transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/5 hover:bg-black/10 text-black'} ${isRandomMode ? (isDark ? 'bg-white/30 ring-1 ring-white/50' : 'bg-black/20 ring-1 ring-black/20') : ''}`}
          title="随机模式"
        >
          <Shuffle className={`w-5 h-5 ${isRandomMode ? (isDark ? 'text-white' : 'text-black') : 'opacity-70'}`} />
        </button>

        <button 
          onClick={() => {
            setShowCatalog(false);
            setShowMapOverlay(true);
          }}
          className={`p-2 rounded-full backdrop-blur-md transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/5 hover:bg-black/10 text-black'}`}
          title="园林地图"
        >
          <Map className="w-5 h-5" />
        </button>

        <button 
          onClick={() => {
            setShowMapOverlay(false);
            setShowCatalog(!showCatalog);
          }}
          className={`p-2 rounded-full backdrop-blur-md transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/5 hover:bg-black/10 text-black'}`}
          title="园林目录"
        >
          <Layers className="w-5 h-5" />
        </button>
      </div>

      {showMapOverlay && (
        <GardensMapOverlay
          gardens={allGardens}
          isDark={isDark}
          onClose={() => setShowMapOverlay(false)}
        />
      )}

      {/* Catalog Menu - Full Screen Overlay Style with Animations */}
      {showCatalog && (
        <div className={`fixed inset-0 z-50 flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-300 ${isDark ? 'bg-black/90' : 'bg-white/95'}`}>
            {/* Catalog Header */}
            <div className="flex justify-between items-center p-6 pt-safe-top mt-4 pointer-events-auto">
                <div className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>园林目录</div>
                <button 
                    onClick={() => setShowCatalog(false)}
                    className={`p-2 rounded-full transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/5 hover:bg-black/10 text-black'}`}
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
            
            {/* Catalog Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-safe-bottom pointer-events-auto">
                <div className="max-w-3xl mx-auto space-y-6 pb-10">
                    {GARDEN_COLLECTIONS.map(collection => (
                        <div key={collection.id} className="space-y-3">
                            <button 
                                onClick={() => toggleCollection(collection.id)}
                                className={`w-full flex items-center justify-between p-4 rounded-xl text-left font-bold transition-colors ${isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-black/5 hover:bg-black/10 text-gray-900'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span>{collection.name}</span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-white/10' : 'bg-black/5'}`}>{collection.data.length}</span>
                                </div>
                                <div className={`transition-transform duration-300 ${expandedCollections.includes(collection.id) ? 'rotate-180' : ''}`}>
                                    <ChevronDown className="w-5 h-5 opacity-50" />
                                </div>
                            </button>
                            
                            <div className={`grid transition-all duration-300 ease-in-out overflow-hidden ${expandedCollections.includes(collection.id) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                <div className="min-h-0">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2 pt-2">
                                        {collection.data.map((g, idx) => (
                                            <button
                                                key={`${collection.id}-${g.id}`}
                                                onClick={() => { 
                                                    onSelectGarden(collection.id, idx); 
                                                    setShowCatalog(false); 
                                                }}
                                                className={`flex items-center p-3 rounded-lg text-sm text-left transition-colors 
                                                    ${currentCollectionId === collection.id && currentIndex === idx
                                                        ? (isDark ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'bg-sky-100 text-sky-700 border border-sky-200')
                                                        : (isDark ? 'hover:bg-white/5 text-white/70' : 'hover:bg-black/5 text-gray-600')
                                                    }
                                                `}
                                            >
                                                <span className="truncate font-medium">{g.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* Cards Container - Adjusted height for mobile overlap prevention */}
      <div className="w-full max-w-md md:max-w-2xl relative perspective-1000 h-[calc(100vh-180px)] max-h-[75vh] min-h-[400px] mb-4">
        {/* Previous/Exiting Card */}
        {prevGarden && (
          <InfoCard 
            garden={prevGarden} 
            isDark={isDark} 
            className={`
              z-10 gpu-anim
              ${direction > 0 ? '-translate-x-[120%] opacity-0 rotate-[-5deg]' : 'translate-x-[120%] opacity-0 rotate-[5deg]'}
            `} 
          />
        )}
        
        {/* Active/Entering Card */}
        <div 
          key={activeGarden.id}
          className={`absolute top-0 left-0 w-full h-full transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] gpu-anim
            ${isAnimating 
              ? (direction > 0 ? 'animate-in-from-right' : 'animate-in-from-left') 
              : ''}
          `}
        >
          <InfoCard garden={activeGarden} isDark={isDark} />
        </div>
      </div>
      
      {/* Pagination Dots */}
      <div className="h-1.5 flex justify-center gap-2 mb-8 short-screen-dots z-30 relative shrink-0">
          {dots.map((i) => (
            <div 
              key={i} 
              className={`h-full rounded-full transition-all duration-300 ${i === currentIndex ? (isDark ? 'w-8 bg-white' : 'w-8 bg-black') : (isDark ? 'w-1.5 bg-white/30' : 'w-1.5 bg-black/20')}`} 
            />
          ))}
      </div>

      {/* Touch navigation areas */}
      <div className="absolute inset-y-0 left-0 w-1/6 z-0 pointer-events-auto" onClick={onPrev} />
      <div className="absolute inset-y-0 right-0 w-1/6 z-0 pointer-events-auto" onClick={onNext} />

      <div className={`mb-safe-bottom text-[10px] font-medium ${isDark ? 'text-white/30' : 'text-black/30'} hide-on-short`}>
        {isMobile ? '左右滑动切换' : '使用方向键控制'} ({currentIndex + 1} / {totalGardens})
      </div>

      <style>{`
        /* Hide footer hint on small height screens to avoid overlap */
        @media (max-height: 700px) {
          .hide-on-short {
            display: none;
          }
          .short-screen-dots {
            margin-bottom: 0.5rem; //* 4 (0.5rem) instead of 8 (2rem) */
          }
        }
        
        .animate-in-from-right {
          animation: slideInRight 0.5s cubic-bezier(0.2,0.8,0.2,1) forwards;
        }
        .animate-in-from-left {
          animation: slideInLeft 0.5s cubic-bezier(0.2,0.8,0.2,1) forwards;
        }
        @keyframes slideInRight {
          from { transform: translateX(120%) rotate(5deg); opacity: 0; }
          to { transform: translateX(0) rotate(0); opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-120%) rotate(-5deg); opacity: 0; }
          to { transform: translateX(0) rotate(0); opacity: 1; }
        }
        /* Custom utility for safe area padding */
        .pb-safe-bottom {
            padding-bottom: env(safe-area-inset-bottom, 20px);
        }
        .mb-safe-bottom {
            margin-bottom: env(safe-area-inset-bottom, 20px);
        }
        .pt-safe-top {
            padding-top: env(safe-area-inset-top, 20px);
        }
        .top-safe-top {
            top: env(safe-area-inset-top, 20px);
        }
        .gpu-anim {
          will-change: transform, opacity;
          transform: translateZ(0);
        }
      `}</style>
    </div>
  );
};

export default UIOverlay;
