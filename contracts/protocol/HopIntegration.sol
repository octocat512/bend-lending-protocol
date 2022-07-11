// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {IWETHGateway} from "../interfaces/IWETHGateway.sol";
import {IInbox} from "arb-bridge-eth/contracts/bridge/interfaces/IInbox.sol";

interface IHopRouter {
  function sendToL2(
    uint256 chainId,
    address recipient,
    uint256 amount,
    uint256 amountOutMin,
    uint256 deadline,
    address relayer,
    uint256 relayerFee
  ) external payable;
}

struct BridgeParams {
  address token;
  address recipient;
  address router;
  uint256 targetChainId;
  uint256 amount;
  uint256 destinationAmountOutMin;
  uint256 destinationDeadline;
}

contract HopIntegration is Ownable {
  address public wethAddr;
  address public bridgeRouterAddr;
  address public wethGatewayAddr;
  address public inboxAddr;

  constructor(
    address wethAddr_,
    address bridgeRouterAddr_,
    address wethGatewayAddr_,
    address inboxAddr_
  ) {
    wethAddr = wethAddr_;
    bridgeRouterAddr = bridgeRouterAddr_;
    wethGatewayAddr = wethGatewayAddr_;
    inboxAddr = inboxAddr_;
  }

  function _borrowETH(
    uint256 amount,
    address nftAsset,
    uint256 nftTokenId,
    address onBehalfOf,
    uint16 referralCode
  ) private {
    IWETHGateway(wethGatewayAddr).borrowETH(amount, nftAsset, nftTokenId, onBehalfOf, referralCode);
  }

  function borrowETH(
    uint256 amount,
    address nftAsset,
    uint256 nftTokenId,
    address onBehalfOf,
    uint16 referralCode
  ) public {
    _borrowETH(amount, nftAsset, nftTokenId, onBehalfOf, referralCode);
  }

  function borrowAndTeleportETH(
    uint256 amount,
    address nftAsset,
    uint256 nftTokenId,
    address onBehalfOf,
    uint16 referralCode,
    //
    uint256 chainId
  ) public {
    // borrowETH
    _borrowETH(amount, nftAsset, nftTokenId, onBehalfOf, referralCode);

    // teleportETH

    // use hop bridge
    // BridgeParams memory params = BridgeParams({
    //   token: address(0),
    //   recipient: msg.sender,
    //   router: bridgeRouterAddr,
    //   targetChainId: chainId,
    //   amount: amount,
    //   destinationAmountOutMin: 0,
    //   destinationDeadline: 0
    // });
    // IHopRouter router = IHopRouter(params.router);
    // router.sendToL2{value: amount}(
    //   params.targetChainId,
    //   params.recipient,
    //   params.amount,
    //   params.destinationAmountOutMin,
    //   params.destinationDeadline,
    //   address(0), // relayer address
    //   0 // relayer fee
    // );

    // use standard bridge
    IInbox inbox = IInbox(inboxAddr);
    inbox.depositEth{value: amount}(0);
  }
}
