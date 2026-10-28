# Jacowaco's Games · Ray of Light edition

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

Antes de publicar, subir el número `?v=` de los links a `css/style.css` y `js/*.js` en `index.html`
(por ejemplo de `?v=8` a `?v=9`). GitHub Pages hace que el navegador guarde los archivos 10 minutos;
con la versión nueva en el link, los celus bajan el CSS y el JS nuevos en vez de usar los viejos.

```
git add -A && git commit -m "..." && git push
```
