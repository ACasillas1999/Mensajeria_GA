import { useEffect, useRef } from 'react';

// Mapbox API Key
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWNhc2lsbGFzNzY2IiwiYSI6ImNsdW12cTZyMjB4NnMya213MDdseXp6ZGgifQ.t7-l1lQfd8mgHILM5YrdNw';

export default function LocationMessage({ text }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Extraer coordenadas del texto
  const extractCoordinates = (txt) => {
    const patterns = [
      /\[Ubicación\s+([-\d.]+),\s*([-\d.]+)\]/i,
      /ubicación:\s*([-\d.]+),\s*([-\d.]+)/i,
      /([-\d.]+),\s*([-\d.]+)/
    ];

    for (const pattern of patterns) {
      const match = txt.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lon = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          return { lat, lon };
        }
      }
    }
    return null;
  };

  const coords = extractCoordinates(text);

  useEffect(() => {
    if (!coords || !mapContainerRef.current) return;

    const loadMapbox = async () => {
      // Cargar Mapbox GL JS dinámicamente
      if (!window.mapboxgl) {
        // Cargar CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
        document.head.appendChild(link);

        // Cargar JS
        const script = document.createElement('script');
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
        await new Promise((resolve) => {
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      // Esperar a que mapboxgl esté disponible
      while (!window.mapboxgl) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      // Limpiar mapa anterior si existe
      if (mapRef.current) {
        mapRef.current.remove();
      }

      // Crear mapa
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [coords.lon, coords.lat],
        zoom: 15,
        scrollZoom: false,
        dragPan: true,
        dragRotate: false,
        touchZoomRotate: false
      });

      // Agregar marcador
      new mapboxgl.Marker({ color: '#ed6b1f' })
        .setLngLat([coords.lon, coords.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<div style="padding: 4px; font-size: 12px;">📍 ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}</div>`)
        )
        .addTo(map);

      // Agregar controles de navegación
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      mapRef.current = map;
    };

    loadMapbox();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [coords]);

  if (!coords) {
    return <div className="text-sm whitespace-pre-wrap">{text}</div>;
  }

  const googleMapsUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lon}`;
  const wazeUrl = `https://waze.com/ul?ll=${coords.lat},${coords.lon}&navigate=yes`;

  return (
    <div className="space-y-2">
      {/* Mapa */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-48 rounded-lg overflow-hidden border border-slate-700"
        style={{ minHeight: '192px' }}
      />
      
      {/* Información y botones */}
      <div className="flex flex-col gap-2">
        <div className="text-xs text-slate-400">
          📍 {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}
        </div>
        
        <div className="flex gap-2">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2 text-xs rounded-lg bg-blue-600/20 border border-blue-700 text-blue-300 hover:bg-blue-600/30 transition text-center font-medium"
          >
            🗺️ Abrir en Google Maps
          </a>
          <a
            href={wazeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 px-3 py-2 text-xs rounded-lg bg-purple-600/20 border border-purple-700 text-purple-300 hover:bg-purple-600/30 transition text-center font-medium"
          >
            🚗 Abrir en Waze
          </a>
        </div>
      </div>
    </div>
  );
}
