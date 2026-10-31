/* Caza de fotos: panel del organizador (largada, revisar fotos, ranking, consignas) */
(function () {
  'use strict';

  const F = window.Fotos;
  const { C, esc } = F;
  const $ = (s, r = document) => r.querySelector(s);
  const ESTADOS = { aprobada: 'Aprobada', pendiente: 'Pendiente', rechazada: 'Rechazada' };

  const sesion = {
    get() { try { return localStorage.getItem('fotos-clave') || ''; } catch (e) { return ''; } },
    set(v) { try { v ? localStorage.setItem('fotos-clave', v) : localStorage.removeItem('fotos-clave'); } catch (e) {} },
  };
  let clave = sesion.get();
  let datos = null;
  let firmaAnterior = '';
  let celdaAbierta = null; // { equipo, n } del modal de la grilla

  // ===== LOGIN ==============================================================
  async function entrar(c) {
    $('#loginError').textContent = '';
    try {
      const d = await F.admin(c);
      clave = c;
      sesion.set(c);
      $('#login').hidden = true;
      $('#panel').hidden = false;
      aplicar(d);
      cargarEditor();
      armarPuestos();
      cargarTablero();
      return true;
    } catch (e) {
      const malaClave = /clave/i.test(e.message);
      // Sin señal no se pierde la sesión: se puede reintentar con la clave ya puesta
      if (malaClave) sesion.set(null);
      $('#clave').value = malaClave ? '' : c;
      $('#login').hidden = false;
      $('#panel').hidden = true;
      $('#loginError').textContent = malaClave ? 'Clave incorrecta.' : 'No se pudo conectar: ' + e.message;
      return false;
    }
  }

  $('#login').addEventListener('submit', e => {
    e.preventDefault();
    entrar($('#clave').value.trim());
  });

  // ===== DATOS ==============================================================
  let pidiendo = false;
  async function refrescar() {
    if (pidiendo || !clave) return;
    pidiendo = true;
    try {
      cargarTablero();
      aplicar(await F.admin(clave));
    } catch (e) {
      $('#salud').innerHTML = `<span class="is-mal">Sin conexión: ${esc(e.message)}</span>`;
    } finally {
      pidiendo = false;
    }
  }

  function aplicar(d) {
    datos = d;
    $('#salud').innerHTML = F.BACKENDS.map(b =>
      `<span class="${d.salud[b.id] ? 'is-ok' : 'is-mal'}">● ${b.nombre}</span>`).join('') +
      `<span>${F.hora(Date.now())}</span>`;
    // Solo se redibuja si cambió algo, así no saltan las imágenes ni el scroll
    const firma = JSON.stringify([d.inicio, d.consignas, d.fotos.map(f => f.id + f.estado)]);
    if (firma === firmaAnterior) return;
    firmaAnterior = firma;
    render();
  }

  const total = () => (datos.consignas || []).length;
  const textoConsigna = n => (datos.consignas || [])[n - 1] || '(consigna borrada)';

  // ===== RENDER =============================================================
  function render() {
    renderLargada();
    renderRevisar();
    renderRanking();
    renderGrilla();
    if (celdaAbierta) abrirCelda(celdaAbierta.equipo, celdaAbierta.n);
  }

  function renderLargada() {
    $('#largada').innerHTML = datos.inicio
      ? `<p class="fx-largada"><b>En juego</b> desde las ${F.hora(datos.inicio)}</p>
         <button class="fx-link" data-largar="0">Volver a "esperando largada"</button>`
      : `<p class="fx-largada"><b>Esperando largada.</b> Los equipos ven sus nombres pero no las consignas.</p>
         <button class="btn btn--pink fx-largar" data-largar="1" ${total() ? '' : 'disabled'}>¡Largar!</button>
         ${total() ? '' : '<p class="fx-nota">Primero cargá las consignas.</p>'}`;
  }

  function renderRevisar() {
    const pend = datos.fotos.filter(f => f.estado === 'pendiente');
    $('#badge').textContent = pend.length || '';
    $('#badgeModo').textContent = pend.length || '';
    $('#revisar').innerHTML = pend.length
      ? pend.map(f => fotoCard(f, true)).join('')
      : `<p class="fx-msg">No hay fotos para revisar.</p>`;
  }

  function fotoCard(f, conContexto) {
    const yaAprobada = datos.fotos.some(o => o !== f && o.equipo === f.equipo && o.consigna === f.consigna && o.estado === 'aprobada');
    return `
      <article class="fx-foto is-${f.estado}">
        <button class="fx-foto__ver" data-ver="${esc(f.url)}" aria-label="Ver grande"><img src="${esc(f.url)}" alt="" loading="lazy"></button>
        <div class="fx-foto__info">
          ${conContexto ? `<p class="fx-foto__eq"><span class="cinta cinta--${esc(f.equipo)}"></span>${esc(F.nombreEquipo(f.equipo))}</p>
          <p class="fx-foto__c"><b>${f.consigna}.</b> ${esc(textoConsigna(f.consigna))}</p>` : ''}
          <p class="fx-nota">Subida ${F.hora(f.creada)}${f.autor ? ' por <b>' + esc(f.autor) + '</b>' : ''} · ${f.fuente === 'google' ? 'Google' : 'Supabase'} · ${ESTADOS[f.estado] || esc(f.estado)}
            ${yaAprobada ? ' · <b>ya tienen otra aprobada</b>' : ''}</p>
          <div class="fx-fila">
            ${f.estado !== 'aprobada' ? `<button class="btn fx-ok" data-revisar="aprobada" data-id="${esc(f.id)}">✓ Aprobar</button>` : ''}
            ${f.estado !== 'rechazada' ? `<button class="btn btn--ghost" data-revisar="rechazada" data-id="${esc(f.id)}">✗ Rechazar</button>` : ''}
            ${f.estado !== 'pendiente' && !conContexto ? `<button class="fx-link" data-revisar="pendiente" data-id="${esc(f.id)}">Volver a pendiente</button>` : ''}
          </div>
        </div>
      </article>`;
  }

  function renderRanking() {
    const n = total();
    const rk = F.ranking(datos.fotos, n);
    $('#ranking').innerHTML = `<ol class="fx-rank">${rk.map((r, i) => `
      <li class="${r.completo ? 'is-completo' : ''}">
        <span class="fx-rank__pos">${i + 1}</span>
        <span class="cinta cinta--${r.equipo.id}"></span>
        <div class="fx-rank__info">
          <p class="fx-rank__n">${esc(r.equipo.nombre)} <b>${r.hechas}/${n}</b></p>
          <p class="fx-nota">${r.enRevision ? r.enRevision + ' en revisión · ' : ''}${r.ultima
            ? (r.completo ? 'Completó' : 'Última aprobada') + ' con foto de las ' + F.hora(r.ultima) + (datos.inicio ? ' (' + F.duracion(r.ultima - datos.inicio) + ')' : '')
            : 'Ninguna aprobada todavía'}</p>
        </div>
        ${r.completo && i === 0 ? '<span class="fx-sello">Ganador</span>' : ''}
      </li>`).join('')}</ol>
      <p class="fx-nota">Gana el que completa todas y cuya última foto aprobada se subió antes. Cuenta la hora de subida, no la de tu aprobación.</p>`;
  }

  function renderGrilla() {
    const n = total();
    const nums = Array.from({ length: n }, (_, i) => i + 1);
    $('#grilla').innerHTML = n ? `<div class="fx-grilla" style="--n:${n}">
      <span></span>${nums.map(i => `<span class="fx-grilla__h">${i}</span>`).join('')}
      ${C.equipos.map(eq => `<span class="fx-grilla__eq"><span class="cinta cinta--${eq.id}"></span>${esc(eq.nombre)}</span>` +
        nums.map(i => {
          const est = F.estadoConsigna(datos.fotos, eq.id, i);
          const cant = datos.fotos.filter(f => f.equipo === eq.id && f.consigna === i).length;
          return `<button class="fx-celda is-${est}" data-celda="${eq.id}:${i}" ${cant ? '' : 'disabled'} title="${esc(eq.nombre)} · ${i}">${cant > 1 ? cant : ''}</button>`;
        }).join('')).join('')}
    </div>
    <p class="fx-nota">Verde: aprobada · amarillo: pendiente · rosa: rechazada. El número es cuántas fotos mandaron. Tocá una celda para ver las fotos.</p>`
      : `<p class="fx-msg">Todavía no hay consignas.</p>`;
  }

  function abrirCelda(equipo, n) {
    celdaAbierta = { equipo, n };
    const fotos = datos.fotos.filter(f => f.equipo === equipo && f.consigna === n);
    $('#modalBody').innerHTML = `
      <p class="fx-foto__eq"><span class="cinta cinta--${esc(equipo)}"></span>${esc(F.nombreEquipo(equipo))}</p>
      <p class="fx-foto__c"><b>${n}.</b> ${esc(textoConsigna(n))}</p>
      ${fotos.map(f => fotoCard(f, false)).join('') || '<p class="fx-msg">Sin fotos.</p>'}`;
    $('#modal').hidden = false;
  }

  // ===== ACCIONES ===========================================================
  async function revisar(id, estado) {
    const f = datos.fotos.find(x => x.id === id);
    if (!f) return;
    const antes = f.estado;
    f.estado = estado;
    firmaAnterior = '';
    render();
    try {
      await F.porId[f.fuente].revisar(clave, f.id, estado);
    } catch (e) {
      f.estado = antes;
      firmaAnterior = '';
      render();
      alert('No se pudo guardar: ' + e.message);
    }
  }

  async function largar(si) {
    if (!confirm(si ? '¿Largar el juego? Las consignas aparecen en todos los celus.' : '¿Volver a "esperando largada"? Se esconden las consignas y no pueden subir fotos.')) return;
    try {
      const malos = await F.aTodos(b => b.largar(clave, si));
      if (malos.length) alert('Ojo, no llegó a: ' + malos.join(', '));
    } catch (e) {
      alert('No se pudo: ' + e.message);
    }
    refrescar();
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('button, [data-cerrar]');
    if (!t) return;
    if (t.dataset.modo) elegirModo(t.dataset.modo);
    else if (t.dataset.ver) F.verFoto(t.dataset.ver);
    else if (t.dataset.vivo) mostrarVivo(t.dataset.vivo === '1');
    else if (t.dataset.editarJuego) editarJuego(t.dataset.editarJuego);
    else if (t.dataset.borrarJuego) borrarJuego(t.dataset.borrarJuego);
    else if (t.dataset.borrarJugador) borrarJugador(t.dataset.borrarJugador);
    else if (t.dataset.revisar) revisar(t.dataset.id, t.dataset.revisar);
    else if (t.dataset.largar) largar(t.dataset.largar === '1');
    else if (t.dataset.celda) { const [eq, n] = t.dataset.celda.split(':'); abrirCelda(eq, Number(n)); }
    else if ('cerrar' in t.dataset) { celdaAbierta = null; $('#modal').hidden = true; }
    else if (t.dataset.tab) {
      document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b === t));
      document.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== t.dataset.tab; });
    }
  });
  $('#modal').addEventListener('click', e => {
    if (e.target === $('#modal')) { celdaAbierta = null; $('#modal').hidden = true; }
  });

  // ===== CONSIGNAS ==========================================================
  function filaEditor(txt) {
    const li = document.createElement('li');
    li.innerHTML = `<textarea class="fx-input" rows="2"></textarea><button class="fx-link" type="button" aria-label="Borrar">✕</button>`;
    li.querySelector('textarea').value = txt;
    li.querySelector('button').addEventListener('click', () => li.remove());
    return li;
  }

  function cargarEditor() {
    const lista = (datos.consignas && datos.consignas.length) ? datos.consignas : Array(10).fill('');
    $('#editor').replaceChildren(...lista.map(filaEditor));
  }

  $('#agregar').addEventListener('click', () => {
    const li = filaEditor('');
    $('#editor').append(li);
    li.querySelector('textarea').focus();
  });

  $('#guardar').addEventListener('click', async () => {
    const consignas = [...$('#editor').querySelectorAll('textarea')].map(t => t.value.trim()).filter(Boolean);
    const msg = $('#guardarMsg');
    if (datos.inicio && consignas.length !== total() && !confirm('El juego ya largó y cambia la cantidad de consignas. ¿Guardar igual?')) return;
    msg.textContent = 'Guardando…';
    try {
      const malos = await F.aTodos(b => b.guardar(clave, consignas));
      msg.textContent = `Guardadas ${consignas.length} consignas` + (malos.length ? '. Ojo, no llegó a: ' + malos.join(', ') : '.');
      await refrescar();
      cargarEditor();
    } catch (e) {
      msg.textContent = 'No se pudo guardar: ' + e.message;
    }
  });

  $('#reiniciar').addEventListener('click', async () => {
    if (!confirm('¿Borrar TODAS las fotos y volver a "esperando largada"?')) return;
    if (prompt('Escribí BORRAR para confirmar') !== 'BORRAR') return;
    try {
      const malos = await F.aTodos(b => b.reiniciar(clave));
      if (malos.length) alert('Ojo, no llegó a: ' + malos.join(', '));
    } catch (e) {
      alert('No se pudo: ' + e.message);
    }
    refrescar();
  });

  $('#salir').addEventListener('click', () => {
    sesion.set(null);
    location.reload();
  });

  // ===== TABLERO DEL CUMPLE (solo Supabase) =================================
  let tab = null;
  let firmaTablero = '';
  let juegoEditando = null;

  async function cargarTablero() {
    try {
      const t = await F.tablero.admin(clave);
      const firma = JSON.stringify(t);
      if (firma === firmaTablero) return;
      firmaTablero = firma;
      tab = t;
      renderTablero();
    } catch (e) {
      $('#tableroAdmin').innerHTML = `<p class="fx-error">No se pudo leer el tablero: ${esc(e.message)}</p>`;
    }
  }

  function renderTablero() {
    $('#vivoEstado').innerHTML = tab.vivo
      ? `<p class="fx-largada"><b>Visible:</b> el botón "Tablero en vivo" aparece en la landing.</p>
         <button class="fx-link" data-vivo="0">Ocultarlo de la landing</button>`
      : `<p class="fx-largada">El botón "Tablero en vivo" está <b>oculto</b> en la landing. La página ya funciona si pasás el link.</p>
         <button class="btn fx-largar" data-vivo="1">Mostrar en la landing</button>`;
    $('#tableroAdmin').innerHTML = `
      <h2 class="fx-h2">Posiciones</h2>
      ${F.htmlPosiciones(tab.juegos)}
      <h2 class="fx-h2">Juegos cargados</h2>
      ${tab.juegos.length ? `<ol class="fx-juegos">${tab.juegos.map(j => `
        <li><div><b>${esc(j.nombre)}</b>${j.doble ? ' <b class="fx-x2">×2</b>' : ''}
          <p class="fx-nota">${C.equipos.slice().sort((a, b) => (j.puestos[a.id] || 9) - (j.puestos[b.id] || 9))
            .map(e => `${j.puestos[e.id] ? j.puestos[e.id] + 'º' : '–'} ${esc(e.nombre)} (+${F.puntos(j, e.id)} pts)`).join(' · ')}</p></div>
          <div class="fx-fila"><button class="fx-link" data-editar-juego="${esc(j.id)}">Editar</button>
          <button class="fx-link" data-borrar-juego="${esc(j.id)}">Borrar</button></div></li>`).join('')}</ol>`
        : '<p class="fx-msg">Ninguno todavía.</p>'}
      <h2 class="fx-h2">Anotados (${tab.jugadores.length})</h2>
      <div class="fx-roster">${C.equipos.map(e => {
        const js = tab.jugadores.filter(j => j.equipo === e.id);
        return `<div><p class="fx-roster__eq"><span class="cinta cinta--${e.id}"></span>${esc(e.nombre)} <small>${js.length}</small></p>
          <p class="fx-roster__nombres">${js.map(j => `<span class="fx-anotado">${esc(j.nombre)}<button data-borrar-jugador="${esc(j.id)}" aria-label="Borrar a ${esc(j.nombre)}">✕</button></span>`).join('')
            || '<span class="fx-nota">Nadie</span>'}</p></div>`;
      }).join('')}</div>`;
  }

  function armarPuestos(puestos = {}) {
    $('#juegoPuestos').innerHTML = C.equipos.map(e => `
      <div class="fx-puesto"><span class="cinta cinta--${e.id}"></span><b>${esc(e.nombre)}</b>
        <div class="fx-seg">${F.PUNTOS.map((pts, i) => `<label><input type="radio" name="p-${e.id}" value="${i + 1}" ${puestos[e.id] === i + 1 ? 'checked' : ''}>
          <span>${i + 1}º</span></label>`).join('')}</div></div>`).join('');
  }

  function limpiarJuego() {
    juegoEditando = null;
    $('#juegoForm').reset();
    armarPuestos();
    $('#juegoTitulo').textContent = 'Cargar juego';
    $('#juegoCancelar').hidden = true;
  }

  function editarJuego(id) {
    const j = tab.juegos.find(x => x.id === id);
    if (!j) return;
    juegoEditando = id;
    $('#juegoNombre').value = j.nombre;
    $('#juegoDoble').checked = j.doble;
    armarPuestos(j.puestos);
    $('#juegoTitulo').textContent = 'Editando: ' + j.nombre;
    $('#juegoCancelar').hidden = false;
    $('#juegoForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#juegoCancelar').addEventListener('click', limpiarJuego);

  $('#juegoForm').addEventListener('submit', async e => {
    e.preventDefault();
    const puestos = {};
    C.equipos.forEach(eq => {
      const r = $(`input[name="p-${eq.id}"]:checked`);
      if (r) puestos[eq.id] = Number(r.value);
    });
    const faltan = C.equipos.filter(eq => !puestos[eq.id]).map(eq => eq.nombre);
    if (faltan.length && !confirm(`${faltan.join(', ')} sin puesto: suma 0. ¿Guardar igual?`)) return;
    const msg = $('#juegoMsg');
    msg.textContent = 'Guardando…';
    try {
      const nombre = $('#juegoNombre').value.trim();
      await F.tablero.guardarJuego(clave, { id: juegoEditando || F.uuid(), nombre, doble: $('#juegoDoble').checked, puestos });
      msg.textContent = `Guardado: ${nombre}.`;
      limpiarJuego();
      await cargarTablero();
    } catch (err) {
      msg.textContent = 'No se pudo guardar: ' + err.message;
    }
  });

  async function accionTablero(pregunta, fn) {
    if (pregunta && !confirm(pregunta)) return;
    try {
      await fn();
    } catch (e) {
      alert('No se pudo: ' + e.message);
    }
    cargarTablero();
  }

  const mostrarVivo = si => accionTablero(null, () => F.tablero.mostrar(clave, si));
  const borrarJuego = id => accionTablero('¿Borrar "' + (tab.juegos.find(j => j.id === id) || {}).nombre + '"?', () => F.tablero.borrarJuego(clave, id));
  const borrarJugador = id => accionTablero('¿Borrar a ' + (tab.jugadores.find(j => j.id === id) || {}).nombre + '?', () => F.tablero.borrarJugador(clave, id));

  // Por separado, para no llevarse los anotados al limpiar puntajes (ni al revés)
  function borrarTodos(que, lista, borrar) {
    if (!lista.length) return alert(`No hay ${que} para borrar.`);
    if (!confirm(`¿Borrar ${lista.length === 1 ? 'el único' : 'los ' + lista.length} ${que}?`)) return;
    if (prompt('Escribí BORRAR para confirmar') !== 'BORRAR') return;
    accionTablero(null, () => Promise.all(lista.map(x => borrar(clave, x.id))));
  }
  $('#borrarJuegos').addEventListener('click', () => borrarTodos('juegos cargados', tab.juegos, F.tablero.borrarJuego));
  $('#borrarAnotados').addEventListener('click', () => borrarTodos('anotados', tab.jugadores, F.tablero.borrarJugador));

  // ===== PARTES DEL PANEL: tablero del cumple / caza de fotos ================
  const modoGuardado = {
    get() { try { return localStorage.getItem('panel-modo'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem('panel-modo', v); } catch (e) {} },
  };
  function elegirModo(modo) {
    document.querySelectorAll('[data-modo]').forEach(b => b.setAttribute('aria-pressed', b.dataset.modo === modo));
    document.querySelectorAll('[data-modo-panel]').forEach(p => { p.hidden = p.dataset.modoPanel !== modo; });
    modoGuardado.set(modo);
  }
  elegirModo(modoGuardado.get() === 'fotos' ? 'fotos' : 'tablero');

  // ===== ARRANQUE ===========================================================
  if (clave) entrar(clave); else $('#login').hidden = false;
  setInterval(() => { if (!document.hidden && datos) refrescar(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && datos) refrescar(); });
})();
