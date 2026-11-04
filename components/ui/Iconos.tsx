import type { IconoCategoria } from "../../lib/constantes";

// Íconos propios, dibujados solo con líneas rectas (sin curvas), 24x24.
const TRAZOS: Record<IconoCategoria | "funcionario" | "logo", string> = {
  bache: '<path d="M5 21 9 3M19 21 15 3M12 4v2M12 9v2"/><path d="M7 15h10l-2 4H9z"/>',
  basura: '<path d="M3 6h18M9 6V3h6v3M5 6l1.5 15h11L19 6M10 10v7M14 10v7"/>',
  alumbrado: '<path d="M8 21h8M11 21V4h8v3"/><path d="M15 7h7l-1.5 3h-4z"/><path d="M18.5 12v1.5"/>',
  vehiculo: '<path d="M2 16v-4l2.5-6h15L22 12v4z"/><path d="M2 12h20M6 16v3h2v-3M16 16v3h2v-3M6.5 9h11"/>',
  ruido: '<path d="M3 9h4l5-4v14l-5-4H3z"/><path d="M16 8l3-3M16 16l3 3M17 12h4"/>',
  senaletica: '<path d="M12 2l7 7-7 7-7-7z"/><path d="M12 16v6M9 22h6M12 6.5v4"/>',
  verde: '<path d="M12 2 5 11h4l-4 6h14l-4-6h4z"/><path d="M12 17v5M9 22h6"/>',
  animal: '<path d="M4 8h3v3H4zM9 4h3v3H9zM14 4h3v3h-3zM19 8h-3v3h3z"/><path d="M8 20l1-5 3-3 3 3 1 5z"/>',
  otro: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 17.5v.5"/>',
  funcionario: '<path d="M2 6h12v10H2zM14 9h4l4 4v3h-8z"/><path d="M5 19h3M16 19h3"/>',
  logo: '<path d="M3 3h18v18H3z"/><path d="M7 16V8l5 5 5-5v8"/>',
};

export function svgIcono(nombre: keyof typeof TRAZOS, grosor = 2) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${grosor}" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${TRAZOS[nombre]}</svg>`;
}

export function Icono({ nombre, size = 18, grosor = 2, style }: { nombre: keyof typeof TRAZOS; size?: number; grosor?: number; style?: React.CSSProperties }) {
  return (
    <span
      style={{ display: "inline-flex", width: size, height: size, flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: svgIcono(nombre, grosor).replace("<svg ", `<svg width="${size}" height="${size}" `) }}
    />
  );
}
