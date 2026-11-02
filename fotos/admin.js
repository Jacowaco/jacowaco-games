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
  // Fotos revisadas acá que el servidor todavía puede devolver con el estado viejo: id → { estado, listo (ms en que se guardó) }
  const cambios = new Map();
  let conocidas = null; // ids de las fotos que ya llegaron; null hasta la primera lectura, para no avisar por las viejas
  const saltadas = [];  // pendientes que se mandaron al final con "Saltar", en ese orden

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
      const desde = Date.now();
      aplicar(await F.admin(clave), desde);
    } catch (e) {
      $('#salud').innerHTML = `<span class="is-mal">Sin conexión: ${esc(e.message)}</span>`;
    } finally {
      pidiendo = false;
    }
  }

  // desde: cuándo se pidió d. Una lectura que salió antes de que se guardara una revisión trae el estado viejo de esa foto
  function aplicar(d, desde = 0) {
    d.fotos.forEach(f => {
      const c = cambios.get(f.id);
      if (!c) return;
      if (c.listo && desde > c.listo) cambios.delete(f.id);
      else f.estado = c.estado;
    });
    datos = d;
    if (conocidas && d.fotos.some(f => f.estado === 'pendiente' && !conocidas.has(f.id))) avisar();
    conocidas = new Set(d.fotos.map(f => f.id));
    $('#salud').innerHTML = `<span class="is-ok">● Conectado</span><span>${F.hora(Date.now())}</span>`;
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

  // De la más vieja a la más nueva; las saltadas van al final
  function pendientes() {
    const orden = f => saltadas.indexOf(f.id);
    return datos.fotos.filter(f => f.estado === 'pendiente').sort((a, b) => orden(a) - orden(b));
  }

  // De a una: al aprobar o rechazar aparece la siguiente
  function renderRevisar() {
    const pend = pendientes();
    $('#badge').textContent = pend.length || '';
    $('#badgeModo').textContent = pend.length || '';
    if (!pend.length) {
      $('#revisar').innerHTML = `<p class="fx-msg">No hay fotos para revisar.</p>`;
      return;
    }
    $('#revisar').innerHTML = `<p class="fx-nota fx-cola">${pend.length === 1 ? 'Es la última' : `Quedan ${pend.length}`}</p>` + fotoCard(pend[0], true);
    // Las que siguen se van bajando, así aparecen al instante
    pend.slice(1, 3).forEach(f => { new Image().src = f.url; });
  }

  function irARevisar() {
    // 50: lo que tapan las pestañas pegadas arriba
    if ($('#revisar').getBoundingClientRect().top < 50) $('#revisar').scrollIntoView();
  }

  function saltar(id) {
    const i = saltadas.indexOf(id);
    if (i >= 0) saltadas.splice(i, 1);
    saltadas.push(id);
    renderRevisar();
    irARevisar();
  }

  // Sonido y vibración cuando llega una foto. El navegador solo deja sonar después de tocar algo en la página.
  let audio = null;
  document.addEventListener('pointerdown', () => {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) {}
  });
  function avisar() {
    try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) {}
    if (!audio || audio.state !== 'running') return;
    const t = audio.currentTime;
    [880, 1320].forEach((hz, i) => {
      const o = audio.createOscillator(), g = audio.createGain(), t0 = t + i * 0.15;
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      o.connect(g).connect(audio.destination);
      o.start(t0);
      o.stop(t0 + 0.15);
    });
  }

  function fotoCard(f, conContexto) {
    const yaAprobada = datos.fotos.some(o => o !== f && o.equipo === f.equipo && o.consigna === f.consigna && o.estado === 'aprobada');
    return `
      <article class="fx-foto is-${f.estado}">
        <button class="fx-foto__ver" data-ver="${esc(f.url)}" aria-label="Ver grande"><img src="${esc(f.url)}" alt="" loading="lazy"></button>
        <div class="fx-foto__info">
          ${conContexto ? `<p class="fx-foto__eq"><span class="cinta cinta--${esc(f.equipo)}"></span>${esc(F.nombreEquipo(f.equipo))}</p>
          <p class="fx-foto__c"><b>${f.consigna}.</b> ${esc(textoConsigna(f.consigna))}</p>` : ''}
          <p class="fx-nota">Subida ${F.hora(f.creada)}${f.autor ? ' por <b>' + esc(f.autor) + '</b>' : ''} · ${ESTADOS[f.estado] || esc(f.estado)}
            ${yaAprobada ? ' · <b>ya tienen otra aprobada</b>' : ''}</p>
          <div class="fx-fila">
            ${f.estado !== 'aprobada' ? `<button class="btn fx-ok" data-revisar="aprobada" data-id="${esc(f.id)}">✓ Aprobar</button>` : ''}
            ${f.estado !== 'rechazada' ? `<button class="btn btn--ghost" data-revisar="rechazada" data-id="${esc(f.id)}">✗ Rechazar</button>` : ''}
            ${f.estado !== 'pendiente' && !conContexto ? `<button class="fx-link" data-revisar="pendiente" data-id="${esc(f.id)}">Volver a pendiente</button>` : ''}
            ${conContexto && pendientes().length > 1 ? `<button class="fx-link" data-saltar="${esc(f.id)}">Saltar</button>` : ''}
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

  // Una fila por consigna y una columna por equipo: entra a lo ancho del celu sin scroll lateral
  function renderGrilla() {
    const n = total();
    const nums = Array.from({ length: n }, (_, i) => i + 1);
    $('#grilla').innerHTML = n ? `<div class="fx-grilla" style="--e:${C.equipos.length}">
      <span class="fx-grilla__h"></span>${C.equipos.map(eq => `<span class="fx-grilla__h fx-grilla__eq"><span class="cinta cinta--${eq.id}"></span>${esc(eq.nombre)}</span>`).join('')}
      ${nums.map(i => `<span class="fx-grilla__c"><b>${i}.</b> ${esc(textoConsigna(i))}</span>` +
        C.equipos.map(eq => {
          const est = F.estadoConsigna(datos.fotos, eq.id, i);
          const cant = datos.fotos.filter(f => f.equipo === eq.id && f.consigna === i).length;
          return `<button class="fx-celda is-${est}" data-celda="${eq.id}:${i}" ${cant ? '' : 'disabled'} aria-label="${esc(eq.nombre)} · consigna ${i}">${i}${cant > 1 ? `<small>×${cant}</small>` : ''}</button>`;
        }).join('')).join('')}
    </div>
    <p class="fx-nota">Verde: aprobada · amarillo: pendiente · rosa: rechazada. ×2, ×3: cuántas fotos mandaron. Tocá un casillero para ver las fotos.</p>`
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
    const cambio = { estado, listo: 0 };
    cambios.set(id, cambio);
    f.estado = estado;
    firmaAnterior = '';
    render();
    try {
      await F.supabase.revisar(clave, f.id, estado);
      cambio.listo = Date.now();
    } catch (e) {
      if (cambios.get(id) === cambio) cambios.delete(id);
      // Mientras se guardaba pudo llegar otra lectura: se corrige la foto que está en pantalla ahora
      const actual = datos.fotos.find(x => x.id === id);
      if (actual) actual.estado = antes;
      firmaAnterior = '';
      render();
      alert('No se pudo guardar: ' + e.message);
    }
  }

  async function largar(si) {
    if (!confirm(si ? '¿Largar el juego? Las consignas aparecen en todos los celus.' : '¿Volver a "esperando largada"? Se esconden las consignas y no pueden subir fotos.')) return;
    try {
      await F.supabase.largar(clave, si);
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
    else if (t.dataset.revisar) {
      revisar(t.dataset.id, t.dataset.revisar);
      if (t.closest('#revisar')) irARevisar();
    }
    else if (t.dataset.saltar) saltar(t.dataset.saltar);
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
  // Lo que se escribe queda en el celu hasta guardarlo: al minimizar, el navegador puede recargar la página
  const borrador = {
    get() { try { return JSON.parse(localStorage.getItem('fotos-borrador')); } catch (e) { return null; } },
    set(v) { try { v ? localStorage.setItem('fotos-borrador', JSON.stringify(v)) : localStorage.removeItem('fotos-borrador'); } catch (e) {} },
  };
  // Una por línea. Si se pegan numeradas ("1. …", "2) …") o con viñetas, el número y la viñeta se sacan
  const consignasEditor = () => $('#editor').value.split('\n')
    .map(t => t.replace(/^\s*(\d+[.)]|[-•*])\s+/, '').trim()).filter(Boolean);
  const contar = () => {
    const n = consignasEditor().length;
    $('#cuenta').textContent = n === 1 ? '1 consigna' : n + ' consignas';
  };

  function cargarEditor() {
    const guardadas = datos.consignas || [];
    let b = borrador.get();
    if (Array.isArray(b)) b = b.join('\n'); // borradores de cuando era un casillero por consigna
    // Un borrador igual a lo guardado no hace falta
    if (typeof b !== 'string' || JSON.stringify(b.split('\n').map(t => t.trim()).filter(Boolean)) === JSON.stringify(guardadas)) {
      borrador.set(null);
      b = null;
    }
    $('#editor').value = b !== null ? b : guardadas.join('\n');
    contar();
    if (b !== null) $('#guardarMsg').textContent = 'Recuperé lo que estabas escribiendo. Todavía no está guardado.';
  }

  $('#editor').addEventListener('input', () => {
    borrador.set($('#editor').value);
    contar();
  });

  $('#guardar').addEventListener('click', async () => {
    const consignas = consignasEditor();
    const msg = $('#guardarMsg');
    if (datos.inicio && consignas.length !== total() && !confirm('El juego ya largó y cambia la cantidad de consignas. ¿Guardar igual?')) return;
    msg.textContent = 'Guardando…';
    try {
      await F.supabase.guardar(clave, consignas);
      // Sin esperar a refrescar: si había una lectura en curso, traería las consignas de antes y el editor volvería atrás
      borrador.set(null);
      datos.consignas = consignas;
      firmaAnterior = '';
      render();
      cargarEditor();
      msg.textContent = `Guardadas ${consignas.length} consignas.`;
      refrescar();
    } catch (e) {
      msg.textContent = 'No se pudo guardar: ' + e.message;
    }
  });

  $('#reiniciar').addEventListener('click', async () => {
    if (!confirm('¿Borrar TODAS las fotos y volver a "esperando largada"?')) return;
    if (prompt('Escribí BORRAR para confirmar') !== 'BORRAR') return;
    try {
      await F.supabase.reiniciar(clave);
    } catch (e) {
      alert('No se pudo: ' + e.message);
    }
    refrescar();
  });

  // ===== BAJAR TODO =========================================================
  // Un .zip con las fotos por equipo, un resumen para leer y los datos crudos
  function cargarScript(src) {
    return new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = () => mal(new Error('no se pudo cargar el armador de .zip'));
      document.head.append(s);
    });
  }

  const paraArchivo = s => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  const recortar = (s, n) => (s.length > n ? s.slice(0, n).trim() + '…' : s);

  function resumen(d, t) {
    const consignas = d.consignas || [];
    const lineas = [`Jacowaco's Games ${new Date(d.inicio || Date.now()).getFullYear()} · bajado el ${new Date().toLocaleString('es-AR', { hour12: false })}`, ''];
    lineas.push('POSICIONES', ...F.posiciones(t.juegos).map(p => `${p.puesto}º ${p.equipo.nombre}: ${p.total} pts`), '');
    lineas.push('JUEGOS', ...t.juegos.map((j, i) => `${i + 1}. ${j.nombre}${j.doble ? ' (×2)' : ''}: ` + C.equipos.slice()
      .sort((a, b) => (j.puestos[a.id] || 9) - (j.puestos[b.id] || 9))
      .map(e => `${e.nombre} ${j.puestos[e.id] ? j.puestos[e.id] + 'º' : '–'} (+${F.puntos(j, e.id)})`).join(' · ')), '');
    lineas.push(`ANOTADOS (${t.jugadores.length})`, ...C.equipos.map(e => {
      const js = t.jugadores.filter(j => j.equipo === e.id);
      return `${e.nombre} (${js.length}): ${js.map(j => j.nombre).join(', ')}`;
    }), '');
    lineas.push('CAZA DE FOTOS', ...F.ranking(d.fotos, consignas.length).map((r, i) => `${i + 1}. ${r.equipo.nombre}: ${r.hechas}/${consignas.length}`
      + (r.ultima ? ` · última aprobada ${F.hora(r.ultima)}` + (d.inicio ? ` (${F.duracion(r.ultima - d.inicio)})` : '') : '')), '');
    lineas.push('CONSIGNAS', ...consignas.map((c, i) => `${i + 1}. ${c}`));
    return lineas.join('\r\n');
  }

  $('#bajarTodo').addEventListener('click', async () => {
    const btn = $('#bajarTodo'), msg = $('#bajarMsg');
    btn.disabled = true;
    msg.textContent = 'Leyendo los datos…';
    try {
      if (!window.JSZip) await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      const [d, t] = await Promise.all([F.admin(clave), F.tablero.admin(clave)]);
      const consignas = d.consignas || [];
      const zip = new window.JSZip();
      zip.file('resumen.txt', resumen(d, t));
      zip.file('datos.json', JSON.stringify({
        inicio: d.inicio && new Date(d.inicio).toISOString(),
        consignas,
        juegos: t.juegos.map(j => ({ nombre: j.nombre, doble: j.doble, puestos: j.puestos })),
        // Sin los id: con el id se puede editar a esa persona
        anotados: t.jugadores.map(j => ({ nombre: j.nombre, equipo: j.equipo })),
        fotos: d.fotos.map(f => ({ equipo: f.equipo, consigna: f.consigna, autor: f.autor, estado: f.estado, subida: new Date(f.creada).toISOString() })),
      }, null, 2));

      // Nombre: "03 - Pizzas colgantes - Floraa - 17.27.31 - aprobada.jpg", dentro de la carpeta del equipo
      const usados = new Set();
      const cola = d.fotos.map(f => {
        const base = `fotos/${f.equipo}/${String(f.consigna).padStart(2, '0')} - ${paraArchivo(recortar(consignas[f.consigna - 1] || 'consigna borrada', 45))}`
          + ` - ${paraArchivo(f.autor || 'sin nombre')} - ${F.hora(f.creada).replace(/:/g, '.')} - ${f.estado}`;
        let nombre = base + '.jpg';
        for (let i = 2; usados.has(nombre); i++) nombre = `${base} (${i}).jpg`;
        usados.add(nombre);
        return { f, nombre };
      });
      let hechas = 0;
      const fallaron = [];
      await Promise.all(Array.from({ length: 4 }, async () => {
        for (let x; (x = cola.shift());) {
          try {
            const r = await fetch(x.f.url);
            if (!r.ok) throw new Error(r.status);
            zip.file(x.nombre, await r.blob(), { date: new Date(x.f.creada) });
          } catch (e) {
            fallaron.push(x.nombre);
          }
          msg.textContent = `Bajando fotos: ${++hechas} de ${d.fotos.length}…`;
        }
      }));
      if (fallaron.length) zip.file('fotos que no bajaron.txt', fallaron.join('\r\n'));

      msg.textContent = 'Armando el .zip…';
      const blob = await zip.generateAsync({ type: 'blob' }); // las fotos ya vienen comprimidas: se guardan tal cual
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `jacowacos-games-${new Date(d.inicio || Date.now()).getFullYear()}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      msg.textContent = `Listo: ${d.fotos.length - fallaron.length} fotos (${(blob.size / 1048576).toFixed(0)} MB)`
        + (fallaron.length ? `. No bajaron ${fallaron.length}: la lista está adentro del .zip.` : '.');
    } catch (e) {
      msg.textContent = 'No se pudo: ' + e.message;
    } finally {
      btn.disabled = false;
    }
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
