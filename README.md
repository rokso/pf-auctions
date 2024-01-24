# Pure Finance Auctions
Auction contracts for Pure Finance...

Stack:
- [Hardhat](https://hardhat.org/)
- [Ethers.js](https://docs.ethers.io/v6/)

## How to use this repository

```
$ npm install
```

### Build Contracts
```
$ npm run build
```

### Testing
```
$ npm run test
```

### Coverage Report
```
$ npm run coverage
```

### Deploy
Setup the env vars properly (See `.env.template` file) and run:

```sh
# deploy
$ npm run deploy -- --gasprice <gas price in wei> --network <network>

# create release
$ npx hardhat create-release --release <semver> --network <network>

# verify
$ npm run verify -- --network <network>
```

