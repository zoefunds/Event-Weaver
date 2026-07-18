#!/bin/bash
set -e
cd "$(dirname "$0")/.."
mkdir -p public/audio/vo
VOICE="Samantha"
RATE=150

gen() {
  local name="$1"
  local text="$2"
  say -v "$VOICE" -r "$RATE" -o "public/audio/vo/${name}.aiff" "$text"
  afconvert -f WAVE -d LEI16@44100 -c 1 "public/audio/vo/${name}.aiff" "public/audio/vo/${name}.wav"
  rm "public/audio/vo/${name}.aiff"
}

gen "01_hook" "Apple ships the Vision Pro. Then the iPhone 16. Then, maybe, a foldable phone. Three claims, in order. In most prediction markets, you can only bet on one of them at a time. In the real world, they're connected. One breaks, and everything downstream breaks with it."

gen "02_problem" "So who decides if that chain actually happened? In almost every prediction market today, the answer is: whoever operates the platform. A single company, a single server, a single admin key. That party sees the same evidence you do, but they also hold every dollar staked on the outcome. That's not a resolution mechanism. That's a conflict of interest wearing a resolution mechanism's clothes."

gen "03_reveal" "This is EventWeaver, causal-chain prediction markets, resolved by decentralized consensus, not by whoever runs the site."

gen "04_overview" "Here's the idea. A market on EventWeaver isn't one bet, it's an ordered chain of two to twelve real-world conditions. Think: if the Fed cuts rates in September, then housing starts rise, then a specific homebuilder beats earnings. The market only resolves YES if every step happens, in order. Break one link, and the chain resolves NO. That's a much more honest way to price a chain reaction than forcing it into a single yes-or-no question."

gen "05_landing" "This is the live app today, not a mockup, not a prototype screenshot. Real markets, real staking, running on GenLayer's public testnet."

gen "06_discovery" "Every market you see here is browsable before you commit anything. Filter by status, open, resolving, resolved, or by category. Each card shows the live odds and the pool size, so you know exactly what you'd be entering before you connect a wallet."

gen "07_market_detail" "Let's open one. This market asks whether Apple's spatial computing bets would cascade: Vision Pro ships, then the iPhone 16 ships, then, the unresolved question, a foldable iPhone gets announced. Scroll down, and you see the actual causal chain, step by step. Step one: Vision Pro released, fulfilled, 100 percent confidence. Step two: iPhone 16 released, also fulfilled. This isn't placeholder text. This is the real reasoning a GenLayer validator wrote, citing Wikipedia and Apple's own site as evidence, after independently reading those pages for itself."

gen "08_create" "Anyone can define a chain like this. In the Visual Logic Builder, you write each condition in plain language, and attach up to five public evidence sources per step, a news page, a regulatory filing, an official press release. You set a confidence floor: how strong the evidence has to be before a validator is allowed to flip a step. Lower means it resolves on weaker evidence; higher means it demands near-certainty. That's a dial you control, market by market."

gen "09_stake" "Once a chain is live, staking is open to everyone, on both sides, right up until the deadline. It's not a deposit into EventWeaver's balance sheet, it's a payable call straight from your wallet to the contract. EventWeaver's backend never touches your funds at any point in this path."

gen "10_mechanism_setup" "So how does a chain actually get verified? This is the part that has to be trustless, because it's the part that decides who gets paid. Before the deadline, the market's creator can trigger step checks progressively. After the deadline, anyone can trigger resolution, and it becomes fully automatic, driven by an always-on backend resolver whose only job is to wake the contract up. The resolver doesn't decide anything. It just knocks on the door."

gen "11_mechanism_core" "Here's who actually answers. Multiple GenLayer validators each independently render the declared evidence page, inside the contract's own execution environment, GenVM, not through some A P I EventWeaver controls. Each validator reads the page, reasons over it with an L L M, and produces a verdict: did this occur, can it still occur, and how confident am I. Then comes the part that makes consensus possible at all: validators aren't required to match each other's wording. They're required to agree on the outcome itself, the same occurred and can-still-occur booleans, and a confidence score within twenty-five points of each other. Verified live on GenLayer's testnet: one round, majority agree, zero leader rotations, zero inconclusive results."

gen "12_transparency" "And every step of that reasoning, not just the final verdict, gets written on-chain. Anyone can read exactly why a validator called a step fulfilled or failed, and check the same evidence sources for themselves. That's the difference between trust us, and verify it yourself."

gen "13_settlement" "When a chain resolves YES, winners split the losing pool, pro-rata to their stake, after a one percent protocol fee and a half-percent creator fee. Claiming credits your balance inside the contract. Withdrawing is a separate, explicit step that sends an actual native token transfer back to your wallet. Both of those, claim and withdraw, have been run end-to-end on GenLayer's public testnet."

gen "14_recap" "Where this stands today: live on GenLayer's StudioNet, not mainnet, this is testnet value, not production money, and we want to be upfront about that. Twenty-four direct unit tests passing, contract lint clean, continuous integration on every push, and the full lifecycle, create, stake, adjudicate against real U R Ls, claim, withdraw, verified live, end to end. The architecture doesn't change to reach mainnet. Only the network underneath it does."

gen "15_closing" "A chain of events deserves a chain of proof, decided by consensus, written where anyone can check it, not asserted by whoever happens to run the server. This is EventWeaver."

echo "Done. Durations:"
for f in public/audio/vo/*.wav; do
  echo "$f: $(afinfo "$f" | grep 'estimated duration' )"
done
