import { task } from "hardhat/config";
import { withSaveAndVerify } from "../../helpers/contracts-helpers";
import { eContractid } from "../../helpers/types";
import { getDeploySigner } from "../../helpers/contracts-getters";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BridgeIntegrationFactory, CustomRouterETHFactory, MintableERC721Factory } from "../../types";
import { IDebtTokenFactory } from "../../types/IDebtTokenFactory";
import { IStargateRouterFactory } from "../../types/IStargateRouterFactory";
import { getDb } from "../../helpers/misc-utils";
import { waitForTx } from "../../helpers/misc-utils";
import { L1ToL2MessageGasEstimator } from "@arbitrum/sdk";
import { parseUnits } from "ethers/lib/utils";

// const BAYCAddr = (await getDb(DRE.network.name).get(`BAYC`).value()).address;
const BAYCAddr = "0x588D1a07ccdb224cB28dCd8E3dD46E16B3a72b5e";

task("deploy:bridge-integration", "Deploy bridge integration contract and initialize configuration")
  .addFlag("verify", "Verify contracts at Etherscan")
  // .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
    try {
      await DRE.run("set-DRE");
      // const network = <eNetwork>DRE.network.name;
      // const wethGatewayAddr = await getContractAddressInDb(eContractid.WETHGateway);
      const bridgeIntegration = await new BridgeIntegrationFactory(await getDeploySigner()).deploy(
        "0xE55870eBB007a50B0dfAbAdB1a21e4bFcee5299b",
        "0xc778417e063141139fce010982780140aa0cd5ab",
        "0x578bade599406a8fe3d24fd7f7211c0911f5b29e"
      );

      await waitForTx(await bridgeIntegration.authorizeLendPoolNFT([BAYCAddr]));

      console.log("finished initilization");
      return withSaveAndVerify(bridgeIntegration, eContractid.BridgeIntegration, [], true);
    } catch (error) {
      throw error;
    }
  });

task("test:borrow", "borrow and teleport eth").setAction(async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
  try {
    await DRE.run("set-DRE");
    const ethers = DRE.ethers;

    const deployer = await getDeploySigner();
    const deployerAddr = await deployer.getAddress();
    const tokenId = 8912;
    const bridgeIntegrationAddr = (await getDb(DRE.network.name).get(`${eContractid.BridgeIntegration}`).value())
      .address;

    console.log("bridge-integration-address", bridgeIntegrationAddr);

    // delegate bendDebtToken
    console.log("address", await deployer.getAddress());
    // mint mock nft
    const nftAsset = MintableERC721Factory.connect(BAYCAddr, deployer);
    try {
      await waitForTx(await nftAsset.mint(tokenId));
      console.log(`minted ${tokenId}`);
    } catch (e) {
      console.log("already minted");
    }

    // approve nft to bridge integration contract
    await waitForTx(await nftAsset.setApprovalForAll(bridgeIntegrationAddr, true));
    console.log("approved ");

    //delegate DebtToken approveDelegation
    // const debtTokenAddr = (await getDb(DRE.network.name).get(eContractid.DebtToken).value()).address;
    const debtToken = IDebtTokenFactory.connect("0x054fc05030a65bb30671f28ea5d668f56e4970d7", deployer);
    await waitForTx(
      await debtToken.approveDelegation(bridgeIntegrationAddr, "1230000000000000000000000000000000000000000000")
    );

    // const borrowableAmount = await debtToken.borrowAllowance(signer.address, bridgeIntegrationAddr);
    // console.log("delgated", ethers.utils.formatEther(borrowableAmount));

    const bridgeIntegration = BridgeIntegrationFactory.connect(bridgeIntegrationAddr, await getDeploySigner());

    // estimate teleport gas fee
    const l1Provider = new ethers.providers.JsonRpcProvider(
      "https://eth-rinkeby.alchemyapi.io/v2/DC-BKbXSsTzf9kRlRdvb4O45sVC1Z_fO"
    );
    const l2Provider = new ethers.providers.JsonRpcProvider(
      "https://arb-rinkeby.g.alchemy.com/v2/LWtrVTJEDl_EMv8nDVt8eRgskbsbDvKk"
    );
    console.log("cool");
    const gasEstimator = new L1ToL2MessageGasEstimator(l2Provider);
    const l1GasPrice = await deployer.getGasPrice();
    console.log("l1gas price:", l1GasPrice.toString());
    // const submissionPrice = await gasEstimator.estimateSubmissionFee(l1Provider, l1GasPrice, 0);
    const submissionPrice = ethers.BigNumber.from(1400).mul(l1GasPrice);
    console.log(submissionPrice.toString());
    console.log("bridge integration", bridgeIntegration.address, await deployer.getAddress());
    const amount = parseUnits("12300000000000000", "wei");
    const gasPriceBid = parseUnits("32725620", "wei");
    const maxGas = parseUnits("1000000", "wei");

    console.log(
      amount.toString(),
      gasPriceBid.toString(),
      maxGas.toString(),
      submissionPrice.toString(),
      amount.sub(submissionPrice.toString()).sub(gasPriceBid.mul(maxGas)).toString()
    );

    await waitForTx(
      await bridgeIntegration.borrowAndTeleportETH(
        amount.toString(),
        BAYCAddr,
        tokenId.toString(),
        deployerAddr,
        0,
        {
          target: "0x36D3041F5b5E92FFd17828d14D0b900f50f62F57",
          arbCallValue: amount.sub(submissionPrice.toString()).sub(gasPriceBid.mul(maxGas)).toString(),
          maxSubmissionCost: submissionPrice.toString(),
          gasPriceBid: gasPriceBid.toString(),
          maxGas: maxGas.toString(),
        },
        {
          gasLimit: 1509621,
        }
      )
    );
    console.log("borrowed");
  } catch (error) {
    throw error;
  }
});

task("test:gas", "estimate gas fee").setAction(async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
  try {
    await DRE.run("set-DRE");
    const ethers = DRE.ethers;

    const l2Provider = new ethers.providers.JsonRpcProvider(
      "https://arb-rinkeby.g.alchemy.com/v2/LWtrVTJEDl_EMv8nDVt8eRgskbsbDvKk"
    );
    // const signer = await getDeploySigner();
    // const balance = await l2Provider.getBalance(await signer.getAddress());
    // console.log(`${await signer.getAddress()}'s balance:`, balance.toString());
    // const gasPrice = await l2Provider.getGasPrice();
    // console.log("l2 gas price:", gasPrice.toString());
    // const gasEstimator = new L1ToL2MessageGasEstimator(l2Provider);
    // const result = await gasEstimator.estimateSubmissionPrice(0);
    // console.log("submission fee:", result.submissionPrice.toString());
  } catch (error) {
    throw error;
  }
});

task("test:sgRouterETH", "test bridging eth from test arb to rinkeby").setAction(
  async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
    try {
      await DRE.run("set-DRE");
      const ethers = DRE.ethers;
      const signer = await getDeploySigner();
      const signerAddr = await signer.getAddress();
      console.log("signer address: ", signerAddr);

      // const router = IStargateRouterFactory.connect("0x6701D9802aDF674E524053bd44AA83ef253efc41", signer);
      // let quoteData = await router.quoteLayerZeroFee(
      //   10001, // destination chainId
      //   3, // function type: see Bridge.sol for all types
      //   signerAddr, // destination of tokens
      //   "0x", // payload, using abi.encode()
      //   {
      //     dstGasForCall: 0, // extra gas, if calling smart contract,
      //     dstNativeAmount: 0, // amount of dust dropped in destination wallet
      //     dstNativeAddr: signerAddr, // destination wallet for dust
      //   }
      // );
      // console.log(ethers.utils.formatEther(quoteData[0]));

      // await waitForTx(
      //   await routerETH.swapETH(
      //     10001,
      //     signerAddr,
      //     signerAddr,
      //     ethers.utils.parseEther("0.01"),
      //     ethers.utils.parseEther("0.0095"),
      //     { value: ethers.utils.parseEther("0.02") }
      //   )
      // );

      // rinkeby 10001
      // arb 10010
      // const tx = await routerETH.swapETH(
      //   10001, //
      //   signerAddr,
      //   signerAddr,
      //   ethers.utils.parseEther("0.01"),
      //   ethers.utils.parseEther("0.0095"),
      //   {
      //     value: ethers.utils.parseEther("0.2"),
      //     gasLimit: 1000000,
      //   }
      // );

      // await waitForTx(tx);
    } catch (error) {
      throw error;
    }
  }
);

task("deploy:custom-router-eth", "deploy a custom router on abitrum").setAction(
  async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
    try {
      await DRE.run("set-DRE");
      const signer = await getDeploySigner();
      const signerAddr = await signer.getAddress();
      console.log("signer address: ", signerAddr);

      const customRouter = await new CustomRouterETHFactory(signer).deploy(
        "0x1450e45e7345c4f6967b2A7DD91d9b0D3f65ff83",
        "0x6701D9802aDF674E524053bd44AA83ef253efc41",
        "13",
        "0xEBbc3452Cc911591e4F18f3b36727Df45d6bd1f9"
      );
      return withSaveAndVerify(
        customRouter,
        "CustomRouterETH",
        [
          "0x1450e45e7345c4f6967b2A7DD91d9b0D3f65ff83",
          "0x6701D9802aDF674E524053bd44AA83ef253efc41",
          "13",
          "0xEBbc3452Cc911591e4F18f3b36727Df45d6bd1f9",
        ],
        true
      );
    } catch (error) {
      throw error;
    }
  }
);

task("test:repay", "teleport eth and repay loan").setAction(async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
  try {
    await DRE.run("set-DRE");
    const ethers = DRE.ethers;
    const signer = await getDeploySigner();
    const signerAddr = await signer.getAddress();
    console.log("signer address: ", signerAddr);

    const router = IStargateRouterFactory.connect("0x6701D9802aDF674E524053bd44AA83ef253efc41", signer);
    // let quoteData = await router.quoteLayerZeroFee(
    //   10001, // destination chainId
    //   3, // function type: see Bridge.sol for all types
    //   signerAddr, // destination of tokens
    //   "0x", // payload, using abi.encode()
    //   {
    //     dstGasForCall: 0, // extra gas, if calling smart contract,
    //     dstNativeAmount: 0, // amount of dust dropped in destination wallet
    //     dstNativeAddr: signerAddr, // destination wallet for dust
    //   }
    // );
    // console.log(ethers.utils.formatEther(quoteData[0]));

    // const target = "0x8FcbD3EE1D98Df911760759911B114C77DdD1A10";
    // const customRouterETH = CustomRouterETHFactory.connect("0xD7dce94173ec788B129621c7AD6649F5Fa431B9C", signer);

    // rinkeby 10001
    // arb 10010
    // const tx = await customRouterETH.swapETH(
    //   10001, //
    //   signerAddr,
    //   target,
    //   ethers.utils.parseEther("0.02"),
    //   ethers.utils.parseEther("0.0195"),
    //   {
    //     asset: BAYCAddr,
    //     tokenID: "8912",
    //     owner: signerAddr,
    //   },
    //   {
    //     value: ethers.utils.parseEther("0.2"),
    //     gasLimit: 1000000,
    //   }
    // );

    // await waitForTx(tx);
  } catch (error) {
    throw error;
  }
});

task("test:lzgas", "estimate cross chain message fee").setAction(async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
  try {
    await DRE.run("set-DRE");
    const ethers = DRE.ethers;

    const signer = await getDeploySigner();
    const signerAddr = await signer.getAddress();

    const router = IStargateRouterFactory.connect("0x8731d54E9D02c286767d56ac03e8037C07e01e98", signer);
    let quoteData = await router.quoteLayerZeroFee(
      6, // destination chainId
      1, // function type: see Bridge.sol for all types
      signerAddr, // destination of tokens
      "0x", // payload, using abi.encode()
      {
        dstGasForCall: 0, // extra gas, if calling smart contract,
        dstNativeAmount: "5899541049729600", // amount of dust dropped in destination wallet
        dstNativeAddr: signerAddr, // destination wallet for dust
      }
    );
    console.log(ethers.utils.formatEther(quoteData[0]));
  } catch (error) {
    throw error;
  }
});
