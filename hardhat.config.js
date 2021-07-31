'use strict'
require('dotenv').config()

require('@nomiclabs/hardhat-ethers')
require('@nomiclabs/hardhat-waffle')
require('@nomiclabs/hardhat-etherscan')
require('hardhat-contract-sizer')
require('solidity-coverage')
require('hardhat-deploy')

const gasPrice = 35000000000

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: {
        url: process.env.NODE_URL,
        blockNumber: process.env.BLOCK_NUMBER
          ? parseInt(process.env.BLOCK_NUMBER)
          : undefined
      }
    },
    localhost: {
      saveDeployments: true
    },
    coverage: {
      url: 'http://127.0.0.1:8555' // Coverage launches its own ganache-cli client
    },
    mainnet: {
      url: process.env.NODE_URL,
      chainId: 1,
      gasPrice,
      accounts: [process.env.PRIVATE_KEY]
    }
  },
  paths: {
    deployments: 'deployments'
  },
  namedAccounts: {
    deployer: process.env.DEPLOYER || 0
  },
  solidity: {
    version: '0.8.3',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false
  },
  mocha: {
    timeout: 200000
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN || 0
  }
}
