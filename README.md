
## Getting Started


## Setup

Follow the next steps to setup the repository:

- Install `node` and `yarn`
- Create an enviroment file named `.env` and fill the next enviroment variables
- Install dependencies
```
# Mnemonic, only first address will be used
MNEMONIC=""

# Add Alchemy or Infura provider keys, alchemy takes preference at the config level
ALCHEMY_KEY=""
INFURA_KEY=""

# Optional Etherscan key, for automatize the verification of the contracts at Etherscan
ETHERSCAN_KEY=""

```


## Test

You can run the full test suite with the following commands:

```
npm run test
```

## Deployments

For deploying contracts, you can use the available scripts located at `package.json`. For a complete list, run `npm run` to see all the tasks.


### Rinkeby full deployment
```
# In one terminal
npm run hardhat:rinkeby deploy:bridge-integration
```

### ArbRinkeby full deployment
```
# In one terminal
npm run hardhat:arbRinkeby deploy:custom-router-eth
```


## Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.template file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network ropsten scripts/deploy.js
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```
