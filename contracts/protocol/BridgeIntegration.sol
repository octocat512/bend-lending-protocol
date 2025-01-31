// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.4;
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ILendPool} from "../interfaces/Benddao/ILendPool.sol";
import {ILendPoolLoan} from "../interfaces/Benddao/ILendPoolLoan.sol";
import {ILendPoolAddressesProvider} from "../interfaces/Benddao/ILendPoolAddressesProvider.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {IInbox} from "arb-bridge-eth/contracts/bridge/interfaces/IInbox.sol";
import {IStargateRouterETH} from "../interfaces/Stargate/IStargateRouterETH.sol";
import {IStargateReceiver} from "../interfaces/Stargate/IStargateReceiver.sol";
import {IStargateRouter} from "../interfaces/Stargate/IStargateRouter.sol";
import "hardhat/console.sol";
import {CustomRouterETH} from "./CustomRouterETH.sol";

struct TicketParams {
  address target;
  uint256 arbCallValue;
  uint256 maxSubmissionCost;
  uint256 maxGas;
  uint256 gasPriceBid;
}

contract BridgeIntegration is ERC721Holder, IStargateReceiver, Ownable {
  ILendPoolAddressesProvider internal _addressProvider;

  IWETH internal WETH;

  IInbox internal _inbox;

  uint256 private constant _NOT_ENTERED = 0;
  uint256 private constant _ENTERED = 1;
  uint256 private _status;

  /**
   * @dev Prevents a contract from calling itself, directly or indirectly.
   * Calling a `nonReentrant` function from another `nonReentrant`
   * function is not supported. It is possible to prevent this from happening
   * by making the `nonReentrant` function external, and making it call a
   * `private` function that does the actual work.
   */
  modifier nonReentrant() {
    // On the first call to nonReentrant, _notEntered will be true
    require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

    // Any calls to nonReentrant after this point will fail
    _status = _ENTERED;

    _;

    // By storing the original value once again, a refund is triggered (see
    // https://eips.ethereum.org/EIPS/eip-2200)
    _status = _NOT_ENTERED;
  }

  constructor(
    address addressProvider,
    address weth,
    address inbox
  ) Ownable() {
    _addressProvider = ILendPoolAddressesProvider(addressProvider);
    _inbox = IInbox(inbox);
    WETH = IWETH(weth);

    WETH.approve(address(_getLendPool()), type(uint256).max);
  }

  receive() external payable {}

  fallback() external payable {}

  function _getLendPool() internal view returns (ILendPool) {
    return ILendPool(_addressProvider.getLendPool());
  }

  function _getLendPoolLoan() internal view returns (ILendPoolLoan) {
    return ILendPoolLoan(_addressProvider.getLendPoolLoan());
  }

  function authorizeLendPoolNFT(address[] calldata nftAssets) external nonReentrant onlyOwner {
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
  ) external nonReentrant returns (uint256) {
    // borrowETH
    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(nftAsset, nftTokenId);
    if (loanId == 0) {
      IERC721Upgradeable(nftAsset).safeTransferFrom(msg.sender, address(this), nftTokenId);
    }
    cachedPool.borrow(address(WETH), amount, nftAsset, nftTokenId, onBehalfOf, referralCode);
    WETH.withdraw(amount);

    // teleportETH
    // use standard
    bytes memory data = abi.encodeWithSelector(CustomRouterETH.redeem.selector, onBehalfOf);

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
  }

  function sgReceive(
    uint16 _srcChainId, // the remote chainId sending the tokens
    bytes memory _srcAddress, // the remote Bridge address
    uint256 _nonce,
    address _token, // the token contract on the local chain
    uint256 amountLD, // the qty of local _token contract tokens
    bytes memory payload
  ) external payable override nonReentrant {
    (address nftAsset, uint256 nftTokenId, address onBeHalfOf) = abi.decode(payload, (address, uint256, address));

    ILendPool cachedPool = _getLendPool();
    ILendPoolLoan cachedPoolLoan = _getLendPoolLoan();

    uint256 loanId = cachedPoolLoan.getCollateralLoanId(nftAsset, nftTokenId);
    require(loanId > 0, "collateral loan id not exist");

    (address reserveAsset, uint256 repayDebtAmount) = cachedPoolLoan.getLoanReserveBorrowAmount(loanId);
    require(reserveAsset == address(WETH), "loan reserve not WETH");

    if (amountLD < repayDebtAmount) {
      repayDebtAmount = amountLD;
    }

    require(amountLD >= (repayDebtAmount), "msg.value is less than repay amount");

    WETH.deposit{value: repayDebtAmount}();

    (uint256 paybackAmount, bool burn) = cachedPool.repay(nftAsset, nftTokenId, amountLD);

    // refund remaining dust eth
    if (amountLD > paybackAmount) {
      _safeTransferETH(onBeHalfOf, amountLD - paybackAmount);
    }
  }

  function _safeTransferETH(address to, uint256 value) internal {
    (bool success, ) = to.call{value: value}(new bytes(0));
    require(success, "ETH_TRANSFER_FAILED");
  }
}
