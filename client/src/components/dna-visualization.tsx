import { useEffect, useRef, useState } from "react";

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
}

const DNA_NODES: Omit<Node, 'x' | 'y' | 'vx' | 'vy' | 'opacity'>[] = [
  { id: '1', label: 'Sci-Fi', size: 8, color: '#a78bfa' },
  { id: '2', label: 'Drama', size: 10, color: '#c4b5fd' },
  { id: '3', label: 'Movies', size: 14, color: '#f472b6' },
  { id: '4', label: 'TV', size: 12, color: '#fb7185' },
  { id: '5', label: 'Books', size: 9, color: '#38bdf8' },
  { id: '6', label: 'Music', size: 11, color: '#4ade80' },
  { id: '7', label: 'You', size: 18, color: '#ffffff' },
  { id: '8', label: '', size: 5, color: '#8b5cf6' },
  { id: '9', label: '', size: 4, color: '#a78bfa' },
  { id: '10', label: '', size: 6, color: '#c4b5fd' },
  { id: '11', label: '', size: 3, color: '#f472b6' },
  { id: '12', label: '', size: 4, color: '#38bdf8' },
];

const CONNECTIONS = [
  ['7', '1'], ['7', '2'], ['7', '3'], ['7', '4'], ['7', '5'], ['7', '6'],
  ['1', '8'], ['2', '9'], ['3', '10'], ['4', '11'], ['5', '12'],
  ['8', '9'], ['10', '11'], ['9', '10'],
];

export default function DNAVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const animationRef = useRef<number>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      const container = canvasRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.offsetWidth,
          height: 320
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (dimensions.width === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2 + 20;
    
    nodesRef.current = DNA_NODES.map((node, i) => {
      const angle = (i / DNA_NODES.length) * Math.PI * 2;
      const radius = node.id === '7' ? 0 : (node.label ? 70 + Math.random() * 40 : 100 + Math.random() * 50);
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        opacity: 0.6 + Math.random() * 0.4,
      };
    });

    let time = 0;

    const animate = () => {
      time += 0.01;
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, dimensions.width * 0.7
      );
      gradient.addColorStop(0, '#1e1b4b');
      gradient.addColorStop(0.5, '#0f0a1e');
      gradient.addColorStop(1, '#050208');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      nodesRef.current.forEach((node, i) => {
        if (node.id !== '7') {
          node.x += node.vx + Math.sin(time + i) * 0.1;
          node.y += node.vy + Math.cos(time + i * 0.7) * 0.1;

          const dx = node.x - centerX;
          const dy = node.y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = node.label ? 130 : 160;
          const minDist = node.label ? 50 : 80;
          
          if (dist > maxDist) {
            node.x = centerX + (dx / dist) * maxDist;
            node.y = centerY + (dy / dist) * maxDist;
            node.vx *= -0.5;
            node.vy *= -0.5;
          }
          if (dist < minDist) {
            node.x = centerX + (dx / dist) * minDist;
            node.y = centerY + (dy / dist) * minDist;
          }
        }
      });

      CONNECTIONS.forEach(([fromId, toId]) => {
        const from = nodesRef.current.find(n => n.id === fromId);
        const to = nodesRef.current.find(n => n.id === toId);
        if (from && to) {
          const gradient = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
          gradient.addColorStop(0, `${from.color}40`);
          gradient.addColorStop(1, `${to.color}40`);
          
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      nodesRef.current.forEach(node => {
        const glowSize = node.size + 8 + Math.sin(time * 2) * 2;
        const glowGradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, glowSize
        );
        glowGradient.addColorStop(0, `${node.color}30`);
        glowGradient.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = glowGradient;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        const nodeGradient = ctx.createRadialGradient(
          node.x - node.size / 3, node.y - node.size / 3, 0,
          node.x, node.y, node.size
        );
        nodeGradient.addColorStop(0, node.color);
        nodeGradient.addColorStop(1, `${node.color}cc`);
        ctx.fillStyle = nodeGradient;
        ctx.fill();

        if (node.label) {
          ctx.font = `${node.id === '7' ? '600 13px' : '500 10px'} Inter, system-ui, sans-serif`;
          ctx.fillStyle = node.id === '7' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.label, node.x, node.y + node.size + 14);
        }
      });

      ctx.font = '500 11px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText('Glimpse of your Entertainment DNA', centerX, 24);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions]);

  return (
    <div className="w-full rounded-2xl overflow-hidden" style={{ background: '#050208' }}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full"
        style={{ height: '320px' }}
      />
    </div>
  );
}
