# Caza de fotos

- Equipos: https://jacowaco.github.io/jacowaco-games/fotos/ (o `fotos/?equipo=ninja` para entrar directo a un equipo)
- Panel: https://jacowaco.github.io/jacowaco-games/fotos/admin.html

Cada foto se sube primero al backend `primario` de [config.js](config.js) y, si falla o tarda, al otro.
El panel lee los dos y junta todo. Las consignas y la largada se cargan desde el panel y se guardan en los dos.

## Supabase (primario)

1. SQL Editor → New query → pegar [setup/supabase.sql](setup/supabase.sql), cambiar `CAMBIAR_CLAVE` por la clave del panel → Run.
2. Project Settings → API Keys: copiar la URL del proyecto y la publishable key (o anon) a `supabase` en `config.js`.

## Google (respaldo)

1. Crear una Google Sheet nueva (cualquier nombre) → Extensiones → Apps Script.
2. Borrar lo que hay, pegar [setup/google.gs](setup/google.gs) y cambiar `CAMBIAR_CLAVE` por la misma clave.
3. Arriba elegir la función `setup` → ▶ Ejecutar → aceptar los permisos ("Configuración avanzada → Ir a … (no seguro)": es tu propio script).
4. Implementar → Nueva implementación → tipo Aplicación web. Ejecutar como: Yo. Quién tiene acceso: Cualquier persona → Implementar.
5. Copiar la URL que termina en `/exec` a `google.url` en `config.js`.

Si después cambiás el código del script: Implementar → Administrar implementaciones → editar → Versión: nueva. Así la URL no cambia.

## El día del juego

1. Panel → Consignas: cargar las consignas → Guardar.
2. Probar con un celu: Largar, subir una foto, aprobarla, y después Consignas → Borrar todas las fotos.
3. Pasar el link a los equipos. Cuando estén todos: ¡Largar!
4. Revisar: aprobar o rechazar. Ranking: gana el que completa todas y cuya última foto aprobada se subió antes.
