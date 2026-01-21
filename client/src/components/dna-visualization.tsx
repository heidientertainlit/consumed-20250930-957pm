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
  type: 'genre' | 'media' | 'person' | 'stat';
}

const DNA_NODES: Omit<Node, 'x' | 'y' | 'vx' | 'vy'>[] = [
  { id: '1', label: 'Sci-Fi', size: 24, color: '#8b5cf6', type: 'genre' },
  { id: '2', label: 'Drama', size: 20, color: '#a78bfa', type: 'genre' },
  { id: '3', label: 'Comedy', size: 18, color: '#c4b5fd', type: 'genre' },
  { id: '4', label: 'Movies', size: 28, color: '#ec4899', type: 'media' },
  { id: '5', label: 'TV', size: 26, color: '#f472b6', type: 'media' },
  { id: '6', label: 'Books', size: 22, color: '#fb7185', type: 'media' },
  { id: '7', label: 'Music', size: 20, color: '#f87171', type: 'media' },
  { id: '8', label: 'You', size: 32, color: '#ffffff', type: 'person' },
  { id: '9', label: '3 Friends', size: 22, color: '#38bdf8', type: 'person' },
  { id: '10', label: '89% Match', size: 16, color: '#4ade80', type: 'stat' },
  { id: '11', label: 'Thriller', size: 16, color: '#a78bfa', type: 'genre' },
  { id: '12', label: 'Podcasts', size: 18, color: '#fb923c', type: 'media' },
];

const CONNECTIONS = [
  ['8', '1'], ['8', '2'], ['8', '4'], ['8', '5'], ['8', '6'],
  ['8', '9'], ['1', '4'], ['2', '5'], ['3', '5'], ['4', '11'],
  ['9', '10'], ['6', '3'], ['7', '12'], ['8', '7'], ['5', '2'],
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
          height: 280
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

    const padding = 60;
    nodesRef.current = DNA_NODES.map((node, i) => ({
      ...node,
      x: padding + Math.random() * (dimensions.width - padding * 2),
      y: padding + Math.random() * (dimensions.height - padding * 2),
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      const gradient = ctx.createLinearGradient(0, 0, dimensions.width, dimensions.height);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(0.5, '#16162a');
      gradient.addColorStop(1, '#0f0f1a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      nodesRef.current.forEach(node => {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < padding || node.x > dimensions.width - padding) {
          node.vx *= -1;
          node.x = Math.max(padding, Math.min(dimensions.width - padding, node.x));
        }
        if (node.y < padding || node.y > dimensions.height - padding) {
          node.vy *= -1;
          node.y = Math.max(padding, Math.min(dimensions.height - padding, node.y));
        }
      });

      CONNECTIONS.forEach(([fromId, toId]) => {
        const from = nodesRef.current.find(n => n.id === fromId);
        const to = nodesRef.current.find(n => n.id === toId);
        if (from && to) {
          const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
          const opacity = Math.max(0.1, 1 - distance / 250);
          
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.strokeStyle = `rgba(139, 92, 246, ${opacity * 0.4})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      nodesRef.current.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size / 2 + 4, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}20`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size / 2, 0, Math.PI * 2);
        const nodeGradient = ctx.createRadialGradient(
          node.x - node.size / 4, node.y - node.size / 4, 0,
          node.x, node.y, node.size / 2
        );
        nodeGradient.addColorStop(0, node.color);
        nodeGradient.addColorStop(1, `${node.color}aa`);
        ctx.fillStyle = nodeGradient;
        ctx.fill();

        ctx.font = `${node.id === '8' ? 'bold ' : ''}${Math.max(10, node.size / 2.5)}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const textY = node.y + node.size / 2 + 12;
        ctx.fillText(node.label, node.x, textY);
      });

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
    <div className="w-full">
      <p className="text-gray-500 text-xs mb-2">Your Entertainment DNA</p>
      <div className="rounded-2xl overflow-hidden shadow-lg">
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full"
          style={{ height: '280px' }}
        />
      </div>
    </div>
  );
}
