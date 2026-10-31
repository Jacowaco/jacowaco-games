-- Jacowaco's Games · caza de fotos · backend en Supabase
-- Supabase → SQL Editor → New query: pegá todo, cambiá CAMBIAR_CLAVE (última línea) por la clave del panel y dale Run.
-- Se puede correr de nuevo sin romper nada: no borra fotos ni cambia la clave.

create table if not exists public.fotos (
  id uuid primary key default gen_random_uuid(),
  equipo text not null,
  consigna int not null,
  ruta text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  creada timestamptz not null default now(),
  revisada timestamptz
);
-- Quién la subió (agregada después de la primera versión)
alter table public.fotos add column if not exists autor text;

-- Una sola fila: clave del panel, consignas y hora de largada
create table if not exists public.juego (
  id int primary key default 1 check (id = 1),
  clave text not null,
  consignas jsonb not null default '[]',
  inicio timestamptz
);

alter table public.fotos enable row level security;
alter table public.juego enable row level security;

-- Los celus solo pueden agregar fotos (sin elegir hora ni estado) y únicamente después de la largada.
-- Leer y revisar pasa por las funciones de abajo.
revoke all on public.fotos, public.juego from anon, authenticated;
grant usage on schema public to anon;
grant insert (equipo, consigna, ruta, autor) on public.fotos to anon;

create or replace function public.largado() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from juego where inicio is not null);
$$;

drop policy if exists "subir" on public.fotos;
create policy "subir" on public.fotos for insert to anon with check (public.largado());

create or replace function public.chequear(p_clave text) returns void
language plpgsql security definer set search_path = public stable as $$
begin
  if not exists (select 1 from juego where clave = p_clave) then
    raise exception 'clave incorrecta';
  end if;
end $$;

-- Para los equipos: sin rutas de fotos (no se pueden ver las de los rivales) y sin consignas antes de largar
create or replace function public.estado() returns json
language sql security definer set search_path = public stable as $$
  select json_build_object(
    'inicio', j.inicio,
    'consignas', case when j.inicio is not null then j.consignas end,
    'fotos', coalesce((select json_agg(json_build_object(
      'id', f.id, 'equipo', f.equipo, 'consigna', f.consigna, 'estado', f.estado, 'autor', f.autor, 'creada', f.creada
    ) order by f.creada) from fotos f), '[]'::json)
  ) from juego j;
$$;

create or replace function public.admin(p_clave text) returns json
language plpgsql security definer set search_path = public stable as $$
begin
  perform chequear(p_clave);
  return (select json_build_object(
    'inicio', j.inicio,
    'consignas', j.consignas,
    'fotos', coalesce((select json_agg(f order by f.creada) from fotos f), '[]'::json)
  ) from juego j);
end $$;

create or replace function public.revisar(p_clave text, p_id uuid, p_estado text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform chequear(p_clave);
  update fotos set estado = p_estado, revisada = case when p_estado = 'pendiente' then null else now() end
  where id = p_id;
end $$;

create or replace function public.guardar(p_clave text, p_consignas jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform chequear(p_clave);
  update juego set consignas = p_consignas where id = 1;
end $$;

create or replace function public.largar(p_clave text, p_largar boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform chequear(p_clave);
  update juego set inicio = case when p_largar then now() end where id = 1;
end $$;

-- Borra todas las fotos (los archivos quedan en el bucket) y vuelve a "esperando largada"
create or replace function public.reiniciar(p_clave text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform chequear(p_clave);
  delete from fotos where true;
  update juego set inicio = null where id = 1;
end $$;

grant execute on function public.largado(), public.chequear(text), public.estado(), public.admin(text),
  public.revisar(text, uuid, text), public.guardar(text, jsonb), public.largar(text, boolean), public.reiniciar(text) to anon;

-- Bucket público: las rutas llevan un UUID, así que solo las ve quien tiene el link (el panel)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 10485760, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "subir fotos" on storage.objects;
create policy "subir fotos" on storage.objects for insert to anon with check (bucket_id = 'fotos');

-- ===== TABLERO DEL CUMPLE: registro de jugadores y puntajes por juego =====

-- Prende el botón "Tablero en vivo" de la landing
alter table public.juego add column if not exists vivo boolean not null default false;

-- El id lo genera el celu y lo recuerda: si cambia de nombre o equipo se actualiza la misma fila
create table if not exists public.jugadores (
  id uuid primary key,
  nombre text not null,
  equipo text not null,
  creado timestamptz not null default now(),
  editado timestamptz not null default now()
);

-- puestos: { "ninja": 1, "gay": 2, ... }; los puntos (4-3-2-1, x2 si es doble) se calculan en la página
create table if not exists public.juegos (
  id uuid primary key,
  nombre text not null,
  doble boolean not null default false,
  puestos jsonb not null default '{}',
  creado timestamptz not null default now()
);

alter table public.jugadores enable row level security;
alter table public.juegos enable row level security;
revoke all on public.jugadores, public.juegos from anon, authenticated;

create or replace function public.registrar(p_id uuid, p_nombre text, p_equipo text) returns void
language sql security definer set search_path = public as $$
  insert into jugadores (id, nombre, equipo) values (p_id, left(trim(p_nombre), 30), p_equipo)
  on conflict (id) do update set nombre = excluded.nombre, equipo = excluded.equipo, editado = now();
$$;

create or replace function public.vivo() returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select vivo from juego where id = 1), false);
$$;

-- Público: sin los id de los jugadores (con el id se puede editar a esa persona)
create or replace function public.tablero() returns json
language sql security definer set search_path = public stable as $$
  select json_build_object(
    'vivo', j.vivo,
    'fotos', j.inicio is not null,
    'juegos', coalesce((select json_agg(json_build_object('id', g.id, 'nombre', g.nombre, 'doble', g.doble, 'puestos', g.puestos)
      order by g.creado) from juegos g), '[]'::json),
    'jugadores', coalesce((select json_agg(json_build_object('nombre', p.nombre, 'equipo', p.equipo)
      order by p.creado) from jugadores p), '[]'::json)
  ) from juego j;
$$;

create or replace function public.tablero_admin(p_clave text) returns json
language plpgsql security definer set search_path = public stable as $$
begin
  perform chequear(p_clave);
  return (select json_build_object(
    'vivo', j.vivo,
    'fotos', j.inicio is not null,
    'juegos', coalesce((select json_agg(g order by g.creado) from juegos g), '[]'::json),
    'jugadores', coalesce((select json_agg(p order by p.creado) from jugadores p), '[]'::json)
  ) from juego j);
end $$;

create or replace function public.guardar_juego(p_clave text, p_id uuid, p_nombre text, p_doble boolean, p_puestos jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform chequear(p_clave);
  insert into juegos (id, nombre, doble, puestos) values (p_id, p_nombre, p_doble, p_puestos)
  on conflict (id) do update set nombre = excluded.nombre, doble = excluded.doble, puestos = excluded.puestos;
end $$;

create or replace function public.borrar_juego(p_clave text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform chequear(p_clave);
  delete from juegos where id = p_id;
end $$;

create or replace function public.borrar_jugador(p_clave text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform chequear(p_clave);
  delete from jugadores where id = p_id;
end $$;

create or replace function public.mostrar_vivo(p_clave text, p_vivo boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform chequear(p_clave);
  update juego set vivo = p_vivo where id = 1;
end $$;

create or replace function public.reiniciar_tablero(p_clave text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform chequear(p_clave);
  delete from juegos where true;
  delete from jugadores where true;
end $$;

grant execute on function public.registrar(uuid, text, text), public.vivo(), public.tablero(), public.tablero_admin(text),
  public.guardar_juego(text, uuid, text, boolean, jsonb), public.borrar_juego(text, uuid), public.borrar_jugador(text, uuid),
  public.mostrar_vivo(text, boolean), public.reiniciar_tablero(text) to anon;

-- Solo la primera vez. Para cambiar la clave después: update public.juego set clave = 'NUEVA' where id = 1;
insert into public.juego (clave) values ('CAMBIAR_CLAVE') on conflict (id) do nothing;
