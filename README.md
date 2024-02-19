# Subgrpah + hadrhat local dev

## 1 Setup CORE

1.1 Open dir dex223-core in terminale

```bash
yarn install
```

1.2 Make `.env` file, by `.env.example` on one level </br>
Run command

```bash
yarn run hardhat:node
```

1.3
Open new terminal and run next command

```bash
yarn run hardhat:compile
```

```bash
yarn run hardhat:deploy:local
```

After deployment to the local node, you will see the counter address, you should copy it

```bash
[ '======== State: deploy started ========' ]
[ 'found defaultIdType 0x0212 for chainId 31337' ]
[ 'deploying verifier...' ]
[
  '===== Autolisting =====',
  '- Contract deployed to address 0x5FbDB2315678afecb367f032d93F642f64180aa3 from 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  '- Tranaction = 0x6c281224c8ffa87a0dd4aa5c072687a7e0f2cc65787a371ed45c227f8a928a56',
  '- Block deploy (startBlock) = 1      '
]
```

1.4
Copy output file `testnet.json` and save this is file in `/dex223-subgraphs/subgraphs/auto-listing/config/`

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
