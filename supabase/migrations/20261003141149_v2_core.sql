-- =========================================================
-- ARADA KAHVE V2 - CORE
-- İlk güvenli veri modeli:
-- venues + venue_members + venue_tables
-- =========================================================


-- ---------------------------------------------------------
-- 1. VENUES
-- Sistemdeki işletmeler / mekanlar.
-- ---------------------------------------------------------

create table public.venues (
    id uuid primary key default gen_random_uuid(),

    name text not null,

    slug text not null unique
        check (slug = lower(slug)),

    is_active boolean not null default true,

    created_at timestamptz not null default now()
);


-- ---------------------------------------------------------
-- 2. VENUE MEMBERS
--
-- Supabase Auth kullanıcısını bir mekana bağlar.
--
-- Örnek:
-- Abdullah -> Arada Kahve -> owner
-- Ahmet    -> Arada Kahve -> manager
-- Mehmet   -> Arada Kahve -> staff
-- ---------------------------------------------------------

create table public.venue_members (
    id uuid primary key default gen_random_uuid(),

    venue_id uuid not null
        references public.venues(id)
        on delete cascade,

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    role text not null
        check (role in ('owner', 'manager', 'staff')),

    created_at timestamptz not null default now(),

    unique (venue_id, user_id)
);


-- ---------------------------------------------------------
-- 3. VENUE TABLES
--
-- İşletmenin fiziksel masaları.
--
-- public_token:
-- QR içerisinde kullanılacak tahmin edilmesi zor kimlik.
--
-- Artık ?tableId=4 yazıp kafadan masa oluşturmak yok.
-- ---------------------------------------------------------

create table public.venue_tables (
    id uuid primary key default gen_random_uuid(),

    venue_id uuid not null
        references public.venues(id)
        on delete cascade,

    name text not null,

    public_token uuid not null
        default gen_random_uuid()
        unique,

    is_active boolean not null default true,

    created_at timestamptz not null default now(),

    unique (venue_id, name)
);


-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.venues enable row level security;
alter table public.venue_members enable row level security;
alter table public.venue_tables enable row level security;


-- =========================================================
-- TABLE PRIVILEGES
--
-- Guest/anon doğrudan bu tablolara erişmesin.
-- Gerektiğinde guest işlemlerini server API üzerinden yapacağız.
-- =========================================================

revoke all on table public.venues
from anon, authenticated;

revoke all on table public.venue_members
from anon, authenticated;

revoke all on table public.venue_tables
from anon, authenticated;


-- İşletmeci kullanıcılarının gerekli minimum yetkileri.

grant select, update
on table public.venues
to authenticated;

grant select
on table public.venue_members
to authenticated;

grant select, insert, update, delete
on table public.venue_tables
to authenticated;


-- =========================================================
-- VENUE MEMBERS POLICIES
-- =========================================================

-- Kullanıcı sadece kendi üyeliklerini görebilir.

create policy "members_can_read_own_memberships"
on public.venue_members
for select
to authenticated
using (
    user_id = auth.uid()
);


-- =========================================================
-- VENUES POLICIES
-- =========================================================

-- Bir kullanıcı sadece üyesi olduğu mekanı görebilir.

create policy "members_can_read_their_venues"
on public.venues
for select
to authenticated
using (
    exists (
        select 1
        from public.venue_members vm
        where vm.venue_id = venues.id
          and vm.user_id = auth.uid()
    )
);


-- Mekan ayarını yalnızca owner değiştirebilir.

create policy "owners_can_update_their_venues"
on public.venues
for update
to authenticated
using (
    exists (
        select 1
        from public.venue_members vm
        where vm.venue_id = venues.id
          and vm.user_id = auth.uid()
          and vm.role = 'owner'
    )
)
with check (
    exists (
        select 1
        from public.venue_members vm
        where vm.venue_id = venues.id
          and vm.user_id = auth.uid()
          and vm.role = 'owner'
    )
);


-- =========================================================
-- VENUE TABLE POLICIES
-- =========================================================

-- Mekanın tüm çalışanları masaları görebilir.

create policy "members_can_read_venue_tables"
on public.venue_tables
for select
to authenticated
using (
    exists (
        select 1
        from public.venue_members vm
        where vm.venue_id = venue_tables.venue_id
          and vm.user_id = auth.uid()
    )
);


-- Owner veya manager masa oluşturabilir.

create policy "managers_can_create_venue_tables"
on public.venue_tables
for insert
to authenticated
with check (
    exists (
        select 1
        from public.venue_members vm
        where vm.venue_id = venue_tables.venue_id
          and vm.user_id = auth.uid()
          and vm.role in ('owner', 'manager')
    )
);


-- Owner veya manager masa düzenleyebilir.

create policy "managers_can_update_venue_tables"
on public.venue_tables
for update
to authenticated
using (
    exists (
        select 1
        from public.venue_members vm
        where vm.venue_id = venue_tables.venue_id
          and vm.user_id = auth.uid()
          and vm.role in ('owner', 'manager')
    )
)
with check (
    exists (
        select 1
        from public.venue_members vm
        where vm.venue_id = venue_tables.venue_id
          and vm.user_id = auth.uid()
          and vm.role in ('owner', 'manager')
    )
);


-- Owner veya manager masa silebilir.

create policy "managers_can_delete_venue_tables"
on public.venue_tables
for delete
to authenticated
using (
    exists (
        select 1
        from public.venue_members vm
        where vm.venue_id = venue_tables.venue_id
          and vm.user_id = auth.uid()
          and vm.role in ('owner', 'manager')
    )
);