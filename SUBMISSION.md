# EventWeaver — Submission Notes

## Links

| | |
| --- | --- |
| Live app | https://eventweaver-orpin.vercel.app |
| Backend API (health check) | https://eventweaver-api-v2.fly.dev/health |
| Full source code | https://github.com/zoefunds/Event-Weaver |
| Intelligent Contract address (GenLayer StudioNet) | `0xEA4a86A6b477a5552F7B149a646f25c756653657` |
| Base Sepolia USDC escrow | [0xd84ec8bf005f7159F91118Cae80868D1F1Fd3f18](https://sepolia.basescan.org/address/0xd84ec8bf005f7159F91118Cae80868D1F1Fd3f18) |
| Base Sepolia test USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## What it does, in plain terms

Normal prediction markets ask one question: "will X happen?" EventWeaver markets ask a
chain of questions where each one only matters if the one before it came true. For example:
"Apple cuts the Vision Pro price, AND THEN Meta cuts the Quest price within 30 days of that."
The market only pays out YES if both things happen, in that order, before the deadline. If
either link breaks, or the event-occurrence deadline and its seven-day evidence-verification
window pass without a complete chain, it pays out NO.

Anyone can create one of these chains, anyone can stake real tokens on YES or NO, and the
backend automatically requests checks as the event-occurrence deadline arrives — no one has
to press a button. Evidence published later can still prove an event occurred on time during
the seven-day verification window.
Winners split what the losing side staked, minus a small fee, and claim USDC directly from
the Base Sepolia escrow to their wallet.

## The problem it solves

The hard part of a market like this was never "can an AI read a news article and tell me if
something happened" — that part is easy and any chatbot can do it today. The hard part is:
**who do you trust to read that article honestly when they're the one deciding who gets the
money?** A single company running a market like this could just lie about the outcome and
keep everyone's stake. That's the actual problem.

GenLayer solves it by making the check itself decentralized. Instead of one server deciding
the outcome, a group of independent validators each fetch the same evidence pages themselves
and each reason over them independently. They only accept a result once enough of them agree
on what actually happened. No single party — not me, not the platform, not a validator
acting alone — can fake a resolution, because the others would catch the mismatch. That's
why this had to be built on GenLayer specifically, and why it wouldn't work as a normal AI
app calling an API: an AI app has one owner deciding the answer; this has none.

## What's real vs. what's synthetic

- The evidence is real. Every market step points at an actual public URL (Apple's newsroom,
  Wikipedia, CoinGecko, the Federal Reserve's site, Reuters), and the contract fetches that
  exact page live, at resolution time, from inside the validator sandbox
  (`gl.nondet.web.render`). Nothing is hardcoded or faked.
- The tokens are real. Staking deposits Base Sepolia test USDC into the deployed escrow,
  then records the same amount on GenLayer. After resolution, the escrow sends a claimed
  USDC allocation directly to the winner's wallet.
- Historical live evidence includes YES and NO Bitcoin chronology markets from the preceding
  matched deployment. Validators established that the Bitcoin genesis block occurred before
  the first halving in the YES market, storing both occurrence timestamps; a deliberately
  false-date market resolved NO. The active immutable deployment is separately verified by
  matching service configuration, escrow bindings, deployment receipts, and schema. The full
  record is in
  [REMEDIATION_ACCEPTANCE.md](REMEDIATION_ACCEPTANCE.md).

## How to use it

1. Go to the live app and connect a MetaMask wallet (a first-time walkthrough explains the
   whole flow — you can also reopen it any time from the footer's "Take the tour" link).
2. Open **Discovery** to browse markets, or **Create** to build your own chain: write each
   condition in plain English, attach 1–5 public URLs as evidence, set a deadline.
3. On any open market, stake Base Sepolia USDC on YES or NO from the trading panel.
4. At the event-occurrence deadline, the platform's backend automatically asks the contract
   to adjudicate — you don't have to do anything. Evidence can still be verified for seven
   days if it proves an on-time occurrence. (Before the deadline, only the market's creator
   can trigger an early check, so odds aren't disturbed by strangers.)
5. If your side won, go to **Portfolio** and hit Claim. The Base Sepolia escrow transfers
   USDC directly to your wallet after the transaction confirms.

## Why this isn't a boilerplate prediction market

Standard prediction-market templates resolve one binary question with one oracle call. This
contract resolves an *ordered sequence* of conditions where later steps are only checked
once earlier ones are proven, tracks partial progress per step with its own evidence trail
and reasoning, and only exposes an outcome once the whole causal chain is settled. That
sequencing, the per-step state machine, and the automatic deadline-triggered resolution are
the actual product — not a themed skin on a yes/no template.

## Path forward

- **Testnet/mainnet**: move from StudioNet to a funded GenLayer testnet (Bradbury/Asimov),
  then mainnet, once the team is ready to put real economic weight behind resolutions.
- **More evidence source types**: beyond web pages, add structured data feeds (on-chain price
  oracles, sports APIs) as additional evidence formats validators can fetch.
- **Community-created chains**: the Create flow already lets anyone build a market; the
  next step is category curation and a reputation system for chain creators.
- **Governance over fees/floors**: let token holders vote on protocol fee rates and default
  confidence floors instead of a single owner key.

## Engineering evidence (so the claims above can be checked, not just read)

- Contract passes all three `genvm-lint` checks and its complete schema loads on-chain — the
  two most common failure points for GenLayer contracts.
- 45 direct unit tests (`pytest tests/direct/`) cover market creation validation,
  USDC-denominated staking, fee/settlement math, every adjudication outcome (full pass,
  chain break, inconclusive evidence, malformed LLM output), permission rules, and admin
  controls. Eleven Solidity custody tests, two backend-relay tests, and three authority-boundary
  tests cover the cross-chain financial paths.
- The preceding deployment exercised every V1 write path with real transaction hashes. The
  current immutable pair has matching deployment, schema, escrow-binding, frontend, backend,
  and authority verification; its full adverse-path coverage is reproducible in the committed
  test suites.
- GitHub Actions CI runs the contract lint, the test suite, and both app builds on every
  push.
