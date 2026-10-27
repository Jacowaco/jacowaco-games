// Mapa satelital (Leaflet + Esri World Imagery). Expone window.sunshineMap.
(function () {
  const PLAZA = [-34.5622057, -58.4267994];
  const MINZ = 4, MAXZ = 17.4;
  const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const el = document.getElementById('map');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const map = L.map(el, {
    zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
    doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, tap: false,
    zoomSnap: 0, zoomDelta: 0.25, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, inertia: false,
  });
  const layer = L.tileLayer(TILES, {
    maxZoom: 19, maxNativeZoom: 18, keepBuffer: 8, updateWhenZooming: true, updateWhenIdle: false,
  }).addTo(map);

  map.setView(PLAZA, reduce ? 16 : MINZ);

  // El descenso usa el camino interno del pinch-zoom (_move con pinch:true): escala los
  // tiles ya cargados mientras llegan los nuevos. setView() haría un reset y borraría todo
  // en cada frame, dejando la pantalla negra hasta que el scroll se detiene.
  let last = -1, endTimer = null;
  window.sunshineMap = {
    setProgress(m) {
      m = Math.min(1, Math.max(0, m));
      const z = MINZ + (MAXZ - MINZ) * m;
      if (Math.abs(z - last) < 0.005) return;
      last = z;
      map._move(L.latLng(PLAZA), z, { pinch: true, round: false });
      clearTimeout(endTimer);
      endTimer = setTimeout(() => map._moveEnd(true), 180);
    },
    loading() { return layer.isLoading(); },
    invalidate() { map.invalidateSize(); },
  };
  addEventListener('resize', () => map.invalidateSize());

  // Precarga de tiles del recorrido (3x3 alrededor de la plaza en cada zoom) para que
  // el descenso no muestre pantalla negra. Arranca cuando el navegador está libre.
  if (!reduce) {
    const urls = [];
    const lat = PLAZA[0] * Math.PI / 180;
    for (let z = MINZ + 1; z <= 18; z++) {
      const n = 2 ** z;
      const cx = Math.floor((PLAZA[1] + 180) / 360 * n);
      const cy = Math.floor((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * n);
      const r = z >= 14 ? 2 : 1;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        urls.push(TILES.replace('{z}', z).replace('{x}', cx + dx).replace('{y}', cy + dy));
      }
    }
    let i = 0;
    const next = () => {
      if (i >= urls.length) return;
      const img = new Image();
      img.onload = img.onerror = next;
      img.src = urls[i++];
    };
    const start = () => { for (let k = 0; k < 4; k++) next(); };
    if ('requestIdleCallback' in window) addEventListener('load', () => requestIdleCallback(start, { timeout: 4000 }));
    else addEventListener('load', () => setTimeout(start, 2500));
  }
})();
