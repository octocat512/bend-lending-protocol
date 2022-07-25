// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;

interface IStargateRouterETH {
  function addLiquidityETH() external payable;

  // compose stargate to swap ETH on the source to ETH on the destination
  function swapETH(
    uint16 _dstChainId, // destination Stargate chainId
    address payable _refundAddress, // refund additional messageFee to this address
    bytes calldata _toAddress, // the receiver of the destination ETH
    uint256 _amountLD, // the amount, in Local Decimals, to be swapped
    uint256 _minAmountLD // the minimum amount accepted out on destination
  ) external payable;

  // this contract needs to accept ETH
  receive() external payable;
}
