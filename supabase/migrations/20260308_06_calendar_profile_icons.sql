begin;

alter table public.calendar_profiles
  add column if not exists icon text;

update public.calendar_profiles
set icon = case
  when lower(
    translate(
      name,
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    )
  ) like '%profissional%' then 'briefcase'
  when lower(
    translate(
      name,
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    )
  ) like '%pessoal%' then 'user'
  when lower(
    translate(
      name,
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'
    )
  ) like '%familia%' then 'users'
  else 'folder'
end
where icon is null or btrim(icon) = '';

alter table public.calendar_profiles
  alter column icon set default 'folder';

update public.calendar_profiles
set icon = 'folder'
where icon is null;

alter table public.calendar_profiles
  alter column icon set not null;

commit;
