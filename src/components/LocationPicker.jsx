import { useState, useEffect, useRef } from 'react';

export default function LocationPicker({ onSend, onClose }) {
  const [mode, setMode] = useState('current'); // 'current', 'search', 'map'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Buscar ubicación por dirección usando Nominatim (OpenStreetMap)
  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      alert('Error al buscar ubicación: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Enviar ubicación actual
  const sendCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización");
      return;
    }

    setLoading(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      onSend(latitude, longitude);
      onClose();
    } catch (error) {
      if (error.code === 1) {
        alert("Permiso de ubicación denegado");
      } else if (error.code === 2) {
        alert("No se pudo obtener tu ubicación");
      } else if (error.code === 3) {
        alert("Tiempo de espera agotado");
      } else {
        alert("Error: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Inicializar mapa para selección manual
  useEffect(() => {
    if (mode !== 'map' || !mapRef.current) return;

    const loadMap = async () => {
      // Cargar Mapbox GL JS si no está disponible
      if (!window.mapboxgl) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
        await new Promise((resolve) => {
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }

      while (!window.mapboxgl) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = 'pk.eyJ1IjoiYWNhc2lsbGFzNzY2IiwiYSI6ImNsdW12cTZyMjB4NnMya213MDdseXp6ZGgifQ.t7-l1lQfd8mgHILM5YrdNw';

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Centro en Guadalajara por defecto
      const map = new mapboxgl.Map({
        container: mapRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-103.3496, 20.6597],
        zoom: 12
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      let marker = null;

      map.on('click', (e) => {
        const { lat, lng } = e.lngLat;
        
        if (marker) {
          marker.setLngLat([lng, lat]);
        } else {
          marker = new mapboxgl.Marker({ color: '#ed6b1f', draggable: true })
            .setLngLat([lng, lat])
            .addTo(map);
          
          marker.on('dragend', () => {
            const lngLat = marker.getLngLat();
            setSelectedLocation({ lat: lngLat.lat, lng: lngLat.lng });
          });
        }
        
        setSelectedLocation({ lat, lng });
      });

      mapInstanceRef.current = map;
    };

    loadMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mode]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">📍 Enviar Ubicación</h3>
          <button onClick={onClose} className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm">✕</button>
        </div>

        <div className="p-4">
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMode('current')}
              className={`flex-1 px-4 py-2 rounded-lg transition ${
                mode === 'current'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-700 dark:text-slate-300'
              }`}
            >
              📍 Mi Ubicación
            </button>
            <button
              onClick={() => setMode('search')}
              className={`flex-1 px-4 py-2 rounded-lg transition ${
                mode === 'search'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-700 dark:text-slate-300'
              }`}
            >
              🔍 Buscar Dirección
            </button>
            <button
              onClick={() => setMode('map')}
              className={`flex-1 px-4 py-2 rounded-lg transition ${
                mode === 'map'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-700 dark:text-slate-300'
              }`}
            >
              🗺️ Seleccionar en Mapa
            </button>
          </div>

          {/* Contenido según modo */}
          {mode === 'current' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">📍</div>
              <p className="text-slate-700 dark:text-slate-300 mb-6">Envía tu ubicación actual usando el GPS de tu dispositivo</p>
              <button
                onClick={sendCurrentLocation}
                disabled={loading}
                className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
              >
                {loading ? 'Obteniendo ubicación...' : 'Enviar Mi Ubicación Actual'}
              </button>
            </div>
          )}

          {mode === 'search' && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
                  placeholder="Buscar dirección, ciudad, lugar..."
                  className="flex-1 px-4 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-400"
                />
                <button
                  onClick={searchLocation}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                >
                  {loading ? '...' : 'Buscar'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.map((result, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        onSend(parseFloat(result.lat), parseFloat(result.lon));
                        onClose();
                      }}
                      className="w-full text-left px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-300 dark:border-slate-700 transition"
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-200">{result.display_name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {parseFloat(result.lat).toFixed(6)}, {parseFloat(result.lon).toFixed(6)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'map' && (
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Haz clic en el mapa para seleccionar una ubicación</p>
              <div 
                ref={mapRef} 
                className="w-full h-96 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 mb-4"
              />
              {selectedLocation && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                  <div className="text-sm">
                    <div className="text-slate-600 dark:text-slate-400">Ubicación seleccionada:</div>
                    <div className="text-slate-900 dark:text-slate-200 font-mono">
                      {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onSend(selectedLocation.lat, selectedLocation.lng);
                      onClose();
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    Enviar Esta Ubicación
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
