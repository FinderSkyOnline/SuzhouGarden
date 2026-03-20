export interface Garden {
  id: string;
  name: string;
  description: string;
  history: string;
  year: string;
  status: 'Open' | 'Closed' | 'Renovation';
  location: {
    coordinates: string;
    address: string;
    approximate?: boolean;
    approximateNote?: string;
  };
  imageUrl: string;
}

export type SwipeDirection = 'LEFT' | 'RIGHT' | null;

export interface GestureState {
  isReady: boolean;
  detected: boolean;
  direction: SwipeDirection;
  progress: number; // -1 (left) to 1 (right)
}
