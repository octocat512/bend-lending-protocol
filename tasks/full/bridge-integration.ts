import { task } from "hardhat/config";
import { getContractAddressInDb, withSaveAndVerify } from "../../helpers/contracts-helpers";
import { eContractid, eNetwork } from "../../helpers/types";
import { getDeploySigner } from "../../helpers/contracts-getters";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  BridgeIntegration,
  BridgeIntegrationFactory,
  DebtTokenFactory,
  ERC721Factory,
  MintableERC721Factory,
} from "../../types";
import { DRE, getDb, notFalsyOrZeroAddress, omit } from "../../helpers/misc-utils";
import { waitForTx } from "../../helpers/misc-utils";
import { L1ToL2MessageGasEstimator } from "@arbitrum/sdk-classic";
import { parseUnits } from "ethers/lib/utils";

task("full:deploy-bridge-integration", "Deploy bridge integration contract for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  // .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
    try {
      await DRE.run("set-DRE");
      // const network = <eNetwork>DRE.network.name;
      // const wethGatewayAddr = await getContractAddressInDb(eContractid.WETHGateway);
      const bridgeIntegration = await new BridgeIntegrationFactory(await getDeploySigner()).deploy();
      // await insertContractAddressInDb(eContractid.BridgeIntegration, bridgeIntegration.address);
      return withSaveAndVerify(bridgeIntegration, eContractid.BridgeIntegration, [], true);
    } catch (error) {
      throw error;
    }
  });

task("full:verify-debt-token", "verify the debt token")
  .addFlag("verify", "Verify contracts at Etherscan")
  // .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
    try {
      await DRE.run("set-DRE");
      // const network = <eNetwork>DRE.network.name;
      // const wethGatewayAddr = await getContractAddressInDb(eContractid.WETHGateway);
      const debtToken = DebtTokenFactory.connect("0x054FC05030A65bb30671f28Ea5d668f56e4970D7", await getDeploySigner());

      return withSaveAndVerify(debtToken, eContractid.DebtToken, [], true);
    } catch (error) {
      throw error;
    }
  });

task("test:initialize", "borrow and teleport eth").setAction(async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
  try {
    await DRE.run("set-DRE");

    const bridgeIntegrationAddr = (await getDb(DRE.network.name).get(`${eContractid.BridgeIntegration}`).value())
      .address;

    const bridgeIntegration = BridgeIntegrationFactory.connect(bridgeIntegrationAddr, await getDeploySigner());
    await waitForTx(
      await bridgeIntegration.initialize(
        "0xE55870eBB007a50B0dfAbAdB1a21e4bFcee5299b",
        "0xc778417e063141139fce010982780140aa0cd5ab",
        "0x578bade599406a8fe3d24fd7f7211c0911f5b29e"
      )
    );

    // const BAYCAddr = (await getDb(DRE.network.name).get(`BAYC`).value()).address;
    const BAYCAddr = "0x588D1a07ccdb224cB28dCd8E3dD46E16B3a72b5e";
    await waitForTx(await bridgeIntegration.authorizeLendPoolNFT([BAYCAddr]));

    console.log("finished initilization");
  } catch (error) {
    throw error;
  }
});

task("test:borrow", "borrow and teleport eth").setAction(async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
  try {
    await DRE.run("set-DRE");
    const ethers = DRE.ethers;

    const signer = (await ethers.getSigners())[0];
    const bridgeIntegrationAddr = (await getDb(DRE.network.name).get(`${eContractid.BridgeIntegration}`).value())
      .address;

    // const BAYCAddr = (await getDb(DRE.network.name).get(`BAYC`).value()).address;
    const BAYCAddr = "0x588D1a07ccdb224cB28dCd8E3dD46E16B3a72b5e";

    console.log("bridge-integration-address", bridgeIntegrationAddr);

    // delegate bendDebtToken
    console.log("address", await (await getDeploySigner()).getAddress());
    // mint mock nft
    const nftAsset = MintableERC721Factory.connect(BAYCAddr, await getDeploySigner());
    try {
      await waitForTx(await nftAsset.mint(8910));
      console.log("minted 8910");
    } catch (e) {
      console.log("already minted");
    }

    // approve nft to bridge integration contract
    await waitForTx(await nftAsset.setApprovalForAll(bridgeIntegrationAddr, true));
    console.log("approved ");

    //delegate DebtToken approveDelegation
    // const debtTokenAddr = (await getDb(DRE.network.name).get(eContractid.DebtToken).value()).address;
    const debtToken = DebtTokenFactory.connect("0x054fc05030a65bb30671f28ea5d668f56e4970d7", await getDeploySigner());
    await waitForTx(
      await debtToken.approveDelegation(bridgeIntegrationAddr, "1230000000000000000000000000000000000000000000")
    );

    // const borrowableAmount = await debtToken.borrowAllowance(signer.address, bridgeIntegrationAddr);
    // console.log("delgated", ethers.utils.formatEther(borrowableAmount));

    const bridgeIntegration = BridgeIntegrationFactory.connect(bridgeIntegrationAddr, await getDeploySigner());

    // estimate teleport gas fee
    const l2Provider = new ethers.providers.JsonRpcProvider(
      "https://arb-rinkeby.g.alchemy.com/v2/LWtrVTJEDl_EMv8nDVt8eRgskbsbDvKk"
    );

    const gasEstimator = new L1ToL2MessageGasEstimator(l2Provider);
    const result = await gasEstimator.estimateSubmissionPrice(0);

    console.log("bridge integration", bridgeIntegration.address, signer.address);
    const amount = parseUnits("12300000000000000", "wei");
    const gasPriceBid = parseUnits("32725620", "wei");
    const maxGas = parseUnits("1000000", "wei");

    console.log(
      amount.toString(),
      gasPriceBid.toString(),
      maxGas.toString(),
      result.submissionPrice.toString(),
      amount.sub(result.submissionPrice.toString()).sub(gasPriceBid.mul(maxGas)).toString()
    );

    await waitForTx(
      await bridgeIntegration.borrowAndTeleportETH(
        amount.toString(),
        BAYCAddr,
        "8910",
        signer.address,
        0,
        {
          target: "0x36D3041F5b5E92FFd17828d14D0b900f50f62F57",
          arbCallValue: amount.sub(result.submissionPrice.toString()).sub(gasPriceBid.mul(maxGas)).toString(),
          maxSubmissionCost: result.submissionPrice.toString(),
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
    const signer = await getDeploySigner();
    const balance = await l2Provider.getBalance(await signer.getAddress());
    console.log(`${await signer.getAddress()}'s balance:`, balance.toString());
    const gasPrice = await l2Provider.getGasPrice();
    console.log("l2 gas price:", gasPrice.toString());
    const gasEstimator = new L1ToL2MessageGasEstimator(l2Provider);
    const result = await gasEstimator.estimateSubmissionPrice(0);
    console.log("submission fee:", result.submissionPrice.toString());
  } catch (error) {
    throw error;
  }
});
