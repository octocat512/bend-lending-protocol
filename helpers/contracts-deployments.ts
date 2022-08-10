import { Contract } from "ethers";
import { BytesLike } from "@ethersproject/bytes";
import { DRE, getDb, notFalsyOrZeroAddress } from "./misc-utils";
import {
  tEthereumAddress,
  eContractid,
  BendPools,
  TokenContractId,
  NftContractId,
  IReserveParams,
  INftParams,
} from "./types";
import { MockContract } from "ethereum-waffle";
import { ConfigNames, getReservesConfigByPool, getNftsConfigByPool, loadPoolConfig } from "./configuration";
import { getDeploySigner } from "./contracts-getters";
import {
  MintableERC721,
  MintableERC721Factory,
  BendUpgradeableProxyFactory,
  BendProxyAdminFactory,
  TimelockControllerFactory,
} from "../types";
import {
  withSaveAndVerify,
  registerContractInJsonDb,
  linkBytecode,
  insertContractAddressInDb,
  getOptionalParamAddressPerNetwork,
  getContractAddressInDb,
} from "./contracts-helpers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { eNetwork } from "./types";

const readArtifact = async (id: string) => {
  return (DRE as HardhatRuntimeEnvironment).artifacts.readArtifact(id);
};

export const deployNftLogicLibrary = async (verify?: boolean) => {
  const nftLogicArtifact = await readArtifact(eContractid.NftLogic);
  const linkedNftLogicByteCode = linkBytecode(nftLogicArtifact, {
    //[eContractid.ReserveLogic]: reserveLogic.address,
  });

  const nftLogicFactory = await DRE.ethers.getContractFactory(nftLogicArtifact.abi, linkedNftLogicByteCode);

  const nftLogic = await (await nftLogicFactory.connect(await getDeploySigner()).deploy()).deployed();

  return withSaveAndVerify(nftLogic, eContractid.NftLogic, [], verify);
};

export const deployValidationLogic = async (reserveLogic: Contract, genericLogic: Contract, verify?: boolean) => {
  const validationLogicArtifact = await readArtifact(eContractid.ValidationLogic);

  const linkedValidationLogicByteCode = linkBytecode(validationLogicArtifact, {
    [eContractid.ReserveLogic]: reserveLogic.address,
    [eContractid.GenericLogic]: genericLogic.address,
  });

  const validationLogicFactory = await DRE.ethers.getContractFactory(
    validationLogicArtifact.abi,
    linkedValidationLogicByteCode
  );

  const validationLogic = await (await validationLogicFactory.connect(await getDeploySigner()).deploy()).deployed();

  return withSaveAndVerify(validationLogic, eContractid.ValidationLogic, [], verify);
};

const PLACEHOLDER_GENERIC_LOGIC = "__$4c26be947d349222af871a3168b3fe584b$__";
const PLACEHOLDER_VALIDATION_LOGIC = "__$5201a97c05ba6aa659e2f36a933dd51801$__";
const PLACEHOLDER_RESERVE_LOGIC = "__$d3b4366daeb9cadc7528af6145b50b2183$__";
const PLACEHOLDER_NFT_LOGIC = "__$eceb79063fab52ea3826f3ee75ecd7f36d$__";
const PLACEHOLDER_SUPPLY_LOGIC = "__$2f7c76ee15bdc1d8f3b34a04b86951fc56$__";
const PLACEHOLDER_BORROW_LOGIC = "__$77c5a84c43428e206d5bf08427df63fefa$__";
const PLACEHOLDER_LIQUIDATE_LOGIC = "__$ce70b23849b5cbed90e6e2f622d8887206$__";
const PLACEHOLDER_CONFIGURATOR_LOGIC = "__$3b2ad8f1ea56cc7a60e9a93596bbfe9178$__";

export const deployMintableERC721 = async (args: [string, string], verify?: boolean): Promise<MintableERC721> =>
  withSaveAndVerify(
    await new MintableERC721Factory(await getDeploySigner()).deploy(...args),
    eContractid.MintableERC721,
    args,
    verify
  );

export const deployBendUpgradeableProxy = async (
  id: string,
  admin: tEthereumAddress,
  logic: tEthereumAddress,
  data: BytesLike,
  verify?: boolean
) =>
  withSaveAndVerify(
    await new BendUpgradeableProxyFactory(await getDeploySigner()).deploy(logic, admin, data),
    id,
    [logic, admin, DRE.ethers.utils.hexlify(data)],
    verify
  );

export const deployBendProxyAdmin = async (id: string, verify?: boolean) =>
  withSaveAndVerify(await new BendProxyAdminFactory(await getDeploySigner()).deploy(), id, [], verify);
