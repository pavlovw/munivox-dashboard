"use client";

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Rectangle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Coordenadas aproximadas de los sectores de Buin para los polígonos
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
    color: '#3b82f6', // Azul claro
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
    color: '#f43f5e', // Rosado claro / Fucsia
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
    color: '#10b981', // Verde esmeralda
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
    color: '#f59e0b', // Ámbar / Naranja
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

// Componente auxiliar para mover el mapa cuando cambia la selección
function CambiarVista({ centro, zoom }: { centro: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(centro, zoom, { animate: true });
  }, [centro, zoom, map]);
  return null;
}

export default function MapaBuinZonas() {
  const [sectorSeleccionado, setSectorSeleccionado] = useState<string>('TODOS');
  const sectorActual = SECTORES_BUIN[sectorSeleccionado];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      
      {/* BARRA DE SELECCIÓN DE SECTORES SUPERIOR */}
      <div style={{ backgroundColor: '#ffffff', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', zIndex: 1000 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>GEOLOCALIZACIÓN TÁCTICA C4</h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Seleccione un sector comunal para delimitar el área operativa</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {Object.entries(SECTORES_BUIN).map(([key, data]) => {
            const activo = sectorSeleccionado === key;
            return (
              <button
                key={key}
                onClick={() => setSectorSeleccionado(key)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  border: activo ? `2px solid ${data.color}` : '1px solid #cbd5e1',
                  backgroundColor: activo ? data.color : '#ffffff',
                  color: activo ? '#ffffff' : '#334155',
                  transition: 'all 0.2s ease',
                  boxShadow: activo ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
                }}
              >
                {data.nombre}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENEDOR DEL MAPA */}
      <div style={{ flex: 1, width: '100%', position: 'relative', minHeight: '450px' }}>
        <MapContainer
          center={sectorActual.centro}
          zoom={sectorActual.zoom}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <CambiarVista centro={sectorActual.centro} zoom={sectorActual.zoom} />
          
          {/* Capa base de mapas (Estilo limpio / CartoDB Positron) */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          {/* RENDERIZAR POLÍGONOS DE SECTORES */}
          {Object.entries(SECTORES_BUIN).map(([key, data]) => {
            if (key === 'TODOS') return null; // El mapa general no dibuja polígono global
            
            const esSeleccionado = sectorSeleccionado === key || sectorSeleccionado === 'TODOS';
            if (!esSeleccionado && sectorSeleccionado !== 'TODOS') return null; // Si elige uno, oculta los demás o resalta el activo

            return (
              <Polygon
                key={key}
                positions={data.bounds}
                pathOptions={{
                  color: data.color,
                  fillColor: data.color,
                  fillOpacity: sectorSeleccionado === key ? 0.35 : 0.1, // Rosado claro / color sector
                  weight: sectorSeleccionado === key ? 3 : 1,
                  dashArray: sectorSeleccionado === key ? undefined : '5, 5'
                }}
              />
            );
          })}
        </MapContainer>

        {/* ETIQUETA FLOTANTE INFORMATIVA */}
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: 'white', padding: '10px 16px', borderRadius: '12px', zIndex: 1000, backdropFilter: 'blur(4px)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
          <span style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Zona Activa</span>
          <span style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8' }}>{sectorActual.nombre}</span>
        </div>
      </div>

    </div>
  );
}