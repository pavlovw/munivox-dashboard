"use client";

import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

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

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoicGF2bG92dyIsImEiOiJjbXhxOTllZ2EwMGdyMmtvNHZ0ejRhZHFqIn0.example_replace_this_token';

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

interface MapProps {
  tickets: any[];
  fantasmas?: any[];
  coordenadaSeleccionada?: [number, number] | null;
  onTicketSelect: (id: string) => void;
}

export default function Map({ tickets, fantasmas = [], coordenadaSeleccionada, onTicketSelect }: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [uvSeleccionadaId, setUvSeleccionadaId] = useState<string>('TODAS');
  const [mostrarBordesUV, setMostrarBordesUV] = useState<boolean>(false);
  const [esModo3D, setEsModo3D] = useState<boolean>(false);

  const uvActual = UNIDADES_VECINALES.find(uv => uv.id === uvSeleccionadaId);

  // Inicialización de Mapbox GL
  useEffect(() => {
    if (!mapContainerRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-70.7415, -33.7312], 
      zoom: 13,
      pitch: 0,
      bearing: 0,
    });

    mapRef.current = map;

    map.on('load', () => {
      const layers = map.getStyle().layers;
      const labelLayerId = layers?.find(layer => layer.type === 'symbol' && layer.layout?.['text-field'])?.id;

      map.addLayer(
        {
          id: 'edificios-3d',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#38bdf8',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.7,
          },
        },
        labelLayerId
      );

      map.addSource('buin-boundary-src', { type: 'geojson', data: buinBoundary as any });
      map.addLayer({
        id: 'buin-boundary-line',
        type: 'line',
        source: 'buin-boundary-src',
        paint: { 'line-color': '#000000', 'line-width': 2 },
      });

      map.addSource('uv-seleccionada-src', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'uv-seleccionada-fill',
        type: 'fill',
        source: 'uv-seleccionada-src',
        paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.25 },
      });
      map.addLayer({
        id: 'uv-seleccionada-line',
        type: 'line',
        source: 'uv-seleccionada-src',
        paint: { 'line-color': '#0284c7', 'line-width': 2 },
      });

      UNIDADES_VECINALES.forEach((uv) => {
        if (uv.id !== 'TODAS' && uv.data) {
          map.addSource(`uv-borde-${uv.id}-src`, { type: 'geojson', data: uv.data as any });
          map.addLayer({
            id: `uv-borde-${uv.id}-line`,
            type: 'line',
            source: `uv-borde-${uv.id}-src`,
            layout: { visibility: 'none' },
            paint: { 'line-color': '#000000', 'line-width': 1, 'line-dasharray': [4, 4] },
          });
        }
      });
    });

    return () => map.remove();
  }, []);

  // Actualizar UV Seleccionada en el Mapa
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('uv-seleccionada-src') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(uvActual && uvActual.data ? (uvActual.data as any) : { type: 'FeatureCollection', features: [] });
    }
  }, [uvSeleccionadaId, uvActual]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    UNIDADES_VECINALES.forEach((uv) => {
      if (uv.id !== 'TODAS' && uv.data) {
        const layerId = `uv-borde-${uv.id}-line`;
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', mostrarBordesUV ? 'visible' : 'none');
        }
      }
    });
  }, [mostrarBordesUV]);

  // ==========================================
  // INYECCIÓN DE MARCADORES (INCLUYENDO GIFS)
  // ==========================================
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers: mapboxgl.Marker[] = [];

    tickets.forEach((t) => {
      if (!t.latitud || !t.longitud) return;

      const popupNode = document.createElement('div');
      popupNode.style.fontFamily = 'sans-serif';
      popupNode.style.minWidth = '140px';
      popupNode.innerHTML = `
        <span style="font-size: 10px; font-weight: 900; color: #0284c7;">${t.codigoTicket}</span>
        <p style="font-size: 12px; font-weight: bold; margin: 4px 0;">${t.categoria?.nombre || 'Incidencia'}</p>
        <button id="btn-ticket-${t.id}" style="width: 100%; background-color: #2563eb; color: white; border: none; padding: 6px; border-radius: 6px; font-weight: bold; font-size: 11px; cursor: pointer;">
          Ver Expediente
        </button>
      `;
      popupNode.querySelector(`#btn-ticket-${t.id}`)?.addEventListener('click', () => onTicketSelect(t.id));
      const popup = new mapboxgl.Popup({ offset: 25 }).setDOMContent(popupNode);

      // Verificamos si es categoría 1 (Auto abandonado)
      const esAuto = t.categoria?.id === 1 || t.categoria?.nombre?.includes('Vehículo');
      let marker: mapboxgl.Marker;

      if (esAuto) {
        // Crear elemento DOM personalizado para nuestro Sprite 2.5D
        const customMarkerDiv = document.createElement('div');
        customMarkerDiv.className = 'marcador-25d auto-abandonado';

        marker = new mapboxgl.Marker({ element: customMarkerDiv })
          .setLngLat([t.longitud, t.latitud])
          .setPopup(popup)
          .addTo(map);

        // Cuando el usuario hace clic (abre el popup), mantenemos la animación
        popup.on('open', () => customMarkerDiv.classList.add('activo'));
        popup.on('close', () => customMarkerDiv.classList.remove('activo'));

      } else {
        // Marcador por defecto para el resto de categorías (Pin azul)
        marker = new mapboxgl.Marker({ color: '#2563eb' })
          .setLngLat([t.longitud, t.latitud])
          .setPopup(popup)
          .addTo(map);
      }

      markers.push(marker);
    });

    // LÓGICA DE PROXIMIDAD: Reproducir todos los GIFs si hacemos mucho zoom (Zoom > 16)
    const revisarZoom = () => {
      const currentZoom = map.getZoom();
      const tokensAnimados = document.querySelectorAll('.marcador-25d');
      if (currentZoom >= 16.5) {
        tokensAnimados.forEach(token => token.classList.add('zoom-cercano'));
      } else {
        tokensAnimados.forEach(token => token.classList.remove('zoom-cercano'));
      }
    };

    map.on('zoom', revisarZoom);
    revisarZoom(); // Ejecutar 1 vez al cargar para verificar zoom inicial

    return () => {
      markers.forEach((m) => m.remove());
      map.off('zoom', revisarZoom);
    };
  }, [tickets, onTicketSelect]);

  const alternarVista = () => {
    const map = mapRef.current;
    if (!map) return;
    if (esModo3D) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      setEsModo3D(false);
    } else {
      map.easeTo({ pitch: 60, bearing: -15, duration: 1000 });
      setEsModo3D(true);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>

      {/* ESTILOS CSS INYECTADOS PARA LOS MARCADORES 2.5D */}
      <style>{`
        .marcador-25d {
          width: 55px;
          height: 55px;
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          cursor: pointer;
          /* Transición suave de elevación 2.5D */
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); 
          /* Sombra en el suelo del mapa */
          filter: drop-shadow(0px 8px 4px rgba(0,0,0,0.3)); 
          z-index: 1;
        }

        /* ESTADO POR DEFECTO: CONGELADO (Usa la imagen PNG estática) */
        .marcador-25d.auto-abandonado {
          background-image: url('/marcadores/auto-estatico.png');
        }

        /* ESTADO 1: HOVER (Pasar el mouse) -> Cambia a GIF y se eleva */
        .marcador-25d.auto-abandonado:hover {
          background-image: url('/marcadores/ezgif-maker.gif');
          transform: translateY(-8px) scale(1.1);
          filter: drop-shadow(0px 16px 8px rgba(0,0,0,0.3));
          z-index: 10;
        }

        /* ESTADO 2: SELECCIONADO (Clic/Popup abierto) -> Cambia a GIF, se eleva más y brilla */
        .marcador-25d.auto-abandonado.activo {
          background-image: url('/marcadores/ezgif-maker.gif');
          transform: translateY(-10px) scale(1.2);
          filter: drop-shadow(0px 20px 10px rgba(0,0,0,0.2)) drop-shadow(0 0 12px rgba(56, 189, 248, 0.8));
          z-index: 20;
        }

        /* ESTADO 3: ZOOM PROFUNDO -> Reproduce los GIFs automáticamente */
        .marcador-25d.auto-abandonado.zoom-cercano {
          background-image: url('/marcadores/ezgif-maker.gif');
        }
      `}</style>

      {/* MENÚ DESPLEGABLE SUPERIOR FLOTANTE */}
      <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '8px 12px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label htmlFor="select-uv" style={{ fontSize: '12px', fontWeight: 800, color: '#1e293b' }}>Unidad Vecinal:</label>
        <select id="select-uv" value={uvSeleccionadaId} onChange={(e) => setUvSeleccionadaId(e.target.value)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600, backgroundColor: '#ffffff', color: '#0f172a', cursor: 'pointer', outline: 'none' }}>
          {UNIDADES_VECINALES.map((uv) => (
            <option key={uv.id} value={uv.id}>{uv.nombre}</option>
          ))}
        </select>
      </div>

      {/* PANEL FLOTANTE DE CAPAS Y MODO 2D/3D */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '12px 16px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 900, color: '#0f172a' }}>CAPAS DEL MAPA</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
          <input type="checkbox" checked={mostrarBordesUV} onChange={(e) => setMostrarBordesUV(e.target.checked)} style={{ cursor: 'pointer' }} />
          Límites vecinales (Rayados)
        </label>
        <button onClick={alternarVista} style={{ width: '100%', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', marginTop: '2px' }}>
          {esModo3D ? 'Cambiar a Vista 2D' : 'Cambiar a Vista 3D'}
        </button>
      </div>

      <div ref={mapContainerRef} style={{ flex: 1, width: '100%', height: '100%' }} />

      <div style={{ position: 'absolute', bottom: '16px', left: '16px', backgroundColor: 'rgba(15, 23, 42, 0.9)', color: 'white', padding: '8px 14px', borderRadius: '10px', zIndex: 10, backdropFilter: 'blur(4px)', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
        <span style={{ display: 'block', fontSize: '8px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Zona Operativa C4</span>
        <span style={{ fontSize: '12px', fontWeight: 900, color: '#38bdf8' }}>{uvActual ? uvActual.nombre : 'Comuna de Buin'}</span>
      </div>
    </div>
  );
}