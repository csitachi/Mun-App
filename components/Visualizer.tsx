import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  isSpeaking: boolean;
  volume: number;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, isSpeaking, volume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let rotation = 0;

    const render = () => {
      // Resize
      canvas.width = canvas.parentElement?.clientWidth || 300;
      canvas.height = canvas.parentElement?.clientHeight || 300;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isActive) {
        // Idle state: Pulse slowly
        const idleRadius = 50 + Math.sin(Date.now() / 1000) * 5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, idleRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.2)'; // Slate 400
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      // Active State
      // Base radius + volume reaction
      // Smooth the volume usage for visual pleasure
      const baseRadius = 60;
      const dynamicRadius = baseRadius + (volume * 100);

      // Color based on speaking state
      // Blue/Cyan for AI speaking, Purple/Pink for Listening (waiting)
      const colorStart = isSpeaking ? '#06b6d4' : '#a855f7'; // Cyan-500 vs Purple-500
      const colorEnd = isSpeaking ? '#3b82f6' : '#ec4899';   // Blue-500 vs Pink-500
      
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, colorStart);
      gradient.addColorStop(1, colorEnd);

      // Main Circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, dynamicRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Outer Ripples (Decor)
      rotation += 0.01;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      
      for(let i=0; i<3; i++) {
        ctx.beginPath();
        // Create an ellipse shape
        ctx.ellipse(0, 0, dynamicRadius + 20 + (i*15), dynamicRadius + 10 + (i*10), i * (Math.PI/3), 0, Math.PI * 2);
        ctx.strokeStyle = isSpeaking 
            ? `rgba(6, 182, 212, ${0.3 - i*0.1})` 
            : `rgba(168, 85, 247, ${0.3 - i*0.1})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [isActive, isSpeaking, volume]);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <canvas ref={canvasRef} className="w-full h-full max-w-[400px] max-h-[400px]" />
    </div>
  );
};

export default Visualizer;