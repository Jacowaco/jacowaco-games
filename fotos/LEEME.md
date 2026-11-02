# Caza de fotos

- Equipos: https://jacowaco.github.io/jacowaco-games/fotos/ (o `fotos/?equipo=ninja` para entrar directo a un equipo)
- Panel: https://jacowaco.github.io/jacowaco-games/fotos/admin.html

Las fotos, las consignas y la largada se guardan en Supabase. Las consignas y la largada se cargan desde el panel.

## Supabase

1. SQL Editor → New query → pegar [setup/supabase.sql](setup/supabase.sql), cambiar `CAMBIAR_CLAVE` por la clave del panel → Run.
2. Project Settings → API Keys: copiar la URL del proyecto y la publishable key (o anon) a `supabase` en `config.js`.

## El día del juego

1. Panel → Consignas: cargar las consignas → Guardar.
2. Probar con un celu: Largar, subir una foto, aprobarla, y después Consignas → Borrar todas las fotos.
3. Pasar el link a los equipos. Cuando estén todos: ¡Largar!
4. Revisar: aprobar o rechazar. Ranking: gana el que completa todas y cuya última foto aprobada se subió antes.
