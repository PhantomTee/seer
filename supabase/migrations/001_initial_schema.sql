create extension if not exists "uuid-ossp";

create table public.markets (
  id                  bigint primary key,
  creator_address     text not null,
  question            text not null,
  ipfs_metadata_cid   text,
  resolution_time     timestamptz not null,
  oracle_mode         text not null check (oracle_mode in ('CHAINLINK','OPTIMISTIC','ADMIN')),
  market_type         text not null check (market_type in ('BINARY','CATEGORICAL')),
  state               text not null default 'OPEN' check (state in ('OPEN','RESOLVING','RESOLVED','INVALID')),
  outcome_labels      text[] not null,
  chainlink_feed      text,
  chainlink_threshold numeric,
  chainlink_above     boolean,
  winning_outcome     integer,
  total_volume_usdc   numeric default 0,
  tx_hash             text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create table public.positions (
  id              uuid primary key default uuid_generate_v4(),
  user_address    text not null,
  market_id       bigint references public.markets(id),
  outcome_index   integer not null,
  token_amount    numeric not null,
  avg_price_usdc  numeric,
  is_confidential boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (user_address, market_id, outcome_index)
);

create table public.trades (
  id              uuid primary key default uuid_generate_v4(),
  market_id       bigint references public.markets(id),
  trader_address  text not null,
  outcome_index   integer not null,
  side            text not null check (side in ('BUY','SELL')),
  amount_tokens   numeric not null,
  usdc_amount     numeric not null,
  price           numeric not null,
  tx_hash         text,
  block_number    bigint,
  trade_source    text check (trade_source in ('ORDER_BOOK','CPMM')),
  created_at      timestamptz default now()
);

create table public.disputes (
  id              uuid primary key default uuid_generate_v4(),
  market_id       bigint references public.markets(id),
  proposer        text not null,
  proposed_outcome integer not null,
  proposer_bond   numeric not null,
  challenger      text,
  counter_outcome integer,
  challenger_bond numeric,
  dispute_opened_at timestamptz,
  dispute_deadline  timestamptz,
  resolved_outcome  integer,
  resolution_tx   text,
  created_at      timestamptz default now()
);

create table public.agent_logs (
  id              uuid primary key default uuid_generate_v4(),
  action          text not null,
  market_id       bigint,
  details         jsonb,
  tx_hash         text,
  created_at      timestamptz default now()
);

create table public.agent_suggestions (
  id              uuid primary key default uuid_generate_v4(),
  question        text not null,
  rationale       text,
  suggested_oracle text,
  resolution_time timestamptz,
  upvotes         integer default 0,
  created_at      timestamptz default now()
);

create table public.user_alerts (
  id              uuid primary key default uuid_generate_v4(),
  user_address    text not null,
  market_id       bigint references public.markets(id),
  alert_type      text not null,
  message         text not null,
  read            boolean default false,
  created_at      timestamptz default now()
);

create index on public.markets(state);
create index on public.markets(resolution_time);
create index on public.positions(user_address);
create index on public.trades(market_id);
create index on public.trades(trader_address);
create index on public.disputes(market_id);
create index on public.user_alerts(user_address, read);

alter publication supabase_realtime add table public.trades;
alter publication supabase_realtime add table public.markets;
alter publication supabase_realtime add table public.user_alerts;
alter publication supabase_realtime add table public.disputes;

alter table public.markets       enable row level security;
alter table public.positions     enable row level security;
alter table public.trades        enable row level security;
alter table public.disputes      enable row level security;
alter table public.agent_logs    enable row level security;
alter table public.agent_suggestions enable row level security;
alter table public.user_alerts   enable row level security;

create policy "Markets are readable by all" on public.markets for select using (true);
create policy "Trades are readable by all" on public.trades for select using (true);
create policy "Disputes are readable by all" on public.disputes for select using (true);
create policy "Suggestions are readable by all" on public.agent_suggestions for select using (true);
create policy "Agent logs are readable by all" on public.agent_logs for select using (true);

create policy "Positions: owner read" on public.positions for select
  using (user_address = lower(current_setting('app.current_user_address', true)));

create policy "Alerts: owner read" on public.user_alerts for select
  using (user_address = lower(current_setting('app.current_user_address', true)));

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger markets_touch_updated_at
before update on public.markets
for each row execute function public.touch_updated_at();

create trigger positions_touch_updated_at
before update on public.positions
for each row execute function public.touch_updated_at();
