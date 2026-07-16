/** Shared domain types mirroring the Intelligent Contract's view dicts. */

export type MarketStatus =
  | 'OPEN'
  | 'RESOLVING'
  | 'RESOLVED_YES'
  | 'RESOLVED_NO'
  | 'CANCELLED'
  | 'EXPIRED';

export type StepState = 'PENDING' | 'FULFILLED' | 'FAILED';

export interface ChainStep {
  index: number;
  description: string;
  sources: string[];
  state: StepState;
  confidence: number;
  reasoning: string;
  evidence_summary: string;
  checked_at_ts: number;
  check_count: number;
}

export interface Market {
  id: number;
  creator: string;
  title: string;
  description: string;
  category: string;
  created_ts: number;
  deadline_ts: number;
  status: MarketStatus;
  confidence_floor: number;
  yes_pool: number;
  no_pool: number;
  total_pool: number;
  implied_yes_bps: number;
  creation_bond: number;
  resolved_ts: number;
  resolution_summary: string;
  stake_count: number;
  steps_fulfilled: number;
  steps_failed: number;
  step_count: number;
  steps?: ChainStep[];
}

export interface Position {
  yes_amount: number;
  no_amount: number;
  claimed: boolean;
}

export interface PayoutQuote {
  claimable: number;
  hypothetical_yes_win: number;
  hypothetical_no_win: number;
  claimed: boolean;
}

export interface PortfolioEntry {
  market_id: number;
  position: Position;
  quote: PayoutQuote;
  market: Market;
}

export interface Portfolio {
  address: string;
  balance: number;
  positions: PortfolioEntry[];
  notifications: ActivityEvent[];
}

export interface ActivityEvent {
  market_id?: number;
  kind: string;
  actor: string;
  amount: number;
  ts: number;
  note: string;
}

export interface PlatformStats {
  market_count: number;
  total_volume: number;
  total_stakes: number;
  total_resolved: number;
  total_payouts: number;
  paused: boolean;
}
