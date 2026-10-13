-- wyniki są czytelne dla wszystkich, więc moje_miejsce nie potrzebuje uprawnień właściciela
alter function public.moje_miejsce() security invoker;
