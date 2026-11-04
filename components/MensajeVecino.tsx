"use client";
import { useState } from "react";
import { FiSend } from "react-icons/fi";
import { Modal } from "./ui/Comunes";
import { useAvisos } from "./ui/Avisos";
import { useApi, mensajeError } from "../lib/useApi";
import type { Ticket } from "../lib/tipos";

// Respuestas frecuentes: el operador las elige y puede editarlas antes de enviar
const PLANTILLAS = [
  "¿Podrías enviarnos una fotografía del problema? Nos ayuda a preparar la atención.",
  "¿Podrías enviarnos la ubicación exacta del problema? Toca el clip, elige Ubicación y mueve el mapa hasta el punto exacto.",
  "¿Podrías indicarnos una referencia del lugar (número de casa, esquina o local cercano)?",
  "Tu caso está programado. El equipo municipal acudirá durante los próximos días hábiles.",
  "Gracias por tu paciencia. Tu reporte sigue en curso y te avisaremos apenas haya novedades.",
];

interface Props {
  ticket: Ticket | null;
  abierto: boolean;
  onCerrar: () => void;
  onEnviado: (t: Ticket) => void;
}

/** Envía un mensaje por WhatsApp al vecino del reporte. Queda en la trazabilidad. */
export default function MensajeVecino({ ticket, abierto, onCerrar, onEnviado }: Props) {
  const api = useApi();
  const avisar = useAvisos();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!ticket) return;
    setEnviando(true);
    try {
      const res = await api(`/tickets/${ticket.id}`, { method: "PUT", body: JSON.stringify({ mensajeVecino: texto.trim() }) });
      if (!res.ok) {
        avisar({ titulo: "No se envió el mensaje", mensaje: await mensajeError(res), tipo: "error" });
        return;
      }
      avisar({ titulo: "Mensaje enviado al vecino", mensaje: ticket.codigoTicket, tipo: "ok" });
      onEnviado(await res.json());
      setTexto("");
      onCerrar();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Escribir al vecino por WhatsApp" subtitulo={ticket?.codigoTicket} ancho={540}
      pie={<>
        <button className="btn btn-fantasma" onClick={onCerrar}>Cancelar</button>
        <button className="btn btn-primario" onClick={enviar} disabled={enviando || texto.trim().length < 3}>
          {enviando ? <span className="girador" style={{ width: 12, height: 12 }} /> : <FiSend size={13} />} Enviar mensaje
        </button>
      </>}>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--texto-2)" }}>
        El vecino lo recibe desde el número de la Municipalidad. Si responde en las próximas 48 horas, su respuesta se agrega a este reporte.
      </p>
      <div className="columna" style={{ gap: 4 }}>
        <span className="rotulo">Respuestas frecuentes</span>
        {PLANTILLAS.map(p => (
          <button key={p} className="item-lista" onClick={() => setTexto(p)}
            style={{ padding: "7px 10px 7px 14px", fontSize: 12, ["--color-item" as any]: texto === p ? "var(--acento)" : "var(--borde)", borderColor: texto === p ? "var(--acento)" : undefined }}>
            {p}
          </button>
        ))}
      </div>
      <textarea className="textarea" value={texto} onChange={e => setTexto(e.target.value)} maxLength={800} placeholder="Escribe el mensaje. Usa un lenguaje simple y cordial." />
      <div className="texto-3 mono" style={{ fontSize: 10.5, textAlign: "right", marginTop: -8 }}>{texto.length}/800</div>
    </Modal>
  );
}
