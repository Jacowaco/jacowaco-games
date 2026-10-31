/* Caza de fotos: los dos backends (Supabase y Google), compresión y ranking. Lo usan jugar.js y admin.js */
(function () {
  'use strict';

  const C = window.FOTOS_CONFIG;
  const SB = C.supabase.url.replace(/\/+$/, '');

  async function errorDe(r) {
    try {
      const d = await r.json();
      return d.message || d.error || d.msg || 'error ' + r.status;
    } catch (e) {
      return 'error ' + r.status;
    }
  }

  function conTiempo(ms, fn) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    return fn(ac.signal).finally(() => clearTimeout(t));
  }

  // Los dos backends devuelven lo mismo; acá se pasa a { inicio: ms|null, consignas: []|null, fotos: [...] }
  function normalizar(d, fuente, urlDe) {
    if (!d) throw new Error('el backend no tiene el juego configurado');
    return {
      inicio: d.inicio ? new Date(d.inicio).getTime() : null,
      consignas: d.consignas || null,
      fotos: (d.fotos || []).map(f => ({
        fuente,
        id: String(f.id),
        equipo: f.equipo,
        consigna: Number(f.consigna),
        estado: f.estado,
        creada: new Date(f.creada).getTime(),
        url: urlDe ? urlDe(f) : null,
      })),
    };
  }

  // ===== SUPABASE ===========================================================
  const supabase = {
    id: 'supabase',
    nombre: 'Supabase',
    activo: !!(C.supabase.url && C.supabase.key),
    headers(extra) {
      const h = Object.assign({ apikey: C.supabase.key }, extra);
      // Las keys viejas (anon, JWT) van también como Bearer; las publishable nuevas solo como apikey
      if (C.supabase.key.startsWith('eyJ')) h.Authorization = 'Bearer ' + C.supabase.key;
      return h;
    },
    async rpc(fn, args, signal) {
      const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers: this.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(args || {}), signal,
      });
      if (!r.ok) throw new Error(await errorDe(r));
      const txt = await r.text();
      return txt ? JSON.parse(txt) : null;
    },
    async estado(signal) {
      return normalizar(await this.rpc('estado', {}, signal), this.id);
    },
    async admin(clave) {
      return normalizar(await this.rpc('admin', { p_clave: clave }), this.id, f => `${SB}/storage/v1/object/public/fotos/${f.ruta}`);
    },
    async subir(equipo, consigna, blob, signal) {
      const azar = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      const ruta = `${equipo}/${consigna}-${azar}.jpg`;
      let r = await fetch(`${SB}/storage/v1/object/fotos/${ruta}`, {
        method: 'POST', headers: this.headers({ 'Content-Type': 'image/jpeg' }), body: blob, signal,
      });
      if (!r.ok) throw new Error(await errorDe(r));
      r = await fetch(`${SB}/rest/v1/fotos`, {
        method: 'POST', headers: this.headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ equipo, consigna, ruta }), signal,
      });
      if (!r.ok) throw new Error(await errorDe(r));
    },
    revisar(clave, id, estado) { return this.rpc('revisar', { p_clave: clave, p_id: id, p_estado: estado }); },
    guardar(clave, consignas) { return this.rpc('guardar', { p_clave: clave, p_consignas: consignas }); },
    largar(clave, si) { return this.rpc('largar', { p_clave: clave, p_largar: si }); },
    reiniciar(clave) { return this.rpc('reiniciar', { p_clave: clave }); },
  };

  // ===== GOOGLE (Apps Script) ===============================================
  // POST con body de texto plano: así el navegador no hace preflight y Apps Script responde con CORS abierto
  const google = {
    id: 'google',
    nombre: 'Google',
    activo: !!C.google.url,
    async llamar(datos, signal) {
      const r = await fetch(C.google.url, datos ? { method: 'POST', body: JSON.stringify(datos), signal } : { signal });
      if (!r.ok) throw new Error('error ' + r.status);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      return d;
    },
    async estado(signal) {
      return normalizar(await this.llamar(null, signal), this.id);
    },
    async admin(clave) {
      return normalizar(await this.llamar({ accion: 'admin', clave }), this.id, f => f.url);
    },
    async subir(equipo, consigna, blob, signal) {
      const imagen = await aBase64(blob);
      await this.llamar({ accion: 'subir', equipo, consigna, imagen }, signal);
    },
    revisar(clave, id, estado) { return this.llamar({ accion: 'revisar', clave, id, estado }); },
    guardar(clave, consignas) { return this.llamar({ accion: 'guardar', clave, consignas }); },
    largar(clave, si) { return this.llamar({ accion: 'largar', clave, largar: si }); },
    reiniciar(clave) { return this.llamar({ accion: 'reiniciar', clave }); },
  };

  // El primario va primero: de ahí salen la largada y las consignas, y ahí se intenta subir antes
  const BACKENDS = [supabase, google].filter(b => b.activo).sort((a, b) => (b.id === C.primario) - (a.id === C.primario));
  const porId = { supabase, google };

  // Lee todos los backends y junta las fotos. salud = { supabase: true|false, google: ... }
  async function leer(fn) {
    if (!BACKENDS.length) throw new Error('No hay backends configurados en fotos/config.js');
    const res = await Promise.allSettled(BACKENDS.map(fn));
    const ok = res.map((r, i) => r.status === 'fulfilled' ? r.value : null);
    const salud = {};
    BACKENDS.forEach((b, i) => { salud[b.id] = !!ok[i]; });
    const base = ok.find(Boolean);
    if (!base) throw res[0].reason;
    return {
      inicio: base.inicio,
      consignas: base.consignas,
      fotos: ok.filter(Boolean).flatMap(d => d.fotos).sort((a, b) => a.creada - b.creada),
      salud,
      errores: res.filter(r => r.status === 'rejected').map(r => r.reason && r.reason.message),
    };
  }

  const estado = () => leer(b => conTiempo(15000, s => b.estado(s)));
  const admin = clave => leer(b => b.admin(clave));

  // Prueba los backends en orden; devuelve el nombre del que la recibió
  async function subir(equipo, consigna, blob) {
    let ultimo;
    for (const b of BACKENDS) {
      try {
        await conTiempo(b.id === 'google' ? 45000 : 30000, s => b.subir(equipo, consigna, blob, s));
        return b.nombre;
      } catch (e) {
        ultimo = e;
      }
    }
    throw ultimo || new Error('No hay backends configurados');
  }

  // Cambios del panel que van a todos los backends; devuelve los nombres de los que fallaron
  async function aTodos(fn) {
    const res = await Promise.allSettled(BACKENDS.map(fn));
    const malos = res.map((r, i) => r.status === 'rejected' ? `${BACKENDS[i].nombre} (${r.reason.message})` : null).filter(Boolean);
    if (malos.length === BACKENDS.length) throw new Error(malos.join(' · '));
    return malos;
  }

  // ===== FOTOS ==============================================================
  async function comprimir(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const k = Math.min(1, C.ladoMax / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * k);
      cv.height = Math.round(img.naturalHeight * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      return await new Promise((ok, mal) => cv.toBlob(b => b ? ok(b) : mal(new Error('No se pudo procesar la foto')), 'image/jpeg', C.calidad));
    } catch (e) {
      throw new Error('No se pudo leer la foto. Probá sacarla de nuevo.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function aBase64(blob) {
    return new Promise((ok, mal) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result).split(',')[1]);
      fr.onerror = () => mal(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  // ===== RANKING ============================================================
  // Una consigna está hecha cuando tiene una foto aprobada; cuenta la hora de SUBIDA de la primera aprobada.
  // Gana el equipo que completa todas y cuya última consigna hecha se subió antes.
  function ranking(fotos, total) {
    return C.equipos.map(eq => {
      const hechas = new Map();
      const enRevision = new Set();
      for (const f of fotos) {
        if (f.equipo !== eq.id || f.consigna < 1 || f.consigna > total) continue;
        if (f.estado === 'aprobada' && !(hechas.get(f.consigna) <= f.creada)) hechas.set(f.consigna, f.creada);
        if (f.estado === 'pendiente') enRevision.add(f.consigna);
      }
      hechas.forEach((_, c) => enRevision.delete(c));
      return {
        equipo: eq,
        hechas: hechas.size,
        enRevision: enRevision.size,
        completo: total > 0 && hechas.size === total,
        ultima: hechas.size ? Math.max(...hechas.values()) : null,
      };
    }).sort((a, b) =>
      (b.completo - a.completo) || (b.hechas - a.hechas) || ((a.ultima ?? Infinity) - (b.ultima ?? Infinity)));
  }

  // Estado de cada consigna para un equipo: aprobada > pendiente > rechazada > vacia
  function estadoConsigna(fotos, equipo, n) {
    const mias = fotos.filter(f => f.equipo === equipo && f.consigna === n);
    for (const e of ['aprobada', 'pendiente', 'rechazada']) if (mias.some(f => f.estado === e)) return e;
    return 'vacia';
  }

  // ===== UTILES =============================================================
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hora = ms => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  function duracion(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return (h ? h + 'h ' : '') + m + 'm ' + String(s % 60).padStart(2, '0') + 's';
  }
  const nombreEquipo = id => (C.equipos.find(e => e.id === id) || { nombre: id }).nombre;

  window.Fotos = {
    C, BACKENDS, porId, estado, admin, subir, aTodos, comprimir, ranking, estadoConsigna, esc, hora, duracion, nombreEquipo,
  };
})();
