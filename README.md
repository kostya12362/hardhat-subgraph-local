# Subgrpah + hadrhat local dev
# DEX223.io contracts testing + local deployment

## Actual working branch: `new_version_with_dex223`

## 1 Setup CORE

```bash
yarn install
```

1.2 Make `.env` file, by `.env.example` on one level </br>
Run command

```bash
yarn run hardhat:node
```

1.3
Open new terminal and run one of next commands

Compile contracts:
```bash
yarn run hardhat:compile
```

For clean local deployment it's better to remove local subfolders:
- artifacts
- cache
- deployments

Local contracts deployment:
```bash
yarn run hardhat:deploy:dex223:local
```

Contracts test swaps on local deployment:
```bash
yarn run hardhat:setup:dex223:local
```

Test swap with test contracts on local deployment:
```bash
yarn run hardhat:swap:dex223:local
```

Test swap with test contracts on local deployment:
```bash
yarn run hardhat:swap:dex223:local
```

Generate json files to pass contract verification (for ex. TestBNB explorer):
```bash
yarn run hardhat:verify
```

1.4. 
Generate pools in batch and mint liquidity (`sepolia`):
- under deployments folder copy folder localhost and rename it to sepolia
- edit files in this sepolia folder and set their real contracts address (as they deployed on real net)
- runs script 

```bash
yarn run hardhat:pools:dex223:sepolia
```

Command may be called with additional param - setting pools FEE (for example, `3000`)
```bash
yarn run hardhat:pools:dex223:sepolia:3000
```

1.5.
Call local unit tests for contracts without deployment 
```bash
yarn run hardhat:test
```

## 2 Setup docker

2.1 Open dir `/docker`</br>
Create `.env` file (see `.env.example`)</br>

2.2
Run command

```bash
docker-compose up -d --build
```

You created instace

- postgresql
- ipfs
- the-graph-node

## 3 Setup Subgraph auto-listing

3.1 Opend dir `/dex223-subgraph/auto-listing`

```bash
yarn install
```

3.2

```bash
yarn run compile
```

3.3

```bash
yarn run create:local
```

3.4

```bash
yarn run deploy:local
```
