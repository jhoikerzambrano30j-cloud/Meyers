-- ============================================================================
--  MEYER'S INMOBILIARIA — ESQUEMA COMPLETO PARA SUPABASE
--  Ejecutar en:  Supabase  →  SQL Editor  →  New query  →  Run
--  Es idempotente: puedes ejecutarlo más de una vez sin romper nada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONES
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. PERFILES DE USUARIO  (registro de usuarios: nombre, correo, teléfono)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
    id         uuid primary key references auth.users(id) on delete cascade,
    full_name  text,
    email      text,
    phone      text,
    role       text not null default 'user' check (role in ('user', 'admin', 'master')),
    bloqueado  boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ¿El usuario actual es administrador?  (security definer evita recursión en RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role in ('admin', 'master')
    );
$$;

-- ¿El usuario actual está bloqueado?
create or replace function public.esta_bloqueado()
returns boolean
language sql
security definer
set search_path = public
as $$
    select coalesce(
        (select bloqueado from public.profiles where id = auth.uid()),
        false
    );
$$;

-- ¿El usuario actual es el master?
create or replace function public.is_master()
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'master'
    );
$$;

-- Políticas de perfiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
    for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
    for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
    for insert with check (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
    for all using (public.is_admin()) with check (public.is_admin());

-- Trigger: crear el perfil automáticamente al registrar un usuario
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, full_name, email, phone)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', ''),
        new.email,
        coalesce(new.raw_user_meta_data->>'phone', '')
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Guardián de roles:
--  · Un usuario normal no puede cambiar su propio rol.
--  · Nadie desde la app puede asignar el rol 'master' (solo el SQL Editor).
--  · No se puede degradar al master desde la app.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is not null then
        if tg_op = 'INSERT' then
            if new.role = 'master' then
                raise exception 'Solo el propietario puede asignar el rol master';
            end if;
            if not public.is_admin() then
                new.role := 'user';
            end if;
        else
            if old.role = 'master' and new.role is distinct from 'master' then
                raise exception 'No se puede cambiar el rol del master';
            end if;
            if new.role = 'master' and old.role is distinct from 'master' then
                raise exception 'Solo el propietario puede asignar el rol master';
            end if;
            -- Nadie puede cambiar su propio rol ni su estado
            if old.id = auth.uid() and (new.role is distinct from old.role or new.bloqueado is distinct from old.bloqueado) then
                raise exception 'No puedes cambiar tu propio rol ni tu estado';
            end if;
            -- Solo el master puede modificar a otro administrador
            if not public.is_master() and old.role in ('admin', 'master')
               and (new.role is distinct from old.role or new.bloqueado is distinct from old.bloqueado) then
                raise exception 'Solo el master puede modificar a un administrador';
            end if;
            if not public.is_admin() then
                if new.role is distinct from old.role then
                    raise exception 'No autorizado para cambiar el rol';
                end if;
                if new.bloqueado is distinct from old.bloqueado then
                    raise exception 'No autorizado para cambiar el estado de la cuenta';
                end if;
            end if;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
    before insert or update on public.profiles
    for each row execute function public.protect_profile_role();

-- Límite: máximo 5 administradores (contando al master)
create or replace function public.enforce_admin_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    total int;
begin
    if new.role = 'admin' and old.role is distinct from 'admin' then
        select count(*) into total from public.profiles where role in ('admin', 'master');
        if total >= 5 then
            raise exception 'Máximo 5 administradores permitidos';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists profiles_admin_limit on public.profiles;
create trigger profiles_admin_limit
    before update on public.profiles
    for each row execute function public.enforce_admin_limit();

-- ============================================================================
-- ADMINISTRACIÓN DE USUARIOS (eliminar / bloquear) — solo admin o master
-- ============================================================================
create or replace function public.admin_delete_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'No autorizado';
    end if;
    if target_id = auth.uid() then
        raise exception 'No puedes eliminarte a ti mismo';
    end if;
    if exists (select 1 from public.profiles where id = target_id and role in ('admin', 'master'))
       and not public.is_master() then
        raise exception 'Solo el master puede eliminar administradores';
    end if;
    delete from auth.users where id = target_id;
end;
$$;

create or replace function public.admin_set_blocked(target_id uuid, blocked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'No autorizado';
    end if;
    if target_id = auth.uid() then
        raise exception 'No puedes bloquearte a ti mismo';
    end if;
    if exists (select 1 from public.profiles where id = target_id and role in ('admin', 'master'))
       and not public.is_master() then
        raise exception 'Solo el master puede bloquear administradores';
    end if;
    update public.profiles set bloqueado = blocked where id = target_id;
    update auth.users
       set banned_until = case when blocked then (now() + interval '100 years') else null end
     where id = target_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
revoke all on function public.admin_set_blocked(uuid, boolean) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.admin_set_blocked(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. PROPIEDADES
-- ----------------------------------------------------------------------------
create table if not exists public.properties (
    id              uuid primary key default gen_random_uuid(),
    codigo          text unique,
    titulo          text not null,
    tipo            text not null,
    ubicacion       text not null,
    precio          numeric not null default 0,
    habitaciones    int not null default 0,
    banos           int not null default 0,
    area            numeric not null default 0,
    descripcion     text,
    caracteristicas text[] not null default '{}',
    badge           text,
    badge_class     text,
    imagen          text,                 -- portada (URL)
    destacada       boolean not null default false,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.properties enable row level security;

-- Solo los usuarios con sesión pueden ver las propiedades (catálogo privado)
drop policy if exists "properties_public_read" on public.properties;
drop policy if exists "properties_authenticated_read" on public.properties;
create policy "properties_authenticated_read" on public.properties
    for select using (auth.uid() is not null and not public.esta_bloqueado());

drop policy if exists "properties_admin_write" on public.properties;
create policy "properties_admin_write" on public.properties
    for all using (public.is_admin()) with check (public.is_admin());

-- Actualizar updated_at automáticamente
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists properties_touch on public.properties;
create trigger properties_touch
    before update on public.properties
    for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 3. GALERÍA DE PROPIEDADES (varias fotos por propiedad)
-- ----------------------------------------------------------------------------
create table if not exists public.property_images (
    id          uuid primary key default gen_random_uuid(),
    property_id uuid not null references public.properties(id) on delete cascade,
    url         text not null,
    path        text,
    sort_order  int not null default 0,
    created_at  timestamptz not null default now()
);

alter table public.property_images enable row level security;

-- Solo los usuarios con sesión pueden ver las fotos de la galería
drop policy if exists "images_public_read" on public.property_images;
drop policy if exists "images_authenticated_read" on public.property_images;
create policy "images_authenticated_read" on public.property_images
    for select using (auth.uid() is not null and not public.esta_bloqueado());

drop policy if exists "images_admin_write" on public.property_images;
create policy "images_admin_write" on public.property_images
    for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. FAVORITOS (cada usuario guarda sus propiedades favoritas)
-- ----------------------------------------------------------------------------
create table if not exists public.favorites (
    user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
    property_id uuid not null references public.properties(id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (user_id, property_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_own" on public.favorites
    for all using (auth.uid() = user_id and not public.esta_bloqueado())
    with check (auth.uid() = user_id and not public.esta_bloqueado());

-- ----------------------------------------------------------------------------
-- 5. TESTIMONIOS
-- ----------------------------------------------------------------------------
create table if not exists public.testimonials (
    id         uuid primary key default gen_random_uuid(),
    nombre     text not null,
    rol        text,
    texto      text not null,
    avatar     text,
    sort_order int not null default 0,
    created_at timestamptz not null default now()
);

alter table public.testimonials enable row level security;

drop policy if exists "testimonials_public_read" on public.testimonials;
create policy "testimonials_public_read" on public.testimonials
    for select using (true);

drop policy if exists "testimonials_admin_write" on public.testimonials;
create policy "testimonials_admin_write" on public.testimonials
    for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. MENSAJES DEL FORMULARIO DE CONTACTO (leads)
-- ----------------------------------------------------------------------------
create table if not exists public.leads (
    id         uuid primary key default gen_random_uuid(),
    nombre     text not null,
    email      text not null,
    telefono   text,
    interes    text,
    mensaje    text,
    atendido   boolean not null default false,
    created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

drop policy if exists "leads_public_insert" on public.leads;
create policy "leads_public_insert" on public.leads
    for insert with check (true);

drop policy if exists "leads_admin_read" on public.leads;
create policy "leads_admin_read" on public.leads
    for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 7. STORAGE (bucket público para las fotos de propiedades)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('propiedades', 'propiedades', true)
on conflict (id) do update set public = true;

drop policy if exists "propiedades_storage_read" on storage.objects;
create policy "propiedades_storage_read" on storage.objects
    for select using (bucket_id = 'propiedades');

drop policy if exists "propiedades_storage_insert" on storage.objects;
create policy "propiedades_storage_insert" on storage.objects
    for insert with check (bucket_id = 'propiedades' and public.is_admin());

drop policy if exists "propiedades_storage_update" on storage.objects;
create policy "propiedades_storage_update" on storage.objects
    for update using (bucket_id = 'propiedades' and public.is_admin());

drop policy if exists "propiedades_storage_delete" on storage.objects;
create policy "propiedades_storage_delete" on storage.objects
    for delete using (bucket_id = 'propiedades' and public.is_admin());

-- ============================================================================
-- 8. DATOS DE EJEMPLO (opcional, puedes borrar esta sección)
-- ============================================================================
insert into public.properties
    (codigo, titulo, tipo, ubicacion, precio, habitaciones, banos, area, descripcion, caracteristicas, badge, badge_class, imagen, destacada)
values
    ('MY-001', 'Villa Moderna con Vista al Mar', 'Casa', 'Zona Norte', 250000, 4, 3, 350,
     'Espectacular villa de líneas contemporáneas con amplios espacios y terraza panorámica.',
     array['Piscina privada','Jardín','Estacionamiento para 2 autos','Cocina integral','Seguridad 24/7'],
     'Destacada', 'new', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80', true),
    ('MY-002', 'Apartamento de Lujo en el Centro', 'Apartamento', 'Centro', 120000, 2, 2, 120,
     'Moderno apartamento en el corazón de la ciudad, a pasos de comercios y transporte.',
     array['Ascensor','Balcón','Gimnasio','Área social','Planta eléctrica'],
     'Nueva', 'new', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80', true),
    ('MY-003', 'Casa Familiar en Zona Residencial', 'Casa', 'Zona Sur', 180000, 3, 2, 220,
     'Acogedora casa familiar con jardín amplio y espacios para toda la familia.',
     array['Jardín amplio','Family room','Lavandería','Estacionamiento techado','Cerca de colegios'],
     'Bajó de Precio', '', 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80', false),
    ('MY-004', 'Terreno con Excelente Ubicación', 'Terreno', 'Zona Norte', 85000, 0, 0, 500,
     'Terreno plano y listo para construir, con servicios básicos y excelente acceso vial.',
     array['Servicios básicos','Acceso pavimentado','Zonificación residencial','Título de propiedad'],
     'Oportunidad', '', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80', true),
    ('MY-005', 'Penthouse con Terraza Panorámica', 'Apartamento', 'Centro', 320000, 3, 3, 180,
     'Exclusivo penthouse con vistas de 360°, terraza privada y acabados premium.',
     array['Terraza privada','Jacuzzi','Dos puestos de estacionamiento','Domótica','Concierge'],
     'Exclusiva', '', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80', false),
    ('MY-006', 'Local Comercial en Avenida Principal', 'Local Comercial', 'Centro', 95000, 0, 1, 80,
     'Local comercial con vitrina a avenida principal y alto tráfico peatonal.',
     array['Vitrina a la calle','Alto tráfico','Baño privado','Aire acondicionado','Listo para operar'],
     'Inversión', '', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=800&q=80', false)
on conflict (codigo) do nothing;

insert into public.testimonials (nombre, rol, texto, avatar, sort_order) values
    ('María González', 'Compradora', 'Meyer''s hizo que el proceso de compra de mi primera casa fuera increíblemente fácil.', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80', 1),
    ('Carlos Rodríguez', 'Vendedor', 'Vendí mi propiedad en tiempo récord y al mejor precio del mercado.', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80', 2),
    ('Ana Martínez', 'Inversionista', 'He realizado varias inversiones con Meyer''s y siempre superan mis expectativas.', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80', 3),
    ('Pedro Sánchez', 'Comprador', 'Excelente atención. Me ayudaron a encontrar exactamente lo que buscaba.', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80', 4)
on conflict do nothing;

-- ============================================================================
-- 9. HAZTE ADMINISTRADOR
-- ----------------------------------------------------------------------------
-- IMPORTANTE:
--   1) Primero regístrate en la web con tu correo.
--   2) Luego reemplaza el correo de abajo por el tuyo y ejecuta SOLO esta línea.
-- ============================================================================
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'TU-CORREO@EJEMPLO.COM');

-- Comprobar que quedó:
-- select id, full_name, email, phone, role from public.profiles;
