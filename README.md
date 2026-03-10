# DotAgent

**Autonomous AI-Powered DeFi Agent for Polkadot Hub**

DotAgent is an intelligent treasury management agent that autonomously manages DeFi positions on Polkadot Hub EVM. It combines on-chain DeFi protocols with Claude AI reasoning to make data-driven lending, swapping, and portfolio allocation decisions.

## Features

- **AI-Powered Reasoning** — Claude analyzes treasury state and proposes optimal actions with confidence scoring
- **Aave V3 Lending** — Automated supply/withdraw to earn yield on stablecoins and ETH
- **Uniswap V3 Swaps** — Token rebalancing with quote previews and slippage protection
- **On-Chain Credit Scoring** — 5-dimension wallet risk assessment (repayment, collateral, history, diversity, longevity)
- **Natural Language Commands** — Control the agent with plain English: "supply 50 USDT", "swap 100 USDT to WETH"
- **Conditional Rules** — AI-parsed automation: "if APR drops 5%, withdraw all and convert to USDT"
- **Strategy Presets** — Conservative, Balanced, Aggressive, USDT Yield, Tether Diversified
- **Real-Time Dashboard** — Single-page UI with live portfolio tracking, action log, and AI reasoning trail

## Architecture

```
Express Server (API + Dashboard)
    |
    +-- Treasury Agent (autonomous loop)
    |     +-- Aave V3 Module (lending/borrowing)
    |     +-- Uniswap V3 Module (token swaps)
    |     +-- Credit Score Module (risk assessment)
    |     +-- LLM Reasoning (Claude AI decisions)
    |
    +-- EVM Wallet (ethers.js)
    +-- Price Feed (CoinGecko)
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your private key and API keys

# 3. Start the agent
npm run dev

# 4. Open dashboard
# http://localhost:3000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ETH_PRIVATE_KEY` | Yes | Hex private key (0x...) |
| `ETH_RPC_URL` | No | RPC endpoint (default: Sepolia) |
| `ANTHROPIC_API_KEY` | No | Enables AI-powered reasoning |
| `PORT` | No | Server port (default: 3000) |

See [.env.example](.env.example) for full configuration including Aave/Uniswap contract addresses.

## Supported Chains

| Chain | Chain ID | Type |
|-------|----------|------|
| Polkadot Hub | 420420420 | Mainnet |
| Polkadot Hub Testnet | 420420421 | Testnet |
| Passet Hub | 420420422 | Testnet |
| Base Sepolia | 84532 | Testnet |

## API Endpoints

### Portfolio & Status
- `GET /api/status` — Agent status, chain, strategy
- `GET /api/portfolio` — Balances, supplied amounts, prices, APYs
- `GET /api/actions` — Action history log

### DeFi Operations
- `POST /api/supply` — Supply tokens to Aave
- `POST /api/withdraw` — Withdraw from Aave
- `POST /api/swap/quote` — Get swap quote
- `POST /api/swap/execute` — Execute token swap
- `GET /api/credit-score` — On-chain credit score (5-dimension analysis)
- `POST /api/credit-score/assess` — Loan eligibility assessment

### AI & Automation
- `POST /api/command` — Natural language command
- `POST /api/llm/reason` — Ask AI to analyze portfolio
- `POST /api/rules` — Create conditional rule
- `POST /api/strategy` — Set strategy preset

### Agent Control
- `POST /api/start` — Start autonomous loop
- `POST /api/stop` — Stop agent
- `POST /api/pause` — Toggle pause mode
- `POST /api/cycle` — Run single cycle manually

## Tech Stack

- **Runtime**: Node.js 22+
- **Blockchain**: ethers.js v6
- **DeFi**: Aave V3, Uniswap V3
- **AI**: Claude Haiku 4.5 (@anthropic-ai/sdk)
- **Server**: Express.js
- **Frontend**: Vanilla JS, Chart.js

## License

Apache-2.0
