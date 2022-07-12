import { task } from "hardhat/config";
import { getContractAddressInDb, withSaveAndVerify } from "../../helpers/contracts-helpers";
import { eContractid, eNetwork } from "../../helpers/types";
import { getDeploySigner } from "../../helpers/contracts-getters";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BridgeIntegrationFactory } from "../../types";

task("full:deploy-bridge-integration", "Deploy bridge integration contract for full enviroment")
  .addFlag("verify", "Verify contracts at Etherscan")
  // .addParam("pool", `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify }, DRE: HardhatRuntimeEnvironment) => {
    try {
      await DRE.run("set-DRE");
      const network = <eNetwork>DRE.network.name;
      const wethGatewayAddr = await getContractAddressInDb(eContractid.WETHGateway);
      const bridgeIntegration = await new BridgeIntegrationFactory(await getDeploySigner()).deploy(
        wethGatewayAddr,
        "0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e"
      );
      // await insertContractAddressInDb(eContractid.BridgeIntegration, bridgeIntegration.address);
      return withSaveAndVerify(
        bridgeIntegration,
        eContractid.BridgeIntegration,
        [wethGatewayAddr, "0x578BAde599406A8fE3d24Fd7f7211c0911F5B29e"],
        true
      );

      //////////////////////////////////////////////////////////////////////////
    } catch (error) {
      throw error;
    }
  });
