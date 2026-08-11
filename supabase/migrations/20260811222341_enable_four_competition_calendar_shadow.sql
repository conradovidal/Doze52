update public.calendar_pack_sources
set
  official_url = case id
    when 'conmebol-libertadores-2026' then 'https://gol.conmebol.com/libertadores/pt-br/tournament/15'
    when 'conmebol-sudamericana-2026' then 'https://gol.conmebol.com/sudamericana/pt-br/tournament/104'
    else official_url
  end,
  rollout_status = 'shadow'
where id in (
  'cbf-copa-do-brasil-2026',
  'conmebol-libertadores-2026',
  'conmebol-sudamericana-2026'
);
