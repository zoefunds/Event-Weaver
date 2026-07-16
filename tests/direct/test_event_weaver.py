"""Direct (in-memory) unit tests for the EventWeaver Intelligent Contract.

Runs the contract natively via gltest.direct — no simulator, no network.
Web and LLM calls are mocked; consensus behavior itself is covered by the
live StudioNet integration evidence in docs/CONTRACT.md.

Run: pytest tests/direct/ -v
"""

import json
import time
from pathlib import Path

import pytest
from gltest.direct import VMContext, deploy_contract, create_address

CONTRACT = Path(__file__).parent.parent.parent / "contracts" / "event_weaver.py"


def hx(addr) -> str:
    """Hex form of a test address (create_address returns raw bytes when the
    SDK is not on sys.path; the loader injects it per-activation)."""
    if isinstance(addr, bytes):
        return "0x" + addr.hex()
    return addr.as_hex


def same(a: str, b: str) -> bool:
    return a.lower() == b.lower()


OWNER = create_address("owner")
ALICE = create_address("alice")
BOB = create_address("bob")
CAROL = create_address("carol")

GEN = 10**18
NOW = int(time.time())
DEADLINE = NOW + 45 * 86400

STEPS = [
    {"description": "Apple announces a Vision Pro price cut", "sources": ["https://www.apple.com/newsroom/"]},
    {"description": "Meta cuts Quest prices within 30 days", "sources": ["https://about.fb.com/news/"]},
]


def fresh(vm: VMContext):
    """Deploy a fresh contract as OWNER with no minimums."""
    vm.sender = OWNER
    vm.value = 0
    return deploy_contract(CONTRACT, vm, 0, 0)


def make_market(vm, c, creator=ALICE, steps=None, deadline=DEADLINE, floor=70) -> int:
    vm.sender = creator
    vm.value = 0
    return c.create_market(
        "Vision Pro Adoption Cascade",
        "Ripple from Apple pricing to Meta response.",
        "Technology",
        json.dumps(steps or STEPS),
        deadline,
        NOW,
        floor,
    )


def verdict(occurred, can_still, confidence, reasoning="because evidence"):
    return json.dumps(
        {
            "occurred": occurred,
            "can_still_occur": can_still,
            "confidence": confidence,
            "reasoning": reasoning,
            "evidence_summary": "source excerpt",
        }
    )


def mock_sources(vm, body="Official announcement: the event occurred."):
    vm.mock_web(r".*apple\.com.*", {"status": 200, "body": body})
    vm.mock_web(r".*fb\.com.*", {"status": 200, "body": body})


# ---------------------------------------------------------------------------
# Deployment & config
# ---------------------------------------------------------------------------

def test_deploy_and_config():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        cfg = c.get_config()
        assert same(cfg["owner"], hx(OWNER))
        assert cfg["paused"] is False
        assert cfg["protocol_fee_bps"] == 100
        assert cfg["creator_fee_bps"] == 50
        assert c.get_market_count() == 0
        assert "Technology" in c.get_categories()


# ---------------------------------------------------------------------------
# Market creation & validation
# ---------------------------------------------------------------------------

def test_create_market_happy_path():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        mid = make_market(vm, c)
        assert mid == 0
        m = c.get_market(0)
        assert m["title"] == "Vision Pro Adoption Cascade"
        assert m["status"] == "OPEN"
        assert m["step_count"] == 2
        assert same(m["creator"], hx(ALICE))
        assert m["implied_yes_bps"] == 5000  # empty pools → 50/50
        assert [s["state"] for s in m["steps"]] == ["PENDING", "PENDING"]


def test_create_market_accepts_decoded_list():
    """Studio/CLI auto-decode JSON strings into lists — both must work."""
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        vm.sender = ALICE
        mid = c.create_market("T", "d", "Technology", STEPS, DEADLINE, NOW, 70)
        assert c.get_market(mid)["step_count"] == 2


@pytest.mark.parametrize(
    "steps,msg",
    [
        ([STEPS[0]], "steps"),                                        # too few
        ([{"description": "x", "sources": []}] * 2, "source"),        # no sources
        ([{"description": "", "sources": ["https://a.com"]}] * 2, "description"),
        ([{"description": "x", "sources": ["ftp://bad"]}] * 2, "http"),
    ],
)
def test_create_market_rejects_bad_chains(steps, msg):
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        vm.sender = ALICE
        with vm.expect_revert():
            c.create_market("T", "d", "Technology", json.dumps(steps), DEADLINE, NOW, 70)


def test_create_market_rejects_past_deadline():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        vm.sender = ALICE
        with vm.expect_revert():
            c.create_market("T", "d", "Tech", json.dumps(STEPS), NOW - 10, NOW, 70)


def test_confidence_floor_is_clamped():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        mid = make_market(vm, c, floor=10)   # below MIN 55 → clamped
        assert c.get_market(mid)["confidence_floor"] == 55
        mid2 = make_market(vm, c, floor=99)  # above MAX 95 → clamped
        assert c.get_market(mid2)["confidence_floor"] == 95


# ---------------------------------------------------------------------------
# Staking (payable value path in)
# ---------------------------------------------------------------------------

def test_stake_moves_value_into_pools():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)
        vm.sender = BOB
        vm.value = 2 * GEN
        c.stake_yes(0, NOW)
        vm.sender = CAROL
        vm.value = 1 * GEN
        c.stake_no(0, NOW)
        vm.value = 0

        pool = c.get_pool(0)
        assert pool["yes_pool"] == 2 * GEN
        assert pool["no_pool"] == 1 * GEN
        assert pool["implied_yes_bps"] == 6666  # 2/3

        pos = c.get_position(0, hx(BOB))
        assert pos["yes_amount"] == 2 * GEN and pos["no_amount"] == 0
        assert c.get_user_market_ids(hx(BOB)) == [0]
        assert c.get_platform_stats()["total_volume"] == 3 * GEN


def test_stake_zero_value_reverts():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)
        vm.sender = BOB
        vm.value = 0
        with vm.expect_revert():
            c.stake_yes(0, NOW)


def test_stake_after_deadline_reverts():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)
        vm.sender = BOB
        vm.value = GEN
        with vm.expect_revert():
            c.stake_yes(0, DEADLINE + 1)


def test_stake_from_balance():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)
        vm.sender = BOB
        vm.value = 3 * GEN
        c.deposit()
        vm.value = 0
        c.stake_from_balance(0, "YES", 2 * GEN, NOW)
        assert c.get_balance_of(hx(BOB)) == 1 * GEN
        assert c.get_pool(0)["yes_pool"] == 2 * GEN
        with vm.expect_revert():  # more than remaining balance
            c.stake_from_balance(0, "NO", 2 * GEN, NOW)


# ---------------------------------------------------------------------------
# Deposit / withdraw (value path out)
# ---------------------------------------------------------------------------

def test_deposit_and_withdraw_ledger():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        vm.sender = BOB
        vm.value = 5 * GEN
        c.deposit()
        vm.value = 0
        assert c.get_balance_of(hx(BOB)) == 5 * GEN
        c.withdraw(2 * GEN)
        assert c.get_balance_of(hx(BOB)) == 3 * GEN
        with vm.expect_revert():
            c.withdraw(10 * GEN)


# ---------------------------------------------------------------------------
# Adjudication (mocked web + LLM) & permissions
# ---------------------------------------------------------------------------

def test_pre_deadline_adjudication_is_creator_only():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)  # creator ALICE
        vm.sender = BOB
        with vm.expect_revert():
            c.request_resolution(0, NOW)


def test_full_chain_resolves_yes_and_pays_out():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)  # creator ALICE

        # stakes: BOB 2 GEN YES, CAROL 1 GEN NO
        vm.sender = BOB
        vm.value = 2 * GEN
        c.stake_yes(0, NOW)
        vm.sender = CAROL
        vm.value = 1 * GEN
        c.stake_no(0, NOW)
        vm.value = 0

        # both steps verify with high confidence
        mock_sources(vm)
        vm.mock_llm(r".*", verdict(True, False, 90))
        vm.sender = ALICE  # creator may adjudicate pre-deadline
        m = c.request_resolution(0, NOW + 60)
        assert m["status"] == "RESOLVED_YES"
        assert m["steps_fulfilled"] == 2

        report = c.get_resolution_report(0)
        assert all(s["state"] == "FULFILLED" for s in report["steps"])
        assert all(s["reasoning"] for s in report["steps"])  # transparent reasoning stored

        # BOB claims: 2 GEN back + losing pool (1 GEN) minus 1.5% fees
        vm.sender = BOB
        payout = c.claim(0, NOW + 120)
        expected = 2 * GEN + (GEN - (GEN * 150) // 10000)
        assert payout == expected
        assert c.get_balance_of(hx(BOB)) == expected

        # loser cannot claim; winner cannot double-claim
        vm.sender = CAROL
        with vm.expect_revert():
            c.claim(0, NOW + 120)
        vm.sender = BOB
        with vm.expect_revert():
            c.claim(0, NOW + 120)

        # withdraw the winnings (native transfer out)
        c.withdraw(expected)
        assert c.get_balance_of(hx(BOB)) == 0


def test_failed_step_breaks_chain_to_no():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)
        mock_sources(vm, body="The plan was officially cancelled forever.")
        vm.mock_llm(r".*", verdict(False, False, 95))  # cannot occur anymore
        vm.sender = ALICE
        m = c.request_resolution(0, NOW + 60)
        assert m["status"] == "RESOLVED_NO"
        assert m["steps_failed"] == 1  # stops at the first broken link


def test_inconclusive_evidence_keeps_market_undecided():
    """Low-confidence / ambiguous verdicts must never flip a step — this is
    the anti-Undetermined design: stay PENDING, retry later."""
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)
        mock_sources(vm, body="Homepage with no relevant announcement.")
        vm.mock_llm(r".*", verdict(False, True, 20))
        vm.sender = ALICE
        m = c.request_resolution(0, NOW + 60)
        assert m["status"] == "RESOLVING"
        assert m["steps"][0]["state"] == "PENDING"
        assert m["steps"][0]["check_count"] == 1


def test_malformed_llm_output_degrades_to_pending():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)
        mock_sources(vm)
        vm.mock_llm(r".*", "```json\n{\"occurred\": \"maybe?\", \"confidence\": \"high\"}\n```")
        vm.sender = ALICE
        m = c.request_resolution(0, NOW + 60)
        assert m["status"] == "RESOLVING"
        assert m["steps"][0]["state"] == "PENDING"


def test_post_deadline_adjudication_is_permissionless_and_expires():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)
        vm.sender = BOB
        vm.value = GEN
        c.stake_yes(0, NOW)
        vm.value = 0

        mock_sources(vm, body="Nothing happened.")
        vm.mock_llm(r".*", verdict(False, False, 90))
        # BOB is not the creator, but the deadline has passed → allowed
        m = c.request_resolution(0, DEADLINE + 10)
        assert m["status"] in ("RESOLVED_NO", "EXPIRED")


def test_expire_market_is_deterministic():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)
        vm.sender = BOB
        with vm.expect_revert():          # before deadline → refuse
            c.expire_market(0, NOW + 10)
        c.expire_market(0, DEADLINE + 1)  # after deadline → NO side wins
        assert c.get_market(0)["status"] == "EXPIRED"


# ---------------------------------------------------------------------------
# Cancellation & refunds
# ---------------------------------------------------------------------------

def test_creator_cancel_and_refund():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)
        vm.sender = ALICE
        c.cancel_market(0, NOW + 10)  # no stakes yet → creator may cancel
        assert c.get_market(0)["status"] == "CANCELLED"

        mid = make_market(vm, c)
        vm.sender = BOB
        vm.value = GEN
        c.stake_yes(mid, NOW)
        vm.value = 0
        vm.sender = ALICE
        with vm.expect_revert():  # creator can't cancel once staked
            c.cancel_market(mid, NOW + 10)
        vm.sender = OWNER         # owner can
        c.cancel_market(mid, NOW + 10)
        vm.sender = BOB
        assert c.refund_cancelled(mid, NOW + 20) == GEN
        assert c.get_balance_of(hx(BOB)) == GEN


# ---------------------------------------------------------------------------
# Administration
# ---------------------------------------------------------------------------

def test_owner_controls():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        vm.sender = ALICE
        with vm.expect_revert():
            c.pause()
        vm.sender = OWNER
        c.pause()
        vm.sender = ALICE
        with vm.expect_revert():  # paused blocks market creation
            make_market(vm, c)
        vm.sender = OWNER
        c.unpause()
        with vm.expect_revert():  # combined fee cap 10%
            c.set_fees(900, 200)
        c.set_fees(200, 100)
        assert c.get_config()["protocol_fee_bps"] == 200


def test_protocol_fees_accrue_and_sweep():
    vm = VMContext()
    with vm.activate():
        c = fresh(vm)
        make_market(vm, c)
        vm.sender = BOB
        vm.value = 2 * GEN
        c.stake_yes(0, NOW)
        vm.sender = CAROL
        vm.value = 10 * GEN
        c.stake_no(0, NOW)
        vm.value = 0

        mock_sources(vm)
        vm.mock_llm(r".*", verdict(True, False, 90))
        vm.sender = ALICE
        c.request_resolution(0, NOW + 60)  # YES wins; losing pool = 10 GEN

        stats = c.get_platform_stats()
        assert stats["accrued_protocol_fees"] == (10 * GEN * 100) // 10000  # 1%
        # creator fee credited to ALICE (0.5%)
        assert c.get_balance_of(hx(ALICE)) == (10 * GEN * 50) // 10000

        vm.sender = OWNER
        swept = c.sweep_protocol_fees()
        assert swept == (10 * GEN * 100) // 10000
        assert c.get_balance_of(hx(OWNER)) == swept
