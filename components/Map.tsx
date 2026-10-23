"use client";

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Importa el archivo JSON general de la comuna de Buin
import buinBoundary from '../data/buin-boundary.json';

// Imports de unidades vecinales
import uvBuinCentro from '../data/unidades-vecinales/unidad-vecinal-3.json';
import uvBuinPoniente from '../data/unidades-vecinales/unidad-vecinal-1.json';
import uvBuinNorte from '../data/unidades-vecinales/unidad-vecinal-16.json';
import uvBuinOriente from '../data/unidades-vecinales/unidad-vecinal-12.json';
import uvBuinSur from '../data/unidades-vecinales/unidad-vecinal-9.json';
import uvNuevoBuin from '../data/unidades-vecinales/unidad-vecinal-19.json';
import uvMaipo from '../data/unidades-vecinales/unidad-vecinal-5.json';
import uvAltoJahuel from '../data/unidades-vecinales/unidad-vecinal-10.json';
import uvLinderos from '../data/unidades-vecinales/unidad-vecinal-7.json';
import uvViluco from '../data/unidades-vecinales/unidad-vecinal-17.json';
import uvValdiviaDePaine from '../data/unidades-vecinales/unidad-vecinal-18.json';
import uvCervera from '../data/unidades-vecinales/unidad-vecinal-15.json';
import uvLaEstancilla from '../data/unidades-vecinales/unidad-vecinal-14.json';
import uvNuevoLinderos from '../data/unidades-vecinales/unidad-vecinal-2.json';
import uvFlorDeMaipo from '../data/unidades-vecinales/unidad-vecinal-13.json';
import uvLosGuindos from '../data/unidades-vecinales/unidad-vecinal-8.json';
import uvElRecurso from '../data/unidades-vecinales/unidad-vecinal-11.json';
import uvRuralNorte from '../data/unidades-vecinales/unidad-vecinal-6.json';
import uvElCerrillo from '../data/unidades-vecinales/unidad-vecinal-4.json';

const UNIDADES_VECINALES = [
  { id: 'TODAS', nombre: 'Ver toda la comuna', data: null },
  { id: '1', nombre: '1. BUIN CENTRO', data: uvBuinCentro },
  { id: '2', nombre: '2. BUIN PONIENTE', data: uvBuinPoniente },
  { id: '3', nombre: '3. BUIN NORTE', data: uvBuinNorte },
  { id: '4', nombre: '4. BUIN ORIENTE', data: uvBuinOriente },
  { id: '5', nombre: '5. BUIN SUR', data: uvBuinSur },
  { id: '6', nombre: '6. NUEVO BUIN', data: uvNuevoBuin },
  { id: '7', nombre: '7. MAIPO', data: uvMaipo },
  { id: '8', nombre: '8. ALTO JAHUEL', data: uvAltoJahuel },
  { id: '9', nombre: '9. LINDEROS', data: uvLinderos },
  { id: '10', nombre: '10. VILUCO', data: uvViluco },
  { id: '11', nombre: '11. VALDIVIA DE PAINE', data: uvValdiviaDePaine },
  { id: '12', nombre: '12. CERVERA', data: uvCervera },
  { id: '13', nombre: '13. LA ESTANCILLA', data: uvLaEstancilla },
  { id: '14', nombre: '14. NUEVO LINDEROS', data: uvNuevoLinderos },
  { id: '15', nombre: '15. FLOR DE MAIPO', data: uvFlorDeMaipo },
  { id: '16', nombre: '16. LOS GUINDOS', data: uvLosGuindos },
  { id: '17', nombre: '17. EL RECURSO', data: uvElRecurso },
  { id: '18', nombre: '18. RURAL NORTE', data: uvRuralNorte },
  { id: '19', nombre: '19. EL CERRILLO', data: uvElCerrillo },
];

const iconoCustom = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

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
  // ESTADOS DEL MAPA
  const [uvSeleccionadaId, setUvSeleccionadaId] = useState<string>('TODAS');
  
  // ESTADO DE LA CAPA (Solo límites rayados)
  const [mostrarBordesUV, setMostrarBordesUV] = useState<boolean>(false);
  
  const centroBuin: [number, number] = [-33.7312, -70.7415];
  const zoomBuin = 13;

  const uvActual = UNIDADES_VECINALES.find(uv => uv.id === uvSeleccionadaId);

  const buinCoordsLatLon = (buinBoundary.geometry.coordinates[0] as [number, number][]).map(
    (coord) => [coord[1], coord[0]] as [number, number]
  );
  const mundoBounds: [number, number][] = [ [-90, -180], [-90, 180], [90, 180], [90, -180] ];
  const mascaraInvertida = [mundoBounds, buinCoordsLatLon];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>

      {/* MENÚ DESPLEGABLE SUPERIOR FLOTANTE */}
      <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '8px 12px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label htmlFor="select-uv" style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>
          Unidad Vecinal:
        </label>
        <select
          id="select-uv"
          value={uvSeleccionadaId}
          onChange={(e) => setUvSeleccionadaId(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600, backgroundColor: '#ffffff', color: '#0f172a', cursor: 'pointer', outline: 'none' }}
        >
          {UNIDADES_VECINALES.map((uv) => (
            <option key={uv.id} value={uv.id}>{uv.nombre}</option>
          ))}
        </select>
      </div>

      {/* PANEL FLOTANTE DE CAPAS (Solo Límites Vecinales) */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 1000, backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>CAPAS DEL MAPA</span>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
          <input type="checkbox" checked={mostrarBordesUV} onChange={(e) => setMostrarBordesUV(e.target.checked)} style={{ cursor: 'pointer' }} />
          Límites vecinales (Rayados)
        </label>
      </div>

      {/* CONTENEDOR LEAFLET */}
      <div style={{ flex: 1, width: '100%', height: '100%' }}>
        <MapContainer center={centroBuin} zoom={zoomBuin} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <ControladorVista centro={centroBuin} zoom={zoomBuin} />

          {/* Mapa base de OpenStreetMap 100% gratuito */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Polygon
            positions={mascaraInvertida as any}
            pathOptions={{ color: 'transparent', fillColor: '#000000', fillOpacity: 0.1 }}
          />

          <GeoJSON data={buinBoundary as any} style={{ color: '#000000', weight: 2, fill: false }} />

          {/* CAPA DINÁMICA: TODOS LOS LÍMITES DE LAS UNIDADES VECINALES */}
          {mostrarBordesUV && UNIDADES_VECINALES.filter(uv => uv.id !== 'TODAS' && uv.data).map((uv) => (
            <GeoJSON 
              key={`capa-bordes-${uv.id}`}
              data={uv.data as any} 
              style={{
                color: '#000000',
                weight: 1, // Más delgado (antes era 2)
                dashArray: '4, 4', // Rayas proporcionales al nuevo grosor
                fill: false
              }}
            />
          ))}

          {/* UNIDAD VECINAL SELECCIONADA (Sombreado Celeste) */}
          {uvActual && uvActual.data && (
            <GeoJSON 
              key={`uv-seleccionada-${uvSeleccionadaId}`}
              data={uvActual.data as any} 
              style={{ color: '#0284c7', weight: 3, fillColor: '#38bdf8', fillOpacity: 0.1 }} 
            />
          )}

          {/* MARCADORES DE TICKETS REALES */}
          {tickets.map((t) => {
            if (!t.latitud || !t.longitud) return null;
            return (
              <Marker key={t.id} position={[t.latitud, t.longitud]} icon={iconoCustom}>
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

      {/* ETIQUETA INFERIOR */}
      <div style={{ position: 'absolute', bottom: '16px', left: '16px', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: 'white', padding: '8px 14px', borderRadius: '10px', zIndex: 1000, backdropFilter: 'blur(4px)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
        <span style={{ display: 'block', fontSize: '8px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Zona Operativa C4</span>
        <span style={{ fontSize: '12px', fontWeight: 900, color: '#38bdf8' }}>{uvActual ? uvActual.nombre : 'Comuna de Buin'}</span>
      </div>

    </div>
  );
}