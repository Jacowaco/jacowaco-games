/* Tablero en vivo: registro de jugadores (nombre + equipo) y puntajes de cada juego de la tarde */
(function () {
  'use strict';

  const F = window.Fotos;
  const { C, esc } = F;
  const $ = (s, r = document) => r.querySelector(s);
  const pie = $('#pie');
  let datos = null;
  let editando = false;

  // ===== REGISTRO ===========================================================
  // Va en su propio contenedor: el refresco del tablero no pisa lo que está escribiendo
  function renderRegistro() {
    const equipo = F.yo.equipo.get(), nombre = F.yo.nombre.get();
    if (equipo && nombre && !editando) {
      $('#registro').innerHTML = `<div class="fx-yo"><span class="cinta cinta--${esc(equipo)}"></span>
        <div><p class="fx-yo__n">Equipo ${esc(F.nombreEquipo(equipo))}</p><p class="fx-yo__quien">Sos ${esc(nombre)}</p></div>
        <button class="fx-link" data-editar>Cambiar</button></div>`;
      return;
    }
    $('#registro').innerHTML = `
      <form class="fx-registro" id="registroForm">
        <p class="label">Anotate: ¿qué cinta te tocó?</p>
        <div class="fx-elige">${C.equipos.map(e => `
          <label><input type="radio" name="equipo" value="${e.id}" ${e.id === equipo ? 'checked' : ''} required>
            <span><span class="cinta cinta--${e.id}"></span>${esc(e.nombre)}</span></label>`).join('')}
        </div>
        <label class="label" for="nombre">Tu nombre</label>
        <input class="fx-input" id="nombre" maxlength="30" autocomplete="given-name" value="${esc(nombre || '')}" required>
        <button class="btn btn--pink">Anotarme</button>
        ${editando ? '<button class="fx-link" type="button" data-cancelar>Cancelar</button>' : ''}
      </form>`;
  }

  $('#registro').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const nombre = f.querySelector('#nombre').value.trim().slice(0, 30);
    const equipo = (f.querySelector('input[name="equipo"]:checked') || {}).value;
    if (!nombre || !equipo) return;
    F.yo.equipo.set(equipo);
    F.yo.nombre.set(nombre);
    editando = false;
    renderRegistro();
    await F.registrarme();
    refrescar();
  });

  $('#registro').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if ('editar' in t.dataset) { editando = true; renderRegistro(); }
    else if ('cancelar' in t.dataset) { editando = false; renderRegistro(); }
  });

  // ===== TABLERO ============================================================
  function renderTablero() {
    const juegos = datos.juegos || [];
    const yo = F.yo.equipo.get();
    const porEquipo = id => (datos.jugadores || []).filter(j => j.equipo === id).map(j => esc(j.nombre));

    $('#tablero').innerHTML = `
      ${datos.fotos ? `<a class="btn fx-afotos" href="../fotos/">Caza de fotos →</a>` : ''}
      <h2 class="fx-h2">Posiciones</h2>
      ${F.htmlPosiciones(juegos, yo)}
      <p class="fx-nota">Cada juego: 1º 4 pts · 2º 3 · 3º 2 · 4º 1. Los marcados ×2 valen doble.</p>

      <h2 class="fx-h2">Juego por juego</h2>
      ${juegos.length ? `<div class="fx-detalle">
        <span></span>${C.equipos.map(e => `<span class="cinta cinta--${e.id}" title="${esc(e.nombre)}"></span>`).join('')}
        ${juegos.map((j, i) => `<span class="fx-detalle__j">${i + 1}. ${esc(j.nombre)}${j.doble ? ' <b class="fx-x2">×2</b>' : ''}</span>` +
          C.equipos.map(e => `<span class="fx-detalle__p">${F.puntos(j, e.id) || '–'}</span>`).join('')).join('')}
      </div>` : '<p class="fx-msg">Todavía no se jugó nada.</p>'}

      <h2 class="fx-h2">Equipos</h2>
      <div class="fx-roster">${C.equipos.map(e => {
        const nombres = porEquipo(e.id);
        return `<div><p class="fx-roster__eq"><span class="cinta cinta--${e.id}"></span>${esc(e.nombre)} <small>${nombres.length}</small></p>
          <p class="fx-roster__nombres">${nombres.join(' · ') || '<span class="fx-nota">Nadie anotado todavía</span>'}</p></div>`;
      }).join('')}</div>`;
  }

  let pidiendo = false;
  async function refrescar() {
    if (pidiendo) return;
    pidiendo = true;
    try {
      datos = await F.tablero.publico();
      renderTablero();
      pie.textContent = 'Actualizado ' + F.hora(Date.now());
      pie.classList.remove('is-mal');
    } catch (e) {
      pie.textContent = 'Sin conexión, reintentando…';
      pie.classList.add('is-mal');
    } finally {
      pidiendo = false;
    }
  }

  renderRegistro();
  F.registrarme();
  refrescar();
  setInterval(() => { if (!document.hidden) refrescar(); }, 10000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescar(); });
})();
