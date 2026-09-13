"use client";

import { useEffect, useRef } from "react";
import { DRAW_STROKE_MS, type DrawPoint, type DrawStroke } from "@/lib/drawGame";

type DrawCanvasProps = {
  strokes: DrawStroke[];
  color: string;
  width: number;
  interactive: boolean;
  onStroke: (stroke: DrawStroke) => void;
};

export function DrawCanvas({
  strokes,
  color,
  width,
  interactive,
  onStroke,
}: DrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef(strokes);
  const drawingRef = useRef<DrawPoint[] | null>(null);
  const gestureIdRef = useRef<string | null>(null);
  const lastSendRef = useRef(0);
  const seqRef = useRef(0);
  const colorRef = useRef(color);
  const widthRef = useRef(width);
  const interactiveRef = useRef(interactive);
  const onStrokeRef = useRef(onStroke);

  useEffect(() => {
    strokesRef.current = strokes;
    paintAll();
  }, [strokes]);

  useEffect(() => {
    colorRef.current = color;
    widthRef.current = width;
    interactiveRef.current = interactive;
    onStrokeRef.current = onStroke;
  }, [color, interactive, onStroke, width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    function resize() {
      if (!canvas || !parent) return;
      const dpr = window.devicePixelRatio || 1;
      const bounds = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(bounds.width * dpr));
      canvas.height = Math.max(1, Math.floor(bounds.height * dpr));
      canvas.style.width = `${bounds.width}px`;
      canvas.style.height = `${bounds.height}px`;
      paintAll();
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  function paintAll() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokesRef.current) {
      paintStroke(ctx, canvas, stroke);
    }
    const live = drawingRef.current;
    if (live && live.length > 0) {
      paintStroke(ctx, canvas, {
        id: "live",
        seq: 0,
        color: colorRef.current,
        width: widthRef.current,
        points: live,
      });
    }
  }

  function pointFromEvent(event: PointerEvent): DrawPoint | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return null;
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
  }

  function flushLive(force: boolean) {
    const live = drawingRef.current;
    if (!live || live.length === 0) return;
    if (!force && live.length < 2) return;
    const now = Date.now();
    if (!force && now - lastSendRef.current < DRAW_STROKE_MS) return;
    lastSendRef.current = now;
    seqRef.current += 1;
    const points = live.length === 1 ? [live[0], live[0]] : live.slice();
    onStrokeRef.current({
      id: gestureIdRef.current ?? `${now}`,
      seq: seqRef.current,
      color: colorRef.current,
      width: widthRef.current,
      points,
    });
    drawingRef.current = [live[live.length - 1]];
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onDown(event: PointerEvent) {
      const node = canvasRef.current;
      if (!interactiveRef.current || !node) return;
      event.preventDefault();
      node.setPointerCapture(event.pointerId);
      const point = pointFromEvent(event);
      if (!point) return;
      gestureIdRef.current = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      drawingRef.current = [point];
      paintAll();
    }

    function onMove(event: PointerEvent) {
      if (!interactiveRef.current || !drawingRef.current) return;
      event.preventDefault();
      const point = pointFromEvent(event);
      if (!point) return;
      drawingRef.current.push(point);
      paintAll();
      flushLive(false);
    }

    function onUp(event: PointerEvent) {
      if (!drawingRef.current) return;
      event.preventDefault();
      flushLive(true);
      drawingRef.current = null;
      gestureIdRef.current = null;
      paintAll();
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`h-full w-full touch-none rounded-2xl bg-white ${
        interactive ? "cursor-crosshair" : "cursor-default"
      }`}
    />
  );
}

function paintStroke(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  stroke: DrawStroke,
) {
  if (stroke.points.length === 0) return;
  ctx.beginPath();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width * (window.devicePixelRatio || 1);
  const first = stroke.points[0];
  ctx.moveTo(first.x * canvas.width, first.y * canvas.height);
  for (let index = 1; index < stroke.points.length; index += 1) {
    const point = stroke.points[index];
    ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
  }
  ctx.stroke();
}
