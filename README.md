# Stack Vote

An on-chain polling dApp on Stacks, built with [Scaffold Stacks](https://scaffoldstacks.mintlify.app/). Anyone can create a poll with 2–3 options and a lifetime measured in Stacks blocks; any wallet can cast exactly one vote per poll while it's open. All questions, options, and tallies live entirely in the Clarity contract's storage — the frontend just reads and writes to it.

## Live deployment

- **Contract (Stacks testnet):** [`ST1E24HE1KGT851Z6T6Z4JVH2SYXC0BHT34EQ8KVE.polls`](https://explorer.hiro.so/txid/ST1E24HE1KGT851Z6T6Z4JVH2SYXC0BHT34EQ8KVE.polls?chain=testnet)
- **Deploy tx:** [`0x8d335ac8...ced71547`](https://explorer.hiro.so/txid/0x8d335ac87691c4f72ded5cf4a5a8fb859a1be38d4511f796503b9a5eced71547?chain=testnet)

## What it does

- `create-poll(question, option-1, option-2, option-3, duration-blocks)` — anyone can open a poll. The third option is optional (pass an empty string to skip it).
- `vote(poll-id, option)` — casts one vote for `option` (1, 2, or 3). Reverts if the poll is closed, the caller already voted, or the option doesn't exist on that poll.
- `get-poll`, `get-poll-count`, `has-account-voted`, `is-poll-open` — read-only views the frontend polls to render live results.

The frontend lists every poll (newest first), shows a live vote-share bar per option, and lets a connected wallet create a poll or vote. It's read straight from chain — no backend, no database.

## Stack

- **Contract:** Clarity 6 (epoch 4.0), tested with the Clarinet SDK / Vitest
- **Frontend:** Next.js 15, React 18, Tailwind, Jotai, `@stacks/connect` v8
- **Tooling:** [Scaffold Stacks CLI](https://scaffoldstacks.mintlify.app/) (`stacksdapp`) for scaffolding, codegen, and deploys

## Running locally

```bash
# prerequisites: Rust, Node 20+, Clarinet 3.23+
cargo install stacksdapp
git clone <this repo>
cd stack-vote

# contract
stacksdapp check && stacksdapp test

# point the frontend at the already-deployed testnet contract
cd frontend && cp .env.local.example .env.local   # set NEXT_PUBLIC_NETWORK=testnet
npm install && npm run dev
```

To deploy your own copy of the contract: put a **testnet-only** deployer mnemonic in `contracts/settings/Testnet.toml` (never commit a real one — the repo's pre-commit hook blocks it), fund it from the [Hiro testnet faucet](https://explorer.hiro.so/sandbox/faucet?chain=testnet), then run:

```bash
stacksdapp deploy --network testnet --yes
stacksdapp dev --network testnet
```

## Notes / feedback on Scaffold Stacks

- The generated `stacksdapp add` + `stacksdapp generate` loop (contract → typed hooks → debug UI) is genuinely fast — going from a blank `polls.clar` to working typed React hooks (`usePolls_Vote`, `usePolls_GetPoll`, …) took minutes, not an afternoon of hand-writing ABI glue.
- Read-only hook `data` comes back as raw `cvToJSON`-shaped objects (`{ type, value }`), not plain JS values — the docs call this out, but it's easy to trip over the first time and worth a bigger callout or a built-in unwrap helper shipped in `generated/`.
- Deploying straight to testnet (no Docker/devnet required) made it possible to build and verify this entirely from a sandboxed CI-style environment with no local blockchain — that path deserves to be the default in the quickstart, not the "alternative."
