"use client";
import { FiX, FiCpu, FiMapPin, FiUser, FiMessageSquare, FiImage, FiClock, FiCopy, FiExternalLink, FiLayers, FiStar } from "react-icons/fi";
import type { Ticket } from "../lib/tipos";
import { ESTADOS, categoriaInfo, departamentoInfo, formatearTelefono, prioridadDe, tiempoRelativo, calificacionDe, fechaHora } from "../lib/constantes";
import { unidadVecinalDe, enlaceGoogleMaps } from "../lib/geo";
import { InsigniaEstado, InsigniaPrioridad, IndicadorSla, Conversacion, Galeria, LineaTiempo, Seccion, EtiquetaCategoria } from "./ui/Comunes";
import { useAvisos } from "./ui/Avisos";

interface Props {
  ticket: Ticket;
  ahora: number;
  onCerrar: () => void;
  acciones?: React.ReactNode;
  cercanos?: Ticket[];
  onVerCercano?: (id: string) => void;
  mostrarCiudadano?: boolean;
  cargando?: boolean;
}

export default function DetalleTicket({ ticket: t, ahora, onCerrar, acciones, cercanos = [], onVerCercano, mostrarCiudadano = true, cargando }: Props) {
  const avisar = useAvisos();
  const cat = categoriaInfo(t.categoria?.nombre);
  const depto = departamentoInfo(t.departamentoId ?? t.departamento?.nombre);
  const uv = unidadVecinalDe(t.latitud, t.longitud);
  const certeza = t.certezaIA != null ? Math.round(t.certezaIA * 100) : null;
  const nota = calificacionDe(t);
  const recomendado = departamentoInfo(cat.departamentoId);

  const copiar = (texto: string, que: string) => {
    navigator.clipboard?.writeText(texto).then(() => avisar({ titulo: `${que} copiado`, tipo: "ok", duracion: 2000 }));
  };

  return (
    <div className="anim-derecha" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "var(--superficie)" }}>
      {/* CABECERA */}
      <div style={{ position: "relative", padding: "14px 16px", borderBottom: "1px solid var(--borde)", background: "var(--superficie)" }}>
        {cargando && <div className="barra-carga" />}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: cat.color }} />
        <div className="fila entre" style={{ alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div className="fila" style={{ gap: 8 }}>
              <span className="rotulo">Expediente</span>
              <span className="mono texto-3" style={{ fontSize: 10.5 }}>{tiempoRelativo(t.createdAt, ahora)}</span>
            </div>
            <button onClick={() => copiar(t.codigoTicket, "Código")} className="mono fila" title="Copiar código"
              style={{ gap: 8, fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", background: "none", border: 0, padding: 0, marginTop: 2 }}>
              {t.codigoTicket} <FiCopy size={12} color="var(--texto-3)" />
            </button>
          </div>
          <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar detalle"><FiX size={16} /></button>
        </div>
        <div className="fila" style={{ marginTop: 10, flexWrap: "wrap", gap: 6 }}>
          <InsigniaEstado estado={t.estado} solida />
          <InsigniaPrioridad prioridad={prioridadDe(t)} ajustada={!!t.prioridadFinal} />
          {nota && (
            <span className="insignia" style={{ color: nota >= 5 ? "var(--ok)" : nota >= 3 ? "var(--aviso)" : "var(--peligro)" }}>
              <FiStar size={11} /> Vecino: {nota === 5 ? "Bien resuelto" : nota === 3 ? "Regular" : "No resuelto"}
            </span>
          )}
        </div>
      </div>

      {/* CUERPO */}
      <div className="desplazable" style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Ficha */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid var(--borde)" }}>
          {[
            { rotulo: "Categoría", valor: <EtiquetaCategoria nombre={t.categoria?.nombre} compacta /> },
            { rotulo: "Departamento", valor: depto ? <span className="fila" style={{ gap: 6, fontWeight: 600 }}><span className="punto" style={{ background: depto.color }} />{depto.nombre}</span> : <span className="texto-3">Sin derivar</span> },
            { rotulo: "Plazo de atención", valor: <IndicadorSla ticket={t} ahora={ahora} barra /> },
            { rotulo: "Funcionario", valor: t.operadorAsignado ? <span style={{ fontWeight: 600 }}>{t.operadorAsignado.nombre}</span> : <span className="texto-3">Sin asignar</span> },
          ].map((c, i) => (
            <div key={i} style={{ padding: "10px 12px", borderRight: i % 2 === 0 ? "1px solid var(--borde)" : 0, borderBottom: i < 2 ? "1px solid var(--borde)" : 0, minWidth: 0 }}>
              <div className="rotulo" style={{ marginBottom: 6 }}>{c.rotulo}</div>
              {c.valor}
            </div>
          ))}
        </div>

        {/* Análisis IA */}
        <Seccion titulo="Análisis de la IA" icono={<FiCpu size={12} />}>
          <div style={{ border: "1px solid var(--acento-borde)", background: "linear-gradient(180deg, var(--acento-suave), var(--superficie) 70%)", padding: 12 }}>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>{t.analisisIA || "La IA no entregó un análisis para este reporte."}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <div className="fila entre"><span className="rotulo">Certeza</span><span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{certeza != null ? `${certeza}%` : "--"}</span></div>
                <div className="barra" style={{ marginTop: 4, ["--color-barra" as any]: certeza != null && certeza < 60 ? "var(--alerta)" : "var(--acento)" }}>
                  <span style={{ width: `${certeza ?? 0}%` }} />
                </div>
              </div>
              <div>
                <div className="rotulo">Área sugerida</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3 }}>{recomendado?.nombre || t.departamento?.nombre || "Sin sugerencia"}</div>
              </div>
            </div>
          </div>
        </Seccion>

        {/* Ubicación */}
        <Seccion titulo="Ubicación" icono={<FiMapPin size={12} />}>
          {t.latitud != null && t.longitud != null ? (
            <div className="fila entre" style={{ border: "1px solid var(--borde)", padding: "10px 12px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>{uv}</div>
                <div className="mono texto-3" style={{ fontSize: 11 }}>{t.latitud.toFixed(5)}, {t.longitud.toFixed(5)}</div>
              </div>
              <div className="fila" style={{ gap: 6 }}>
                <button className="btn btn-sm btn-fantasma" onClick={() => copiar(`${t.latitud}, ${t.longitud}`, "Coordenadas")}><FiCopy size={12} /></button>
                <a className="btn btn-sm btn-secundario" href={enlaceGoogleMaps(t.latitud, t.longitud)} target="_blank" rel="noreferrer"><FiExternalLink size={12} /> Maps</a>
              </div>
            </div>
          ) : (
            <div className="vacio" style={{ padding: 14 }}>El vecino aún no envía la ubicación</div>
          )}
        </Seccion>

        {/* Ciudadano */}
        {mostrarCiudadano && t.ciudadano && (
          <Seccion titulo="Vecino" icono={<FiUser size={12} />}>
            <div className="fila entre" style={{ border: "1px solid var(--borde)", padding: "10px 12px" }}>
              <div>
                <div className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{formatearTelefono(t.ciudadano.telefono)}</div>
                <div className="texto-3" style={{ fontSize: 11 }}>
                  {t.reportesCiudadano != null ? `${t.reportesCiudadano} reporte${t.reportesCiudadano === 1 ? "" : "s"} en total` : "Contacto por WhatsApp"}
                  {t.ciudadano.baneado && <span style={{ color: "var(--peligro)", fontWeight: 600 }}> | Bloqueado</span>}
                </div>
              </div>
              <a className="btn btn-sm btn-secundario" href={`https://wa.me/${String(t.ciudadano.telefono).replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                <FiMessageSquare size={12} /> WhatsApp
              </a>
            </div>
          </Seccion>
        )}

        {/* Conversación */}
        <Seccion titulo="Relato del vecino" icono={<FiMessageSquare size={12} />}>
          <Conversacion descripcion={t.descripcionUsuario} />
        </Seccion>

        {/* Evidencias */}
        <Seccion titulo={`Evidencia fotográfica (${t.evidencias?.length || 0})`} icono={<FiImage size={12} />}>
          <Galeria evidencias={t.evidencias} />
        </Seccion>

        {/* Posibles duplicados */}
        {cercanos.length > 0 && (
          <Seccion titulo={`Reportes cercanos (${cercanos.length})`} icono={<FiLayers size={12} />}>
            <div style={{ border: "1px solid var(--alerta)", background: "var(--alerta-suave)", padding: "8px 10px", fontSize: 11.5, color: "#8A2E06", marginBottom: 6 }}>
              Hay reportes a menos de 300 m en los últimos 30 días. Revisa si se trata del mismo problema.
            </div>
            <div className="columna" style={{ gap: 4 }}>
              {cercanos.slice(0, 6).map((c, i) => (
                <button key={c.id} className="item-lista anim-arriba" onClick={() => onVerCercano?.(c.id)}
                  style={{ ["--i" as any]: i, ["--color-item" as any]: categoriaInfo(c.categoria?.nombre).color, padding: "8px 10px 8px 14px" }}>
                  <div className="fila entre">
                    <span className="mono" style={{ fontWeight: 600, fontSize: 12 }}>{c.codigoTicket}</span>
                    <span className="mono texto-3" style={{ fontSize: 11 }}>{c.distancia} m</span>
                  </div>
                  <div className="fila entre" style={{ marginTop: 2 }}>
                    <span className="texto-2 truncar" style={{ fontSize: 11.5 }}>{c.categoria?.nombre || "Sin clasificar"}</span>
                    <span style={{ fontSize: 10.5, color: ESTADOS[c.estado]?.color, fontWeight: 600 }}>{ESTADOS[c.estado]?.etiqueta}</span>
                  </div>
                </button>
              ))}
            </div>
          </Seccion>
        )}

        {/* Trazabilidad */}
        <Seccion titulo="Trazabilidad" icono={<FiClock size={12} />} accion={<span className="mono texto-3" style={{ fontSize: 10.5 }}>{fechaHora(t.createdAt)}</span>}>
          <LineaTiempo historial={t.historial} creado={t.createdAt} />
        </Seccion>
      </div>

      {/* ACCIONES */}
      {acciones && (
        <div style={{ borderTop: "1px solid var(--borde)", background: "var(--superficie-2)", padding: 14 }}>
          {acciones}
        </div>
      )}
    </div>
  );
}
