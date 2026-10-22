"use client";

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Importa el archivo JSON con las coordenadas de Buin
import buinBoundary from '../data/buin-boundary.json';

// Configuración de iconos personalizados para Leaflet en Next.js
const iconoCustom = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

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
  const centroBuin: [number, number] = [-33.7312, -70.7415];
  const zoomBuin = 13;

  // 1. Extraer las coordenadas del JSON de Buin y transformarlas de [lng, lat] a [lat, lng] para Leaflet
  const buinCoordsLatLon = (buinBoundary.geometry.coordinates[0] as [number, number][]).map(
    (coord) => [coord[1], coord[0]] as [number, number]
  );

  // 2. Definir un rectángulo gigante que cubra todo el mundo/región exterior
  const mundoBounds: [number, number][] = [
    [-90, -180],
    [-90, 180],
    [90, 180],
    [90, -180]
  ];

  // 3. Crear la máscara invertida: El primer anillo es el mundo exterior, el segundo anillo (hueco) es Buin
  const mascaraInvertida = [mundoBounds, buinCoordsLatLon];

  // Estilo para el borde de Buin (interior completamente transparente)
  const estiloBordeBuin = {
    color: '#000000',       // Borde negro sólido
    weight: 3,              // Grosor del borde
    fill: false             // Interior transparente (sin relleno de color)
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      
      {/* CONTENEDOR LEAFLET */}
      <div style={{ flex: 1, width: '100%', height: '100%' }}>
        <MapContainer
          center={centroBuin}
          zoom={zoomBuin}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <ControladorVista centro={centroBuin} zoom={zoomBuin} />

          {/* Teselas oficiales de OpenStreetMap */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* MÁSCARA OSCURA EXTERIOR (Todo lo que está fuera de Buin con sombra 0.4) */}
          <Polygon
            positions={mascaraInvertida as any}
            pathOptions={{
              color: 'transparent', // Sin borde en el rectángulo exterior global
              fillColor: '#000000', // Color negro para la sombra
              fillOpacity: 0.2,     // Opacidad del 40% pedida
            }}
          />

          {/* LÍMITE COMUNAL DE BUIN (Borde negro limpio, interior transparente) */}
          <GeoJSON 
            data={buinBoundary as any} 
            style={estiloBordeBuin} 
          />

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
        <span style={{ fontSize: '12px', fontWeight: 900, color: '#38bdf8' }}>Comuna de Buin</span>
      </div>

    </div>
  );
}