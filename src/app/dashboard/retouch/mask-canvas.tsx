"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface MaskCanvasHandle {
  /** Returns a PNG data URL (white strokes on black) or null if nothing drawn. */
  exportMask: () => string | null;
  clear: () => void;
}

/**
 * Lets the user brush a mask over an image for eraser-style tools. The canvas
 * renders at the image's natural resolution internally (so the exported mask
 * lines up pixel-for-pixel) while displaying responsively over the image.
 */
export const MaskCanvas = forwardRef<MaskCanvasHandle, {
  imageUrl: string;
  onDirtyChange?: (dirty: boolean) => void;
}>(function MaskCanvas({ imageUrl, onDirtyChange }, ref) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const dirty = useRef(false);
  const [brush, setBrush] = useState(6); // % of image width

  function setDirty(v: boolean) {
    if (dirty.current !== v) {
      dirty.current = v;
      onDirtyChange?.(v);
    }
  }

  function handleImgLoad() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    setDirty(false);
  }

  function toCanvasCoords(e: React.PointerEvent) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  }

  function start(e: React.PointerEvent) {
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = toCanvasCoords(e);
    stroke(e); // dab a dot on click
  }

  function stroke(e: React.PointerEvent) {
    if (!drawing.current) return;
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const p = toCanvasCoords(e);
    const lineWidth = (brush / 100) * c.width;
    ctx.strokeStyle = "#ffffff";
    ctx.fillStyle = "#ffffff";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const from = last.current ?? p;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    // round dot so single taps register
    ctx.beginPath();
    ctx.arc(p.x, p.y, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    last.current = p;
    setDirty(true);
  }

  function end() {
    drawing.current = false;
    last.current = null;
  }

  useImperativeHandle(ref, () => ({
    exportMask() {
      if (!dirty.current) return null;
      const c = canvasRef.current;
      if (!c) return null;
      const out = document.createElement("canvas");
      out.width = c.width;
      out.height = c.height;
      const octx = out.getContext("2d");
      if (!octx) return null;
      octx.fillStyle = "#000000";
      octx.fillRect(0, 0, out.width, out.height);
      octx.drawImage(c, 0, 0); // opaque white strokes composite over black
      return out.toDataURL("image/png");
    },
    clear() {
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
      setDirty(false);
    },
  }));

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border border-app-border-strong bg-app-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Source"
          onLoad={handleImgLoad}
          className="block w-full select-none object-contain"
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={stroke}
          onPointerUp={end}
          onPointerLeave={end}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none opacity-50"
        />
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-app-text-subtle">Brush</span>
        <input
          type="range"
          min={2}
          max={20}
          value={brush}
          onChange={(e) => setBrush(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer accent-amber-400"
        />
        <button
          type="button"
          onClick={() => {
            const c = canvasRef.current;
            const ctx = c?.getContext("2d");
            if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
            setDirty(false);
          }}
          className="rounded-lg border border-app-border-strong px-2.5 py-1 text-xs text-app-text-muted hover:border-zinc-500 hover:text-app-text"
        >
          Clear
        </button>
      </div>
      <p className="text-xs text-app-text-subtle">Paint over the parts you want removed, then generate.</p>
    </div>
  );
});
