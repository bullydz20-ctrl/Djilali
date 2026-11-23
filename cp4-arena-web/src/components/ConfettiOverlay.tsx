import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vr: number;
  alpha: number;
}

const CONFETTI_COLORS = ['#F5B82E', '#38BDF8', '#10B981', '#A855F7', '#EF4444', '#F8FAFC'];

export function ConfettiOverlay({
  active,
  onDone
}: {
  active: boolean;
  onDone?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = Array.from({ length: 130 }, (_, i) => ({
      x: (window.innerWidth * ((i * 37) % 100)) / 100,
      y: -20 - (i % 12) * 18,
      vx: (Math.random() - 0.5) * 4.2,
      vy: 2.8 + Math.random() * 4.5,
      size: 6 + Math.random() * 6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.22,
      alpha: 1
    }));

    let rafId = 0;
    const startedAt = performance.now();
    const duration = 4200;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.045;
        p.rotation += p.vr;
        if (elapsed > duration - 900) {
          p.alpha = Math.max(0, 1 - (elapsed - (duration - 900)) / 900);
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size * 2) / 3);
        ctx.restore();
      }

      if (elapsed < duration) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        onDone?.();
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [active, onDone]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 95
      }}
    />
  );
}
