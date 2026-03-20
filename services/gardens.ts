import { Garden } from '../types';
import gardens1 from '../src/data/gardens.json';
import gardens2 from '../src/data/gardens2.json';
import gardens3 from '../src/data/gardens3.json';
import gardens4 from '../src/data/gardens4.json';

// 使用 placehold.co 生成可靠的占位图片，确保本地运行不崩
// Using reliable placeholder images to ensure stability locally
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

const processGardens = (data: any[]): Garden[] => {
  return data.map((garden, index) => ({
  ...garden,
  imageUrl: getImage(index),
  // Ensure status matches the Union Type
  status: garden.status as 'Open' | 'Closed' | 'Renovation'
}));
};

export const GARDEN_COLLECTIONS = [
  { id: '1', name: '名录一', data: processGardens(gardens1 as any[]) },
  { id: '2', name: '名录二', data: processGardens(gardens2 as any[]) },
  { id: '3', name: '名录三', data: processGardens(gardens3 as any[]) },
  { id: '4', name: '名录四', data: processGardens(gardens4 as any[]) },
];

export const ALL_GARDENS = GARDEN_COLLECTIONS.flatMap((collection) => collection.data);

// Backward compatibility
export const GARDENS = GARDEN_COLLECTIONS[0].data;
