-- ============================================================================
--  MEYER'S INMOBILIARIA — SQL FINAL DE ENTREGA
--  Ejecutar en: Supabase → SQL Editor → New query → Run
--  Es seguro: NO borra datos y se puede ejecutar varias veces.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) "NUESTRA HISTORIA" (tabla que faltaba)
-- ----------------------------------------------------------------------------
create table if not exists public.about_content (
    id                int primary key default 1 check (id = 1),
    tag               text not null default 'Nuestra Historia',
    titulo            text not null default 'Meyer''s Inmobiliaria',
    texto             text not null default (
        'Fundada en 2020 por Mayerlyn Martínez, Meyer''s nació con una visión clara: revolucionar la experiencia inmobiliaria poniendo a las personas en el centro de cada decisión.'
        || E'\n\n' ||
        'No solo vendemos propiedades; construimos relaciones duraderas basadas en la confianza, la transparencia y un profundo conocimiento del mercado. Nuestro compromiso es que cada cliente se sienta en casa desde el primer contacto.'
    ),
    imagen            text,
    imagen_thumb      text,
    imagen_path       text,
    imagen_thumb_path text,
    imagen_alt        text,
    badge_label       text not null default 'Desde',
    badge_year        text not null default '2020',
    stat1_numero      text not null default '500+',
    stat1_etiqueta    text not null default 'Propiedades Vendidas',
    stat2_numero      text not null default '100%',
    stat2_etiqueta    text not null default 'Clientes Satisfechos',
    stat3_numero      text not null default '5+',
    stat3_etiqueta    text not null default 'Años de Experiencia',
    updated_at        timestamptz not null default now()
);

insert into public.about_content (id) values (1) on conflict (id) do nothing;

alter table public.about_content enable row level security;

drop policy if exists "about_public_read" on public.about_content;
create policy "about_public_read" on public.about_content
    for select using (true);

drop policy if exists "about_admin_write" on public.about_content;
create policy "about_admin_write" on public.about_content
    for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2) TIPO DE NEGOCIO EN PROPIEDADES (columna que faltaba)
-- ----------------------------------------------------------------------------
alter table public.properties add column if not exists operacion text;

update public.properties
set operacion = 'Alquiler'
where operacion = 'Alquiler con opción a compra';

update public.properties
set operacion = 'Venta'
where operacion is null
   or operacion not in ('Venta', 'Alquiler', 'Traspaso');

alter table public.properties alter column operacion set default 'Venta';
alter table public.properties alter column operacion set not null;

alter table public.properties drop constraint if exists properties_operacion_check;
alter table public.properties add constraint properties_operacion_check
    check (operacion in ('Venta', 'Alquiler', 'Traspaso'));

-- ----------------------------------------------------------------------------
-- 2b) ZONAS LIBRES (sin relación con la ciudad, sin duplicados)
-- ----------------------------------------------------------------------------
delete from public.zonas a
using public.zonas b
where a.nombre = b.nombre and a.id > b.id;

alter table public.zonas drop column if exists ciudad_id cascade;

alter table public.zonas drop constraint if exists zonas_nombre_key;
alter table public.zonas add constraint zonas_nombre_key unique (nombre);

-- ----------------------------------------------------------------------------
-- 3) ÍNDICES (rendimiento)
-- ----------------------------------------------------------------------------
create index if not exists idx_properties_publicas on public.properties (estado, destacada desc, created_at desc);
create index if not exists idx_properties_created_at on public.properties (created_at desc);
create index if not exists idx_properties_asesor on public.properties (asesor_id);
create index if not exists idx_properties_ubicacion on public.properties (ubicacion);
create index if not exists idx_properties_zona on public.properties (zona);
create index if not exists idx_properties_tipo on public.properties (tipo);
create index if not exists idx_properties_operacion on public.properties (operacion);
create index if not exists idx_property_images_property on public.property_images (property_id, sort_order);
create index if not exists idx_favorites_property on public.favorites (property_id);
create index if not exists idx_testimonials_estado on public.testimonials (estado, sort_order);
create index if not exists idx_services_activo_orden on public.services (activo, orden);
create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_asesores_activo_orden on public.asesores (activo, orden);

-- ----------------------------------------------------------------------------
-- 4) MASTER: permitir nombrar master (máximo 3)
-- ----------------------------------------------------------------------------
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
                raise exception 'Solo un master puede asignar el rol master';
            end if;
            if not public.is_admin() then
                new.role := 'user';
            end if;
        else
            if old.role = 'master' and new.role is distinct from 'master' then
                raise exception 'No se puede cambiar el rol del master';
            end if;
            if new.role = 'master' and old.role is distinct from 'master' then
                if not public.is_master() then
                    raise exception 'Solo un master puede asignar el rol master';
                end if;
            end if;
            if old.id = auth.uid() and (new.role is distinct from old.role or new.bloqueado is distinct from old.bloqueado) then
                raise exception 'No puedes cambiar tu propio rol ni tu estado';
            end if;
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

create or replace function public.enforce_admin_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    total_admin int;
    total_master int;
begin
    if new.role is distinct from old.role and new.role in ('admin', 'master') then
        select count(*) into total_master
        from public.profiles
        where role = 'master' and id <> new.id;

        if new.role = 'master' and total_master >= 3 then
            raise exception 'Máximo 3 usuarios master permitidos';
        end if;

        select count(*) into total_admin
        from public.profiles
        where role in ('admin', 'master') and id <> new.id;

        if total_admin >= 5 then
            raise exception 'Máximo 5 administradores permitidos';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
    before insert or update on public.profiles
    for each row execute function public.protect_profile_role();

drop trigger if exists profiles_admin_limit on public.profiles;
create trigger profiles_admin_limit
    before update on public.profiles
    for each row execute function public.enforce_admin_limit();
