/* Jacowaco's Sunshine Games — animaciones y datos */
(function () {
  'use strict';

  // ===== CONFIG ============================================================
  const WHATSAPP_NUMBER = '5491133685915'; // ej: '5491112345678' (con código de país, sin +)
  const SITE_URL = 'https://jacowaco.github.io/jacowaco-games/';
  const EVENT = {
    title: "Jacowaco's Sunshine Games",
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

  // ===== PODIO: tarjetas =====================================================
  const track = $('#podioTrack');
  track.innerHTML = HISTORIAL.map(h => {
    const eq = EQUIPOS[h.campeon];
    return `
      <article class="card">
        <img src="img/${h.foto}.webp" alt="Equipo ${eq.nombre}, campeón ${h.year}" loading="lazy">
        <div class="card__year">${h.year}</div>
        <div class="card__bottom">
          <span class="cinta cinta--${h.campeon}"></span>
          <p class="card__champ"><small>Campeón</small>${eq.nombre}</p>
          <p class="card__others">${h.lugar} · ${h.fecha} · vs ${h.otros.join(' · ')}${h.nota ? '<br><em>' + h.nota + '</em>' : ''}</p>
        </div>
      </article>`;
  }).join('') + `
      <article class="card card--next">
        <div>
          <div class="card__year">2026</div>
          <p class="card__champ">Tu foto acá</p>
          <p>Sáb 31 oct · Plaza</p>
        </div>
      </article>`;

  // Tabla de títulos
  const counts = {};
  HISTORIAL.forEach(h => { counts[h.campeon] = (counts[h.campeon] || 0) + 1; });
  const maxC = Math.max(...Object.values(counts));
  $('#titulosRows').innerHTML = Object.keys(EQUIPOS)
    .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
    .map(k => `
      <div class="titulos__row">
        <span class="titulos__team">${EQUIPOS[k].nombre}</span>
        <span class="cinta cinta--${k} titulos__bar" style="width:${(counts[k] || 0) / maxC * 100}%"></span>
        <span class="titulos__n">${counts[k] || 0}</span>
      </div>`).join('');

  // Marquee de fotos (dos filas, duplicadas para loop infinito)
  const half = Math.ceil(FOTOS.length / 2);
  const rows = [FOTOS.slice(0, half), FOTOS.slice(half)];
  rows.forEach((list, i) => {
    const html = list.map(f => `<img src="img/${f}-s.webp" alt="" loading="lazy">`).join('');
    $('#marquee' + (i + 1)).innerHTML = html + html;
  });

  // ===== HERO ================================================================
  if (!reduce) {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('[data-hero]', { y: 40, opacity: 0, duration: 1, stagger: 0.15 }, 0.3)
      .from('.hero__cintas .cinta', { xPercent: (i) => (i % 2 ? 110 : -110), duration: 1.1, stagger: 0.12, ease: 'power4.out' }, 0.5);
    gsap.to('.hero__content', {
      yPercent: -25, opacity: 0.2, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  // ===== REVEALS =============================================================
  if (!reduce) {
    document.querySelectorAll('[data-reveal]').forEach(el => {
      gsap.to(el, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    document.querySelectorAll('[data-reveal-group]').forEach(g => {
      gsap.to(g.children, { y: 0, opacity: 1, duration: 0.8, stagger: 0.12, ease: 'power3.out',
        scrollTrigger: { trigger: g, start: 'top 85%', once: true } });
    });
    document.querySelectorAll('.titulos__bar').forEach(b => {
      gsap.to(b, { scaleX: 1, duration: 1.1, ease: 'power3.out',
        scrollTrigger: { trigger: b, start: 'top 90%', once: true } });
    });
    document.querySelectorAll('[data-count]').forEach(el => {
      const to = +el.dataset.count, from = +(el.dataset.from || 0);
      const o = { v: from };
      gsap.to(o, { v: to, duration: 1.6, ease: 'power2.out', snap: { v: 1 },
        onUpdate: () => { el.textContent = Math.round(o.v); },
        scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
  } else {
    document.querySelectorAll('.titulos__bar').forEach(b => { b.style.transform = 'none'; });
    document.querySelectorAll('[data-count]').forEach(el => { el.textContent = el.dataset.count; });
  }

  // ===== RULETA ==============================================================
  const order = ['ninja', 'gay', 'patrio', 'pinup'];
  const rName = $('#ruletaName'), rCinta = $('#ruletaCinta'), rNote = $('#ruletaNote'), rBtn = $('#ruletaBtn');
  const NOTAS = [
    'Mentira. El sorteo real es en la plaza.',
    'No te ilusiones, en la plaza se sortea de nuevo.',
    'Esto no vale. La cinta posta te la doy yo.',
    'Capturá pantalla igual, por las dudas.',
  ];
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
      rNote.textContent = NOTAS[Math.floor(Math.random() * NOTAS.length)];
      if (!reduce) gsap.fromTo('#ruletaSlot', { scale: 0.96 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1,0.4)' });
    };
    tick();
  });

  // ===== PODIO: scroll horizontal ===========================================
  const outer = $('.podio__outer');
  function podioExtra() { return Math.max(0, track.offsetWidth - window.innerWidth); }
  function podioLayout() { outer.style.height = (window.innerHeight + podioExtra()) + 'px'; }
  podioLayout();
  ScrollTrigger.addEventListener('refreshInit', podioLayout);
  gsap.to(track, {
    x: () => -podioExtra(), ease: 'none',
    scrollTrigger: { trigger: outer, start: 'top top', end: 'bottom bottom', scrub: reduce ? true : 0.4, invalidateOnRefresh: true },
  });

  // ===== MAPA: coreografía ===================================================
  const mapa = $('.mapa'), globeEl = $('#globe'), mapEl = $('#map');
  const label = $('#mapLabel'), alt = $('#mapAlt'), pin = $('#mapPin'), card = $('#mapCard');
  const STAGES = [[0, 'Planeta Tierra'], [0.3, 'Sudamérica'], [0.47, 'Argentina'], [0.62, 'Buenos Aires'], [0.8, 'Bosques de Palermo'], [0.93, '']];
  let target = 0, current = 0, rafOn = false, mapaVisible = false;

  function applyProgress(p) {
    const globeOff = !!window.sunshineGlobeFailed;
    const g = clamp01(p / 0.55);
    if (window.sunshineGlobe) window.sunshineGlobe.update(g);
    const fade = globeOff ? 1 : clamp01((p - 0.46) / 0.1);
    mapEl.style.opacity = fade;
    globeEl.style.opacity = 1 - fade;
    if (window.sunshineMap) window.sunshineMap.setProgress(globeOff ? p : clamp01((p - 0.5) / 0.45));

    let txt = '';
    for (const [t, s] of STAGES) if (p >= t) txt = s;
    if (label.textContent !== txt) label.textContent = txt;

    const km = 36000 * Math.pow(1 - p, 3) + 0.3;
    alt.textContent = 'ALT ' + (km >= 10 ? Math.round(km).toLocaleString('es-AR') + ' km' : Math.round(km * 1000).toLocaleString('es-AR') + ' m');

    pin.classList.toggle('is-down', p > 0.93);
    card.classList.toggle('is-on', p > 0.955);
  }

  function tick() {
    if (!mapaVisible) { rafOn = false; return; }
    current += (target - current) * 0.14;
    if (Math.abs(target - current) < 0.0005) current = target;
    applyProgress(current);
    requestAnimationFrame(tick);
  }

  if (!reduce) {
    ScrollTrigger.create({
      trigger: mapa, start: 'top top', end: 'bottom bottom',
      onUpdate: self => { target = self.progress; if (!rafOn && mapaVisible) { rafOn = true; tick(); } },
      onToggle: self => { mapaVisible = self.isActive; if (self.isActive && !rafOn) { rafOn = true; tick(); } },
    });
    new IntersectionObserver(([e]) => {
      mapaVisible = e.isIntersecting;
      if (mapaVisible && !rafOn) { rafOn = true; tick(); }
    }).observe(mapa);
    applyProgress(0);
  } else {
    mapEl.style.opacity = 1; label.textContent = ''; alt.textContent = '';
  }

  // ===== FINAL: WhatsApp + calendario =========================================
  const msg = encodeURIComponent('¡Voy a los Sunshine Games! ☀️ ' + SITE_URL);
  const hasNumber = /^\d{8,15}$/.test(WHATSAPP_NUMBER);
  $('#waBtn').href = hasNumber ? `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}` : `https://wa.me/?text=${msg}`;

  $('#gcalLink').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(EVENT.title)
    + '&dates=' + EVENT.startUTC + '/' + EVENT.endUTC
    + '&location=' + encodeURIComponent(EVENT.location)
    + '&details=' + encodeURIComponent(EVENT.details);

  $('#icsBtn').addEventListener('click', () => {
    const esc = s => s.replace(/,/g, '\\,').replace(/;/g, '\\;');
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sunshine Games//ES', 'BEGIN:VEVENT',
      'UID:sunshine-games-2026@jacowaco', 'DTSTAMP:20261027T000000Z',
      'DTSTART:' + EVENT.startUTC, 'DTEND:' + EVENT.endUTC,
      'SUMMARY:' + esc(EVENT.title), 'LOCATION:' + esc(EVENT.location),
      'DESCRIPTION:' + esc(EVENT.details), 'URL:' + SITE_URL,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.download = 'sunshine-games.ics';
    document.body.appendChild(a); a.click(); a.remove();
  });

  // Recalcular al cargar fuentes/imágenes
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
