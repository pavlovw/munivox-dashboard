"use client";

import { useMemo, useState } from "react";
import { FiSearch, FiArrowRight, FiPhone, FiShield, FiMessageSquare, FiCommand, FiAlertTriangle } from "react-icons/fi";
import { CATEGORIAS, ESTADOS, PRIORIDADES, ORDEN_PRIORIDADES, departamentoInfo, normalizar } from "../lib/constantes";
import { Icono } from "./ui/Iconos";

// Guía de trabajo para el personal: protocolos, criterios y buenas prácticas

const FICHAS: Record<string, { verificar: string[]; acciones: string[]; ejemploPrioridad: string }> = {
  "Bache / Vialidad": {
    verificar: ["Tamaño y profundidad aproximada", "Si está en calzada transitada o en vereda", "Si hay riesgo para motos o ciclistas"],
    acciones: ["Señalizar si es peligroso", "Bacheo o relleno provisorio", "Programar reparación definitiva"],
    ejemploPrioridad: "Crítica si es un socavón en una vía principal; media si es un hoyo pequeño en un pasaje.",
  },
  "Basura / Microbasural": {
    verificar: ["Volumen aproximado", "Si hay residuos peligrosos (escombros, neumáticos, químicos)", "Si es un punto recurrente"],
    acciones: ["Retiro con camión de Aseo", "Limpieza del lugar", "Derivar a inspección si hay infractor identificable"],
    ejemploPrioridad: "Alta si obstruye el paso o hay riesgo sanitario; media en la mayoría de los casos.",
  },
  "Alumbrado público": {
    verificar: ["Cuántas luminarias están apagadas", "Si hay cables expuestos o postes dañados"],
    acciones: ["Cambio de luminaria", "Reporte a la empresa eléctrica si es falla de red", "Aislar la zona si hay cables cortados"],
    ejemploPrioridad: "Crítica si hay cables cortados; alta si un sector completo está a oscuras.",
  },
  "Vehículo abandonado": {
    verificar: ["Patente visible", "Tiempo aproximado en el lugar", "Si obstruye accesos o tránsito"],
    acciones: ["Notificación en el parabrisas", "Coordinación con Carabineros", "Retiro con grúa según ordenanza"],
    ejemploPrioridad: "Alta si bloquea un acceso; baja si está estacionado sin obstruir.",
  },
  "Ruidos molestos": {
    verificar: ["Horario", "Si es recurrente en el mismo domicilio o local"],
    acciones: ["Ronda de Seguridad Pública", "Citación del Juzgado de Policía Local si corresponde", "Derivar a Carabineros si hay riesgo"],
    ejemploPrioridad: "Media en general; alta si hay riñas o riesgo para personas (derivar al 133).",
  },
  "Señalética / Tránsito": {
    verificar: ["Tipo de señal o semáforo", "Si es una intersección de alto flujo"],
    acciones: ["Señalización provisoria", "Reposición de la señal", "Aviso a la Unidad Operativa de Control de Tránsito si es un semáforo"],
    ejemploPrioridad: "Crítica si un semáforo está apagado en un cruce principal; media para una señal caída.",
  },
  "Áreas verdes": {
    verificar: ["Si hay ramas o árboles con riesgo de caída", "Estado del riego"],
    acciones: ["Poda o retiro de ramas", "Reparación de riego", "Mantención de plaza"],
    ejemploPrioridad: "Alta si un árbol puede caer sobre la vía o una vivienda; baja para mantención.",
  },
  "Animales": {
    verificar: ["Si el animal está herido o es agresivo", "Si hay una jauría"],
    acciones: ["Coordinación con el programa de tenencia responsable", "Rescate o derivación veterinaria", "Ronda preventiva"],
    ejemploPrioridad: "Alta si hay animales agresivos cerca de colegios; media en los demás casos.",
  },
  "Otro": {
    verificar: ["Qué área municipal es competente", "Si corresponde a otra institución"],
    acciones: ["Corregir la categoría si aplica", "Derivar al área competente o descartar indicando a quién acudir"],
    ejemploPrioridad: "Según el riesgo para las personas.",
  },
};

const FLUJO = [
  { estado: "PENDIENTE", quien: "Central C4", accion: "Revisa, corrige categoría y prioridad, y deriva" },
  { estado: "EN_REVISION", quien: "Jefatura", accion: "Asigna a un funcionario de terreno" },
  { estado: "DESPACHADO", quien: "Funcionario", accion: "Acepta la tarea y va al lugar" },
  { estado: "RESUELTO", quien: "Funcionario", accion: "Cierra con informe y foto; el vecino evalúa" },
] as const;

const SECCIONES: { id: string; titulo: string; icono: React.ReactNode; texto: string; contenido: React.ReactNode }[] = [
  {
    id: "emergencias", titulo: "Emergencias: lo que MuniVox no atiende", icono: <FiPhone size={15} />,
    texto: "emergencia riesgo vital incendio robo ambulancia samu bomberos carabineros 131 132 133",
    contenido: (
      <>
        <p>MuniVox gestiona problemas de la vía pública, no emergencias. Si un reporte describe riesgo inminente para personas, <strong>no esperes al flujo normal</strong>:</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, margin: "10px 0" }}>
          {[["131", "SAMU", "Emergencias médicas"], ["132", "Bomberos", "Incendios y rescates"], ["133", "Carabineros", "Delitos y riñas"]].map(([n, q, d]) => (
            <div key={n} style={{ border: "2px solid var(--peligro)", padding: "10px 12px" }}>
              <div className="mono" style={{ fontSize: 26, fontWeight: 600, color: "var(--peligro)" }}>{n}</div>
              <div style={{ fontWeight: 600 }}>{q}</div>
              <div className="texto-3" style={{ fontSize: 12 }}>{d}</div>
            </div>
          ))}
        </div>
        <p>Llama tú mismo si corresponde, deja una nota interna con la hora y el número de atención, y escríbele al vecino indicando a qué número debe llamar.</p>
      </>
    ),
  },
  {
    id: "vecino", titulo: "Comunicación con el vecino", icono: <FiMessageSquare size={15} />,
    texto: "mensaje vecino whatsapp lenguaje trato respuesta adulto mayor",
    contenido: (
      <ul>
        <li>Escribe como hablarías a un vecino mayor: frases cortas, sin siglas ni tecnicismos ("Obras Municipales" en vez de "DOM").</li>
        <li>Pide una sola cosa por mensaje (una foto, una referencia o la ubicación) y explica cómo hacerlo.</li>
        <li>No prometas plazos que no dependen de ti; di qué viene ahora ("el equipo lo revisará esta semana").</li>
        <li>Al descartar, explica el motivo y, si corresponde, a qué institución debe acudir.</li>
        <li>Lo que el vecino responda en las 48 horas siguientes a tu mensaje se agrega solo al reporte.</li>
        <li>Nunca contactes al vecino desde un teléfono personal: usa el botón <strong>Escribir</strong> del expediente para que quede registrado.</li>
      </ul>
    ),
  },
  {
    id: "datos", titulo: "Protección de datos: reglas para el personal", icono: <FiShield size={15} />,
    texto: "datos personales privacidad ley 21719 telefono fotos confidencialidad solicitud supresion",
    contenido: (
      <>
        <ul>
          <li>Usa los datos del vecino <strong>solo</strong> para atender su reporte. No los compartas por otros medios ni con otras personas.</li>
          <li>No copies teléfonos ni fotos fuera del sistema (planillas personales, chats, capturas de pantalla).</li>
          <li>Las notas internas deben describir el problema, no a las personas: evita nombres, RUT o datos de salud.</li>
          <li>Si un vecino pide ver, corregir o eliminar sus datos por un medio distinto a WhatsApp, regístralo en Administración &gt; Datos personales. El plazo de respuesta es de <strong>30 días corridos</strong>.</li>
          <li>Si sospechas un acceso indebido o una filtración, avisa de inmediato a tu jefatura y al delegado de protección de datos.</li>
          <li>Las acciones sensibles quedan registradas en la bitácora de auditoría.</li>
        </ul>
        <p><a href="/privacidad" target="_blank" rel="noreferrer">Ver la política de privacidad publicada</a></p>
      </>
    ),
  },
  {
    id: "panel", titulo: "Atajos y consejos del panel", icono: <FiCommand size={15} />,
    texto: "atajos teclado buscar campana alertas sonido duplicado",
    contenido: (
      <ul>
        <li><span className="mono" style={{ border: "1px solid var(--borde-fuerte)", padding: "0 6px" }}>/</span> enfoca la búsqueda de la bandeja; <span className="mono" style={{ border: "1px solid var(--borde-fuerte)", padding: "0 6px" }}>Esc</span> cierra el expediente.</li>
        <li>Los indicadores superiores son botones: filtran la bandeja con un clic.</li>
        <li>La campana reúne lo que requiere atención: urgentes sin derivar, rechazos, reclamos y respuestas de vecinos.</li>
        <li>Si el expediente muestra reportes cercanos del mismo problema, usa <strong>Es el mismo</strong>: el vecino recibe el enlace del caso original.</li>
        <li>Si la IA no reconoce la categoría, corrígela antes de derivar: así el caso llega al departamento correcto y las estadísticas quedan bien.</li>
        <li>El indicador "En vivo" confirma que los cambios llegan al instante. Si dice "Sondeo 15 s", el panel igual se actualiza, pero con algunos segundos de retraso.</li>
      </ul>
    ),
  },
];

export default function Protocolos() {
  const [busqueda, setBusqueda] = useState("");
  const q = normalizar(busqueda);

  const fichas = useMemo(() => CATEGORIAS.filter(c => !q || normalizar(`${c.nombre} ${FICHAS[c.nombre]?.verificar.join(" ")} ${FICHAS[c.nombre]?.acciones.join(" ")}`).includes(q)), [q]);
  const secciones = SECCIONES.filter(s => !q || normalizar(`${s.titulo} ${s.texto}`).includes(q));
  const mostrarGenerales = !q || normalizar("flujo estados prioridad plazos sla").split(" ").some(p => q.includes(p) || p.includes(q));

  return (
    <div className="desplazable" style={{ height: "100%" }}>
      <div className="columna" style={{ gap: 12, paddingBottom: 12, maxWidth: 1200 }}>
        <div className="input-con-icono" style={{ maxWidth: 420 }}>
          <FiSearch size={14} />
          <input className="input" style={{ height: 38 }} placeholder="Buscar en la guía (ej: semáforo, emergencia, datos)" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>

        {mostrarGenerales && (
          <>
            <div className="panel anim-arriba">
              <div className="panel-cabecera"><span className="titulo-3">Flujo de un reporte</span><span className="texto-3" style={{ fontSize: 11 }}>Cada cambio queda en la trazabilidad y se avisa al vecino</span></div>
              <div className="panel-cuerpo fila" style={{ gap: 0, alignItems: "stretch", overflowX: "auto" }}>
                {FLUJO.map((f, i) => (
                  <div key={f.estado} className="fila anim-izquierda" style={{ gap: 0, alignItems: "stretch", animationDelay: `${i * 90}ms` }}>
                    <div style={{ minWidth: 180, border: `2px solid ${ESTADOS[f.estado].color}`, padding: "10px 12px" }}>
                      <div style={{ fontWeight: 700, color: ESTADOS[f.estado].color }}>{ESTADOS[f.estado].etiqueta}</div>
                      <div className="rotulo" style={{ marginTop: 4 }}>{f.quien}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>{f.accion}</div>
                    </div>
                    {i < FLUJO.length - 1 && <div className="fila" style={{ padding: "0 8px", color: "var(--texto-3)" }}><FiArrowRight size={18} /></div>}
                  </div>
                ))}
              </div>
              <div className="texto-3" style={{ padding: "0 16px 14px", fontSize: 12 }}>
                En cualquier etapa activa un caso puede quedar <strong style={{ color: ESTADOS.DESCARTADO.color }}>Descartado</strong> (con motivo). Si el funcionario rechaza la tarea, vuelve a la jefatura sin funcionario. Un caso cerrado se puede reabrir desde el C4.
              </div>
            </div>

            <div className="panel anim-arriba">
              <div className="panel-cabecera"><span className="titulo-3">Prioridades y plazos de atención</span></div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr style={{ textAlign: "left" }}>{["Prioridad", "Plazo", "Cuándo usarla"].map(h => <th key={h} className="rotulo" style={{ padding: "8px 14px", borderBottom: "1px solid var(--borde)" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {ORDEN_PRIORIDADES.map(p => (
                    <tr key={p}>
                      <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--borde)", fontWeight: 700, color: PRIORIDADES[p].color }}>{PRIORIDADES[p].etiqueta}</td>
                      <td className="mono" style={{ padding: "9px 14px", borderBottom: "1px solid var(--borde)" }}>{PRIORIDADES[p].slaHoras < 24 ? `${PRIORIDADES[p].slaHoras} horas` : PRIORIDADES[p].slaHoras === 24 ? "1 día" : `${PRIORIDADES[p].slaHoras / 24} días`}</td>
                      <td style={{ padding: "9px 14px", borderBottom: "1px solid var(--borde)" }}>
                        {p === "CRITICA" && "Riesgo inminente para personas: cables cortados, socavón en vía transitada, semáforo apagado en cruce principal."}
                        {p === "ALTA" && "Afecta la circulación, la salud o la seguridad de muchas personas."}
                        {p === "MEDIA" && "La mayoría de los reportes: problemas reales sin riesgo inmediato."}
                        {p === "BAJA" && "Molestias menores o mantención programable."}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="texto-3" style={{ padding: "8px 14px 12px", fontSize: 12 }}>La IA propone la prioridad; el C4 puede ajustarla. El plazo corre desde que el vecino envió el reporte.</div>
            </div>
          </>
        )}

        {fichas.length > 0 && (
          <div>
            <div className="rotulo" style={{ margin: "6px 0 8px" }}>Fichas por tipo de problema</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
              {fichas.map((c, i) => {
                const f = FICHAS[c.nombre];
                return (
                  <div key={c.nombre} className="panel anim-arriba" style={{ ["--i" as any]: i, borderTop: `4px solid ${c.color}` }}>
                    <div className="panel-cuerpo">
                      <div className="fila entre">
                        <span className="fila" style={{ gap: 10 }}>
                          <span style={{ width: 32, height: 32, background: c.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icono nombre={c.icono} size={18} /></span>
                          <span style={{ fontWeight: 700 }}>{c.nombre}</span>
                        </span>
                        <span className="texto-3" style={{ fontSize: 11 }}>{departamentoInfo(c.departamentoId)?.nombre || "Según el caso"}</span>
                      </div>
                      <div className="rotulo" style={{ marginTop: 12 }}>Qué verificar</div>
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5 }}>{f.verificar.map(v => <li key={v}>{v}</li>)}</ul>
                      <div className="rotulo" style={{ marginTop: 10 }}>Acciones habituales</div>
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5 }}>{f.acciones.map(v => <li key={v}>{v}</li>)}</ul>
                      <div style={{ marginTop: 10, fontSize: 12, background: "var(--superficie-2)", borderLeft: `3px solid ${c.color}`, padding: "6px 8px" }}>{f.ejemploPrioridad}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {secciones.map((s, i) => (
          <div key={s.id} className="panel anim-arriba" style={{ ["--i" as any]: i }}>
            <div className="panel-cabecera"><span className="titulo-3 fila" style={{ gap: 8 }}>{s.icono}{s.titulo}</span></div>
            <div className="panel-cuerpo" style={{ fontSize: 13, lineHeight: 1.65, color: "var(--texto-2)" }}>{s.contenido}</div>
          </div>
        ))}

        {q && !fichas.length && !secciones.length && !mostrarGenerales && (
          <div className="vacio"><FiAlertTriangle size={18} />No encontramos "{busqueda}" en la guía.</div>
        )}
      </div>
    </div>
  );
}
