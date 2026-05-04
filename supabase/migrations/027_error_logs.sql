create table if not exists error_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  user_id text,
  message text not null,
  stack text,
  context text,
  url text,
  created_at timestamptz not null default now()
);

create index error_logs_org_id_created_at_idx on error_logs (org_id, created_at desc);
