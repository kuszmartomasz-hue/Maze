-- Tabela wyników: jeden wiersz na gracza, zapis tylko przez funkcję zapisz_wynik.
create table public.wyniki (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nick text not null check (char_length(nick) between 1 and 20 and nick = btrim(nick)),
  poziom int not null check (poziom between 1 and 500),
  osiagniety timestamptz not null default now()
);
create index wyniki_ranking on public.wyniki (poziom desc, osiagniety asc);

alter table public.wyniki enable row level security;
create policy "wyniki: odczyt dla wszystkich" on public.wyniki
  for select to anon, authenticated using (true);
-- brak polityk insert/update/delete — zapis wyłącznie przez zapisz_wynik

-- Stan przerwanej gry: jeden wiersz na gracza, widoczny tylko dla niego.
create table public.zapisy (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  stan jsonb not null check (pg_column_size(stan) <= 16384),
  zaktualizowany timestamptz not null default now()
);

alter table public.zapisy enable row level security;
create policy "zapisy: własny odczyt" on public.zapisy
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "zapisy: własne dodanie" on public.zapisy
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "zapisy: własna zmiana" on public.zapisy
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "zapisy: własne usunięcie" on public.zapisy
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Wynik tylko rośnie; przy wyższym poziomie odświeża się czas osiągnięcia; nick zawsze aktualny.
create function public.zapisz_wynik(p_nick text, p_poziom int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'brak sesji';
  end if;
  insert into public.wyniki (user_id, nick, poziom)
  values ((select auth.uid()), btrim(p_nick), p_poziom)
  on conflict (user_id) do update set
    nick = excluded.nick,
    osiagniety = case when excluded.poziom > public.wyniki.poziom then now() else public.wyniki.osiagniety end,
    poziom = greatest(public.wyniki.poziom, excluded.poziom);
end;
$$;
revoke execute on function public.zapisz_wynik(text, int) from public, anon;
grant execute on function public.zapisz_wynik(text, int) to authenticated;

-- Miejsce gracza w rankingu (null, gdy nie ma wyniku).
create function public.moje_miejsce()
returns table (miejsce bigint, poziom int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.wyniki w
      where w.poziom > m.poziom or (w.poziom = m.poziom and w.osiagniety < m.osiagniety)) + 1,
    m.poziom
  from public.wyniki m
  where m.user_id = (select auth.uid());
$$;
revoke execute on function public.moje_miejsce() from public, anon;
grant execute on function public.moje_miejsce() to authenticated;
