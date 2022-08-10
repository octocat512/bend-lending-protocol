import { IERC20DetailedFactory } from "../types/IERC20DetailedFactory";
import { IERC721DetailedFactory } from "../types/IERC721DetailedFactory";
import { getEthersSigners } from "./contracts-helpers";
import { DRE, getDb, omit } from "./misc-utils";
import { eContractid, tEthereumAddress, TokenContractId, NftContractId } from "./types";

export const getFirstSigner = async () => (await getEthersSigners())[0];

export const getSecondSigner = async () => (await getEthersSigners())[1];

export const getThirdSigner = async () => (await getEthersSigners())[2];

export const getDeploySigner = async () => (await getEthersSigners())[0];

export const getPoolAdminSigner = async () => (await getEthersSigners())[0];

export const getPoolOwnerSigner = async () => (await getEthersSigners())[0];

export const getEmergencyAdminSigner = async () => (await getEthersSigners())[1];

export const getProxyAdminSigner = async () => (await getEthersSigners())[2];

export const getIErc20Detailed = async (address: tEthereumAddress) =>
  await IERC20DetailedFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.IERC20Detailed}`).value()).address,
    await getDeploySigner()
  );

export const getIErc721Detailed = async (address: tEthereumAddress) =>
  await IERC721DetailedFactory.connect(
    address || (await getDb(DRE.network.name).get(`${eContractid.IERC721Detailed}`).value()).address,
    await getDeploySigner()
  );

export const getQuoteCurrencies = (oracleQuoteCurrency: string): string[] => {
  switch (oracleQuoteCurrency) {
    case "ETH":
    case "WETH":
    default:
      return ["ETH", "WETH"];
  }
};

export const getPairsTokenAggregator = (
  allAssetsAddresses: {
    [tokenSymbol: string]: tEthereumAddress;
  },
  aggregatorsAddresses: { [tokenSymbol: string]: tEthereumAddress },
  oracleQuoteCurrency: string
): [string[], string[]] => {
  const assetsWithoutQuoteCurrency = omit(allAssetsAddresses, getQuoteCurrencies(oracleQuoteCurrency));

  const pairs = Object.entries(assetsWithoutQuoteCurrency).map(([tokenSymbol, tokenAddress]) => {
    //if (true/*tokenSymbol !== 'WETH' && tokenSymbol !== 'ETH' && tokenSymbol !== 'LpWETH'*/) {
    const aggregatorAddressIndex = Object.keys(aggregatorsAddresses).findIndex((value) => value === tokenSymbol);
    if (aggregatorAddressIndex < 0) {
      throw Error(`can not find aggregator for ${tokenSymbol}`);
    }
    const [, aggregatorAddress] = (Object.entries(aggregatorsAddresses) as [string, tEthereumAddress][])[
      aggregatorAddressIndex
    ];
    return [tokenAddress, aggregatorAddress];
    //}
  }) as [string, string][];

  const mappedPairs = pairs.map(([asset]) => asset);
  const mappedAggregators = pairs.map(([, source]) => source);

  return [mappedPairs, mappedAggregators];
};
