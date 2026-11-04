"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { FiAlertTriangle, FiCheck, FiInfo, FiX, FiBell } from "react-icons/fi";

type TipoAviso = "info" | "ok" | "error" | "alerta" | "nuevo";

interface Aviso {
  id: number;
  titulo: string;
  mensaje?: string;
  tipo: TipoAviso;
  duracion: number;
  accion?: { etiqueta: string; onClick: () => void };
  saliendo?: boolean;
}

const COLORES: Record<TipoAviso, string> = {
  info: "#4C7DFF",
  ok: "#37B24D",
  error: "#F03E3E",
  alerta: "#F59F00",
  nuevo: "#4C7DFF",
};

const ICONOS: Record<TipoAviso, React.ReactNode> = {
  info: <FiInfo size={16} />,
  ok: <FiCheck size={16} />,
  error: <FiAlertTriangle size={16} />,
  alerta: <FiAlertTriangle size={16} />,
  nuevo: <FiBell size={16} />,
};

type Avisar = (a: { titulo: string; mensaje?: string; tipo?: TipoAviso; duracion?: number; accion?: Aviso["accion"] }) => void;

const Contexto = createContext<Avisar>(() => {});

export function useAvisos() {
  return useContext(Contexto);
}

export function AvisosProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const contador = useRef(0);

  const cerrar = useCallback((id: number) => {
    setAvisos(a => a.map(x => (x.id === id ? { ...x, saliendo: true } : x)));
    setTimeout(() => setAvisos(a => a.filter(x => x.id !== id)), 220);
  }, []);

  const avisar = useCallback<Avisar>(
    ({ titulo, mensaje, tipo = "info", duracion = 4500, accion }) => {
      const id = ++contador.current;
      setAvisos(a => [...a.slice(-3), { id, titulo, mensaje, tipo, duracion, accion }]);
      setTimeout(() => cerrar(id), duracion);
    },
    [cerrar]
  );

  return (
    <Contexto.Provider value={avisar}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map(a => (
          <div key={a.id} className={`aviso${a.saliendo ? " saliendo" : ""}`} style={{ ["--color-aviso" as any]: COLORES[a.tipo] }}>
            <span style={{ color: COLORES[a.tipo], marginTop: 1 }}>{ICONOS[a.tipo]}</span>
            <div className="crece">
              <div style={{ fontWeight: 600, fontSize: 12.5 }}>{a.titulo}</div>
              {a.mensaje && <div style={{ fontSize: 12, color: "#A9B6CC", marginTop: 2 }}>{a.mensaje}</div>}
              {a.accion && (
                <button
                  onClick={() => { a.accion!.onClick(); cerrar(a.id); }}
                  style={{ marginTop: 8, background: "transparent", border: `1px solid ${COLORES[a.tipo]}`, color: "#fff", fontSize: 11, fontWeight: 600, padding: "4px 10px" }}
                >
                  {a.accion.etiqueta}
                </button>
              )}
            </div>
            <button onClick={() => cerrar(a.id)} aria-label="Cerrar aviso" style={{ background: "transparent", border: 0, color: "#7C8BA6", padding: 2 }}>
              <FiX size={14} />
            </button>
            <span className="aviso-tiempo" style={{ animation: `crecerX ${a.duracion}ms linear reverse both`, width: "100%" }} />
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}
