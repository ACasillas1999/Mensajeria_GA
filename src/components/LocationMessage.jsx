import { useEffect, useRef } from 'react';

export default function LocationMessage({ text }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Extraer coordenadas del texto
  // Formato esperado: [Ubicación LAT,LON] o variaciones
  const extractCoordinates = (txt) => {
    // Patrón para detectar coordenadas
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
        // Validar que sean coordenadas válidas
        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
          return { lat, lon };
        }
      }
    }
    return null;
  };

  const coords = extractCoordinates(text);

  useEffect(() => {
    if (!coords || !mapRef.current) return;

    // Cargar Leaflet dinámicamente
    const loadLeaflet = async () => {
      // Importar CSS de Leaflet
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Importar Leaflet
      const L = (await import('leaflet')).default;

      // Fix para los iconos de Leaflet
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Limpiar mapa anterior si existe
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Crear mapa
      const map = L.map(mapRef.current, {
        center: [coords.lat, coords.lon],
        zoom: 15,
        scrollWheelZoom: false,
      });

      // Agregar capa de OpenStreetMap
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Agregar marcador
      L.marker([coords.lat, coords.lon])
        .addTo(map)
        .bindPopup(`📍 ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`)
        .openPopup();

      mapInstanceRef.current = map;
    };

    loadLeaflet();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [coords]);

  if (!coords) {
    // Si no se pueden extraer coordenadas, mostrar texto original
    return <div className="text-sm whitespace-pre-wrap">{text}</div>;
  }

  const googleMapsUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lon}`;
  const wazeUrl = `https://waze.com/ul?ll=${coords.lat},${coords.lon}&navigate=yes`;

  return (
    <div className="space-y-2">
      {/* Mapa */}
      <div 
        ref={mapRef} 
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
