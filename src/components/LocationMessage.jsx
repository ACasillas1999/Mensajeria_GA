import { memo } from 'react';

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

  return (
    <div className="space-y-2">
      {/* Información de ubicación */}
      <div className="flex items-start gap-2 p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
        <div className="text-2xl">📍</div>
        <div className="flex-1">
          <div className="text-sm font-medium text-slate-200 mb-1">Ubicación compartida</div>
          <div className="text-xs text-slate-400">
            {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}
          </div>
        </div>
      </div>

      {/* Botones de navegación */}
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
  );
});

export default LocationMessage;
