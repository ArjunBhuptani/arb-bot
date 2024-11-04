# Arb-Bot

Arb-Bot is an automated arbitrage bot designed to close invoices on the Everclear protocol. It leverages various APIs and services to monitor asset balances, fetch invoices, and process transactions efficiently.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Features

- Supports multiple blockchain networks including Ethereum, BSC, Arbitrum, and more.
- Monitors asset balances and processes invoices.
- Configurable to work with different network types (mainnet, testnet).
- Logs activities with different log levels for easy debugging.

## Roadmap
This bot is actively under development and is in a somewhat untested state. Here's the status of development:
- [x] Fetch all invoices for a given environment
- [x] Query balances on all chains
- [x] Determine where the bot should fill an invoice, and what the destination of the invoice should be
- [x] Query the Everclear API to generate a fill transaction
- [ ] Submit the transaction to chain
- [ ] Testnet testing
- [ ] Unit test coverage
- [ ] Mainnet testing
- [ ] Automated rebalancing of inventory via other bridges

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/yourusername/arb-bot.git
   cd arb-bot
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

## Configuration

1. **Environment Variables:**

   Create a `.env` file in the root directory and configure the following variables:

   ```plaintext
   PRIVATE_KEY=your_private_key
   API_URL_MAINNET=https://api.everclear.org/
   API_URL_TESTNET=https://api.testnet.everclear.org/
   NETWORK_TYPE=mainnet
   ```

   Update the RPC URLs and other environment variables as needed.

2. **Network Configuration:**

   The bot supports multiple networks. Ensure that the `src/data/addresses.json` file is correctly configured with the necessary asset and protocol addresses.

## Usage

To start the bot, run:

```bash
npm start
````

