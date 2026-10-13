-- Zwarty zapis (wersja 2): plansza 200×200 to ok. 50 KB; limit 64 KB jak dla żądania fetch z keepalive.
alter table public.zapisy drop constraint zapisy_stan_check;
alter table public.zapisy add constraint zapisy_stan_check check (pg_column_size(stan) <= 65536);
