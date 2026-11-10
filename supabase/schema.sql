-- ============================================================
-- Toast Express — database setup for Supabase
-- Run this ONCE: Supabase → SQL Editor → New query → paste all → Run
-- It is safe to run again (it uses "if not exists" / "or replace").
-- ============================================================

-- ---------- 1. TABLES ----------

-- one row per student (the login itself lives in Supabase's auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  hall        text not null,
  phone       text not null unique,
  icon        text not null default '🍞',
  role        text not null default 'customer' check (role in ('customer','admin')),
  created_at  timestamptz not null default now()
);

-- record WHEN each student agreed to the Terms/Privacy Policy and WHICH version (proof of consent)
alter table public.profiles add column if not exists consented_at timestamptz;
alter table public.profiles add column if not exists terms_version text;

-- exactly ONE row (id = 1): everything the admin can change
create table if not exists public.settings (
  id             int primary key default 1 check (id = 1),
  price          int  not null default 2500,
  stock_total    int  not null default 0,          -- the admin sets this each morning
  accepting      boolean not null default true,
  bank_name      text not null default 'YOUR BANK',
  account_number text not null default '0000000000',
  account_name   text not null default 'TOAST EXPRESS',
  ingredients    text not null default 'Chicken suya, beef suya, sausage, eggs and the special Toast Express sauce, toasted between slices of bread.',
  updated_at     timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- one row per order
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  qty          int  not null check (qty between 1 and 10),
  unit_price   int  not null,
  total        int  not null,
  status       text not null default 'awaiting_payment'
               check (status in ('awaiting_payment','payment_sent','paid','preparing','ready','delivered','cancelled')),
  eta_minutes  int,
  eta_at       timestamptz,
  order_date   date not null default (timezone('Africa/Lagos', now()))::date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists orders_date_idx on public.orders (order_date);
create index if not exists orders_user_idx on public.orders (user_id);

-- ---------- 2. HELPER FUNCTIONS ----------

-- "is the person making this request an admin?"
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- toasts still available today = today's stock − toasts in today's non-cancelled orders
create or replace function public.today_remaining() returns int
language sql stable security definer set search_path = public as $$
  select s.stock_total - coalesce((
    select sum(o.qty) from public.orders o
    where o.order_date = (timezone('Africa/Lagos', now()))::date and o.status <> 'cancelled'
  ), 0)
  from public.settings s where s.id = 1;
$$;

-- what the website may show: price, live count, ingredients (+ bank details ONLY when logged in)
create or replace function public.get_store() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'price', s.price, 'stock_total', s.stock_total, 'accepting', s.accepting, 'ingredients', s.ingredients,
    'remaining', public.today_remaining(),
    'bank_name',      case when auth.uid() is null then null else s.bank_name end,
    'account_number', case when auth.uid() is null then null else s.account_number end,
    'account_name',   case when auth.uid() is null then null else s.account_name end
  ) from public.settings s where s.id = 1;
$$;

-- ---------- 3. SIGN-UP: create the profile automatically ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, hall, phone, icon, consented_at, terms_version)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name',''), 'Student'),
    coalesce(nullif(new.raw_user_meta_data->>'hall',''), '-'),
    coalesce(nullif(new.raw_user_meta_data->>'phone',''), split_part(new.email,'@',1)),
    coalesce(nullif(new.raw_user_meta_data->>'icon',''), '🍞'),
    nullif(new.raw_user_meta_data->>'consent_at','')::timestamptz,
    nullif(new.raw_user_meta_data->>'terms_version','')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 4. PLACING AN ORDER (the stock-safe way) ----------
-- "for update" locks the settings row, so if 2 students tap at the same
-- moment, one waits for the other. The last toast can never be sold twice.
create or replace function public.place_order(p_qty int) returns public.orders
language plpgsql security definer set search_path = public as $$
declare s public.settings; rem int; o public.orders;
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  select * into s from public.settings where id = 1 for update;
  if not s.accepting then raise exception 'Orders are closed right now.'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 10 then raise exception 'Choose between 1 and 10 toasts.'; end if;
  rem := public.today_remaining();
  if p_qty > rem then
    raise exception '%', case when rem > 0 then 'Only ' || rem || ' left today.' else 'Sold out for today.' end;
  end if;
  insert into public.orders (user_id, qty, unit_price, total)
  values (auth.uid(), p_qty, s.price, p_qty * s.price) returning * into o;
  return o;
end $$;

-- customer taps "I've paid"
create or replace function public.mark_payment_sent(p_id uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  update public.orders set status = 'payment_sent', updated_at = now()
   where id = p_id and user_id = auth.uid() and status = 'awaiting_payment' returning * into o;
  if o.id is null then raise exception 'This order can''t be updated.'; end if;
  return o;
end $$;

-- customer cancels an unpaid order (its toasts go back into stock automatically)
create or replace function public.cancel_order(p_id uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  update public.orders set status = 'cancelled', updated_at = now()
   where id = p_id and user_id = auth.uid() and status = 'awaiting_payment' returning * into o;
  if o.id is null then raise exception 'Only unpaid orders can be cancelled.'; end if;
  return o;
end $$;

-- ---------- 5. SECURITY RULES (Row Level Security) ----------
-- Without these, anyone with your public key could read everything. With them:
--   customers see only THEIR profile + THEIR orders
--   only admins can read everyone, confirm payments, and change settings
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.orders   enable row level security;

drop policy if exists "profiles: read own or admin" on public.profiles;
create policy "profiles: read own or admin" on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- students may change ONLY these columns (never 'role' → nobody can make themselves admin)
revoke update on public.profiles from anon, authenticated;
grant  update (icon, name, hall) on public.profiles to authenticated;

drop policy if exists "settings: admin read" on public.settings;
create policy "settings: admin read" on public.settings for select using (public.is_admin());
drop policy if exists "settings: admin update" on public.settings;
create policy "settings: admin update" on public.settings for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders: read own or admin" on public.orders;
create policy "orders: read own or admin" on public.orders for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "orders: admin update" on public.orders;
create policy "orders: admin update" on public.orders for update using (public.is_admin()) with check (public.is_admin());
-- note: there is NO insert policy on orders — orders can only be created through place_order()

-- who may call which function
revoke execute on function public.place_order(int)       from public, anon;
revoke execute on function public.mark_payment_sent(uuid) from public, anon;
revoke execute on function public.cancel_order(uuid)      from public, anon;
grant  execute on function public.place_order(int)        to authenticated;
grant  execute on function public.mark_payment_sent(uuid) to authenticated;
grant  execute on function public.cancel_order(uuid)      to authenticated;
grant  execute on function public.get_store()             to anon, authenticated;
grant  execute on function public.is_admin()              to authenticated;

-- ---------- 5b. REVIEWS (optional, after an order is received) ----------
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  order_id    uuid not null unique references public.orders(id) on delete cascade,  -- one review per order
  rating      int  not null check (rating between 1 and 5),
  comment     text not null default '' check (char_length(comment) <= 280),
  hidden      boolean not null default false,                                        -- the admin can hide a review
  created_at  timestamptz not null default now()
);
alter table public.reviews enable row level security;

drop policy if exists "reviews: read own or admin" on public.reviews;
create policy "reviews: read own or admin" on public.reviews for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "reviews: admin update" on public.reviews;
create policy "reviews: admin update" on public.reviews for update using (public.is_admin()) with check (public.is_admin());
-- no insert policy: reviews can only be created through add_review() below

-- the public list for the website: first name + icon + stars + comment (never phone or hall)
create or replace function public.get_reviews(p_limit int default 30) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(r), '[]'::json) from (
    select rv.id, split_part(p.name, ' ', 1) as name, p.icon, rv.rating, rv.comment, rv.created_at
    from public.reviews rv join public.profiles p on p.id = rv.user_id
    where not rv.hidden order by rv.created_at desc limit least(greatest(p_limit, 1), 100)
  ) r;
$$;

-- only the student who got the order, only after it is delivered, only once
create or replace function public.add_review(p_order uuid, p_rating int, p_comment text) returns public.reviews
language plpgsql security definer set search_path = public as $$
declare o public.orders; rv public.reviews;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid();
  if o.id is null then raise exception 'Order not found.'; end if;
  if o.status <> 'delivered' then raise exception 'You can review once your order is received.'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Tap a star to rate your toast.'; end if;
  insert into public.reviews (user_id, order_id, rating, comment)
  values (auth.uid(), p_order, p_rating, left(trim(coalesce(p_comment, '')), 280)) returning * into rv;
  return rv;
exception when unique_violation then raise exception 'You already reviewed this order.';
end $$;

revoke execute on function public.add_review(uuid, int, text) from public, anon;
grant  execute on function public.add_review(uuid, int, text) to authenticated;
grant  execute on function public.get_reviews(int) to anon, authenticated;

-- ============================================================
-- 6. MAKE YOURSELF (the owner) THE ADMIN — do this AFTER you have created
--    your own account on the website. Replace the phone number, then run ONLY this line:
--
--    update public.profiles set role = 'admin' where phone = '08012345678';
--
-- 7. EVERY MORNING: open the Kitchen page → set "Today's stock". Orders count from zero each day automatically.
-- ============================================================
