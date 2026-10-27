# Jacowaco's Sunshine Games

Landing del cumple. Estática, sin build: `index.html` + `css/` + `js/` + `img/`.

Publicada en https://jacowaco.github.io/jacowaco-games/ (GitHub Pages, rama `main`, raíz).

## Editar

- **Número de WhatsApp**: `js/main.js`, constante `WHATSAPP_NUMBER` (con código de país, sin `+`).
  Mientras sea el placeholder, el botón abre WhatsApp para elegir contacto.
- **Fecha, hora, lugar**: `index.html` (hero y sección final) y `js/main.js` (`EVENT`, para el link de Google Calendar).
- **Historial de campeones**: `js/main.js`, array `HISTORIAL`.
- **Fotos nuevas**: poner los jpg en `originales/` (no se sube a git) y correr `npm install && node tools/optimize.mjs`
  para regenerar `img/*.webp`. Para que aparezcan en el marquee, agregarlas a `FOTOS` en `js/main.js`.

## Probar local

```
npx serve .
```

## Publicar

```
git add -A && git commit -m "..." && git push
```
