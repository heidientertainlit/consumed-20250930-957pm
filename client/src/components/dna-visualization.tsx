import { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  brightness: number;
  label?: string;
}

export default function DNAVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      const container = canvasRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.offsetWidth,
          height: 200
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

    const labeledNodes = [
      { label: 'You', size: 6 },
      { label: 'Movies', size: 4 },
      { label: 'TV', size: 4 },
      { label: 'Books', size: 3.5 },
      { label: 'Music', size: 3.5 },
      { label: 'Sci-Fi', size: 3 },
      { label: 'Drama', size: 3 },
    ];

    const particles: Particle[] = [];
    
    labeledNodes.forEach((node, i) => {
      const angle = (i / labeledNodes.length) * Math.PI * 2;
      const radius = i === 0 ? 0 : 40 + Math.random() * 30;
      particles.push({
        x: dimensions.width / 2 + Math.cos(angle) * radius,
        y: dimensions.height / 2 + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: node.size,
        brightness: 0.9 + Math.random() * 0.1,
        label: node.label,
      });
    });

    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: 1 + Math.random() * 2,
        brightness: 0.3 + Math.random() * 0.5,
      });
    }

    particlesRef.current = particles;
    let time = 0;

    const animate = () => {
      time += 0.02;
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;

      particlesRef.current.forEach((p, i) => {
        p.x += p.vx + Math.sin(time + i * 0.5) * 0.15;
        p.y += p.vy + Math.cos(time + i * 0.3) * 0.15;

        if (p.label) {
          const dx = p.x - centerX;
          const dy = p.y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = p.label === 'You' ? 20 : 90;
          if (dist > maxDist) {
            p.x = centerX + (dx / dist) * maxDist;
            p.y = centerY + (dy / dist) * maxDist;
            p.vx *= -0.8;
            p.vy *= -0.8;
          }
        } else {
          if (p.x < 0 || p.x > dimensions.width) p.vx *= -1;
          if (p.y < 0 || p.y > dimensions.height) p.vy *= -1;
          p.x = Math.max(0, Math.min(dimensions.width, p.x));
          p.y = Math.max(0, Math.min(dimensions.height, p.y));
        }
      });

      const connectionDistance = 70;
      particlesRef.current.forEach((p1, i) => {
        particlesRef.current.forEach((p2, j) => {
          if (i >= j) return;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < connectionDistance) {
            const opacity = (1 - dist / connectionDistance) * 0.3;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(167, 139, 250, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      particlesRef.current.forEach(p => {
        const glowSize = p.size * 3;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        glow.addColorStop(0, `rgba(167, 139, 250, ${p.brightness * 0.4})`);
        glow.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(p.x - p.size/3, p.y - p.size/3, 0, p.x, p.y, p.size);
        grad.addColorStop(0, `rgba(255, 255, 255, ${p.brightness})`);
        grad.addColorStop(0.5, `rgba(200, 180, 255, ${p.brightness * 0.8})`);
        grad.addColorStop(1, `rgba(139, 92, 246, ${p.brightness * 0.6})`);
        ctx.fillStyle = grad;
        ctx.fill();

        if (p.label) {
          ctx.font = '500 9px Inter, system-ui, sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.textAlign = 'center';
          ctx.fillText(p.label, p.x, p.y + p.size + 10);
        }
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
    <div className="w-full -mt-2">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full"
        style={{ height: '200px' }}
      />
    </div>
  );
}
