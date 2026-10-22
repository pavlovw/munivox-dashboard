"use client";

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Configuración de iconos personalizados para Leaflet en Next.js
const iconoCustom = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Coordenadas y límites más precisos para los sectores de Buin
const SECTORES_BUIN: Record<string, { nombre: string; color: string; bounds: [number, number][]; centro: [number, number]; zoom: number }> = {
  TODOS: {
    nombre: 'Toda la Comuna de Buin',
    color: '#0284c7',
    bounds: [
      [-33.6800, -70.8200],
      [-33.6800, -70.6800],
      [-33.7800, -70.6800],
      [-33.7800, -70.8200]
    ],
    centro: [-33.7312, -70.7415],
    zoom: 13
  },
  CENTRO: {
    nombre: 'Buin Centro',
    color: '#3b82f6',
    bounds: [
      [-33.7150, -70.7500],
      [-33.7150, -70.7300],
      [-33.7450, -70.7300],
      [-33.7450, -70.7500]
    ],
    centro: [-33.7300, -70.7400],
    zoom: 15
  },
  LINDEROS: {
    nombre: 'Linderos',
    color: '#f43f5e', // Rosado claro / fucsia como pediste
    bounds: [
      [-33.7450, -70.7600],
      [-33.7450, -70.7350],
      [-33.7700, -70.7350],
      [-33.7700, -70.7600]
    ],
    centro: [-33.7570, -70.7480],
    zoom: 14
  },
  ALTO_JAHUEL: {
    nombre: 'Alto Jahuel',
    color: '#10b981',
    bounds: [
      [-33.6900, -70.7200],
      [-33.6900, -70.6900],
      [-33.7200, -70.6900],
      [-33.7200, -70.7200]
    ],
    centro: [-33.7050, -70.7050],
    zoom: 14
  },
  MAIPO: {
    nombre: 'Maipo',
    color: '#f59e0b',
    bounds: [
      [-33.7200, -70.7300],
      [-33.7200, -70.7000],
      [-33.7500, -70.7000],
      [-33.7500, -70.7300]
    ],
    centro: [-33.7350, -70.7150],
    zoom: 14
  }
};

// Componente auxiliar para recentrar el mapa dinámicamente
function ControladorVista({ centro, zoom }: { centro: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(centro, zoom, { animate: true });
  }, [centro, zoom, map]);
  return null;
}

interface MapProps {
  tickets: any[];
  fantasmas?: any[];
  coordenadaSeleccionada?: [number, number] | null;
  onTicketSelect: (id: string) => void;
}

export default function Map({ tickets, fantasmas = [], coordenadaSeleccionada, onTicketSelect }: MapProps) {
  const [sectorSeleccionado, setSectorSeleccionado] = useState<string>('TODOS');
  const sectorActual = SECTORES_BUIN[sectorSeleccionado];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      
      {/* BARRA DE SECTORES SUPERIOR FLOTANTE SOBRE EL MAPA */}
      <div style={{ position: 'absolute', top: '12px', left: '12px', right: '12px', zIndex: 1000, display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {Object.entries(SECTORES_BUIN).map(([key, data]) => {
          const activo = sectorSeleccionado === key;
          return (
            <button
              key={key}
              onClick={() => setSectorSeleccionado(key)}
              style={{
                padding: '6px 14px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                border: activo ? `2px solid ${data.color}` : '1px solid #cbd5e1',
                backgroundColor: activo ? data.color : 'rgba(255, 255, 255, 0.95)',
                color: activo ? '#ffffff' : '#334155',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                transition: 'all 0.2s ease'
              }}
            >
              {data.nombre}
            </button>
          );
        })}
      </div>

      {/* CONTENEDOR LEAFLET */}
      <div style={{ flex: 1, width: '100%', height: '100%' }}>
        <MapContainer
          center={sectorActual.centro}
          zoom={sectorActual.zoom}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <ControladorVista centro={sectorActual.centro} zoom={sectorActual.zoom} />

          {/* Teselas oficiales de OpenStreetMap (Libres de API Key y marcas de agua) */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* POLÍGONOS DE LOS SECTORES DE BUIN */}
          {Object.entries(SECTORES_BUIN).map(([key, data]) => {
            if (key === 'TODOS') return null;
            const esActivo = sectorSeleccionado === key;
            if (sectorSeleccionado !== 'TODOS' && !esActivo) return null;

            return (
              <Polygon
                key={key}
                positions={data.bounds}
                pathOptions={{
                  color: data.color,
                  fillColor: data.color,
                  fillOpacity: esActivo ? 0.3 : 0.08,
                  weight: esActivo ? 3 : 1,
                  dashArray: esActivo ? undefined : '4, 4'
                }}
              />
            );
          })}

          {/* MARCADORES DE TICKETS REALES */}
          {tickets.map((t) => {
            if (!t.latitud || !t.longitud) return null;
            return (
              <Marker 
                key={t.id} 
                position={[t.latitud, t.longitud]} 
                icon={iconoCustom}
              >
                <Popup>
                  <div style={{ minWidth: '160px', fontFamily: 'sans-serif' }}>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#0284c7' }}>{t.codigoTicket}</span>
                    <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '4px 0' }}>{t.categoria?.nombre || 'Incidencia'}</p>
                    <button 
                      onClick={() => onTicketSelect(t.id)}
                      style={{ width: '100%', backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '6px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Ver Expediente
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* ETIQUETA INFERIOR DE ZONA ACTIVA */}
      <div style={{ position: 'absolute', bottom: '16px', left: '16px', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: 'white', padding: '8px 14px', borderRadius: '10px', zIndex: 1000, backdropFilter: 'blur(4px)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
        <span style={{ display: 'block', fontSize: '8px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Zona Operativa C4</span>
        <span style={{ fontSize: '12px', fontWeight: 900, color: '#38bdf8' }}>{sectorActual.nombre}</span>
      </div>

    </div>
  );
}