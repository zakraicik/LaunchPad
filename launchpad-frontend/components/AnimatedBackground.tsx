import { useEffect, useRef } from "react";

interface Bubble {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  oscillationOffset: number;
  oscillationSpeed: number;
  shape: "circle" | "hexagon";
  color: string;
  pulsePhase: number;
  baseSize: number;
  acceleration: number;
  blur: number;
}

const COLORS = [
  "rgba(59, 130, 246, alpha)", // blue-500
  "rgba(6, 182, 212, alpha)", // cyan-500
  "rgba(99, 102, 241, alpha)", // indigo-500
  "rgba(147, 51, 234, alpha)", // purple-500
];

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bubbles = useRef<Bubble[]>([]);
  const animationFrameId = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn("AnimatedBackground: Canvas not found");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("AnimatedBackground: Could not get 2D context");
      return;
    }

    console.log("AnimatedBackground: Canvas initialized");

    // Set canvas size to match window size
    const resizeCanvas = () => {
      const { innerWidth, innerHeight } = window;
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      console.log(
        `AnimatedBackground: Canvas resized to ${innerWidth}x${innerHeight}`
      );
      initBubbles();
    };

    const drawConnections = (
      ctx: CanvasRenderingContext2D,
      bubbles: Bubble[]
    ) => {
      const maxDistance = 150;
      const maxDistanceSquared = maxDistance * maxDistance;

      // Pre-calculate positions to avoid repeated calculations
      const positions = bubbles.map((b) => ({
        x: b.x,
        y: b.y,
        index: bubbles.indexOf(b),
      }));

      for (let i = 0; i < positions.length; i++) {
        const pos1 = positions[i];
        for (let j = i + 1; j < positions.length; j++) {
          const pos2 = positions[j];
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distanceSquared = dx * dx + dy * dy;

          if (distanceSquared < maxDistanceSquared) {
            const distance = Math.sqrt(distanceSquared);
            const opacity = (1 - distance / maxDistance) * 0.1;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(191, 219, 254, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(pos1.x, pos1.y);
            ctx.lineTo(pos2.x, pos2.y);
            ctx.stroke();
          }
        }
      }
    };

    // Initialize bubbles
    const initBubbles = () => {
      const mainBubbles: Bubble[] = Array.from({ length: 20 }, () => {
        const baseSpeed = 0.2 + Math.random() * 0.25;
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          baseSize: 35 + Math.random() * 65,
          size: 35 + Math.random() * 65,
          speedX: (Math.random() - 0.5) * baseSpeed,
          speedY: (Math.random() - 0.5) * baseSpeed,
          opacity: 0.08 + Math.random() * 0.1,
          oscillationOffset: Math.random() * Math.PI * 2,
          oscillationSpeed: 0.006 + Math.random() * 0.008,
          shape: "circle",
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          pulsePhase: Math.random() * Math.PI * 2,
          acceleration: 0,
          blur: Math.random() > 0.6 ? 1.5 + Math.random() * 2 : 0,
        };
      });

      const smallBubbles: Bubble[] = Array.from({ length: 15 }, () => {
        const baseSpeed = 0.25 + Math.random() * 0.3;
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          baseSize: 15 + Math.random() * 25,
          size: 15 + Math.random() * 25,
          speedX: (Math.random() - 0.5) * baseSpeed,
          speedY: (Math.random() - 0.5) * baseSpeed,
          opacity: 0.07 + Math.random() * 0.09,
          oscillationOffset: Math.random() * Math.PI * 2,
          oscillationSpeed: 0.005 + Math.random() * 0.006,
          shape: "circle" as const,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          pulsePhase: Math.random() * Math.PI * 2,
          acceleration: 0,
          blur: Math.random() > 0.4 ? 1 + Math.random() * 1.5 : 0,
        };
      });

      bubbles.current = [...mainBubbles, ...smallBubbles];
      console.log(
        `AnimatedBackground: ${bubbles.current.length} bubbles initialized`
      );
    };

    // Animation loop
    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections first
      drawConnections(ctx, bubbles.current);

      // Batch drawing operations
      ctx.save();
      bubbles.current.forEach((bubble) => {
        const oscillation = Math.sin(bubble.oscillationOffset) * 0.3;
        const pulseScale = 1 + Math.sin(bubble.pulsePhase) * 0.04;
        bubble.size = bubble.baseSize * pulseScale;

        bubble.acceleration += (Math.random() - 0.5) * 0.003;
        bubble.acceleration *= 0.98;
        bubble.speedX +=
          Math.cos(bubble.oscillationOffset) * 0.003 + bubble.acceleration;
        bubble.speedY +=
          Math.sin(bubble.oscillationOffset) * 0.003 + bubble.acceleration;
        bubble.speedX *= 0.997;
        bubble.speedY *= 0.997;

        bubble.x += bubble.speedX + oscillation;
        bubble.y += bubble.speedY + oscillation;
        bubble.oscillationOffset += bubble.oscillationSpeed;
        bubble.pulsePhase += 0.003;

        // Wrap around edges with a smaller margin
        const margin = bubble.size * 0.5;
        if (bubble.x < -margin) bubble.x = canvas.width + margin;
        if (bubble.x > canvas.width + margin) bubble.x = -margin;
        if (bubble.y < -margin) bubble.y = canvas.height + margin;
        if (bubble.y > canvas.height + margin) bubble.y = -margin;

        // Only draw if bubble is visible or nearly visible
        if (
          bubble.x + bubble.size > -50 &&
          bubble.x - bubble.size < canvas.width + 50 &&
          bubble.y + bubble.size > -50 &&
          bubble.y - bubble.size < canvas.height + 50
        ) {
          if (bubble.blur > 0) {
            ctx.filter = `blur(${bubble.blur}px)`;
          }

          const gradient = ctx.createRadialGradient(
            bubble.x,
            bubble.y,
            0,
            bubble.x,
            bubble.y,
            bubble.size
          );

          const color = bubble.color.replace(
            "alpha",
            bubble.opacity.toString()
          );
          const glowColor = bubble.color.replace(
            "alpha",
            (bubble.opacity * 0.25).toString()
          );

          gradient.addColorStop(0, color);
          gradient.addColorStop(0.7, glowColor);
          gradient.addColorStop(1, "rgba(191, 219, 254, 0)");

          ctx.fillStyle = gradient;
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;

          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.size, 0, Math.PI * 2);
          ctx.fill();

          ctx.filter = "none";
          ctx.shadowBlur = 0;
        }
      });
      ctx.restore();

      // Use requestAnimationFrame with a timestamp to control frame rate
      const now = performance.now();
      if (!lastFrameTime) {
        lastFrameTime = now;
      }
      const deltaTime = now - lastFrameTime;

      if (deltaTime >= frameInterval) {
        lastFrameTime = now;
        animationFrameId.current = requestAnimationFrame(animate);
      } else {
        animationFrameId.current = requestAnimationFrame(animate);
      }
    };

    // Setup
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // Initialize animation variables
    let lastFrameTime: number | null = null;
    const frameInterval = 1000 / 40;

    animate();
    console.log("AnimatedBackground: Animation started");

    // Cleanup
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        console.log("AnimatedBackground: Animation cleaned up");
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: -999,
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
      }}
      aria-hidden="true"
    />
  );
}
