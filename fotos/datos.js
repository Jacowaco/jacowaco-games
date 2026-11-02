/* Caza de fotos: backend en Supabase, compresión y ranking. Lo usan jugar.js y admin.js */
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

  // Lo que devuelve Supabase pasado a { inicio: ms|null, consignas: []|null, fotos: [...] }
  function normalizar(d, urlDe) {
    if (!d) throw new Error('Supabase no tiene el juego configurado');
    return {
      inicio: d.inicio ? new Date(d.inicio).getTime() : null,
      consignas: d.consignas || null,
      fotos: (d.fotos || []).map(f => ({
        id: String(f.id),
        equipo: f.equipo,
        consigna: Number(f.consigna),
        estado: f.estado,
        autor: f.autor || '',
        creada: new Date(f.creada).getTime(),
        url: urlDe ? urlDe(f) : null,
      })).sort((a, b) => a.creada - b.creada),
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
      if (!this.activo) throw new Error('Supabase no está configurado en fotos/config.js');
      const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers: this.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(args || {}), signal,
      });
      if (!r.ok) throw new Error(await errorDe(r));
      const txt = await r.text();
      return txt ? JSON.parse(txt) : null;
    },
    async estado(signal) {
      return normalizar(await this.rpc('estado', {}, signal));
    },
    async admin(clave, signal) {
      return normalizar(await this.rpc('admin', { p_clave: clave }, signal), f => `${SB}/storage/v1/object/public/fotos/${f.ruta}`);
    },
    async subir(equipo, consigna, autor, blob, signal) {
      const azar = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
      const ruta = `${equipo}/${consigna}-${azar}.jpg`;
      let r = await fetch(`${SB}/storage/v1/object/fotos/${ruta}`, {
        method: 'POST', headers: this.headers({ 'Content-Type': 'image/jpeg' }), body: blob, signal,
      });
      if (!r.ok) throw new Error(await errorDe(r));
      r = await fetch(`${SB}/rest/v1/fotos`, {
        method: 'POST', headers: this.headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify({ equipo, consigna, ruta, autor }), signal,
      });
      if (!r.ok) throw new Error(await errorDe(r));
    },
    revisar(clave, id, estado) { return this.rpc('revisar', { p_clave: clave, p_id: id, p_estado: estado }); },
    guardar(clave, consignas) { return this.rpc('guardar', { p_clave: clave, p_consignas: consignas }); },
    largar(clave, si) { return this.rpc('largar', { p_clave: clave, p_largar: si }); },
    reiniciar(clave) { return this.rpc('reiniciar', { p_clave: clave }); },
  };

  const estado = () => conTiempo(15000, s => supabase.estado(s));
  const admin = clave => conTiempo(15000, s => supabase.admin(clave, s));
  const subir = (equipo, consigna, autor, blob) => conTiempo(30000, s => supabase.subir(equipo, consigna, autor, blob, s));

  // ===== JUGADOR ============================================================
  // Quién es este celu. Lo comparten la página de fotos y el tablero (mismo sitio, mismo localStorage)
  function guardado(clave) {
    return {
      get() { try { return localStorage.getItem(clave); } catch (e) { return null; } },
      set(v) { try { v ? localStorage.setItem(clave, v) : localStorage.removeItem(clave); } catch (e) {} },
    };
  }
  const yo = {
    equipo: guardado('fotos-equipo'),
    nombre: guardado('fotos-nombre'),
    id: guardado('jugador-id'),
    sync: guardado('jugador-sync'),
  };

  // Anota (o actualiza) al jugador en Supabase. Se llama en cada carga: si el panel lo borró, vuelve a quedar anotado.
  // Durante la caza de fotos Supabase no deja cambiar de equipo: se vuelve al último equipo confirmado y se devuelve el motivo.
  async function registrarme() {
    const equipo = yo.equipo.get(), nombre = yo.nombre.get();
    if (!equipo || !nombre || !supabase.activo) return null;
    let id = yo.id.get();
    if (!id) {
      id = uuid();
      yo.id.set(id);
    }
    try {
      await supabase.rpc('registrar', { p_id: id, p_nombre: nombre, p_equipo: equipo });
      yo.sync.set(equipo + '|' + nombre);
    } catch (e) {
      if (/cambiar de equipo/i.test(e.message)) {
        const previo = (yo.sync.get() || '').split('|')[0];
        if (previo) yo.equipo.set(previo);
        return e.message;
      }
      /* sin señal: se reintenta la próxima vez */
    }
    return null;
  }

  // Links de las fotos del equipo de este jugador (Supabase lo decide por el registro, no por lo que diga el celu)
  async function fotosEquipo() {
    const id = yo.id.get();
    if (!id || !supabase.activo) return {};
    const urls = {};
    for (const f of (await supabase.rpc('fotos_equipo', { p_jugador: id })) || []) {
      urls[f.id] = `${SB}/storage/v1/object/public/fotos/${f.ruta}`;
    }
    return urls;
  }

  // ===== TABLERO ============================================================
  const PUNTOS = [4, 3, 2, 1];
  const tablero = {
    publico: () => supabase.rpc('tablero'),
    admin: clave => supabase.rpc('tablero_admin', { p_clave: clave }),
    guardarJuego: (clave, j) => supabase.rpc('guardar_juego', { p_clave: clave, p_id: j.id, p_nombre: j.nombre, p_doble: j.doble, p_puestos: j.puestos }),
    borrarJuego: (clave, id) => supabase.rpc('borrar_juego', { p_clave: clave, p_id: id }),
    borrarJugador: (clave, id) => supabase.rpc('borrar_jugador', { p_clave: clave, p_id: id }),
    mostrar: (clave, si) => supabase.rpc('mostrar_vivo', { p_clave: clave, p_vivo: si }),
  };

  // Puntos de un equipo en un juego: 4-3-2-1 según el puesto (empates permitidos), x2 si el juego es doble
  function puntos(juego, equipo) {
    const p = Number((juego.puestos || {})[equipo]);
    return p >= 1 && p <= PUNTOS.length ? PUNTOS[p - 1] * (juego.doble ? 2 : 1) : 0;
  }

  // Tabla general; con el mismo total comparten puesto
  function posiciones(juegos) {
    const filas = C.equipos.map(eq => ({ equipo: eq, total: juegos.reduce((s, j) => s + puntos(j, eq.id), 0) }))
      .sort((a, b) => b.total - a.total);
    filas.forEach((f, i) => { f.puesto = i && f.total === filas[i - 1].total ? filas[i - 1].puesto : i + 1; });
    return filas;
  }

  // La usan el tablero en vivo y el panel
  function htmlPosiciones(juegos, miEquipo) {
    return `<ol class="fx-pos">${posiciones(juegos).map(p => `
      <li class="${p.puesto === 1 && p.total > 0 ? 'is-punta' : ''} ${p.equipo.id === miEquipo ? 'is-yo' : ''}">
        <span class="fx-pos__n">${p.puesto}</span>
        <span class="cinta cinta--${p.equipo.id}"></span>
        <span class="fx-pos__eq">${esc(p.equipo.nombre)}</span>
        <span class="fx-pos__pts">${p.total}<small>pts</small></span>
      </li>`).join('')}</ol>`;
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

  // ===== VISOR ==============================================================
  // Muestra una foto a pantalla completa sin salir de la página (abrirla en otra pestaña en el celu la descarga o te saca).
  // Se cierra tocándola o con "atrás" del celu.
  let visor = null;
  function verFoto(url) {
    if (!visor) {
      visor = document.createElement('div');
      visor.className = 'fx-visor';
      visor.hidden = true;
      visor.innerHTML = '<img alt=""><span>Tocá para cerrar</span>';
      visor.addEventListener('click', () => history.back());
      window.addEventListener('popstate', () => { visor.hidden = true; visor.querySelector('img').removeAttribute('src'); });
      document.body.append(visor);
    }
    visor.querySelector('img').src = url;
    visor.hidden = false;
    history.pushState({ visor: true }, '');
  }

  // ===== UTILES =============================================================
  const uuid = () => crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hora = ms => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  function duracion(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return (h ? h + 'h ' : '') + m + 'm ' + String(s % 60).padStart(2, '0') + 's';
  }
  const nombreEquipo = id => (C.equipos.find(e => e.id === id) || { nombre: id }).nombre;

  window.Fotos = {
    C, supabase, estado, admin, subir, comprimir, ranking, estadoConsigna, esc, hora, duracion, nombreEquipo,
    yo, registrarme, fotosEquipo, verFoto, tablero, PUNTOS, puntos, posiciones, htmlPosiciones, uuid,
  };
})();
