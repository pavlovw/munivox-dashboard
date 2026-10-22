"use client";

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Importa el archivo JSON general de la comuna de Buin
import buinBoundary from '../data/buin-boundary.json';

// Imports mapeados al archivo JSON que realmente contiene sus coordenadas correspondientes
import uvBuinCentro from '../data/unidades-vecinales/unidad-vecinal-3.json'; // uv3 -> Buin Centro
import uvBuinPoniente from '../data/unidades-vecinales/unidad-vecinal-1.json'; // uv1 -> Buin Poniente
import uvBuinNorte from '../data/unidades-vecinales/unidad-vecinal-16.json'; // uv16 -> Buin Norte
import uvBuinOriente from '../data/unidades-vecinales/unidad-vecinal-12.json'; // uv12 -> Buin Oriente
import uvBuinSur from '../data/unidades-vecinales/unidad-vecinal-9.json'; // uv9 -> Buin Sur
import uvNuevoBuin from '../data/unidades-vecinales/unidad-vecinal-19.json'; // uv19 -> Nuevo Buin
import uvMaipo from '../data/unidades-vecinales/unidad-vecinal-5.json'; // uv5 -> Maipo
import uvAltoJahuel from '../data/unidades-vecinales/unidad-vecinal-10.json'; // uv10 -> Alto Jahuel
import uvLinderos from '../data/unidades-vecinales/unidad-vecinal-7.json'; // uv7 -> Linderos
import uvViluco from '../data/unidades-vecinales/unidad-vecinal-17.json'; // uv17 -> Viluco
import uvValdiviaDePaine from '../data/unidades-vecinales/unidad-vecinal-18.json'; // uv18 -> Valdivia de Paine
import uvCervera from '../data/unidades-vecinales/unidad-vecinal-15.json'; // uv15 -> Cervera
import uvLaEstancilla from '../data/unidades-vecinales/unidad-vecinal-14.json'; // uv14 -> La Estancilla
import uvNuevoLinderos from '../data/unidades-vecinales/unidad-vecinal-2.json'; // uv2 -> Nuevo Linderos
import uvFlorDeMaipo from '../data/unidades-vecinales/unidad-vecinal-13.json'; // uv13 -> Flor de Maipo
import uvLosGuindos from '../data/unidades-vecinales/unidad-vecinal-8.json'; // uv8 -> Los Guindos
import uvElRecurso from '../data/unidades-vecinales/unidad-vecinal-11.json'; // uv11 -> El Recurso
import uvRuralNorte from '../data/unidades-vecinales/unidad-vecinal-6.json'; // uv6 -> Rural Norte
import uvElCerrillo from '../data/unidades-vecinales/unidad-vecinal-4.json'; // uv4 -> El Cerrillo

// Lista oficial de las 19 unidades vecinales ordenadas exactamente del 1 al 19
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
  const [uvSeleccionadaId, setUvSeleccionadaId] = useState<string>('TODAS');
  
  const centroBuin: [number, number] = [-33.7312, -70.7415];
  const zoomBuin = 13;

  const uvActual = UNIDADES_VECINALES.find(uv => uv.id === uvSeleccionadaId);

  // 1. Extraer las coordenadas del JSON de Buin para la máscara exterior
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

  const mascaraInvertida = [mundoBounds, buinCoordsLatLon];

  // Estilo para el borde general de Buin
  const estiloBordeBuin = {
    color: '#000000',
    weight: 2,
    fill: false
  };

  // Estilo para la unidad vecinal seleccionada (sombreando en celeste)
  const estiloUVSeleccionada = {
    color: '#0284c7',       // Borde azul oscuro/celeste fuerte
    weight: 3,
    fillColor: '#38bdf8',   // Relleno celeste
    fillOpacity: 0.4        // Sombreado celeste con opacidad
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      
      {/* MENÚ DESPLEGABLE SUPERIOR FLOTANTE PARA SELECCIONAR LA UNIDAD VECINAL */}
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
            <option key={uv.id} value={uv.id}>
              {uv.nombre}
            </option>
          ))}
        </select>
      </div>

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

          {/* MÁSCARA OSCURA EXTERIOR (Todo lo que está fuera de Buin) */}
          <Polygon
            positions={mascaraInvertida as any}
            pathOptions={{
              color: 'transparent',
              fillColor: '#000000',
              fillOpacity: 0.1,
            }}
          />

          {/* LÍMITE GENERAL DE BUIN */}
          <GeoJSON 
            data={buinBoundary as any} 
            style={estiloBordeBuin} 
          />

          {/* UNIDAD VECINAL SELECCIONADA (Sombreado Celeste) */}
          {uvActual && uvActual.data && (
            <GeoJSON 
              key={uvSeleccionadaId}
              data={uvActual.data as any} 
              style={estiloUVSeleccionada} 
            />
          )}

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
        <span style={{ fontSize: '12px', fontWeight: 900, color: '#38bdf8' }}>{uvActual ? uvActual.nombre : 'Comuna de Buin'}</span>
      </div>

    </div>
  );
}