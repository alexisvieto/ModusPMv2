"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toBlob: () => Promise<Blob | null>;
};

// Pad de firma: se dibuja con el dedo (o mouse). Escala a devicePixelRatio para
// que la firma quede nítida. touchAction:none evita que la página haga scroll
// mientras se firma en el celular.
export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(
  function SignaturePad({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const dirty = useRef(false);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#0f2044";
      }
    }, []);

    function pos(e: React.PointerEvent) {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function down(e: React.PointerEvent) {
      e.preventDefault();
      const canvas = canvasRef.current!;
      canvas.setPointerCapture(e.pointerId);
      const ctx = canvas.getContext("2d")!;
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      drawing.current = true;
    }
    function move(e: React.PointerEvent) {
      if (!drawing.current) return;
      e.preventDefault();
      const ctx = canvasRef.current!.getContext("2d")!;
      const { x, y } = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      dirty.current = true;
    }
    function up() {
      drawing.current = false;
    }

    useImperativeHandle(ref, () => ({
      clear() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        dirty.current = false;
      },
      isEmpty() {
        return !dirty.current;
      },
      toBlob() {
        return new Promise<Blob | null>((resolve) => {
          const canvas = canvasRef.current;
          if (!canvas) return resolve(null);
          canvas.toBlob((b) => resolve(b), "image/png");
        });
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        className={className}
        style={{ touchAction: "none" }}
      />
    );
  },
);
