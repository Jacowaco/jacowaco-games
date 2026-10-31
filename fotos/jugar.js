/* Caza de fotos: página de los equipos */
(function () {
  'use strict';

  const F = window.Fotos;
  const { C, esc } = F;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  const pie = $('#pie');
  const camara = $('#camara');
  if (C.soloCamara) camara.setAttribute('capture', 'environment');

  // El equipo sale del link (?equipo=ninja) o de lo que eligió antes en este celu (acá o en el tablero en vivo)
  const guardado = F.yo.equipo;
  const guardadoNombre = F.yo.nombre;
  const deLink = new URLSearchParams(location.search).get('equipo');
  if (deLink && C.equipos.some(e => e.id === deLink)) guardado.set(deLink);
  let equipo = C.equipos.some(e => e.id === guardado.get()) ? guardado.get() : null;
  let nombre = guardadoNombre.get();

  let datos = null;     // último estado de los backends
  const local = {};     // consigna → { fase: 'subiendo'|'error'|'enviada', file, msg }
  const miniaturas = {}; // consigna → objectURL de la última foto sacada en este celu
  let consignaActual = null;
  let fotosMias = {};   // id de foto → link, solo las del propio equipo

  // ===== RENDER =============================================================
  function render() {
    if (!equipo) return renderElegir();
    // El refresco no pisa el formulario mientras escribe
    if (!nombre) { if (!$('#nombreForm')) renderNombre(); return; }
    if (!datos) return;
    const cab = cabecera();
    if (!datos.inicio || !datos.consignas) {
      app.innerHTML = cab + `<div class="fx-espera"><p class="fx-espera__t">Esperando<br>la largada</p>
        <p class="sub">Las consignas aparecen acá cuando arranque el juego. No hace falta recargar.</p></div>`;
      return;
    }
    const total = datos.consignas.length;
    const rk = F.ranking(datos.fotos, total);
    const yo = rk.find(r => r.equipo.id === equipo);
    const puesto = rk.filter(r => r.completo).indexOf(yo) + 1;
    app.innerHTML = cab + `
      ${yo.completo ? `<div class="fx-listo"><p>¡Completaron todo!</p><b>Llegaron ${puesto}º</b></div>` : ''}
      ${carrera(rk, total)}
      <ol class="fx-lista">${datos.consignas.map((txt, i) => tarjeta(i + 1, txt)).join('')}</ol>`;
  }

  function renderElegir() {
    app.innerHTML = `<p class="label">¿De qué equipo sos?</p>
      <div class="fx-equipos">${C.equipos.map(e => `
        <button class="fx-equipo" data-equipo="${e.id}"><span class="cinta cinta--${e.id}"></span><b>${esc(e.nombre)}</b></button>`).join('')}
      </div>`;
  }

  function renderNombre() {
    app.innerHTML = cabecera(false) + `
      <form class="fx-nombre" id="nombreForm">
        <label class="label" for="nombre">¿Cómo te llamás?</label>
        <input class="fx-input" id="nombre" maxlength="30" autocomplete="given-name" required>
        <button class="btn">Listo</button>
      </form>`;
  }

  function cabecera(conNombre = true) {
    return `<div class="fx-yo"><span class="cinta cinta--${equipo}"></span>
      <div><p class="fx-yo__n">Equipo ${esc(F.nombreEquipo(equipo))}</p>
      ${conNombre ? `<p class="fx-yo__quien">Sos ${esc(nombre)}</p>` : ''}</div>
      <button class="fx-link" data-cambiar>Cambiar</button></div>`;
  }

  // La carrera: cuántas lleva cada equipo, ordenados (sin fotos: no se ven las de los rivales)
  function carrera(rk, total) {
    let llegada = 0;
    return `<h2 class="fx-h2 fx-carrera__t">La carrera</h2>
      <ol class="fx-carrera">${rk.map((r, i) => {
        const soy = r.equipo.id === equipo;
        return `
        <li class="${soy ? 'is-yo' : ''} ${r.completo ? 'is-completo' : ''}">
          <span class="fx-carrera__pos">${i + 1}</span>
          <span class="cinta cinta--${r.equipo.id}"></span>
          <span class="fx-carrera__eq">${esc(r.equipo.nombre)}${soy ? '<small>vos</small>' : ''}</span>
          <span class="fx-carrera__n"><b>${r.hechas}</b>/${total}</span>
          <div class="fx-barra"><span style="width:${total ? r.hechas / total * 100 : 0}%"></span></div>
          ${soy && r.enRevision ? `<p class="fx-carrera__rev">${r.enRevision} en revisión</p>` : ''}
          ${r.completo ? `<span class="fx-sello">Llegó ${++llegada}º</span>` : ''}
        </li>`;
      }).join('')}</ol>`;
  }

  const SELLOS = { aprobada: '✓ Aprobada', pendiente: 'En revisión', rechazada: 'Rechazada' };
  const ESTADO_CORTO = { aprobada: '✓', pendiente: 'En revisión', rechazada: '✗' };

  function tarjeta(n, txt) {
    let est = F.estadoConsigna(datos.fotos, equipo, n);
    // Recién subida pero todavía no vino en el estado: se muestra en revisión igual
    if (local[n] && local[n].fase === 'enviada') {
      if (est === 'vacia' || est === 'rechazada') est = 'pendiente'; else delete local[n];
    }
    const l = local[n] && local[n].fase ? local[n] : null;
    // Todas las fotos del equipo para esta consigna, la más nueva primero, para decidir si conviene mandar otra
    const delEquipo = datos.fotos.filter(f => f.equipo === equipo && f.consigna === n).reverse();
    const galeria = delEquipo.map((f, i) => {
      // Si el link todavía no llegó, la más nueva usa la copia local (si la sacó este celu)
      const url = fotosMias[f.id] || (i === 0 && f.autor === nombre ? miniaturas[n] : null);
      return `<button class="fx-mini is-${f.estado}" ${url ? `data-ver="${esc(url)}"` : 'disabled'} aria-label="Ver foto de ${esc(f.autor || '')}">
        ${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : '<span class="fx-mini__sin">Foto en el respaldo</span>'}
        <span class="fx-mini__pie">${esc(f.autor || '¿?')} · ${F.hora(f.creada).slice(0, 5)}<b>${ESTADO_CORTO[f.estado] || ''}</b></span></button>`;
    });
    // Mientras sube (o si falló) se muestra la que está en el celu
    if (l && l.fase !== 'enviada' && miniaturas[n]) {
      galeria.unshift(`<span class="fx-mini is-local"><img src="${miniaturas[n]}" alt=""><span class="fx-mini__pie">${esc(nombre)}<b>${l.fase === 'error' ? 'Sin subir' : 'Subiendo'}</b></span></span>`);
    }
    let accion = '';
    if (l && l.fase === 'subiendo') accion = `<p class="fx-subiendo">Subiendo…</p>`;
    else if (l && l.fase === 'error') accion = `<p class="fx-error">${esc(l.msg)}</p>
      <button class="btn btn--pink" data-reintentar="${n}">Reintentar</button>
      <button class="fx-link" data-foto="${n}">Sacar otra</button>`;
    else if (est === 'vacia') accion = `<button class="btn" data-foto="${n}">Sacar foto</button>`;
    else if (est === 'rechazada') accion = `<p class="fx-nota">No era esa. Probá con otra.</p><button class="btn btn--pink" data-foto="${n}">Sacar otra</button>`;
    else if (est === 'pendiente') accion = `<button class="fx-link" data-foto="${n}">Mandar otra</button>`;
    return `
      <li class="fx-card is-${est}">
        <span class="fx-card__n">${n}</span>
        <p class="fx-card__txt">${esc(txt)}</p>
        ${est !== 'vacia' && !(l && l.fase !== 'enviada') ? `<span class="fx-sello">${SELLOS[est]}</span>` : ''}
        ${galeria.length ? `<div class="fx-galeria">${galeria.join('')}</div>` : ''}
        ${accion ? `<div class="fx-card__acc">${accion}</div>` : ''}
      </li>`;
  }

  // ===== DATOS ==============================================================
  // Si ya hay un pedido en curso, se repite al terminar (para que una foto recién subida aparezca enseguida)
  let pidiendo = false, otraVez = false;
  async function refrescar() {
    if (pidiendo) { otraVez = true; return; }
    pidiendo = true;
    try {
      // Si el registro no llegó a Supabase (sin señal al entrar), se reintenta: sin él no vienen las fotos del equipo
      if (equipo && nombre && F.yo.sync.get() !== equipo + '|' + nombre) await F.registrarme();
      const [d, mias] = await Promise.allSettled([F.estado(), F.fotosEquipo()]);
      if (d.status === 'rejected') throw d.reason;
      datos = d.value;
      if (mias.status === 'fulfilled') fotosMias = mias.value;
      pie.textContent = 'Actualizado ' + F.hora(Date.now()) + (datos.errores.length ? ' · un servidor no responde, seguimos con el otro' : '');
      pie.classList.remove('is-mal');
    } catch (e) {
      pie.textContent = 'Sin conexión, reintentando… (' + e.message + ')';
      pie.classList.add('is-mal');
    } finally {
      pidiendo = false;
    }
    render();
    if (otraVez) { otraVez = false; refrescar(); }
  }

  async function subir(n, file) {
    local[n] = { fase: 'subiendo', file };
    if (miniaturas[n]) URL.revokeObjectURL(miniaturas[n]);
    miniaturas[n] = URL.createObjectURL(file);
    render();
    try {
      const blob = await F.comprimir(file);
      await F.subir(equipo, n, nombre, blob);
      local[n] = { fase: 'enviada' };
      render();
      refrescar();
    } catch (e) {
      local[n] = { fase: 'error', file, msg: 'No se pudo subir: ' + (e.name === 'AbortError' ? 'tardó demasiado' : e.message) };
      render();
    }
  }

  // ===== EVENTOS ============================================================
  app.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.ver) {
      F.verFoto(t.dataset.ver);
    } else if (t.dataset.equipo) {
      equipo = t.dataset.equipo;
      guardado.set(equipo);
      anotarme();
      render();
      refrescar();
    } else if ('cambiar' in t.dataset) {
      if (!confirm('¿Cambiar de equipo o de nombre?')) return;
      equipo = nombre = null;
      guardado.set(null);
      guardadoNombre.set(null);
      render();
    } else if (t.dataset.foto) {
      consignaActual = Number(t.dataset.foto);
      camara.click();
    } else if (t.dataset.reintentar) {
      const n = Number(t.dataset.reintentar);
      subir(n, local[n].file);
    }
  });

  app.addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#nombre').value.trim().slice(0, 30);
    if (!v) return;
    nombre = v;
    guardadoNombre.set(v);
    anotarme();
    render();
  });

  // Si Supabase no lo deja cambiar de equipo (juego largado), vuelve al suyo y avisa
  async function anotarme() {
    const motivo = await F.registrarme();
    if (motivo) {
      alert('No te podés cambiar de equipo durante la caza de fotos.');
      equipo = guardado.get();
      render();
      refrescar();
    } else if (equipo) {
      refrescar();
    }
  }

  camara.addEventListener('change', () => {
    const file = camara.files[0];
    const n = consignaActual;
    consignaActual = null;
    camara.value = '';
    if (file && n) subir(n, file);
  });

  render();
  anotarme();
  setInterval(() => { if (equipo && !document.hidden) refrescar(); }, 8000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && equipo) refrescar(); });
})();
