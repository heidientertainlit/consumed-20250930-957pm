import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  brightness: number;
  label?: string;
  type?: 'you' | 'friend' | 'media' | 'genre' | 'ambient';
  color?: string;
}

export default function DNAVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const { user, session } = useAuth();

  const { data: friends } = useQuery({
    queryKey: ['friends-for-dna', user?.id],
    queryFn: async () => {
      if (!session?.access_token || !user?.id) return [];
      
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          friend_id,
          friend:profiles!friendships_friend_id_fkey(id, user_name, display_name)
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .limit(5);

      if (error) return [];
      return data?.map(f => ({
        id: f.friend_id,
        name: f.friend?.display_name || f.friend?.user_name || 'Friend'
      })) || [];
    },
    enabled: !!user?.id && !!session?.access_token,
    staleTime: 60000,
  });

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

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const particles: Particle[] = [];
    
    particles.push({
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      size: 7,
      brightness: 1,
      label: 'You',
      type: 'you',
      color: '#ffffff',
    });

    const mediaTypes = ['Movies', 'TV', 'Books', 'Music'];
    mediaTypes.forEach((label, i) => {
      const angle = (i / mediaTypes.length) * Math.PI * 2 - Math.PI / 2;
      particles.push({
        x: centerX + Math.cos(angle) * 50,
        y: centerY + Math.sin(angle) * 50,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: 4,
        brightness: 0.9,
        label,
        type: 'media',
        color: '#f472b6',
      });
    });

    const genres = ['Sci-Fi', 'Drama', 'Comedy'];
    genres.forEach((label, i) => {
      const angle = (i / genres.length) * Math.PI * 2 + Math.PI / 6;
      particles.push({
        x: centerX + Math.cos(angle) * 75,
        y: centerY + Math.sin(angle) * 75,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 3,
        brightness: 0.8,
        label,
        type: 'genre',
        color: '#a78bfa',
      });
    });

    const friendList = friends || [];
    friendList.forEach((friend, i) => {
      const angle = (i / Math.max(friendList.length, 1)) * Math.PI * 2 + Math.PI / 3;
      const radius = 85 + Math.random() * 20;
      particles.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: 3.5,
        brightness: 0.85,
        label: friend.name,
        type: 'friend',
        color: '#38bdf8',
      });
    });

    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: 1 + Math.random() * 1.5,
        brightness: 0.2 + Math.random() * 0.3,
        type: 'ambient',
        color: '#8b5cf6',
      });
    }

    particlesRef.current = particles;
    let time = 0;

    const animate = () => {
      time += 0.015;
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      particlesRef.current.forEach((p, i) => {
        if (p.type !== 'you') {
          p.x += p.vx + Math.sin(time + i * 0.5) * 0.12;
          p.y += p.vy + Math.cos(time + i * 0.3) * 0.12;

          if (p.type !== 'ambient') {
            const dx = p.x - centerX;
            const dy = p.y - centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = p.type === 'friend' ? 110 : p.type === 'genre' ? 95 : 70;
            const minDist = p.type === 'friend' ? 70 : p.type === 'genre' ? 55 : 35;
            
            if (dist > maxDist) {
              p.x = centerX + (dx / dist) * maxDist;
              p.y = centerY + (dy / dist) * maxDist;
              p.vx *= -0.7;
              p.vy *= -0.7;
            }
            if (dist < minDist) {
              p.x = centerX + (dx / dist) * minDist;
              p.y = centerY + (dy / dist) * minDist;
            }
          } else {
            if (p.x < 0 || p.x > dimensions.width) p.vx *= -1;
            if (p.y < 0 || p.y > dimensions.height) p.vy *= -1;
            p.x = Math.max(0, Math.min(dimensions.width, p.x));
            p.y = Math.max(0, Math.min(dimensions.height, p.y));
          }
        }
      });

      const connectionDistance = 80;
      particlesRef.current.forEach((p1, i) => {
        if (p1.type === 'ambient') return;
        particlesRef.current.forEach((p2, j) => {
          if (i >= j || p2.type === 'ambient') return;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < connectionDistance) {
            const opacity = (1 - dist / connectionDistance) * 0.35;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(167, 139, 250, ${opacity})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        });
      });

      particlesRef.current.forEach(p => {
        const color = p.color || '#a78bfa';
        
        const glowSize = p.size * 2.5;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        glow.addColorStop(0, `${color}50`);
        glow.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(p.x - p.size/3, p.y - p.size/3, 0, p.x, p.y, p.size);
        grad.addColorStop(0, p.type === 'you' ? '#ffffff' : `${color}ff`);
        grad.addColorStop(1, `${color}cc`);
        ctx.fillStyle = grad;
        ctx.fill();

        if (p.label) {
          ctx.font = `${p.type === 'you' ? '600' : '500'} ${p.type === 'you' ? '10' : '8'}px Inter, system-ui, sans-serif`;
          ctx.fillStyle = p.type === 'friend' ? 'rgba(56, 189, 248, 0.9)' : 'rgba(255, 255, 255, 0.75)';
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
  }, [dimensions, friends]);

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
