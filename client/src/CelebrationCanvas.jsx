import React, { useEffect, useRef } from 'react';

const PALETTE = ['#fbbf24', '#38bdf8', '#f43f5e', '#10b981', '#a855f7', '#fb923c', '#ffffff'];

export default function CelebrationCanvas({ active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);

    const pieces = [];
    const rockets = [];
    const sparks = [];
    const timeouts = [];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reducedMotion) {
      for (let i = 0; i < 160; i += 1) {
        pieces.push({
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

    function explodeRocket(x, y, color) {
      for (let i = 0; i < 65; i += 1) {
        const angle = (Math.PI * 2 * i) / 65 + (Math.random() - 0.5) * 0.15;
        const speed = 2 + Math.random() * 6.5;
        sparks.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          decay: 0.012 + Math.random() * 0.012,
          color: Math.random() > 0.3 ? color : '#ffffff',
          size: 2.5 + Math.random() * 2,
        });
      }
    }

    let rocketInterval;
    if (!reducedMotion) {
      launchRocket();
      timeouts.push(setTimeout(launchRocket, 250), setTimeout(launchRocket, 500));
      rocketInterval = setInterval(launchRocket, 850);
    }

    let frameId;
    function render() {
      ctx.clearRect(0, 0, width, height);
      for (let i = rockets.length - 1; i >= 0; i -= 1) {
        const rocket = rockets[i];
        rocket.y += rocket.vy;
        rocket.vy *= 0.985;
        ctx.beginPath();
        ctx.arc(rocket.x, rocket.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = rocket.color;
        ctx.fill();
        if (rocket.y <= rocket.targetY || rocket.vy >= -1.5) {
          explodeRocket(rocket.x, rocket.y, rocket.color);
          rockets.splice(i, 1);
        }
      }

      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i];
        spark.x += spark.vx;
        spark.y += spark.vy;
        spark.vy += 0.09;
        spark.vx *= 0.98;
        spark.alpha -= spark.decay;
        if (spark.alpha <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = spark.alpha;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
        ctx.fillStyle = spark.color;
        ctx.fill();
        ctx.restore();
      }

      for (const piece of pieces) {
        piece.x += piece.vx + Math.sin(piece.angle) * 0.8;
        piece.y += piece.vy;
        piece.angle += piece.spin;
        if (piece.y > height + 20) {
          piece.y = -15;
          piece.x = Math.random() * width;
        }
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.angle);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
        ctx.restore();
      }
      frameId = requestAnimationFrame(render);
    }

    frameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frameId);
      clearInterval(rocketInterval);
      timeouts.forEach(clearTimeout);
      window.removeEventListener('resize', resize);
    };
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="celebration-canvas" aria-hidden="true" />;
}
