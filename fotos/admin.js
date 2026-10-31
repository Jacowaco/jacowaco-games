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
    $('#revisar').innerHTML = pend.length
      ? pend.map(f => fotoCard(f, true)).join('')
      : `<p class="fx-msg">No hay fotos para revisar.</p>`;
  }

  function fotoCard(f, conContexto) {
    const yaAprobada = datos.fotos.some(o => o !== f && o.equipo === f.equipo && o.consigna === f.consigna && o.estado === 'aprobada');
    return `
      <article class="fx-foto is-${f.estado}">
        <a href="${esc(f.url)}" target="_blank" rel="noopener"><img src="${esc(f.url)}" alt="" loading="lazy"></a>
        <div class="fx-foto__info">
          ${conContexto ? `<p class="fx-foto__eq"><span class="cinta cinta--${esc(f.equipo)}"></span>${esc(F.nombreEquipo(f.equipo))}</p>
          <p class="fx-foto__c"><b>${f.consigna}.</b> ${esc(textoConsigna(f.consigna))}</p>` : ''}
          <p class="fx-nota">Subida ${F.hora(f.creada)} · ${f.fuente === 'google' ? 'Google' : 'Supabase'} · ${ESTADOS[f.estado] || esc(f.estado)}
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
    if (t.dataset.revisar) revisar(t.dataset.id, t.dataset.revisar);
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

  // ===== ARRANQUE ===========================================================
  if (clave) entrar(clave); else $('#login').hidden = false;
  setInterval(() => { if (!document.hidden && datos) refrescar(); }, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && datos) refrescar(); });
})();
