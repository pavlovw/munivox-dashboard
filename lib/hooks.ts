"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useEfectoTemprano = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Referencia que siempre apunta al último valor (para callbacks usados en efectos) */
export function useUltimo<T>(valor: T) {
  const ref = useRef(valor);
  useEfectoTemprano(() => {
    ref.current = valor;
  });
  return ref;
}

/** Fuerza un nuevo render cada cierto tiempo (para tiempos relativos y plazos) */
export function useAhora(intervaloMs = 30000) {
  // Empieza en 0 y se fija al montar: la hora no puede leerse durante el prerender
  const [ahora, setAhora] = useState(0);
  useEffect(() => {
    const tic = () => setAhora(Date.now());
    tic();
    const id = setInterval(tic, intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return ahora;
}

/** Número que se anima desde su valor anterior hasta el nuevo */
export function useCuentaAnimada(valor: number, duracionMs = 700) {
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);
  const actual = useRef(valor);

  useEffect(() => {
    desde.current = actual.current;
    const inicio = performance.now();
    let frame = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracionMs);
      const suave = 1 - Math.pow(1 - p, 3);
      const v = desde.current + (valor - desde.current) * suave;
      actual.current = v;
      setMostrado(v);
      if (p < 1) frame = requestAnimationFrame(paso);
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [valor, duracionMs]);

  return mostrado;
}

/** Valor guardado en localStorage (preferencias del usuario en este equipo) */
export function usePreferencia<T>(clave: string, inicial: T) {
  const [valor, setValor] = useState<T>(inicial);
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(clave);
      if (guardado !== null) setValor(JSON.parse(guardado));
    } catch {}
  }, [clave]);
  const guardar = (v: T) => {
    setValor(v);
    try { localStorage.setItem(clave, JSON.stringify(v)); } catch {}
  };
  return [valor, guardar] as const;
}

/** Sonido corto de alerta (sin archivos externos) */
export function sonarAlerta(tono: "nuevo" | "alerta" = "nuevo") {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const notas = tono === "nuevo" ? [880, 1320] : [660, 440];
    notas.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gan = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = f;
      gan.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.14);
      gan.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + i * 0.14 + 0.01);
      gan.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.14 + 0.12);
      osc.connect(gan).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.14);
      osc.stop(ctx.currentTime + i * 0.14 + 0.13);
    });
    setTimeout(() => ctx.close(), 600);
  } catch {}
}
