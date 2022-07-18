// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {ILendPool} from "../interfaces/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/ILendPoolLoan.sol";
import {ILendPoolAddressesProvider} from "../interfaces/ILendPoolAddressesProvider.sol";
import {IInbox} from "arb-bridge-eth/contracts/bridge/interfaces/IInbox.sol";
import {IWETH} from "../interfaces/IWETH.sol";

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

struct TicketParams {
  address target;
  uint256 arbCallValue;
  uint256 maxSubmissionCost;
  uint256 maxGas;
  uint256 gasPriceBid;
}

contract BridgeIntegration is ERC721Holder {
  ILendPoolAddressesProvider internal _addressProvider;

  IWETH internal WETH;

  IInbox internal _inbox;

  function initialize(
    address addressProvider,
    address weth,
    address inbox
  ) public {
    _addressProvider = ILendPoolAddressesProvider(addressProvider);
    _inbox = IInbox(inbox);
    WETH = IWETH(weth);

    WETH.approve(address(_getLendPool()), type(uint256).max);
  }

  function _getLendPool() internal view returns (ILendPool) {
    return ILendPool(_addressProvider.getLendPool());
  }

  function _getLendPoolLoan() internal view returns (ILendPoolLoan) {
    return ILendPoolLoan(_addressProvider.getLendPoolLoan());
  }

  function authorizeLendPoolNFT(address[] calldata nftAssets) external {
    for (uint256 i = 0; i < nftAssets.length; i++) {
      IERC721Upgradeable(nftAssets[i]).setApprovalForAll(address(_getLendPool()), true);
    }
  }

  function borrowAndTeleportETH(
    uint256 amount,
    address nftAsset,
    uint256 nftTokenId,
    address onBehalfOf,
    uint16 referralCode,
    TicketParams calldata ticket
  ) external returns (uint256) {
    // borrowETH
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(nftAsset, nftTokenId);
    if (loanId == 0) {
      IERC721Upgradeable(nftAsset).safeTransferFrom(msg.sender, address(this), nftTokenId);
    }
    cachedPool.borrow(address(WETH), amount, nftAsset, nftTokenId, onBehalfOf, referralCode);
    WETH.withdraw(amount);
    // _safeTransferETH(onBehalfOf, amount);

    // teleportETH
    // use standard

    bytes memory data = abi.encodeWithSelector(BridgeIntegration.redeem.selector, onBehalfOf);

    return
      _inbox.createRetryableTicket{value: amount}(
        ticket.target,
        ticket.arbCallValue,
        ticket.maxSubmissionCost,
        onBehalfOf,
        onBehalfOf,
        ticket.maxGas,
        ticket.gasPriceBid,
        data
      );

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
  }

  // function is used on l2
  function redeem(address to) external payable {
    _safeTransferETH(to, msg.value);
  }

  function _safeTransferETH(address to, uint256 value) internal {
    (bool success, ) = to.call{value: value}(new bytes(0));
    require(success, "ETH_TRANSFER_FAILED");
  }

  receive() external payable {
    require(msg.sender == address(WETH), "Receive not allowed");
  }

  fallback() external payable {
    revert("Fallback not allowed");
  }
}
