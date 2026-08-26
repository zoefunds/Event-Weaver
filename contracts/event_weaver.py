# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import datetime
import json
import typing
from dataclasses import dataclass

from genlayer import *


# ============================================================================
#  Constants — statuses, sides, limits
# ============================================================================

# Market lifecycle statuses. Stored as small ints for cheap storage;
# translated to strings at the view boundary.
STATUS_OPEN: int = 0          # accepting stakes
STATUS_RESOLVING: int = 1     # resolution requested, adjudication ran at least once
STATUS_RESOLVED_YES: int = 2  # full chain verified — YES stakers win
STATUS_RESOLVED_NO: int = 3   # chain definitively broken — NO stakers win
STATUS_CANCELLED: int = 4     # cancelled before activity; stakes refundable
STATUS_EXPIRED: int = 5       # deadline passed without full chain — NO wins

STATUS_NAMES: dict[int, str] = {
    STATUS_OPEN: "OPEN",
    STATUS_RESOLVING: "RESOLVING",
    STATUS_RESOLVED_YES: "RESOLVED_YES",
    STATUS_RESOLVED_NO: "RESOLVED_NO",
    STATUS_CANCELLED: "CANCELLED",
    STATUS_EXPIRED: "EXPIRED",
}

# Per-step verification states.
STEP_PENDING: int = 0     # not yet evaluated, or evidence inconclusive so far
STEP_FULFILLED: int = 1   # verified to have occurred
STEP_FAILED: int = 2      # verified NOT to have occurred / can no longer occur

STEP_NAMES: dict[int, str] = {
    STEP_PENDING: "PENDING",
    STEP_FULFILLED: "FULFILLED",
    STEP_FAILED: "FAILED",
}

SIDE_YES: int = 1
SIDE_NO: int = 2

# Hard limits — sanity rails, generous enough not to constrain real use.
MAX_STEPS_PER_MARKET: int = 12
MIN_STEPS_PER_MARKET: int = 2
MAX_SOURCES_PER_STEP: int = 5
MAX_TITLE_LEN: int = 200
MAX_DESCRIPTION_LEN: int = 2000
MAX_STEP_TEXT_LEN: int = 600
MAX_URL_LEN: int = 500
MAX_CATEGORY_LEN: int = 40
MAX_EVIDENCE_EXCERPT: int = 1200   # chars of rendered page fed to the LLM per source
MAX_REASONING_STORED: int = 2000   # chars of reasoning persisted per step

# Confidence is bucketed to a coarse 0..100 int; the DEFAULT floor a market
# needs for a step to flip from PENDING to FULFILLED/FAILED. Coarse buckets
# keep validators convergent.
DEFAULT_CONFIDENCE_FLOOR: int = 70
MIN_CONFIDENCE_FLOOR: int = 55
MAX_CONFIDENCE_FLOOR: int = 95

# Fees are expressed in basis points (1/10000).
DEFAULT_PROTOCOL_FEE_BPS: int = 100    # 1.0% of the losing pool
DEFAULT_CREATOR_FEE_BPS: int = 50      # 0.5% of the losing pool
MAX_TOTAL_FEE_BPS: int = 1000          # combined fees can never exceed 10%

BPS_DENOMINATOR: int = 10000

# Error prefixes — deterministic, machine-parseable failure classes.
ERR_EXPECTED = "EXPECTED: "     # caller mistake (bad input, wrong state)
ERR_EXTERNAL = "EXTERNAL: "     # upstream/web failure
ERR_TRANSIENT = "TRANSIENT: "   # retryable condition
ERR_LLM = "LLM_ERROR: "         # model output unusable after sanitation

DEFAULT_CATEGORIES: list[str] = [
    "Technology",
    "Finance",
    "Geopolitics",
    "Science",
    "Sports",
    "Crypto",
    "Entertainment",
    "Climate",
    "Other",
]


# ============================================================================
#  Storage dataclasses
# ============================================================================

@allow_storage
@dataclass
class ChainStep:
    """One condition in a market's causal chain.

    A step describes a single verifiable real-world condition, the public
    web sources validators should consult, and the current verification
    state plus an audit trail of the last adjudication.
    """
    description: str          # natural-language condition, e.g. "Apple launches AR glasses before June 2026"
    sources: DynArray[str]    # public URLs to consult as evidence
    state: u8                 # STEP_PENDING / STEP_FULFILLED / STEP_FAILED
    confidence: u8            # 0..100 bucketed confidence of last verdict
    reasoning: str            # persisted transparent reasoning (truncated)
    evidence_summary: str     # short summary of what evidence supported the verdict
    checked_at_ts: u64        # unix ts (caller-supplied clock) of last check
    check_count: u32          # how many adjudication passes touched this step


@allow_storage
@dataclass
class Market:
    """A causal-chain prediction market."""
    id: u64
    creator: Address
    title: str
    description: str
    category: str
    created_ts: u64
    deadline_ts: u64            # after this, an unresolved chain expires to NO
    status: u8
    confidence_floor: u8        # per-market floor for step verdicts
    yes_pool: u256              # USDC base units (6 decimals) staked on YES
    no_pool: u256               # USDC base units (6 decimals) staked on NO
    creation_bond: u256         # deprecated native-GEN field, retained as zero for V1
    resolved_ts: u64
    resolution_summary: str     # overall transparent reasoning of the final verdict
    fee_paid: bool              # protocol+creator fee already carved from losing pool
    stake_count: u32            # number of stake actions (activity metric)
    steps_fulfilled: u32        # cached count of FULFILLED steps
    steps_failed: u32           # cached count of FAILED steps


@allow_storage
@dataclass
class Position:
    """A user's stake in one market."""
    yes_amount: u256
    no_amount: u256
    claimed: bool


@allow_storage
@dataclass
class ActivityEvent:
    """Append-only activity log entry for a market (staking / lifecycle)."""
    kind: str          # "CREATE" | "STAKE_YES" | "STAKE_NO" | "RESOLVE" | "CLAIM" | "CANCEL" | "EXPIRE" | "CHECK"
    actor: Address
    amount: u256
    ts: u64
    note: str


# ============================================================================
#  Pure helpers (deterministic — safe anywhere)
# ============================================================================

def _require(cond: bool, message: str) -> None:
    """Deterministic guard that raises a user-facing EXPECTED error."""
    if not cond:
        raise gl.vm.UserError(ERR_EXPECTED + message)


def _clamp_int(value: int, low: int, high: int) -> int:
    """Clamp an int into [low, high]."""
    if value < low:
        return low
    if value > high:
        return high
    return value


def _truncate(text: str, limit: int) -> str:
    """Trim text to a storage-safe length without exploding mid-codepoint."""
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def _normalize_url(url: str) -> str:
    """Light URL validation/normalization. Rejects obviously invalid input."""
    u = url.strip()
    _require(0 < len(u) <= MAX_URL_LEN, f"source URL must be 1..{MAX_URL_LEN} chars")
    _require(
        u.startswith("https://") or u.startswith("http://"),
        f"source URL must start with http(s):// — got '{u[:40]}'",
    )
    return u


def _confidence_bucket(raw: typing.Any) -> int:
    """Coerce arbitrary LLM confidence output into a coarse 0..100 bucket.

    Accepts ints, floats, numeric strings, and percentages expressed as
    0..1 floats. Buckets to the nearest 5 so leader and validators that
    reason to slightly different confidences still converge.
    """
    try:
        if isinstance(raw, bool):
            value = 100.0 if raw else 0.0
        elif isinstance(raw, (int, float)):
            value = float(raw)
        elif isinstance(raw, str):
            cleaned = raw.strip().rstrip("%").strip()
            value = float(cleaned)
        else:
            value = 0.0
    except (ValueError, TypeError):
        value = 0.0
    if 0.0 < value <= 1.0:
        value *= 100.0
    value = max(0.0, min(100.0, value))
    return int(round(value / 5.0) * 5)


def _coerce_bool(raw: typing.Any) -> typing.Optional[bool]:
    """Interpret common LLM spellings of a boolean. None if unparseable."""
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, (int, float)):
        if raw == 1:
            return True
        if raw == 0:
            return False
        return None
    if isinstance(raw, str):
        lowered = raw.strip().lower()
        if lowered in ("true", "yes", "y", "1", "fulfilled", "occurred", "happened", "confirmed"):
            return True
        if lowered in ("false", "no", "n", "0", "failed", "not occurred", "did not happen", "refuted"):
            return False
    return None


def _first_present(payload: dict, keys: list[str]) -> typing.Any:
    """Return the first present key from a list of aliases, else None."""
    for key in keys:
        if key in payload:
            return payload[key]
    return None


def _sanitize_json_text(text: str) -> str:
    """Strip markdown fences and leading chatter around a JSON object."""
    stripped = text.strip()
    if stripped.startswith("```"):
        # remove the first fence line and any trailing fence
        first_newline = stripped.find("\n")
        if first_newline != -1:
            stripped = stripped[first_newline + 1 :]
        if stripped.rstrip().endswith("```"):
            stripped = stripped.rstrip()[:-3]
    # fall back to the outermost braces if there is chatter around the object
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end != -1 and end > start:
        stripped = stripped[start : end + 1]
    return stripped.strip()


def _parse_verdict_payload(raw: typing.Any) -> dict:
    """Normalize an LLM verdict into {occurred, can_still_occur, confidence,
    reasoning, evidence_summary}.

    Tolerant of alias keys and stringly-typed values; raises LLM_ERROR only
    when the outcome itself is unrecoverable.
    """
    payload: typing.Any = raw
    if isinstance(payload, str):
        try:
            payload = json.loads(_sanitize_json_text(payload))
        except (json.JSONDecodeError, ValueError):
            raise gl.vm.UserError(ERR_LLM + "verdict was not parseable JSON")
    if not isinstance(payload, dict):
        raise gl.vm.UserError(ERR_LLM + "verdict JSON was not an object")

    occurred_raw = _first_present(
        payload,
        ["occurred", "happened", "fulfilled", "result", "verdict", "outcome", "answer"],
    )
    occurred = _coerce_bool(occurred_raw)

    can_still_raw = _first_present(
        payload,
        ["can_still_occur", "still_possible", "possible", "pending_possible", "may_still_occur"],
    )
    can_still = _coerce_bool(can_still_raw)
    if can_still is None:
        # Conservative default: if the model didn't say, assume the event
        # can still occur so we stay PENDING rather than flipping to FAILED.
        can_still = True

    confidence = _confidence_bucket(
        _first_present(payload, ["confidence", "confidence_pct", "certainty", "score"])
    )

    reasoning_raw = _first_present(payload, ["reasoning", "rationale", "explanation", "analysis"])
    reasoning = str(reasoning_raw) if reasoning_raw is not None else ""

    evidence_raw = _first_present(payload, ["evidence_summary", "evidence", "sources_summary"])
    evidence_summary = str(evidence_raw) if evidence_raw is not None else ""

    if occurred is None:
        # Unclear verdict — treat as low-confidence "not yet", never crash.
        occurred = False
        can_still = True
        confidence = 0

    return {
        "occurred": occurred,
        "can_still_occur": can_still,
        "confidence": confidence,
        "reasoning": reasoning,
        "evidence_summary": evidence_summary,
    }


# ============================================================================
#  The Contract
# ============================================================================

class EventWeaver(gl.Contract):
    """Causal-chain prediction markets. GenLayer adjudicates outcomes while
    Base Sepolia USDC escrow handles all value movement and payouts."""

    # ---- ownership / config -------------------------------------------------
    owner: Address
    paused: bool
    protocol_fee_bps: u32
    creator_fee_bps: u32
    accrued_protocol_fees: u256  # informational USDC units; escrow holds funds
    min_creation_bond: u256
    min_stake: u256

    # ---- market storage -----------------------------------------------------
    market_count: u64
    markets: TreeMap[u32, Market]
    market_steps: TreeMap[u32, DynArray[ChainStep]]

    # positions keyed by "marketId:0xaddress"
    positions: TreeMap[str, Position]
    # per-user list of market ids they have staked in
    user_markets: TreeMap[Address, DynArray[u64]]
    # per-market activity log
    activity: TreeMap[u32, DynArray[ActivityEvent]]

    # Addresses that staked each market. Needed by the Base Sepolia relayer to
    # read a finalized, consensus-derived payout list without off-chain DB trust.
    market_stakers: TreeMap[u32, DynArray[Address]]

    # ---- platform metrics ---------------------------------------------------
    total_volume: u256
    total_stakes: u64
    total_resolved: u64
    total_payouts: u256

    # ------------------------------------------------------------------------
    #  Construction
    # ------------------------------------------------------------------------

    def __init__(
        self,
        min_creation_bond: int = 0,
        min_stake: int = 0,
    ):
        """Deploy the platform.

        Args:
            min_creation_bond: retained compatibility setting (no native value
                is accepted in V1; anti-spam is handled off-chain).
            min_stake: minimum USDC base units per stake action. 0 disables.
        """
        self.owner = gl.message.sender_address
        self.paused = False
        self.protocol_fee_bps = u32(DEFAULT_PROTOCOL_FEE_BPS)
        self.creator_fee_bps = u32(DEFAULT_CREATOR_FEE_BPS)
        self.accrued_protocol_fees = u256(0)
        self.min_creation_bond = u256(max(0, min_creation_bond))
        self.min_stake = u256(max(0, min_stake))
        self.market_count = u64(0)
        self.total_volume = u256(0)
        self.total_stakes = u64(0)
        self.total_resolved = u64(0)
        self.total_payouts = u256(0)

    # ------------------------------------------------------------------------
    #  Internal utilities
    # ------------------------------------------------------------------------

    def _not_paused(self) -> None:
        if self.paused:
            raise gl.vm.UserError(ERR_EXPECTED + "platform is paused")

    def _only_owner(self) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError(ERR_EXPECTED + "only the owner may call this")

    def _now_ts(self) -> int:
        """Authenticated, consensus-agreed clock. GenVM patches
        datetime.now() to the network's block time, which every validator
        computes identically — it is never read from caller-supplied
        arguments or calldata, so it cannot be spoofed by a transaction
        sender to fabricate a future or stale time."""
        return int(datetime.datetime.now(datetime.timezone.utc).timestamp())

    def _require_adjudication_rights(self, market: Market, now_ts: int) -> None:
        """Adjudication policy: before the market deadline only the market
        creator or the platform owner may trigger step checks (progressive
        verification of long chains). After the deadline adjudication is
        fully permissionless — anyone (including the platform's automatic
        resolver) may trigger it, and validators decide trustlessly."""
        if now_ts > int(market.deadline_ts):
            return
        sender = gl.message.sender_address
        _require(
            sender == market.creator or sender == self.owner,
            "before the deadline only the market creator or owner may trigger adjudication",
        )

    def _get_market(self, market_id: int) -> Market:
        mid = u32(market_id)
        market = self.markets.get(mid)
        if market is None:
            raise gl.vm.UserError(ERR_EXPECTED + f"market {market_id} does not exist")
        return market

    def _position_key(self, market_id: int, addr: Address) -> str:
        return f"{market_id}:{addr.as_hex}"

    def _get_or_create_position(self, market_id: int, addr: Address) -> Position:
        key = self._position_key(market_id, addr)
        pos = self.positions.get(key)
        if pos is None:
            self.positions[key] = Position(
                yes_amount=u256(0), no_amount=u256(0), claimed=False
            )
            pos = self.positions[key]
        return pos

    def _log(self, market_id: int, kind: str, actor: Address, amount: int, ts: int, note: str) -> None:
        """Append to the market's activity log."""
        mid = u32(market_id)
        if self.activity.get(mid) is None:
            self.activity[mid] = []
        self.activity[mid].append(
            ActivityEvent(
                kind=kind,
                actor=actor,
                amount=u256(max(0, amount)),
                ts=u64(max(0, ts)),
                note=_truncate(note, 200),
            )
        )

    def _record_user_market(self, addr: Address, market_id: int) -> None:
        """Track which markets a user has touched (idempotent-ish; we accept
        duplicates being filtered at the view layer to keep writes cheap)."""
        if self.user_markets.get(addr) is None:
            self.user_markets[addr] = []
        arr = self.user_markets[addr]
        mid = u32(market_id)
        # small-scan dedupe; user market lists are short in practice
        for existing in arr:
            if existing == mid:
                return
        arr.append(mid)

    def _record_market_staker(self, addr: Address, market_id: int) -> None:
        mid = u32(market_id)
        if self.market_stakers.get(mid) is None:
            self.market_stakers[mid] = []
        arr = self.market_stakers[mid]
        for existing in arr:
            if existing == addr:
                return
        arr.append(addr)

    # ------------------------------------------------------------------------
    #  Market serialization for views (schema-safe primitives only)
    # ------------------------------------------------------------------------

    def _step_dict(self, step: ChainStep, index: int) -> dict:
        return {
            "index": index,
            "description": step.description,
            "sources": [s for s in step.sources],
            "state": STEP_NAMES.get(int(step.state), "PENDING"),
            "confidence": int(step.confidence),
            "reasoning": step.reasoning,
            "evidence_summary": step.evidence_summary,
            "checked_at_ts": int(step.checked_at_ts),
            "check_count": int(step.check_count),
        }

    def _market_dict(self, market: Market, include_steps: bool) -> dict:
        yes_pool = int(market.yes_pool)
        no_pool = int(market.no_pool)
        total = yes_pool + no_pool
        # implied probability from pool ratio, in basis points
        implied_yes_bps = (yes_pool * BPS_DENOMINATOR) // total if total > 0 else 5000
        result = {
            "id": int(market.id),
            "creator": market.creator.as_hex,
            "title": market.title,
            "description": market.description,
            "category": market.category,
            "created_ts": int(market.created_ts),
            "deadline_ts": int(market.deadline_ts),
            "status": STATUS_NAMES.get(int(market.status), "OPEN"),
            "confidence_floor": int(market.confidence_floor),
            "yes_pool": yes_pool,
            "no_pool": no_pool,
            "total_pool": total,
            "implied_yes_bps": implied_yes_bps,
            "creation_bond": int(market.creation_bond),
            "resolved_ts": int(market.resolved_ts),
            "resolution_summary": market.resolution_summary,
            "stake_count": int(market.stake_count),
            "steps_fulfilled": int(market.steps_fulfilled),
            "steps_failed": int(market.steps_failed),
            "step_count": len(self.market_steps[u32(int(market.id))]) if self.market_steps.get(u32(int(market.id))) is not None else 0,
        }
        if include_steps:
            steps = self.market_steps.get(u32(int(market.id)))
            result["steps"] = (
                [self._step_dict(step, i) for i, step in enumerate(steps)]
                if steps is not None
                else []
            )
        return result

    # ------------------------------------------------------------------------
    #  Non-deterministic adjudication core
    # ------------------------------------------------------------------------

    def _fetch_evidence(self, sources: list[str]) -> list[dict]:
        """Fetch each evidence URL defensively inside the nondet block.

        Runs INSIDE a leader/validator function — never call from
        deterministic code. A dead or slow source yields an error record
        instead of aborting adjudication.
        """
        evidence: list[dict] = []
        for url in sources[:MAX_SOURCES_PER_STEP]:
            try:
                text = gl.nondet.web.render(url, mode="text")
                excerpt = str(text)[:MAX_EVIDENCE_EXCERPT]
                evidence.append({"url": url, "ok": True, "excerpt": excerpt})
            except Exception as exc:  # noqa: BLE001 — degrade per-source
                evidence.append({"url": url, "ok": False, "excerpt": f"[fetch failed: {str(exc)[:120]}]"})
        return evidence

    def _build_step_prompt(
        self,
        market_title: str,
        step_description: str,
        step_index: int,
        prior_context: str,
        deadline_ts: int,
        now_ts: int,
        evidence: list[dict],
    ) -> str:
        """Compose the adjudication prompt for one chain step."""
        evidence_blocks = []
        for item in evidence:
            status = "OK" if item["ok"] else "FETCH_FAILED"
            evidence_blocks.append(f"--- SOURCE ({status}): {item['url']}\n{item['excerpt']}")
        evidence_text = "\n\n".join(evidence_blocks) if evidence_blocks else "(no sources provided)"

        return f"""You are a neutral adjudicator for a causal-chain prediction market called "{market_title}".

You must decide whether ONE specific condition in the chain has occurred in the real world, based ONLY on the evidence excerpts below plus widely-known public facts. Do not speculate beyond the evidence.

CONDITION (step {step_index + 1} of the chain):
"{step_description}"

CONTEXT FROM EARLIER CHAIN STEPS:
{prior_context if prior_context else "(this is the first step)"}

TIMING: current unix time is {now_ts}; the market deadline is unix time {deadline_ts}.

EVIDENCE:
{evidence_text}

Respond with ONLY a JSON object, no markdown, with exactly these keys:
{{
  "occurred": true or false — has the condition verifiably occurred?
  "can_still_occur": true or false — if it has not occurred, is it still possible before the deadline?
  "confidence": integer 0-100 — your confidence in the "occurred" answer,
  "reasoning": one short paragraph explaining the verdict,
  "evidence_summary": one sentence naming which evidence supported the verdict
}}

Rules:
- "occurred" must be true ONLY with concrete supporting evidence.
- If evidence is missing or ambiguous, set occurred=false, can_still_occur=true, confidence below 50.
- If the deadline has passed and it did not occur, set can_still_occur=false.
- Keep reasoning under 120 words."""

    def _adjudicate_step_nondet(
        self,
        market_title: str,
        step_description: str,
        step_index: int,
        sources: list[str],
        prior_context: str,
        deadline_ts: int,
        now_ts: int,
    ) -> dict:
        """Run the full web-fetch + LLM verdict for one step under a
        comparative equivalence principle.

        The principle is deliberately outcome-focused and tolerant: the
        leader's result stands as long as validators agree on the verdict
        booleans and rough confidence band, regardless of prose wording.
        This prevents leader rotation / Undetermined results caused by
        immaterial differences in fetched page snapshots.
        """

        def leader() -> str:
            evidence = self._fetch_evidence(sources)
            prompt = self._build_step_prompt(
                market_title,
                step_description,
                step_index,
                prior_context,
                deadline_ts,
                now_ts,
                evidence,
            )
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            verdict = _parse_verdict_payload(raw)
            # Return a compact canonical JSON string — comparative NLP
            # equivalence then compares meaning, not bytes.
            return json.dumps(
                {
                    "occurred": verdict["occurred"],
                    "can_still_occur": verdict["can_still_occur"],
                    "confidence": verdict["confidence"],
                    "reasoning": _truncate(verdict["reasoning"], 800),
                    "evidence_summary": _truncate(verdict["evidence_summary"], 300),
                },
                sort_keys=True,
            )

        principle = (
            "Both results are JSON verdicts about whether the same real-world "
            "condition occurred. Treat them as equivalent if they agree on the "
            "boolean value of 'occurred' AND on the boolean value of "
            "'can_still_occur', and their 'confidence' values are within 25 "
            "points of each other. Differences in wording of 'reasoning' or "
            "'evidence_summary', formatting, or key order are irrelevant."
        )

        raw_result = gl.eq_principle.prompt_comparative(leader, principle)
        return _parse_verdict_payload(raw_result)

    def _apply_verdict_to_step(self, market: Market, step: ChainStep, verdict: dict, now_ts: int) -> None:
        """Fold an adjudication verdict into a step's stored state."""
        floor = int(market.confidence_floor)
        confidence = int(verdict["confidence"])
        occurred = bool(verdict["occurred"])
        can_still = bool(verdict["can_still_occur"])

        previous_state = int(step.state)
        new_state = previous_state

        if occurred and confidence >= floor:
            new_state = STEP_FULFILLED
        elif (not occurred) and (not can_still) and confidence >= floor:
            new_state = STEP_FAILED
        # Otherwise: stay PENDING — inconclusive evidence never flips a step.

        # A fulfilled step is sticky: real-world events don't un-happen. A
        # later low-confidence pass cannot revert it.
        if previous_state == STEP_FULFILLED:
            new_state = STEP_FULFILLED

        if new_state != previous_state:
            if new_state == STEP_FULFILLED:
                market.steps_fulfilled = u32(int(market.steps_fulfilled) + 1)
            elif new_state == STEP_FAILED:
                market.steps_failed = u32(int(market.steps_failed) + 1)

        step.state = u8(new_state)
        step.confidence = u8(_clamp_int(confidence, 0, 100))
        step.reasoning = _truncate(str(verdict["reasoning"]), MAX_REASONING_STORED)
        step.evidence_summary = _truncate(str(verdict["evidence_summary"]), 400)
        step.checked_at_ts = u64(max(0, now_ts))
        step.check_count = u32(int(step.check_count) + 1)

    def _maybe_finalize(self, market: Market, now_ts: int) -> None:
        """Flip a RESOLVING market to a terminal status when the chain is
        decided: all steps fulfilled → YES; any step failed → NO; deadline
        passed with unfulfilled steps → EXPIRED (NO side wins)."""
        steps = self.market_steps[u32(int(market.id))]
        total_steps = len(steps)
        fulfilled = int(market.steps_fulfilled)
        failed = int(market.steps_failed)

        if failed > 0:
            market.status = u8(STATUS_RESOLVED_NO)
        elif fulfilled == total_steps and total_steps > 0:
            market.status = u8(STATUS_RESOLVED_YES)
        elif now_ts > int(market.deadline_ts):
            market.status = u8(STATUS_EXPIRED)
        else:
            return  # still undecided — stays RESOLVING

        market.resolved_ts = u64(max(0, now_ts))
        self.total_resolved = u64(int(self.total_resolved) + 1)
        outcome = STATUS_NAMES[int(market.status)]
        parts = [f"Chain verdict: {outcome}."]
        for i, step in enumerate(steps):
            parts.append(
                f"Step {i + 1} [{STEP_NAMES[int(step.state)]}, conf {int(step.confidence)}%]: "
                f"{_truncate(step.reasoning, 240)}"
            )
        market.resolution_summary = _truncate(" ".join(parts), 4000)
        self._log(int(market.id), "RESOLVE", gl.message.sender_address, 0, now_ts, outcome)
        self._settle_fees(market)

    def _settle_fees(self, market: Market) -> None:
        """Calculate the losing-pool fee accounting once. USDC remains in
        Base Sepolia escrow; only the distributable amount is relayed."""
        if market.fee_paid:
            return
        status = int(market.status)
        if status == STATUS_RESOLVED_YES:
            losing_pool = int(market.no_pool)
        elif status in (STATUS_RESOLVED_NO, STATUS_EXPIRED):
            losing_pool = int(market.yes_pool)
        else:
            return

        protocol_fee = (losing_pool * int(self.protocol_fee_bps)) // BPS_DENOMINATOR
        self.accrued_protocol_fees = u256(int(self.accrued_protocol_fees) + protocol_fee)
        market.fee_paid = True

    def _losing_pool_after_fees(self, market: Market) -> tuple[int, int]:
        """Return (winning_pool, distributable_losing_pool_after_fees)."""
        status = int(market.status)
        if status == STATUS_RESOLVED_YES:
            winning, losing = int(market.yes_pool), int(market.no_pool)
        else:
            winning, losing = int(market.no_pool), int(market.yes_pool)
        total_fee_bps = int(self.protocol_fee_bps) + int(self.creator_fee_bps)
        distributable = losing - (losing * total_fee_bps) // BPS_DENOMINATOR
        return winning, max(0, distributable)

    # ========================================================================
    #  PUBLIC WRITES — market lifecycle
    # ========================================================================

    @gl.public.write
    def create_market(
        self,
        title: str,
        description: str,
        category: str,
        steps_json: str,
        deadline_ts: int,
        confidence_floor: int = DEFAULT_CONFIDENCE_FLOOR,
    ) -> int:
        """Create a causal-chain market. V1 accepts no native value: USDC is
        deposited into the Base Sepolia escrow only when a user stakes.

        Args:
            title / description / category: market metadata.
            steps_json: JSON array of {"description": str, "sources": [url,...]}
                objects, ordered — the causal chain. 2..12 steps.
            deadline_ts: unix time after which an unresolved chain expires.
            confidence_floor: 55..95, per-step confidence needed to flip a
                step's state.

        Returns: the new market id.
        """
        self._not_paused()
        sender = gl.message.sender_address
        bond = 0
        now_ts = self._now_ts()

        _require(0 < len(title.strip()) <= MAX_TITLE_LEN, f"title must be 1..{MAX_TITLE_LEN} chars")
        _require(len(description) <= MAX_DESCRIPTION_LEN, f"description exceeds {MAX_DESCRIPTION_LEN} chars")
        _require(0 < len(category.strip()) <= MAX_CATEGORY_LEN, "category required")
        _require(deadline_ts > now_ts, "deadline must be in the future")

        floor = _clamp_int(int(confidence_floor), MIN_CONFIDENCE_FLOOR, MAX_CONFIDENCE_FLOOR)

        # Parse and validate the chain definition.
        if isinstance(steps_json, (list, tuple)):
            raw_steps = list(steps_json)
        else:
            try:
                raw_steps = json.loads(steps_json)
            except (json.JSONDecodeError, ValueError, TypeError):
                raise gl.vm.UserError(ERR_EXPECTED + "steps_json is not valid JSON")
        _require(isinstance(raw_steps, list), "steps_json must be a JSON array")
        _require(
            MIN_STEPS_PER_MARKET <= len(raw_steps) <= MAX_STEPS_PER_MARKET,
            f"chain must have {MIN_STEPS_PER_MARKET}..{MAX_STEPS_PER_MARKET} steps",
        )

        parsed_steps: list[tuple[str, list[str]]] = []
        for i, raw in enumerate(raw_steps):
            _require(isinstance(raw, dict), f"step {i} must be an object")
            desc = str(raw.get("description", "")).strip()
            _require(
                0 < len(desc) <= MAX_STEP_TEXT_LEN,
                f"step {i} description must be 1..{MAX_STEP_TEXT_LEN} chars",
            )
            raw_sources = raw.get("sources", [])
            _require(isinstance(raw_sources, list), f"step {i} sources must be an array")
            _require(
                1 <= len(raw_sources) <= MAX_SOURCES_PER_STEP,
                f"step {i} needs 1..{MAX_SOURCES_PER_STEP} evidence source URLs",
            )
            sources = [_normalize_url(str(u)) for u in raw_sources]
            parsed_steps.append((desc, sources))

        market_id = int(self.market_count)
        self.market_count = u64(market_id + 1)
        mid = u32(market_id)

        self.markets[mid] = Market(
            id=mid,
            creator=sender,
            title=title.strip(),
            description=description.strip(),
            category=category.strip(),
            created_ts=u64(now_ts),
            deadline_ts=u64(deadline_ts),
            status=u8(STATUS_OPEN),
            confidence_floor=u8(floor),
            yes_pool=u256(0),
            no_pool=u256(0),
            creation_bond=u256(bond),
            resolved_ts=u64(0),
            resolution_summary="",
            fee_paid=False,
            stake_count=u32(0),
            steps_fulfilled=u32(0),
            steps_failed=u32(0),
        )

        self.market_steps[mid] = []
        steps_arr = self.market_steps[mid]
        for desc, sources in parsed_steps:
            steps_arr.append(
                ChainStep(
                    description=desc,
                    sources=sources,
                    state=u8(STEP_PENDING),
                    confidence=u8(0),
                    reasoning="",
                    evidence_summary="",
                    checked_at_ts=u64(0),
                    check_count=u32(0),
                )
            )

        self._record_user_market(sender, market_id)
        self._log(market_id, "CREATE", sender, bond, now_ts, title.strip()[:100])
        return market_id

    def _stake(self, market_id: int, side: int, amount: int) -> None:
        """Shared USDC-stake accounting core. Escrow custody happens first on
        Base Sepolia; this consensus ledger records the matching position."""
        self._not_paused()
        now_ts = self._now_ts()
        market = self._get_market(market_id)
        _require(
            int(market.status) in (STATUS_OPEN, STATUS_RESOLVING),
            "market is not open for staking",
        )
        _require(now_ts <= int(market.deadline_ts), "market deadline has passed")
        _require(amount > 0, "stake amount must be positive")
        _require(amount >= int(self.min_stake), "stake below minimum")

        sender = gl.message.sender_address
        pos = self._get_or_create_position(market_id, sender)

        if side == SIDE_YES:
            market.yes_pool = u256(int(market.yes_pool) + amount)
            pos.yes_amount = u256(int(pos.yes_amount) + amount)
            kind = "STAKE_YES"
        else:
            market.no_pool = u256(int(market.no_pool) + amount)
            pos.no_amount = u256(int(pos.no_amount) + amount)
            kind = "STAKE_NO"

        market.stake_count = u32(int(market.stake_count) + 1)
        self.total_volume = u256(int(self.total_volume) + amount)
        self.total_stakes = u64(int(self.total_stakes) + 1)
        self._record_user_market(sender, market_id)
        self._record_market_staker(sender, market_id)
        self._log(market_id, kind, sender, amount, now_ts, "")

    @gl.public.write
    def stake_yes(self, market_id: int, amount: int) -> None:
        """Record a USDC stake on YES after the wallet has deposited the same
        six-decimal amount into EventWeaverEscrow on Base Sepolia."""
        self._stake(market_id, SIDE_YES, int(amount))

    @gl.public.write
    def stake_no(self, market_id: int, amount: int) -> None:
        """Record a USDC stake on NO after its Base Sepolia escrow deposit."""
        self._stake(market_id, SIDE_NO, int(amount))

    @gl.public.write
    def claim(self, market_id: int) -> int:
        """After terminal resolution, claim winnings: the caller's winning
        stake back plus a pro-rata share of the losing pool (after fees).
        This is a ledger acknowledgement only; real USDC is claimed directly
        from EventWeaverEscrow on Base Sepolia after the relayer settles it.

        Returns the credited amount.
        """
        now_ts = self._now_ts()
        market = self._get_market(market_id)
        status = int(market.status)
        _require(
            status in (STATUS_RESOLVED_YES, STATUS_RESOLVED_NO, STATUS_EXPIRED),
            "market is not resolved yet",
        )
        sender = gl.message.sender_address
        key = self._position_key(market_id, sender)
        pos = self.positions.get(key)
        _require(pos is not None, "no position in this market")
        _require(not pos.claimed, "already claimed")

        winning_pool, distributable = self._losing_pool_after_fees(market)
        my_winning_stake = (
            int(pos.yes_amount) if status == STATUS_RESOLVED_YES else int(pos.no_amount)
        )
        _require(my_winning_stake > 0, "no winning stake to claim")

        share = (distributable * my_winning_stake) // winning_pool if winning_pool > 0 else 0
        payout = my_winning_stake + share
        pos.claimed = True
        self._log(market_id, "CLAIM", sender, payout, now_ts, "")
        return payout

    @gl.public.write
    def refund_cancelled(self, market_id: int) -> int:
        """Acknowledge a cancelled-market refund. USDC is claimed from escrow."""
        now_ts = self._now_ts()
        market = self._get_market(market_id)
        _require(int(market.status) == STATUS_CANCELLED, "market is not cancelled")
        sender = gl.message.sender_address
        key = self._position_key(market_id, sender)
        pos = self.positions.get(key)
        _require(pos is not None, "no position in this market")
        _require(not pos.claimed, "already refunded")
        refund = int(pos.yes_amount) + int(pos.no_amount)
        _require(refund > 0, "nothing to refund")
        pos.claimed = True
        self._log(market_id, "CLAIM", sender, refund, now_ts, "refund")
        return refund

    @gl.public.write
    def cancel_market(self, market_id: int) -> None:
        """Cancel an open market. Creator may cancel only while it has no
        stakes; the owner may cancel any open/resolving market (stakes become
        refundable, bond returned)."""
        now_ts = self._now_ts()
        market = self._get_market(market_id)
        sender = gl.message.sender_address
        status = int(market.status)
        _require(status in (STATUS_OPEN, STATUS_RESOLVING), "market cannot be cancelled")
        if sender == market.creator and sender != self.owner:
            _require(int(market.stake_count) == 0, "creator can only cancel before any stakes")
        else:
            self._only_owner()
        market.status = u8(STATUS_CANCELLED)
        market.resolved_ts = u64(max(0, now_ts))
        market.resolution_summary = "Cancelled; all stakes refundable via refund_cancelled()."
        market.fee_paid = True  # no fees on cancellation
        self._log(market_id, "CANCEL", sender, 0, now_ts, "")

    # ========================================================================
    #  PUBLIC WRITES — trustless resolution
    # ========================================================================

    @gl.public.write
    def check_step(self, market_id: int, step_index: int) -> dict:
        """Adjudicate a single chain step against live web evidence.

        Anyone may call this — resolution is permissionless. The step's
        verdict is decided by validator consensus over web evidence and LLM
        reasoning, then folded into market state. Finalizes the market when
        the chain becomes decided.

        Returns the step's post-adjudication view dict.
        """
        self._not_paused()
        now_ts = self._now_ts()
        market = self._get_market(market_id)
        status = int(market.status)
        _require(status in (STATUS_OPEN, STATUS_RESOLVING), "market is not resolvable")
        self._require_adjudication_rights(market, now_ts)
        steps = self.market_steps[u32(market_id)]
        _require(0 <= step_index < len(steps), "step index out of range")

        step = steps[step_index]
        # Steps must be verified in order: everything before must be fulfilled.
        for i in range(step_index):
            _require(
                int(steps[i].state) == STEP_FULFILLED,
                f"step {i + 1} must be fulfilled before checking step {step_index + 1}",
            )

        if status == STATUS_OPEN:
            market.status = u8(STATUS_RESOLVING)

        if int(step.state) == STEP_FULFILLED:
            # Nothing to do — sticky fulfilled state.
            self._maybe_finalize(market, now_ts)
            return self._step_dict(step, step_index)

        prior_context = " ".join(
            f"Step {i + 1} ('{_truncate(steps[i].description, 120)}') was verified FULFILLED."
            for i in range(step_index)
        )

        verdict = self._adjudicate_step_nondet(
            market.title,
            step.description,
            step_index,
            [s for s in step.sources],
            prior_context,
            int(market.deadline_ts),
            now_ts,
        )
        self._apply_verdict_to_step(market, step, verdict, now_ts)
        self._log(
            market_id,
            "CHECK",
            gl.message.sender_address,
            0,
            now_ts,
            f"step {step_index + 1}: {STEP_NAMES[int(step.state)]} @{int(step.confidence)}%",
        )
        self._maybe_finalize(market, now_ts)
        return self._step_dict(step, step_index)

    @gl.public.write
    def request_resolution(self, market_id: int) -> dict:
        """Run a full adjudication pass over the chain: walks steps in order,
        adjudicating each pending step until one fails to fulfill (chain
        order matters). Finalizes if the chain becomes decided.

        Returns the market view dict after the pass.
        """
        self._not_paused()
        now_ts = self._now_ts()
        market = self._get_market(market_id)
        status = int(market.status)
        _require(status in (STATUS_OPEN, STATUS_RESOLVING), "market is not resolvable")
        self._require_adjudication_rights(market, now_ts)
        if status == STATUS_OPEN:
            market.status = u8(STATUS_RESOLVING)

        steps = self.market_steps[u32(market_id)]
        prior_context = ""
        for index in range(len(steps)):
            step = steps[index]
            state = int(step.state)
            if state == STEP_FULFILLED:
                prior_context += (
                    f"Step {index + 1} ('{_truncate(step.description, 120)}') was verified FULFILLED. "
                )
                continue
            if state == STEP_FAILED:
                break  # chain already broken
            verdict = self._adjudicate_step_nondet(
                market.title,
                step.description,
                index,
                [s for s in step.sources],
                prior_context,
                int(market.deadline_ts),
                now_ts,
            )
            self._apply_verdict_to_step(market, step, verdict, now_ts)
            self._log(
                market_id,
                "CHECK",
                gl.message.sender_address,
                0,
                now_ts,
                f"step {index + 1}: {STEP_NAMES[int(step.state)]} @{int(step.confidence)}%",
            )
            if int(step.state) != STEP_FULFILLED:
                break  # later steps depend on this one; stop the pass
            prior_context += (
                f"Step {index + 1} ('{_truncate(step.description, 120)}') was verified FULFILLED. "
            )

        self._maybe_finalize(market, now_ts)
        return self._market_dict(market, include_steps=True)

    @gl.public.write
    def expire_market(self, market_id: int) -> None:
        """Deterministically expire a market whose deadline passed without the
        full chain being verified. NO side wins. Anyone may call."""
        now_ts = self._now_ts()
        market = self._get_market(market_id)
        status = int(market.status)
        _require(status in (STATUS_OPEN, STATUS_RESOLVING), "market is not expirable")
        _require(now_ts > int(market.deadline_ts), "deadline has not passed yet")
        market.status = u8(STATUS_RESOLVING)
        self._maybe_finalize(market, now_ts)

    # ========================================================================
    #  PUBLIC WRITES — administration
    # ========================================================================

    @gl.public.write
    def pause(self) -> None:
        """Owner: halt market creation, staking and resolution."""
        self._only_owner()
        self.paused = True

    @gl.public.write
    def unpause(self) -> None:
        """Owner: resume operations."""
        self._only_owner()
        self.paused = False

    @gl.public.write
    def set_fees(self, protocol_fee_bps: int, creator_fee_bps: int) -> None:
        """Owner: update fee schedule (combined cap 10%)."""
        self._only_owner()
        _require(protocol_fee_bps >= 0 and creator_fee_bps >= 0, "fees must be non-negative")
        _require(
            protocol_fee_bps + creator_fee_bps <= MAX_TOTAL_FEE_BPS,
            f"combined fees exceed {MAX_TOTAL_FEE_BPS} bps",
        )
        self.protocol_fee_bps = u32(protocol_fee_bps)
        self.creator_fee_bps = u32(creator_fee_bps)

    @gl.public.write
    def set_minimums(self, min_creation_bond: int, min_stake: int) -> None:
        """Owner: update anti-spam minimums."""
        self._only_owner()
        _require(min_creation_bond >= 0 and min_stake >= 0, "minimums must be non-negative")
        self.min_creation_bond = u256(min_creation_bond)
        self.min_stake = u256(min_stake)

    @gl.public.write
    def set_owner(self, new_owner: str) -> None:
        """Owner: transfer ownership to a new address (hex string)."""
        self._only_owner()
        self.owner = Address(new_owner)

    @gl.public.write
    def sweep_protocol_fees(self) -> int:
        """Owner: clear the informational USDC fee counter. Actual USDC fees
        remain in the Base Sepolia escrow and are handled there."""
        self._only_owner()
        amount = int(self.accrued_protocol_fees)
        _require(amount > 0, "no fees accrued")
        self.accrued_protocol_fees = u256(0)
        return amount

    # ========================================================================
    #  PUBLIC VIEWS
    # ========================================================================

    @gl.public.view
    def get_market(self, market_id: int) -> dict:
        """Full market view including steps."""
        return self._market_dict(self._get_market(market_id), include_steps=True)

    @gl.public.view
    def get_markets(self, offset: int = 0, limit: int = 20) -> list[dict]:
        """Paginated market summaries (without step bodies), newest first."""
        count = int(self.market_count)
        capped_limit = _clamp_int(int(limit), 1, 50)
        start = count - 1 - max(0, int(offset))
        result: list[dict] = []
        idx = start
        while idx >= 0 and len(result) < capped_limit:
            market = self.markets.get(u32(idx))
            if market is not None:
                result.append(self._market_dict(market, include_steps=False))
            idx -= 1
        return result

    @gl.public.view
    def get_market_count(self) -> int:
        return int(self.market_count)

    @gl.public.view
    def get_market_ids_by_status(self, status: str) -> list[int]:
        """Ids of markets in the given status name (e.g. 'OPEN')."""
        wanted = status.strip().upper()
        matches: list[int] = []
        for i in range(int(self.market_count)):
            market = self.markets.get(u32(i))
            if market is not None and STATUS_NAMES.get(int(market.status)) == wanted:
                matches.append(i)
        return matches

    @gl.public.view
    def get_market_ids_by_category(self, category: str) -> list[int]:
        wanted = category.strip().lower()
        matches: list[int] = []
        for i in range(int(self.market_count)):
            market = self.markets.get(u32(i))
            if market is not None and market.category.strip().lower() == wanted:
                matches.append(i)
        return matches

    @gl.public.view
    def get_steps(self, market_id: int) -> list[dict]:
        self._get_market(market_id)
        steps = self.market_steps.get(u32(market_id))
        if steps is None:
            return []
        return [self._step_dict(step, i) for i, step in enumerate(steps)]

    @gl.public.view
    def get_step(self, market_id: int, step_index: int) -> dict:
        self._get_market(market_id)
        steps = self.market_steps[u32(market_id)]
        _require(0 <= step_index < len(steps), "step index out of range")
        return self._step_dict(steps[step_index], step_index)

    @gl.public.view
    def get_position(self, market_id: int, address: str) -> dict:
        """A user's stake in a market. Zeroed dict if none."""
        self._get_market(market_id)
        key = self._position_key(market_id, Address(address))
        pos = self.positions.get(key)
        if pos is None:
            return {"yes_amount": 0, "no_amount": 0, "claimed": False}
        return {
            "yes_amount": int(pos.yes_amount),
            "no_amount": int(pos.no_amount),
            "claimed": bool(pos.claimed),
        }

    @gl.public.view
    def get_user_market_ids(self, address: str) -> list[int]:
        arr = self.user_markets.get(Address(address))
        if arr is None:
            return []
        return [int(x) for x in arr]

    @gl.public.view
    def get_balance_of(self, address: str) -> int:
        """Deprecated in V1: balances are held by Base Sepolia escrow."""
        return 0

    @gl.public.view
    def get_pool(self, market_id: int) -> dict:
        market = self._get_market(market_id)
        yes_pool = int(market.yes_pool)
        no_pool = int(market.no_pool)
        total = yes_pool + no_pool
        return {
            "yes_pool": yes_pool,
            "no_pool": no_pool,
            "total_pool": total,
            "implied_yes_bps": (yes_pool * BPS_DENOMINATOR) // total if total > 0 else 5000,
        }

    @gl.public.view
    def quote_payout(self, market_id: int, address: str) -> dict:
        """What `address` would receive if it claimed right now (or, for an
        open market, if its current side won at current pool ratios)."""
        market = self._get_market(market_id)
        key = self._position_key(market_id, Address(address))
        pos = self.positions.get(key)
        if pos is None:
            return {"claimable": 0, "hypothetical_yes_win": 0, "hypothetical_no_win": 0, "claimed": False}

        status = int(market.status)
        total_fee_bps = int(self.protocol_fee_bps) + int(self.creator_fee_bps)

        def _hypo(my_stake: int, winning_pool: int, losing_pool: int) -> int:
            if my_stake <= 0 or winning_pool <= 0:
                return 0
            distributable = losing_pool - (losing_pool * total_fee_bps) // BPS_DENOMINATOR
            return my_stake + (distributable * my_stake) // winning_pool

        hypothetical_yes = _hypo(int(pos.yes_amount), int(market.yes_pool), int(market.no_pool))
        hypothetical_no = _hypo(int(pos.no_amount), int(market.no_pool), int(market.yes_pool))

        claimable = 0
        if not pos.claimed:
            if status == STATUS_RESOLVED_YES:
                claimable = hypothetical_yes
            elif status in (STATUS_RESOLVED_NO, STATUS_EXPIRED):
                claimable = hypothetical_no
            elif status == STATUS_CANCELLED:
                claimable = int(pos.yes_amount) + int(pos.no_amount)

        return {
            "claimable": claimable,
            "hypothetical_yes_win": hypothetical_yes,
            "hypothetical_no_win": hypothetical_no,
            "claimed": bool(pos.claimed),
        }

    @gl.public.view
    def get_base_payouts(self, market_id: int) -> list[dict]:
        """Consensus-derived USDC allocations for the Base Sepolia relayer.
        This is deliberately unavailable until terminal resolution so the
        relayer cannot pay a market before GenLayer decides its outcome."""
        market = self._get_market(market_id)
        status = int(market.status)
        _require(
            status in (STATUS_RESOLVED_YES, STATUS_RESOLVED_NO, STATUS_EXPIRED, STATUS_CANCELLED),
            "market is not settled",
        )
        stakers = self.market_stakers.get(u32(market_id))
        if stakers is None:
            return []
        winning_pool, distributable = self._losing_pool_after_fees(market)
        rows: list[dict] = []
        for addr in stakers:
            pos = self.positions.get(self._position_key(market_id, addr))
            if pos is None:
                continue
            if status == STATUS_CANCELLED:
                payout = int(pos.yes_amount) + int(pos.no_amount)
            else:
                winning_stake = int(pos.yes_amount) if status == STATUS_RESOLVED_YES else int(pos.no_amount)
                payout = winning_stake + ((distributable * winning_stake) // winning_pool if winning_pool > 0 else 0)
            if payout > 0:
                rows.append({"address": addr.as_hex, "amount": payout})
        return rows

    @gl.public.view
    def get_resolution_report(self, market_id: int) -> dict:
        """Full transparency report: status, per-step verdicts with reasoning,
        and the final resolution summary."""
        market = self._get_market(market_id)
        steps = self.market_steps.get(u32(market_id))
        return {
            "market_id": int(market.id),
            "status": STATUS_NAMES.get(int(market.status), "OPEN"),
            "confidence_floor": int(market.confidence_floor),
            "resolved_ts": int(market.resolved_ts),
            "resolution_summary": market.resolution_summary,
            "steps": [self._step_dict(s, i) for i, s in enumerate(steps)] if steps is not None else [],
        }

    @gl.public.view
    def get_activity(self, market_id: int, offset: int = 0, limit: int = 25) -> list[dict]:
        """Recent activity log entries for a market, newest first."""
        self._get_market(market_id)
        log = self.activity.get(u32(market_id))
        if log is None:
            return []
        total = len(log)
        capped = _clamp_int(int(limit), 1, 100)
        start = total - 1 - max(0, int(offset))
        result: list[dict] = []
        idx = start
        while idx >= 0 and len(result) < capped:
            evt = log[idx]
            result.append(
                {
                    "kind": evt.kind,
                    "actor": evt.actor.as_hex,
                    "amount": int(evt.amount),
                    "ts": int(evt.ts),
                    "note": evt.note,
                }
            )
            idx -= 1
        return result

    @gl.public.view
    def get_platform_stats(self) -> dict:
        return {
            "market_count": int(self.market_count),
            "total_volume": int(self.total_volume),
            "total_stakes": int(self.total_stakes),
            "total_resolved": int(self.total_resolved),
            "total_payouts": int(self.total_payouts),
            "accrued_protocol_fees": int(self.accrued_protocol_fees),
            "paused": bool(self.paused),
        }

    @gl.public.view
    def get_config(self) -> dict:
        return {
            "owner": self.owner.as_hex,
            "paused": bool(self.paused),
            "protocol_fee_bps": int(self.protocol_fee_bps),
            "creator_fee_bps": int(self.creator_fee_bps),
            "min_creation_bond": int(self.min_creation_bond),
            "min_stake": int(self.min_stake),
            "default_confidence_floor": DEFAULT_CONFIDENCE_FLOOR,
            "max_steps_per_market": MAX_STEPS_PER_MARKET,
            "min_steps_per_market": MIN_STEPS_PER_MARKET,
            "max_sources_per_step": MAX_SOURCES_PER_STEP,
        }

    @gl.public.view
    def get_categories(self) -> list[str]:
        return list(DEFAULT_CATEGORIES)
