"use client";

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Esto repara las rutas de los iconos por defecto de Leaflet en Next.js usando TypeScript
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Controlador de Vuelo: Hace el efecto zoom animado al pinchar un ticket en la lista
function MapUpdater({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 18, { animate: true, duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

// Iconos geométricos institucionales
const iconoPendiente = L.divIcon({ className: 'marcador-emergencia', html: '<div class="marcador-punto"></div>', iconSize: [28, 28], iconAnchor: [14, 14] });
const iconoFantasma = L.divIcon({ className: 'marcador-fantasma', html: '<div class="marcador-fantasma-punto"></div>', iconSize: [10, 10], iconAnchor: [5, 5] });
const iconoOperacion = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

interface MapProps {
  tickets: any[];
  fantasmas: any[];
  coordenadaSeleccionada: [number, number] | null;
  onTicketSelect: (id: string) => void;
}

export default function Map({ tickets, fantasmas, coordenadaSeleccionada, onTicketSelect }: MapProps) {
  useEffect(() => { delete (L.Icon.Default.prototype as any)._getIconUrl; }, []);

  const centroBuin: [number, number] = [-33.732, -70.742];

  return (
    <MapContainer center={centroBuin} zoom={14} style={{ height: '100%', width: '100%' }}>
      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      
      <MapUpdater center={coordenadaSeleccionada} />

      <Marker position={centroBuin}>
        <Popup><strong className="text-slate-800">C4 - MUNICIPALIDAD DE BUIN</strong></Popup>
      </Marker>

      {/* DIBUJAR INCIDENTES ACTIVOS (Los que ves en la lista) */}
      {tickets.map(ticket => {
        if (!ticket.latitud || !ticket.longitud) return null;
        const esPendiente = ticket.estado === 'PENDIENTE';
        
        return (
          <Marker 
            key={ticket.id} 
            position={[ticket.latitud, ticket.longitud]} 
            icon={esPendiente ? iconoPendiente : iconoOperacion}
            eventHandlers={{ click: () => onTicketSelect(ticket.id) }}
          >
            <Popup>
              <strong className={esPendiente ? "text-red-700" : "text-blue-700"}>{ticket.codigoTicket}</strong><br/>
              <span className="text-[10px] uppercase font-bold text-gray-500">{ticket.estado.replace('_', ' ')}</span>
            </Popup>
          </Marker>
        );
      })}

      {/* DIBUJAR FANTASMAS (Casos resueltos cercanos cuando haces clic en un reporte) */}
      {fantasmas.map(fantasma => {
        if (!fantasma.latitud || !fantasma.longitud) return null;
        return (
          <Marker 
            key={fantasma.id} 
            position={[fantasma.latitud, fantasma.longitud]} 
            icon={iconoFantasma}
            eventHandlers={{ click: () => onTicketSelect(fantasma.id) }}
          >
            <Popup>
              <strong className="text-slate-500">{fantasma.codigoTicket}</strong><br/>
              <span className="text-[10px] uppercase font-bold text-slate-400">RESUELTO (Contexto Histórico)</span>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
