-- Ejecutar completo en Supabase > SQL Editor > New query > Run

create table if not exists categorias (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 40),
  created_at timestamptz not null default now()
);

create table if not exists movimientos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  categoria_id bigint references categorias(id) on delete set null,
  concepto text not null check (char_length(concepto) between 3 and 80),
  monto numeric(12,2) not null check (monto > 0),
  tipo text not null check (tipo in ('ingreso', 'gasto')),
  fecha date not null default current_date,
  created_at timestamptz not null default now()
);

alter table categorias enable row level security;
alter table movimientos enable row level security;

create policy "categorias_propias" on categorias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "movimientos_propios" on movimientos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
