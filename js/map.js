// Mapa satelital (Leaflet + Esri World Imagery). Expone window.sunshineMap.
(function () {
  const PLAZA = [-34.5622057, -58.4267994];
  const MINZ = 4, MAXZ = 17.4;
  const el = document.getElementById('map');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const map = L.map(el, {
    zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false,
    doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, tap: false,
    zoomSnap: 0, zoomDelta: 0.25, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, inertia: false,
  });
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, maxNativeZoom: 18, keepBuffer: 6, updateWhenZooming: true, updateWhenIdle: false, crossOrigin: true,
  }).addTo(map);

  map.setView(PLAZA, reduce ? 16 : MINZ);

  let last = -1;
  window.sunshineMap = {
    setProgress(m) {
      m = Math.min(1, Math.max(0, m));
      const z = MINZ + (MAXZ - MINZ) * m;
      if (Math.abs(z - last) < 0.005) return;
      last = z;
      map.setView(PLAZA, z, { animate: false });
    },
    invalidate() { map.invalidateSize(); },
  };
  addEventListener('resize', () => map.invalidateSize());
})();
