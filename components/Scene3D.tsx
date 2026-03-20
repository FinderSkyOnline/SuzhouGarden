import React, { useRef, useLayoutEffect, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Image, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      mesh: any;
      planeGeometry: any;
      meshBasicMaterial: any;
      canvasTexture: any;
    }
  }
}

interface Scene3DProps {
  imageUrl: string;
  direction: number; // -1, 0, 1
  isChanging: boolean;
  theme: 'dark' | 'light';
}

const CardMesh: React.FC<Scene3DProps> = ({ imageUrl, direction, isChanging, theme }) => {
  const groupRef = useRef<THREE.Group>(null);
  const imageRef = useRef<THREE.Mesh>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const shadowTexture = useMemo(() => createShadowTexture(), []);
  const invalidate = useThree((state) => state.invalidate);

  // Initial setup for entry position
  useLayoutEffect(() => {
    if (groupRef.current && !isChanging && direction !== 0) {
      // Enter from the side corresponding to direction
      // Next (dir=1) -> Enter from Right (x = 6)
      // Prev (dir=-1) -> Enter from Left (x = -6)
      groupRef.current.position.x = direction * 6;
      groupRef.current.rotation.y = direction * 0.1;
      groupRef.current.scale.setScalar(0.9);
      
      if (imageRef.current && imageRef.current.material) {
        (imageRef.current.material as THREE.Material).opacity = 0;
      }
      if (shadowRef.current && shadowRef.current.material) {
        (shadowRef.current.material as THREE.Material).opacity = 0;
      }
    }
    invalidate();
  }, [direction, isChanging, invalidate]);

  useEffect(() => {
    invalidate();
  }, [imageUrl, theme, invalidate]);

  // Scroll Animation Logic
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Scroll Transition
    // When isChanging is true, we slide out to the opposite direction of 'direction'
    // e.g. Next (dir=1) -> Slide current card Left (x = -5)
    // e.g. Prev (dir=-1) -> Slide current card Right (x = 5)
    
    let targetX = 0;
    let targetRotY = 0;
    let targetScale = 1;
    let targetOpacity = 1;

    if (isChanging) {
      // Slide out
      targetX = direction * -6; // Move further out for cleaner exit
      targetRotY = direction * -0.1; // Slight rotation against movement
      targetScale = 0.9; // Shrink slightly
      targetOpacity = 0; 
    } else {
      // Idle / Entered
      targetX = 0;
      targetRotY = 0;
      targetScale = 1;
      targetOpacity = 1;
    }

    // Use a spring-like smoothing for "snap" feel
    // Damp factor 12 is snappier than previous 6
    const damp = Math.min(1, 12 * delta); 
    
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, damp);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, damp);
    
    // Minimal rotation on Y to focus on "Scroll" feel
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, damp);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, damp);
    
    groupRef.current.scale.setScalar(THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, damp));

    // Handle Opacity
    if (imageRef.current && imageRef.current.material) {
       const mat = imageRef.current.material as THREE.Material;
       mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, damp);
       mat.transparent = true; 
    }

    if (shadowRef.current && shadowRef.current.material) {
       const mat = shadowRef.current.material as THREE.Material;
       const shadowOpacity = theme === 'dark' ? 0.4 : 0.2;
       mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity * shadowOpacity, damp);
    }

    const groupSettled =
      Math.abs(groupRef.current.position.x - targetX) < 0.001 &&
      Math.abs(groupRef.current.position.y) < 0.001 &&
      Math.abs(groupRef.current.rotation.y - targetRotY) < 0.001 &&
      Math.abs(groupRef.current.rotation.z) < 0.001 &&
      Math.abs(groupRef.current.scale.x - targetScale) < 0.001;
    const imageSettled =
      !imageRef.current ||
      !(imageRef.current.material) ||
      Math.abs((imageRef.current.material as THREE.Material).opacity - targetOpacity) < 0.001;
    const shadowSettled =
      !shadowRef.current ||
      !(shadowRef.current.material) ||
      Math.abs((shadowRef.current.material as THREE.Material).opacity - targetOpacity * (theme === 'dark' ? 0.4 : 0.2)) < 0.001;

    if (!groupSettled || !imageSettled || !shadowSettled) {
      invalidate();
    }
  });

  return (
    <group ref={groupRef}>
      {/* Shadow Plane */}
      <mesh ref={shadowRef} position={[0, -2.1, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
         <planeGeometry args={[3.8, 3.8]} />
         <meshBasicMaterial color="#000" transparent opacity={0} toneMapped={false}>
           <canvasTexture attach="map" image={shadowTexture} />
         </meshBasicMaterial>
      </mesh>

      {/* Main Image Card */}
      <Image 
        ref={imageRef}
        url={imageUrl}
        scale={[3.2, 4]} 
        radius={0.2}
        transparent
        toneMapped={false}
      >
        {/* @ts-ignore */}
      </Image>
    </group>
  );
};

function createShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if(context) {
    const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 96, 96);
  }
  return canvas;
}

interface SceneProps {
  currentImage: string;
  direction: number;
  isChanging: boolean;
  theme: 'dark' | 'light';
}

const Scene3D: React.FC<SceneProps> = ({ currentImage, direction, isChanging, theme }) => {
  // Using solid colors to ensure consistency with body/meta theme color
  // Matches App.tsx logic: bg-black (#000000) or bg-slate-100 (#f1f5f9)
  const bgColor = theme === 'dark' 
    ? "bg-black" 
    : "bg-slate-100";

  return (
    <div className={`absolute inset-0 -z-10 transition-colors duration-500 ${bgColor}`} style={{ background: theme === 'dark' ? '#000000' : '#f1f5f9' }}>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        performance={{ min: 0.6 }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
        
        <CardMesh 
            key={currentImage} 
            imageUrl={currentImage} 
            direction={direction} 
            isChanging={isChanging} 
            theme={theme}
        />
      </Canvas>
    </div>
  );
};

export default Scene3D;
