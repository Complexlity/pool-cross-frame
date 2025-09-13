# PoolXArb - PoolTogether Cross-Chain Deposit Frame

A Farcaster Frame that enables users to deposit into PoolTogether's prize vaults using cross-chain tokens on the Arbitrum network. Built with Glide for seamless cross-chain transactions.

## Features

- Deposit into PoolTogether prize vaults directly from Farcaster
- Cross-chain token support via Glide
- Non-custodial and secure transactions
- Mobile-friendly interface
- Supports multiple networks (Arbitrum, Optimism, Base)

## Prerequisites

- Node.js 18+ or Bun
- A Glide project ID (get one at [buildwithglide.com](https://buildwithglide.com/))
- (Optional) Airstack API key for enhanced features

## Getting Started

### 1. Install Dependencies

Using Bun (recommended):
```bash
bun install
```

### 2. Environment Setup

Copy the example environment file and update it with your credentials:

```bash
cp .env.sample .env
```

Edit the `.env` file with your Glide project ID:
```env
GLIDE_PROJECT_ID=your_glide_project_id
# Optional: For enhanced features
# AIRSTACK_API_KEY=your_airstack_api_key
# NEYNAR_API_KEY=your_neynar_api_key
```

### 3. Development

Start the development server:

```bash
bun dev
```

The development server will start and be available at `http://localhost:5173`

### 4. Production Build

To create a production build:

```bash
bun run build
```

### 5. Deploy to Vercel

Deploy your frame to Vercel with a single command:

```bash
bun run deploy
```

## How It Works

1. Users connect their wallet through the Farcaster frame
2. Select a PoolTogether vault to deposit into
3. Choose a payment method (supports multiple chains)
4. Enter the deposit amount
5. Review and confirm the transaction
6. The funds are bridged to the target chain and deposited into the selected vault

## Supported Networks

- Arbitrum
- Optimism
- Base

## Tech Stack

- [Frog](https://frog.fm/) - Farcaster Frame framework
- [Glide](https://buildwithglide.com/) - Cross-chain transactions
- [Viem](https://viem.sh/) - Ethereum interface
- [PoolTogether](https://pooltogether.com/) - Prize savings protocol

## License

MIT