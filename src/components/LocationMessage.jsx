import { memo } from 'react';

// Mapbox API Key
const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWNhc2lsbGFzNzY2IiwiYSI6ImNsdW12cTZyMjB4NnMya213MDdseXp6ZGgifQ.t7-l1lQfd8mgHILM5YrdNw';

const LocationMessage = memo(function LocationMessage({ text }) {
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

  if (!coords) {
    return <div className="text-sm whitespace-pre-wrap">{text}</div>;
  }

  const googleMapsUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lon}`;
  const wazeUrl = `https://waze.com/ul?ll=${coords.lat},${coords.lon}&navigate=yes`;
  
  // URL para imagen estática de Google Maps (más rápida que Mapbox interactivo)
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${coords.lat},${coords.lon}&zoom=15&size=600x300&markers=color:orange%7C${coords.lat},${coords.lon}&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8`;

  return (
    <div className="space-y-2">
      {/* Mapa estático (mucho más rápido que Mapbox) */}
      <a 
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full h-48 rounded-lg overflow-hidden border border-slate-700 relative group cursor-pointer"
      >
        <img 
          src={staticMapUrl}
          alt="Mapa de ubicación"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            🗺️ Abrir en Google Maps
          </span>
        </div>
      </a>
      
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
});

export default LocationMessage;
