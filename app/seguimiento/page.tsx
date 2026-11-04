"use client";

import { useEffect, useState } from "react";
import { FiSearch, FiCheck, FiArrowLeft, FiHelpCircle, FiMessageCircle, FiAlertTriangle } from "react-icons/fi";
import { Logo } from "../../components/ui/Comunes";
import { API_URL } from "../../lib/useApi";

// Página pública: el vecino ve el avance de su reporte sin iniciar sesión.
// No muestra datos personales (ni teléfono, ni relato, ni ubicación exacta).

interface Seguimiento {
  codigo: string;
  estado: "PENDIENTE" | "EN_REVISION" | "DESPACHADO" | "RESUELTO" | "DESCARTADO";
  categoria: string | null;
  departamento: string | null;
  creado: string;
  actualizado: string;
  etapas: { recibido: string; enRevision: string | null; asignado: string | null; enCamino: string | null; cerrado: string | null };
  informe: string | null;
  motivo: string | null;
  fotosCierre: string[];
  token: string;
}

const EXPLICACION: Record<Seguimiento["estado"], { titulo: string; texto: (s: Seguimiento) => string; color: string }> = {
  PENDIENTE: { titulo: "Recibimos tu reporte", texto: () => "La central de la Municipalidad lo revisará y lo enviará al área que corresponde.", color: "#D9480F" },
  EN_REVISION: { titulo: "Tu reporte está en revisión", texto: s => `${s.departamento || "El área responsable"} está organizando la atención de tu caso.`, color: "#1D4ED8" },
  DESPACHADO: { titulo: "Un funcionario va en camino", texto: s => `Personal de ${s.departamento || "la Municipalidad"} se dirige al lugar que indicaste.`, color: "#7048E8" },
  RESUELTO: { titulo: "Tu caso fue resuelto", texto: () => "El equipo municipal informó que el problema fue atendido. Gracias por avisar.", color: "#2B8A3E" },
  DESCARTADO: { titulo: "Tu reporte fue cerrado", texto: () => "Este reporte se cerró sin intervención. Más abajo está el motivo.", color: "#6B7689" },
};

const fecha = (f?: string | null) =>
  f ? new Date(f).toLocaleString("es-CL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";

export default function PaginaSeguimiento() {
  const [escala, setEscala] = useState(1);
  const [numero, setNumero] = useState("");
  const [digitos, setDigitos] = useState("");
  const [datos, setDatos] = useState<Seguimiento | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [ayuda, setAyuda] = useState(false);

  useEffect(() => {
    try { const e = Number(localStorage.getItem("munivox_escala_texto")); if (e >= 1 && e <= 1.5) setEscala(e); } catch {}
    const t = new URLSearchParams(window.location.search).get("t");
    if (t) consultar(`${API_URL}/publico/seguimiento?t=${encodeURIComponent(t)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiarEscala = (delta: number) => {
    const nueva = Math.min(1.5, Math.max(1, Math.round((escala + delta) * 100) / 100));
    setEscala(nueva);
    try { localStorage.setItem("munivox_escala_texto", String(nueva)); } catch {}
  };

  async function consultar(url: string, init?: RequestInit) {
    setCargando(true);
    setError("");
    try {
      const res = await fetch(url, init);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No pudimos consultar el reporte.");
      setDatos(data);
      window.history.replaceState(null, "", `/seguimiento?t=${data.token}`);
    } catch (e: any) {
      setError(e.message || "No pudimos consultar el reporte. Revisa tu conexión a internet.");
    } finally {
      setCargando(false);
    }
  }

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    consultar(`${API_URL}/publico/seguimiento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: numero, digitos }),
    });
  };

  const volver = () => { setDatos(null); setError(""); window.history.replaceState(null, "", "/seguimiento"); };

  const base = 16 * escala;

  return (
    <div style={{ minHeight: "100vh", background: "var(--fondo)", fontSize: base }}>
      <header style={{ background: "var(--marino)", color: "#fff" }}>
        <div className="fila entre" style={{ maxWidth: 720, margin: "0 auto", padding: "14px 16px" }}>
          <Logo tamano={30} subtitulo="Municipalidad de Buin" />
          <div className="fila" style={{ gap: 6 }} role="group" aria-label="Tamaño de la letra">
            <span style={{ fontSize: 12, color: "var(--marino-texto)", marginRight: 4 }}>Letra</span>
            <button onClick={() => cambiarEscala(-0.15)} aria-label="Letra más pequeña" style={botonLetra}>A-</button>
            <button onClick={() => cambiarEscala(0.15)} aria-label="Letra más grande" style={{ ...botonLetra, fontSize: 18 }}>A+</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 48px" }}>
        {!datos ? (
          <div className="anim-arriba">
            <h1 style={{ fontSize: base * 1.75, lineHeight: 1.15, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Revisa cómo va tu reporte</h1>
            <p style={{ margin: "0 0 24px", color: "var(--texto-2)", lineHeight: 1.6 }}>
              Escribe el número de tu reporte y los últimos 4 números de tu teléfono.
            </p>

            {error && (
              <div role="alert" className="anim-sacudir fila" style={{ gap: 10, alignItems: "flex-start", background: "var(--peligro-suave)", borderLeft: "4px solid var(--peligro)", padding: "14px 16px", marginBottom: 18, lineHeight: 1.5 }}>
                <FiAlertTriangle style={{ flexShrink: 0, marginTop: 3 }} /> {error}
              </div>
            )}

            <form onSubmit={buscar} className="panel marco" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
              <label style={{ display: "block" }}>
                <span style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>1. Número del reporte</span>
                <span style={{ display: "flex", alignItems: "stretch", border: "2px solid var(--borde-fuerte)" }}>
                  <span className="mono" style={{ display: "flex", alignItems: "center", padding: "0 14px", background: "var(--superficie-3)", fontWeight: 600, fontSize: base * 1.4 }}>MUN-</span>
                  <input className="mono" inputMode="numeric" autoComplete="off" maxLength={6} required value={numero}
                    onChange={e => setNumero(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" aria-label="Seis números del reporte"
                    style={{ flex: 1, minWidth: 0, border: 0, outline: "none", padding: "14px 12px", fontSize: base * 1.6, letterSpacing: "0.15em", fontWeight: 600 }} />
                </span>
              </label>

              <label style={{ display: "block" }}>
                <span style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>2. Últimos 4 números de tu teléfono</span>
                <input className="mono" inputMode="numeric" autoComplete="off" maxLength={4} required value={digitos}
                  onChange={e => setDigitos(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="5678" aria-label="Últimos cuatro números del teléfono"
                  style={{ width: "100%", border: "2px solid var(--borde-fuerte)", outline: "none", padding: "14px 12px", fontSize: base * 1.6, letterSpacing: "0.3em", fontWeight: 600 }} />
                <span style={{ display: "block", color: "var(--texto-3)", fontSize: base * 0.85, marginTop: 6 }}>Del mismo número con el que enviaste el reporte por WhatsApp.</span>
              </label>

              <button type="submit" className="btn btn-primario" disabled={cargando || numero.length !== 6 || digitos.length !== 4}
                style={{ height: 60, fontSize: base * 1.1 }}>
                {cargando ? <span className="girador" style={{ borderColor: "rgba(255,255,255,.35)", borderTopColor: "#fff" }} /> : <FiSearch size={20} />}
                {cargando ? "Buscando" : "Ver mi reporte"}
              </button>
            </form>

            <button onClick={() => setAyuda(!ayuda)} className="fila" aria-expanded={ayuda}
              style={{ marginTop: 20, gap: 10, background: "none", border: 0, color: "var(--acento)", fontWeight: 600, fontSize: base, padding: 0 }}>
              <FiHelpCircle size={20} /> ¿No encuentras el número de tu reporte?
            </button>
            {ayuda && (
              <div className="panel anim-arriba" style={{ marginTop: 12, padding: 18, lineHeight: 1.7 }}>
                <p style={{ margin: "0 0 10px" }}>Te lo enviamos por WhatsApp cuando registraste el reporte. Empieza con <strong>MUN-</strong> y tiene 6 números.</p>
                <p style={{ margin: "0 0 10px" }}><strong>Si no lo encuentras, no te preocupes:</strong> escribe la palabra <strong>estado</strong> al WhatsApp de la Municipalidad y te mostraremos todos tus reportes, sin necesidad del número.</p>
                <p style={{ margin: 0 }}>En ese mismo chat te enviamos un enlace que abre esta página directamente con tu reporte.</p>
              </div>
            )}
          </div>
        ) : (
          <Resultado datos={datos} base={base} onVolver={volver} />
        )}

        <footer style={{ marginTop: 40, paddingTop: 18, borderTop: "1px solid var(--borde)", color: "var(--texto-3)", fontSize: base * 0.8, lineHeight: 1.6 }}>
          Esta página no muestra datos personales. <a href="/privacidad">Política de privacidad</a>.
          <br />Emergencias: 131 SAMU, 132 Bomberos, 133 Carabineros.
        </footer>
      </main>
    </div>
  );
}

const botonLetra: React.CSSProperties = { minWidth: 40, height: 36, background: "transparent", border: "1px solid var(--marino-borde)", color: "#fff", fontWeight: 700, fontSize: 14 };

function Resultado({ datos, base, onVolver }: { datos: Seguimiento; base: number; onVolver: () => void }) {
  const e = EXPLICACION[datos.estado];
  const descartado = datos.estado === "DESCARTADO";
  const pasos = [
    { titulo: "Reporte recibido", fecha: datos.etapas.recibido },
    { titulo: "En revisión por el área responsable", fecha: datos.etapas.enRevision },
    { titulo: "Funcionario asignado", fecha: datos.etapas.asignado },
    { titulo: "Funcionario en camino", fecha: datos.etapas.enCamino },
    { titulo: descartado ? "Reporte cerrado" : "Caso resuelto", fecha: datos.etapas.cerrado },
  ].filter((p, i) => !(descartado && (i === 2 || i === 3) && !p.fecha));
  const actual = pasos.reduce((ultimo, p, i) => (p.fecha ? i : ultimo), 0);

  return (
    <div className="anim-arriba">
      <button onClick={onVolver} className="fila" style={{ gap: 8, background: "none", border: 0, color: "var(--acento)", fontWeight: 600, fontSize: base, padding: 0, marginBottom: 18 }}>
        <FiArrowLeft size={18} /> Buscar otro reporte
      </button>

      <div className="panel" style={{ borderTop: `6px solid ${e.color}` }}>
        <div style={{ padding: 20 }}>
          <div style={{ color: "var(--texto-3)", fontSize: base * 0.85 }}>Reporte</div>
          <div className="mono" style={{ fontSize: base * 2, fontWeight: 600, letterSpacing: "-0.02em" }}>{datos.codigo}</div>
          <div style={{ color: "var(--texto-2)", marginTop: 4 }}>{datos.categoria || "Reporte ciudadano"}{datos.departamento ? ` | ${datos.departamento}` : ""}</div>
        </div>
        <div style={{ background: e.color, color: "#fff", padding: "18px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: base * 1.35 }}>{e.titulo}</div>
          <div style={{ marginTop: 6, lineHeight: 1.5, opacity: 0.95 }}>{e.texto(datos)}</div>
        </div>
      </div>

      <h2 style={{ fontSize: base * 1.2, margin: "28px 0 14px" }}>Avance</h2>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {pasos.map((p, i) => {
          const hecho = !!p.fecha;
          const esActual = i === actual;
          return (
            <li key={p.titulo} className="anim-izquierda" style={{ display: "flex", gap: 14, animationDelay: `${i * 90}ms` }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{
                  width: 34, height: 34, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: hecho ? (esActual ? e.color : "var(--ok)") : "var(--superficie)", color: "#fff",
                  border: hecho ? "none" : "2px solid var(--borde-fuerte)",
                }}>
                  {hecho ? <FiCheck size={18} /> : <span className="mono" style={{ color: "var(--texto-3)", fontSize: 13 }}>{i + 1}</span>}
                </span>
                {i < pasos.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 26, background: pasos[i + 1].fecha ? "var(--ok)" : "var(--borde-fuerte)" }} />}
              </div>
              <div style={{ paddingBottom: 18, paddingTop: 4 }}>
                <div style={{ fontWeight: esActual ? 700 : 600, color: hecho ? "var(--texto)" : "var(--texto-3)" }}>{p.titulo}</div>
                <div style={{ color: "var(--texto-3)", fontSize: base * 0.85, marginTop: 2 }}>{hecho ? fecha(p.fecha) : "Pendiente"}</div>
              </div>
            </li>
          );
        })}
      </ol>

      {(datos.informe || datos.motivo) && (
        <div className="panel" style={{ padding: 18, marginTop: 8, borderLeft: `4px solid ${e.color}`, lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{datos.informe ? "Qué se hizo" : "Motivo del cierre"}</div>
          {datos.informe || datos.motivo}
        </div>
      )}

      {datos.fotosCierre.length > 0 && (
        <>
          <h2 style={{ fontSize: base * 1.2, margin: "28px 0 12px" }}>Foto del trabajo realizado</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {datos.fotosCierre.map(u => (
              <a key={u} href={u} target="_blank" rel="noreferrer" style={{ border: "1px solid var(--borde)" }}>
                <img src={u} alt="Foto del lugar después de la atención" style={{ width: "100%", height: 200, objectFit: "cover" }} />
              </a>
            ))}
          </div>
        </>
      )}

      <div className="fila" style={{ gap: 12, marginTop: 28, padding: 16, background: "var(--acento-suave)", border: "1px solid var(--acento-borde)", lineHeight: 1.5, alignItems: "flex-start" }}>
        <FiMessageCircle size={22} color="var(--acento)" style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Te avisaremos por WhatsApp cada vez que haya un avance. Si quieres agregar información, escríbenos en el mismo chat.</span>
      </div>
      <div style={{ color: "var(--texto-3)", fontSize: base * 0.8, marginTop: 14 }}>Última actualización: {fecha(datos.actualizado)}</div>
    </div>
  );
}
