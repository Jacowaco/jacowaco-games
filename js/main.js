/* Jacowaco's Games, Ray of Light edition — animaciones y datos */
(function () {
  'use strict';

  // ===== CONFIG ============================================================
  const WHATSAPP_NUMBER = '5491133685915'; // ej: '5491112345678' (con código de país, sin +)
  const SITE_URL = 'https://jacowaco.github.io/jacowaco-games/';
  const EVENT = {
    title: "Jacowaco's Games · Ray of Light",
    startUTC: '20261031T173000Z', // 14:30 ART
    endUTC: '20261031T210000Z',   // 18:00 ART
    location: 'Plaza Florencio Sánchez, Bosques de Palermo, Buenos Aires',
    details: 'Ropa deportiva cómoda + algo para tomar o picar. ' + SITE_URL,
  };

  const EQUIPOS = {
    ninja:  { nombre: 'Ninja',  cinta: 'negra' },
    gay:    { nombre: 'Gay',    cinta: 'arcoíris' },
    patrio: { nombre: 'Patrio', cinta: 'argentina' },
    pinup:  { nombre: 'Pinup',  cinta: 'amarilla a lunares' },
  };

  const HISTORIAL = [
    { year: 2018, lugar: 'Plaza',  fecha: '27 oct', campeon: 'ninja',  otros: ['Fluor', 'Gay', 'Patrio'],      foto: 'ganadores2018' },
    { year: 2019, lugar: 'Plaza',  fecha: '9 nov',  campeon: 'ninja',  otros: ['Hot', 'Pinup', 'Patrio'],      foto: 'ganadores2019' },
    { year: 2021, lugar: 'Plaza',  fecha: '13 nov', campeon: 'ninja',  otros: ['Frutilla', 'Patrio', 'Pinup'], foto: 'ganadores2021' },
    { year: 2023, lugar: 'Dentro', fecha: '21 oct', campeon: 'patrio', otros: ['Gay', 'Ninja', 'Pinup'],       foto: 'ganadores2023' },
    { year: 2024, lugar: 'Plaza',  fecha: '9 nov',  campeon: 'gay',    otros: ['Patrio', 'Dino', 'Ninja'],     foto: 'ganadores2024', nota: 'Nadie le sacó foto al equipo. Va la grupal.' },
    { year: 2025, lugar: 'Dentro', fecha: '25 oct', campeon: 'pinup',  otros: ['Gay', 'Patrio', 'Ninja'],      foto: 'ganadores2025' },
  ];

  const FOTOS = [
    'foto2018', 'foto2018b', 'foto2018c', 'foto2019', 'foto2019b', 'foto2021', 'foto2021b',
    'foto2023', 'foto2023b', 'foto2023c', 'foto2024', 'foto2024b', 'foto2025', 'foto2025b', 'foto2025c',
  ];

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp01 = v => Math.min(1, Math.max(0, v));

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  // ===== HALL OF FAME: álbum de figuritas ====================================
  $('#podioTrack').innerHTML = HISTORIAL.map(h => {
    const eq = EQUIPOS[h.campeon];
    return `
      <article class="figu">
        <img src="img/${h.foto}-s.webp" alt="Equipo ${eq.nombre}, campeón ${h.year}" loading="lazy">
        <span class="figu__n">${h.year}</span>
        <div class="figu__foot">
          <span class="cinta cinta--${h.campeon}"></span>
          <p class="figu__label">Campeón</p>
          <p class="figu__name">${eq.nombre}</p>
          <p class="figu__meta">${h.lugar} · ${h.fecha} · vs ${h.otros.join(' · ')}${h.nota ? '<br><em>' + h.nota + '</em>' : ''}</p>
        </div>
      </article>`;
  }).join('') + `
      <article class="figu figu--next">
        <p class="figu__year">2026</p>
        <p class="figu__hand">Tu foto acá</p>
      </article>`;

  // Títulos contados con palitos + los años en que ganó cada uno
  const counts = {}, years = {};
  HISTORIAL.forEach(h => {
    counts[h.campeon] = (counts[h.campeon] || 0) + 1;
    (years[h.campeon] = years[h.campeon] || []).push(h.year);
  });
  $('#titulosRows').innerHTML = Object.keys(EQUIPOS)
    .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
    .map(k => {
      const n = counts[k] || 0;
      return `
      <li>
        <span class="tally__team">${EQUIPOS[k].nombre}</span>
        <span class="tally__marks" aria-hidden="true">${'<i></i>'.repeat(n)}</span>
        <span class="tally__n">${(years[k] || []).map(y => `<span>${y}</span>`).join('')}</span>
      </li>`;
    }).join('');

  // Tiras de fotos pegadas con cinta (duplicadas para que el loop no tenga corte)
  const per = Math.ceil(FOTOS.length / 3);
  [FOTOS.slice(0, per), FOTOS.slice(per, per * 2), FOTOS.slice(per * 2)].forEach((list, i) => {
    // la momia (foto2018b) carga sí o sí: es el remate de "Momias envueltas"
    const html = list.map(f => `<figure class="foto"><img src="img/${f}-s.webp" alt="" loading="${f === 'foto2018b' ? 'eager' : 'lazy'}"></figure>`).join('');
    $('#tira' + (i + 1)).innerHTML = html + html;
  });
  // Las tiras arrancan quietas y empiezan a correr recién cuando entran en pantalla,
  // así la momia (2ª foto de la primera tira) está a la vista la primera vez que llegás.
  const tiraIO = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-on'); tiraIO.unobserve(e.target); }
  }), { rootMargin: '0px 0px -15% 0px' });
  document.querySelectorAll('.tira').forEach(t => tiraIO.observe(t));

  // ===== HERO ================================================================
  // En celu el título sube y la cinta tapa la parte de abajo del sol: el slogan se centra en lo
  // que queda visible. Se mide con offsetTop (layout, sin las animaciones de entrada).
  function fitSlogan() {
    const hero = $('.hero'), sun = $('.hero__sun'), content = $('.hero__content'), tape = $('.hero__who');
    if (window.innerWidth >= 700) { hero.style.removeProperty('--slogan-pb'); return; }
    const tapeTop = content.offsetTop + tape.offsetTop;
    const covered = sun.offsetTop + sun.offsetHeight - tapeTop + 8;       // + aire sobre la cinta
    hero.style.setProperty('--slogan-pb', Math.max(0, covered) + 'px');
  }
  fitSlogan();
  window.addEventListener('resize', fitSlogan);
  if (document.fonts) document.fonts.ready.then(fitSlogan);

  // Orden: slogan sobre la lluvia → se despeja y sale el sol detrás → título y datos → cintas
  if (!reduce) {
    // El slogan entra sobre la lluvia; mientras termina de aparecer se despeja y sube el sol
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    // primero "Este sábado", después "sale el sol" (justo cuando empieza a despejar)
    tl.fromTo('.hero__slogan em', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.3)
      .fromTo('.hero__slogan b', { opacity: 0, y: 24, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.6)' }, 0.95)
      .to('.nube--1', { xPercent: -130, duration: 1.3, ease: 'power2.in' }, 1.0)
      .to('.nube--2', { xPercent: 130, duration: 1.3, ease: 'power2.in' }, 1.05)
      .to('.nube--3', { yPercent: -140, duration: 1.2, ease: 'power2.in' }, 1.1)
      .to('.hero__rain', { autoAlpha: 0, duration: 1.1, ease: 'power1.inOut' }, 1.0)
      .set('.hero__clouds', { autoAlpha: 0 }, 2.4)
      .to('.hero__sun', { y: 0, duration: 1.6 }, 1.1)
      .to('.hero__slogan', { color: '#191816', duration: 0.8 }, 1.4)
      // de a uno: cinta, "Ray of", "Light", sello "Edition", datos
      .fromTo('.hero__who', { y: 30, opacity: 0, rotate: -9 }, { y: 0, opacity: 1, rotate: -3, duration: 0.7 }, 2.3)
      .fromTo('.hero__l', { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.45 }, 2.75)
      .fromTo('.hero__ed', { scale: 2.4, opacity: 0, rotate: -12 }, { scale: 1, opacity: 1, rotate: 0, duration: 0.45, ease: 'back.out(2.5)' }, 3.75)
      .fromTo('.hero__meta', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 4.25)
      .set('.hero__cintas', { visibility: 'visible' }, 4.7)
      .from('.hero__cintas .cinta', { xPercent: (i) => (i % 2 ? 110 : -110), duration: 1.1, stagger: 0.12, ease: 'power4.out' }, 4.7)
      .fromTo('.hero__scroll', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6 }, 5.9);
    gsap.to('.hero__content', {
      yPercent: -25, opacity: 0.2, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });

    // ===== PREMIOS: las fotos se pegan de a una (caen torcidas y se acomodan con la cinta)
    gsap.from('.premio', {
      y: '-=90', opacity: 0, scale: 1.15, rotation: (i) => (i % 2 ? '+=14' : '-=14'),
      duration: 0.55, stagger: 0.38, ease: 'back.out(1.7)',
      scrollTrigger: { trigger: '.premios__grid', start: 'top 72%', once: true },
    });

    // ===== EQUIPOS: entran de a uno (la cinta se desenrolla, después cae el nombre)
    const teamsTl = gsap.timeline({
      scrollTrigger: { trigger: '.equipos__grid', start: 'top 82%', once: true },
    });
    gsap.utils.toArray('.team').forEach((team, i) => {
      const left = i % 2 === 0;
      const at = i * 0.35;
      teamsTl
        .from(team.querySelector('.cinta'), {
          scaleX: 0, transformOrigin: left ? '0% 50%' : '100% 50%', duration: 0.6, ease: 'power3.out',
        }, at)
        .from(team.querySelector('.team__name'), {
          y: 36, opacity: 0, rotate: left ? -5 : 5, duration: 0.55, ease: 'back.out(2)',
        }, at + 0.3);
    });
  }

  // ===== RULETA ==============================================================
  const order = ['ninja', 'gay', 'patrio', 'pinup'];
  const rName = $('#ruletaName'), rCinta = $('#ruletaCinta'), rNote = $('#ruletaNote'), rBtn = $('#ruletaBtn');
  const NOTA = 'Mentira. El sorteo real es en la plaza.';
  let spinning = false;
  function show(k) { rName.textContent = EQUIPOS[k].nombre; rCinta.className = 'cinta cinta--' + k; }
  rBtn.addEventListener('click', () => {
    if (spinning) return;
    spinning = true; rNote.textContent = ''; rBtn.textContent = '...';
    let i = Math.floor(Math.random() * 4), steps = 12 + Math.floor(Math.random() * 6), delay = 60;
    const tick = () => {
      i = (i + 1) % 4; show(order[i]); steps--;
      if (steps > 0) { delay *= 1.2; setTimeout(tick, delay); return; }
      spinning = false; rBtn.textContent = 'Otra vez';
      rNote.textContent = NOTA;
      if (!reduce) gsap.fromTo('#ruletaSlot', { rotation: -3 }, { rotation: -1, duration: 0.6, ease: 'elastic.out(1,0.4)' });
    };
    tick();
  });

  // ===== EDICIÓN 2026: los juegos tachados no se dejan leer =====================
  const SECRETOS = ['Se revela en la plaza.', 'Ni lo intentes.', 'Buen intento.', 'Eso es secreto.', 'Paciencia: sábado 31.'];
  let secretoIdx = 0;
  document.querySelectorAll('.redact').forEach(b => b.addEventListener('click', () => {
    b.classList.remove('is-shake'); void b.offsetWidth; b.classList.add('is-shake');
    $('#planillaNote').textContent = SECRETOS[secretoIdx++ % SECRETOS.length];
  }));

  // ===== HALL OF FAME: la sección se frena y el álbum pasa de costado ==========
  const album = $('#podioTrack'), hofOuter = $('.hof__outer');
  // El recorrido termina con la figurita 2026 centrada en pantalla.
  // clientWidth descuenta la barra de scroll; innerWidth no.
  const hofLast = album.querySelector('.figu--next');
  // El álbum arranca con la primera figurita en el centro de la pantalla y termina con la 2026
  // en el centro. Cada figurita se estampa al llegar al medio y el scroll se la lleva a la izquierda.
  // Se mide con offsetLeft/offsetWidth (layout puro) para que el estampado, que escala, no altere la cuenta.
  const figus = gsap.utils.toArray('.album .figu');
  const vwNow = () => document.documentElement.clientWidth;               // sin la barra de scroll
  const albumRestLeft = () => album.getBoundingClientRect().left - gsap.getProperty(album, 'x');
  const centerOf = f => f.offsetLeft + f.offsetWidth / 2;                 // centro dentro del álbum
  const xFor = f => vwNow() / 2 - (albumRestLeft() + centerOf(f));        // x que deja a f en el centro
  // HOF_SLOW > 1: hace falta más scroll que píxeles recorre el álbum.
  const HOF_SLOW = 1.4;
  // Al frenarse la sección, un tramo corto de scroll con el álbum quieto (se pega la primera).
  const hofHold = () => window.innerHeight * 0.2;
  function hofLayout() { hofOuter.style.height = (window.innerHeight + hofHold() + Math.max(0, xFor(figus[0]) - xFor(hofLast)) * HOF_SLOW) + 'px'; }
  hofLayout();
  ScrollTrigger.addEventListener('refreshInit', hofLayout);

  // El álbum sigue al scroll (suavizado), con una "traba": no puede pasar el centro de la próxima
  // figurita que todavía no se pegó. Con scroll lento ni se nota; con scroll rápido el álbum
  // avanza a golpes, figurita por figurita, y cada una se pega siempre en el centro, a la vista.
  let hofProg = 0, albumX = null, gateIdx = reduce ? figus.length : 0, stampIdx = 0, hofOn = false;
  ScrollTrigger.create({
    trigger: hofOuter, start: () => `top+=${Math.round(hofHold())} top`, end: 'bottom bottom', invalidateOnRefresh: true,
    onUpdate: self => { hofProg = self.progress; },
    onRefresh: self => { hofProg = self.progress; albumX = null; },
  });
  function hofTick() {
    const start = xFor(figus[0]), end = xFor(hofLast);
    let target = start + (end - start) * hofProg;
    if (gateIdx < figus.length) target = Math.max(target, xFor(figus[gateIdx]));
    if (albumX === null || reduce) albumX = target;
    else albumX += (target - albumX) * 0.16;
    gsap.set(album, { x: albumX });
    stampCheck();
  }
  // Solo corre mientras la sección está cerca de la pantalla
  ScrollTrigger.create({
    trigger: hofOuter, start: 'top bottom', end: 'bottom top',
    onToggle: self => {
      if (self.isActive && !hofOn) { hofOn = true; gsap.ticker.add(hofTick); }
      else if (!self.isActive && hofOn) { hofOn = false; gsap.ticker.remove(hofTick); }
    },
  });
  albumX = null; gsap.set(album, { x: xFor(figus[0]) });

  // Figuritas estampadas de a una: cada una cae grande y torcida en el centro de la pantalla,
  // pega contra el álbum y lo sacude. La próxima arranca un toque antes de llegar al medio;
  // la traba sostiene al álbum en el centro hasta que termina de pegar.
  function stampCheck() {
    if (reduce || stampIdx >= figus.length || stampIdx > gateIdx) return;
    if (hofOuter.getBoundingClientRect().top > window.innerHeight * 0.08) return; // la sección no se frenó
    const f = figus[stampIdx];
    const left = album.getBoundingClientRect().left;
    if (left + centerOf(f) > vwNow() / 2 + f.offsetWidth * 0.15) return;          // todavía no llegó
    stampIdx++;
    stamp(f);
  }
  function stamp(f) {
    const r = parseFloat(getComputedStyle(f).getPropertyValue('--r')) || 0;
    const side = figus.indexOf(f) % 2 ? 1 : -1;
    gsap.fromTo(f, { opacity: 0, scale: 1.7, rotation: r + side * 12, y: -30 }, {
      opacity: 1, scale: 1, rotation: r, y: 0, duration: 0.24, ease: 'power4.in',
      onComplete: () => {
        gateIdx++;                                                        // libera el álbum
        gsap.timeline().to(album, { y: 7, duration: 0.05, ease: 'power1.out' })
          .to(album, { y: 0, duration: 0.25, ease: 'elastic.out(1, 0.35)' });
      },
    });
  }
  // Planilla de títulos: la hoja cae pegada, cada fila se escribe (nombre, palitos uno por uno,
  // años) y después la pregunta, con el resaltador rosa pasando por debajo.
  if (!reduce) {
    const tt = gsap.timeline({ scrollTrigger: { trigger: '.titulos', start: 'top 72%', once: true } });
    tt.from('.tally', { y: -70, opacity: 0, rotation: -7, duration: 0.4, ease: 'back.out(1.6)' });
    gsap.utils.toArray('#titulosRows li').forEach((li, i) => {
      const at = 0.25 + i * 0.18;
      tt.from(li.querySelector('.tally__team'), { x: -18, opacity: 0, duration: 0.22, ease: 'power2.out' }, at)
        .from(li.querySelectorAll('.tally__marks i'), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.07, stagger: 0.06, ease: 'power2.in' }, at + 0.08)
        .from(li.querySelectorAll('.tally__n span'), { opacity: 0, y: 6, duration: 0.18, stagger: 0.04 }, at + 0.12);
    });
    // La pregunta arranca mientras se terminan de escribir las últimas filas
    const qAt = 0.25 + gsap.utils.toArray('#titulosRows li').length * 0.18;
    tt.from('.titulos__l1', { y: 40, opacity: 0, duration: 0.4, ease: 'power3.out' }, qAt)
      .from('.titulos__q mark', { opacity: 0, duration: 0.3, ease: 'power3.out' }, qAt + 0.25)
      .fromTo('.titulos__q mark', { '--hl': '0%' }, { '--hl': '100%', duration: 0.5, ease: 'power2.inOut' }, qAt + 0.45)
      .to('.titulos__q', { rotation: -1.5, duration: 0.07, yoyo: true, repeat: 3, ease: 'power1.inOut' }, qAt + 0.95);
  }

  if (!reduce) gsap.set(figus, { opacity: 0 });

  // ===== MAPA: coreografía ===================================================
  const mapa = $('.mapa'), globeEl = $('#globe'), mapEl = $('#map');
  const label = $('#mapLabel'), alt = $('#mapAlt'), pin = $('#mapPin'), card = $('#mapCard'), foto = $('#mapFoto');
  // Recorrido (p = progreso de scroll en la sección):
  //   0 → GLOBE_END  globo girando y acercándose
  //   GLOBE_END → ARRIVE  descenso satelital hasta la plaza
  //   ARRIVE → 1  la plaza queda quieta y la info aparece por partes (pin, nombre, ubicación, botón)
  // La sección mide 710vh (610vh de recorrido). K convierte las marcas pensadas para 620vh de
  // recorrido, así el descenso va a la misma velocidad. En la plaza: 4 pasos de ~22vh (tarjeta,
  // ubicación, botón, foto) y después ~100vh de hold con la foto a la vista.
  const RANGE = 610;
  const K = 620 / RANGE;
  const GLOBE_END = 0.4 * K, ARRIVE = 0.68 * K;
  const STAGES = [[0, 'Planeta Tierra'], [0.22 * K, 'Sudamérica'], [0.36 * K, 'Argentina'], [0.47 * K, 'Buenos Aires'], [0.58 * K, 'Bosques de Palermo'], [ARRIVE, '']];
  const STEP = 22 / RANGE;
  let target = 0, current = 0, rafOn = false;

  function applyProgress(p) {
    const globeOff = !!window.sunshineGlobeFailed;
    const g = clamp01(p / GLOBE_END);
    if (window.sunshineGlobe) window.sunshineGlobe.update(g);
    const fade = globeOff ? 1 : clamp01((p - (GLOBE_END - 0.06)) / 0.08);
    mapEl.style.opacity = fade;
    globeEl.style.opacity = 1 - fade;
    if (window.sunshineMap) window.sunshineMap.setProgress(globeOff ? clamp01(p / ARRIVE) : clamp01((p - GLOBE_END) / (ARRIVE - GLOBE_END)));

    let txt = '';
    for (const [t, s] of STAGES) if (p >= t) txt = s;
    if (label.textContent !== txt) label.textContent = txt;

    const km = 36000 * Math.pow(1 - clamp01(p / ARRIVE), 3) + 0.3;
    alt.textContent = 'ALT ' + (km >= 10 ? Math.round(km).toLocaleString('es-AR') + ' km' : Math.round(km * 1000).toLocaleString('es-AR') + ' m');

    // Spawn por partes durante el hold en la plaza
    pin.classList.toggle('is-down', p >= ARRIVE);
    card.classList.toggle('is-on', p > ARRIVE + STEP);
    card.classList.toggle('is-on2', p > ARRIVE + STEP * 2);
    card.classList.toggle('is-on3', p > ARRIVE + STEP * 3);
    foto.classList.toggle('is-on', p > ARRIVE + STEP * 4); // después del botón de Maps
  }

  // El loop corre hasta alcanzar el scroll y recién ahí se apaga. No depende de si la
  // sección está visible: si se apagara antes, quedaba trabado a mitad del descenso.
  function tick() {
    const gap = target - current;
    if (Math.abs(gap) < 0.0005) { current = target; applyProgress(current); rafOn = false; return; }
    // el tope de velocidad solo hace falta durante el descenso (carga de tiles); en la plaza, no
    const inMap = current > GLOBE_END && current < ARRIVE && gap > 0;
    const waiting = inMap && window.sunshineMap && window.sunshineMap.loading();
    let step = gap * 0.14;
    if (inMap) step = Math.min(step, waiting ? 0.0035 : 0.006); // descenso acotado: Leaflet mantiene tiles del nivel anterior
    current += step;
    applyProgress(current);
    requestAnimationFrame(tick);
  }

  if (!reduce) {
    ScrollTrigger.create({
      trigger: mapa, start: 'top top', end: 'bottom bottom',
      onUpdate: self => { target = self.progress; if (!rafOn) { rafOn = true; tick(); } },
    });
    applyProgress(0);
  } else {
    mapEl.style.opacity = 1; label.textContent = ''; alt.textContent = '';
  }

  // ===== FINAL: WhatsApp + Google Calendar ===================================
  const msg = encodeURIComponent('¡Voy a los Jacowaco\'s Games! ☀️ ' + SITE_URL);
  const hasNumber = /^\d{8,15}$/.test(WHATSAPP_NUMBER);
  $('#waBtn').href = hasNumber ? `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}` : `https://wa.me/?text=${msg}`;

  $('#gcalLink').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(EVENT.title)
    + '&dates=' + EVENT.startUTC + '/' + EVENT.endUTC
    + '&location=' + encodeURIComponent(EVENT.location)
    + '&details=' + encodeURIComponent(EVENT.details);

  // Recalcular al cargar fuentes/imágenes
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
