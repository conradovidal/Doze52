begin;
insert into auth.users(id,email) values ('a9520000-0000-4000-8000-000000000001','continuity-a@doze52.test'),('a9520000-0000-4000-8000-000000000002','continuity-b@doze52.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','a9520000-0000-4000-8000-000000000001',true);
do $$
declare op jsonb; a jsonb; b jsonb;
begin
  op := '{"operationId":"b9520000-0000-4000-8000-000000000001","kind":"habit","entityId":"c9520000-0000-4000-8000-000000000001","baseRevision":0,"payload":{"id":"c9520000-0000-4000-8000-000000000001","name":"Test","color":"#123456","icon":"circle-check","position":0}}';
  a := public.apply_continuity_operation(op);
  b := public.apply_continuity_operation(op);
  assert a->>'status'='applied' and a=b, 'idempotency';
  begin
    perform public.apply_continuity_operation(jsonb_set(op,'{payload,name}','"Changed"'));
    raise exception 'reused operation accepted';
  exception when invalid_parameter_value then null; end;
  b := public.apply_continuity_operation(jsonb_set(op,'{operationId}','"b9520000-0000-4000-8000-000000000002"'));
  assert b->>'status'='conflict', 'revision';
  b := public.apply_continuity_operation('{"operationId":"b9520000-0000-4000-8000-000000000003","kind":"habit","entityId":"c9520000-0000-4000-8000-000000000002","baseRevision":0,"payload":{"id":"c9520000-0000-4000-8000-000000000002","name":"Second","color":"#123456","icon":"circle-check","position":1}}');
  assert b->>'status'='limit', 'plan limit';
  b := public.apply_continuity_operation('{"operationId":"b9520000-0000-4000-8000-000000000004","kind":"checkin","entityId":"c9520000-0000-4000-8000-000000000001:2026-09-07","baseRevision":0,"payload":{"habitId":"c9520000-0000-4000-8000-000000000001","date":"2026-09-07","completed":true}}');
  assert b->>'status'='applied', 'checkin';
  b := public.apply_continuity_operation('{"operationId":"b9520000-0000-4000-8000-000000000005","kind":"checkin","entityId":"c9520000-0000-4000-8000-000000000001:2026-09-07","baseRevision":1,"payload":{"habitId":"c9520000-0000-4000-8000-000000000001","date":"2026-09-07","completed":false}}');
  assert b->'record'->'payload'->>'completed'='false', 'uncheck preserved';
  a := public.apply_continuity_operation('{"operationId":"b9520000-0000-4000-8000-000000000006","kind":"onboarding","entityId":"annual","baseRevision":0,"payload":{"origin":"mobile","version":1,"status":"completed"}}');
  b := public.apply_continuity_operation('{"operationId":"b9520000-0000-4000-8000-000000000007","kind":"onboarding","entityId":"annual","baseRevision":1,"payload":{"origin":"desktop","version":1,"status":"pending"}}');
  assert b->'record'->'payload'->>'status'='completed', 'monotonic completion';
  -- Pull is scoped and advances only when records change, including tombstones.
  a := public.pull_continuity_changes(0);
  assert jsonb_array_length(a)=3, 'initial incremental pull';
  assert public.pull_continuity_changes((a->2->>'change_seq')::bigint)='[]'::jsonb, 'unchanged pull';
  b := public.apply_continuity_operation(op || '{"operationId":"b9520000-0000-4000-8000-000000000010","baseRevision":1,"delete":true}'::jsonb);
  assert b->'record'->>'deleted_at' is not null, 'tombstone';
  b := public.apply_continuity_operation(op || '{"operationId":"b9520000-0000-4000-8000-000000000011","baseRevision":2}'::jsonb);
  assert b->>'status'='conflict', 'old edit cannot restore deleted habit';
  assert jsonb_array_length(public.pull_continuity_changes((a->2->>'change_seq')::bigint))=1, 'incremental deletion';
  b := public.apply_continuity_operation(op || '{"operationId":"b9520000-0000-4000-8000-000000000012","baseRevision":2,"restore":true}'::jsonb);
  assert b->>'status'='applied' and b->'record'->>'deleted_at' is null, 'explicit restore';
  begin
    delete from public.continuity_records;
    raise exception 'direct write accepted';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','a9520000-0000-4000-8000-000000000002',true);
do $$ begin
  assert (select count(*) from public.continuity_records)=0, 'cross account read';
  assert public.pull_continuity_changes(0)='[]'::jsonb, 'cross account pull';
  begin
    perform public.apply_continuity_operation('{"operationId":"b9520000-0000-4000-8000-000000000008","kind":"checkin","entityId":"c9520000-0000-4000-8000-000000000001:2026-09-07","baseRevision":0,"payload":{"habitId":"c9520000-0000-4000-8000-000000000001","date":"2026-09-07","completed":true}}');
    raise exception 'foreign habit accepted';
  exception when foreign_key_violation then null; end;
end $$;
select 'CONTINUITY_DATABASE_PASSED' as result;
rollback;
