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

    const drawHexagon = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number
    ) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const xPoint = x + size * Math.cos(angle);
        const yPoint = y + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(xPoint, yPoint);
        else ctx.lineTo(xPoint, yPoint);
      }
      ctx.closePath();
    };

    const drawConnections = (
      ctx: CanvasRenderingContext2D,
      bubbles: Bubble[]
    ) => {
      const maxDistance = 150;

      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const dx = bubbles[i].x - bubbles[j].x;
          const dy = bubbles[i].y - bubbles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            const opacity = (1 - distance / maxDistance) * 0.1; // Reduced connection opacity
            ctx.beginPath();
            ctx.strokeStyle = `rgba(191, 219, 254, ${opacity})`;
            ctx.lineWidth = 0.5; // Thinner lines
            ctx.moveTo(bubbles[i].x, bubbles[i].y);
            ctx.lineTo(bubbles[j].x, bubbles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    // Initialize bubbles
    const initBubbles = () => {
      const mainBubbles: Bubble[] = Array.from({ length: 15 }, () => {
        const baseSpeed = 0.02 + Math.random() * 0.03; // Keeping the slow speed
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          baseSize: 35 + Math.random() * 65, // Larger size range
          size: 35 + Math.random() * 65,
          speedX: (Math.random() - 0.5) * baseSpeed,
          speedY: (Math.random() - 0.5) * baseSpeed,
          opacity: 0.06 + Math.random() * 0.08, // Keeping subtle opacity
          oscillationOffset: Math.random() * Math.PI * 2,
          oscillationSpeed: 0.002 + Math.random() * 0.003, // Keeping slow oscillation
          shape: Math.random() > 0.9 ? "hexagon" : "circle", // Keeping 90% circles
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          pulsePhase: Math.random() * Math.PI * 2,
          acceleration: 0,
          blur: Math.random() > 0.6 ? 1.5 + Math.random() * 2 : 0,
        };
      });

      const smallBubbles: Bubble[] = Array.from({ length: 12 }, () => {
        const baseSpeed = 0.015 + Math.random() * 0.025; // Keeping slow speed
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          baseSize: 15 + Math.random() * 25, // Slightly larger small bubbles
          size: 15 + Math.random() * 25,
          speedX: (Math.random() - 0.5) * baseSpeed,
          speedY: (Math.random() - 0.5) * baseSpeed,
          opacity: 0.05 + Math.random() * 0.07,
          oscillationOffset: Math.random() * Math.PI * 2,
          oscillationSpeed: 0.001 + Math.random() * 0.002,
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

      bubbles.current.forEach((bubble) => {
        // Update oscillation and pulse with smoother transitions
        const oscillation = Math.sin(bubble.oscillationOffset) * 0.1; // Even more subtle oscillation
        const pulseScale = 1 + Math.sin(bubble.pulsePhase) * 0.03; // More subtle pulse
        bubble.size = bubble.baseSize * pulseScale;

        // Update position with gentler acceleration
        bubble.acceleration += (Math.random() - 0.5) * 0.001; // Further reduced random acceleration
        bubble.acceleration *= 0.97; // Even stronger damping
        bubble.speedX +=
          Math.cos(bubble.oscillationOffset) * 0.001 + bubble.acceleration;
        bubble.speedY +=
          Math.sin(bubble.oscillationOffset) * 0.001 + bubble.acceleration;
        bubble.speedX *= 0.97; // Stronger damping
        bubble.speedY *= 0.97; // Stronger damping

        bubble.x += bubble.speedX + oscillation;
        bubble.y += bubble.speedY + oscillation;
        bubble.oscillationOffset += bubble.oscillationSpeed;
        bubble.pulsePhase += 0.002; // Even slower pulse

        // Wrap around edges
        if (bubble.x < -bubble.size) bubble.x = canvas.width + bubble.size;
        if (bubble.x > canvas.width + bubble.size) bubble.x = -bubble.size;
        if (bubble.y < -bubble.size) bubble.y = canvas.height + bubble.size;
        if (bubble.y > canvas.height + bubble.size) bubble.y = -bubble.size;

        // Apply blur if specified
        if (bubble.blur > 0) {
          ctx.filter = `blur(${bubble.blur}px)`;
        }

        // Draw bubble with gradient and glow
        const gradient = ctx.createRadialGradient(
          bubble.x,
          bubble.y,
          0,
          bubble.x,
          bubble.y,
          bubble.size
        );

        const color = bubble.color.replace("alpha", bubble.opacity.toString());
        const glowColor = bubble.color.replace(
          "alpha",
          (bubble.opacity * 0.2).toString() // Further reduced glow intensity
        );

        gradient.addColorStop(0, color);
        gradient.addColorStop(0.7, glowColor); // Smoother gradient transition
        gradient.addColorStop(1, "rgba(191, 219, 254, 0)");

        ctx.fillStyle = gradient;

        // Add subtle glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 8; // Even more subtle glow

        if (bubble.shape === "hexagon") {
          drawHexagon(ctx, bubble.x, bubble.y, bubble.size * 0.8);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(bubble.x, bubble.y, bubble.size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Reset effects
        ctx.shadowBlur = 0;
        ctx.filter = "none";
      });

      animationFrameId.current = requestAnimationFrame(animate);
    };

    // Setup
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
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
