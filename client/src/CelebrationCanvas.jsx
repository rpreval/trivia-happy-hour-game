import React, { useEffect, useRef } from 'react';

const PALETTE = ['#fbbf24', '#38bdf8', '#f43f5e', '#10b981', '#a855f7', '#fb923c', '#ffffff'];

export default function CelebrationCanvas({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const confetti = [];
    const rockets = [];
    const sparks = [];

    for (let i = 0; i < 160; i++) {
      confetti.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        w: 8 + Math.random() * 7,
        h: 5 + Math.random() * 5,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 3.5,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.16,
      });
    }

    function launchRocket() {
      rockets.push({
        x: width * (0.15 + Math.random() * 0.7),
        y: height,
        targetY: height * (0.15 + Math.random() * 0.35),
        vy: -(11 + Math.random() * 4),
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      });
    }

    function explodeRocket(x, y, baseColor) {
      const count = 65;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.15;
        const speed = 2 + Math.random() * 6.5;
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          decay: 0.012 + Math.random() * 0.012,
          color: Math.random() > 0.3 ? baseColor : '#ffffff',
          size: 2.5 + Math.random() * 2,
        });
      }
    }

    launchRocket();
    setTimeout(launchRocket, 250);
    setTimeout(launchRocket, 500);
    const rocketInterval = setInterval(launchRocket, 850);

    let rafId;
    function render() {
      ctx.clearRect(0, 0, width, height);

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy;
        r.vy *= 0.985;

        ctx.beginPath();
        ctx.arc(r.x, r.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = r.color;
        ctx.fill();

        if (r.y <= r.targetY || r.vy >= -1.5) {
          explodeRocket(r.x, r.y, r.color);
          rockets.splice(i, 1);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.09;
        s.vx *= 0.98;
        s.alpha -= s.decay;

        if (s.alpha <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.restore();
      }

      for (const c of confetti) {
        c.x += c.vx + Math.sin(c.angle) * 0.8;
        c.y += c.vy;
        c.angle += c.spin;

        if (c.y > height + 20) {
          c.y = -15;
          c.x = Math.random() * width;
        }

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    }

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(rocketInterval);
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      aria-hidden="true"
    />
  );
}
