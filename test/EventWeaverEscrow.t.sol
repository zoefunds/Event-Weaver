// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/base/EventWeaverEscrow.sol";

interface Vm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address sender) external;
    function expectRevert() external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

contract MockUSDC is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract BatchStaker {
    function approveAndStake(MockUSDC token, EventWeaverEscrow escrow, uint256 marketId) external {
        token.approve(address(escrow), 30);
        escrow.stake(marketId, 1, 10);
        escrow.stake(marketId, 2, 20);
    }
}

contract EventWeaverEscrowTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 constant AUTHORITY_PK = 0xA11CE;
    address constant GENLAYER = address(0x123456);
    MockUSDC token;
    EventWeaverEscrow escrow;
    address authority;
    address alice = address(0xA1);
    address bob = address(0xB2);

    function setUp() public {
        authority = vm.addr(AUTHORITY_PK);
        token = new MockUSDC();
        escrow = new EventWeaverEscrow(address(token), address(this), authority, GENLAYER);
        token.mint(alice, 1_000);
        vm.prank(alice);
        token.approve(address(escrow), type(uint256).max);
    }

    function _signature(bytes32 digest) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AUTHORITY_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _register(uint256 marketId) internal {
        bytes32 marketHash = keccak256(abi.encode("canonical-market", marketId));
        escrow.registerMarket(marketId, marketHash, _signature(escrow.marketRegistrationDigest(marketId, marketHash)));
    }

    function _deposit(uint256 marketId, uint256 amount) internal {
        vm.prank(alice);
        escrow.stake(marketId, 1, amount);
    }

    function _ack(uint256 marketId, bytes32 depositId, uint256 amount) internal {
        bytes32 applicationHash = keccak256(abi.encode("accepted-genlayer-application", depositId));
        escrow.acknowledgeDeposit(
            marketId,
            depositId,
            alice,
            amount,
            applicationHash,
            _signature(escrow.acknowledgeDepositDigest(marketId, depositId, alice, amount, applicationHash))
        );
    }

    function _settle(uint256 marketId, address recipient, uint256 amount) internal {
        address[] memory recipients = new address[](1);
        recipients[0] = recipient;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        bytes32 verdict = keccak256(abi.encode("finalized-genlayer-verdict", marketId));
        bytes32 settlementId = keccak256(abi.encode("unique-settlement", marketId));
        bytes32 digest = escrow.settlementDigest(marketId, settlementId, recipients, amounts, verdict);
        bytes memory signature = _signature(digest);
        escrow.settle(marketId, settlementId, recipients, amounts, verdict, signature);
    }

    function testUnknownMarketDepositRevertsWithoutMovingUSDC() public {
        uint256 beforeBalance = token.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert();
        escrow.stake(999, 1, 100);
        require(token.balanceOf(alice) == beforeBalance, "invalid market moved funds");
        require(token.balanceOf(address(escrow)) == 0, "escrow accepted invalid market");
    }

    function testMarketRegistrationIsBoundToConfiguredGenLayerContract() public {
        bytes32 marketHash = keccak256("market-1");
        bytes32 wrongTypeHash = keccak256(
            "EventWeaverMarketRegistration(uint256 chainId,address escrow,address genLayerContract,uint256 marketId,bytes32 marketHash)"
        );
        bytes32 wrongInner =
            keccak256(abi.encode(wrongTypeHash, block.chainid, address(escrow), address(0xBAD), 1, marketHash));
        bytes32 wrongDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", wrongInner));
        vm.expectRevert();
        escrow.registerMarket(1, marketHash, _signature(wrongDigest));
        _register(1);
    }

    function testActiveStakeCannotBeAdministrativelyWithdrawn() public {
        _register(1);
        _deposit(1, 100);
        (bool ok,) = address(escrow)
            .call(abi.encodeWithSignature("withdrawUnallocated(uint256,address,uint256)", 1, address(this), 100));
        require(!ok, "legacy withdrawal unexpectedly exists");
        require(token.balanceOf(address(escrow)) == 100, "active custody changed");
    }

    function testRelayerCannotAlterSignedSettlement() public {
        _register(2);
        _deposit(2, 100);
        _ack(2, keccak256("deposit-2"), 100);
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100;
        bytes32 verdict = keccak256("finalized-genlayer-verdict");
        bytes32 settlementId = keccak256("settlement-2");
        bytes memory sig = _signature(escrow.settlementDigest(2, settlementId, recipients, amounts, verdict));
        amounts[0] = 99;
        vm.expectRevert();
        escrow.settle(2, settlementId, recipients, amounts, verdict, sig);
        amounts[0] = 100;
        escrow.settle(2, settlementId, recipients, amounts, verdict, sig);
        require(escrow.claimable(2, alice) == 100, "canonical allocation missing");
    }

    function testSettlementCannotPrecedeDepositReconciliation() public {
        _register(3);
        _deposit(3, 100);
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100;
        bytes32 verdict = keccak256("final");
        bytes32 settlementId = keccak256("settlement-3");
        bytes memory sig = _signature(escrow.settlementDigest(3, settlementId, recipients, amounts, verdict));
        vm.expectRevert();
        escrow.settle(3, settlementId, recipients, amounts, verdict, sig);
        _ack(3, keccak256("deposit-3"), 100);
        escrow.settle(3, settlementId, recipients, amounts, verdict, sig);
    }

    function testPendingDepositCannotBecomeSurplusAndCanStillBeRefunded() public {
        _register(4);
        _deposit(4, 80);
        _ack(4, keccak256("deposit-4a"), 80);
        _settle(4, alice, 80);

        // A second deposit cannot enter after settlement, so model the adverse
        // ordering on a second market: confirmed deposit, delayed registration,
        // and an attempted settlement/surplus path while it remains pending.
        _register(5);
        _deposit(5, 20);
        vm.expectRevert();
        escrow.withdrawAuthorizedSurplus(5, address(this), 20, bytes(""));

        bytes32 depositId = keccak256("0xabc:7");
        bytes32 reasonHash = keccak256("GENLAYER_APPLICATION_UNAVAILABLE");
        bytes memory sig = _signature(escrow.depositRefundDigest(5, depositId, alice, 20, reasonHash));
        escrow.allocateDepositRefund(5, depositId, alice, 20, reasonHash, sig);
        require(escrow.claimable(5, alice) == 20, "deposit refund absent");
        (,, uint256 pending,) = escrow.pools(5);
        require(pending == 0, "pending liability not cleared");
        vm.prank(alice);
        escrow.claim(5);
        require(token.balanceOf(alice) == 920, "refund was not paid");
    }

    function testSettlementIdentityCannotReplayAcrossMarkets() public {
        _register(6);
        _deposit(6, 10);
        _ack(6, keccak256("deposit-6"), 10);
        _register(7);
        _deposit(7, 10);
        _ack(7, keccak256("deposit-7"), 10);
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10;
        bytes32 verdict = keccak256("verdict");
        bytes32 settlementId = keccak256("unique-id");
        escrow.settle(
            6,
            settlementId,
            recipients,
            amounts,
            verdict,
            _signature(escrow.settlementDigest(6, settlementId, recipients, amounts, verdict))
        );
        bytes memory replaySignature =
            _signature(escrow.settlementDigest(7, settlementId, recipients, amounts, verdict));
        vm.expectRevert();
        escrow.settle(7, settlementId, recipients, amounts, verdict, replaySignature);
    }

    function testTwoStakesInOneTransactionEmitDistinctEventsAndReserveBoth() public {
        _register(8);
        BatchStaker batch = new BatchStaker();
        token.mint(address(batch), 30);
        vm.recordLogs();
        batch.approveAndStake(token, escrow, 8);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 topic = keccak256("Staked(uint256,address,uint8,uint256)");
        uint256 count;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].topics.length > 0 && logs[i].topics[0] == topic) count++;
        }
        require(count == 2, "both same-tx deposits must be observable by log index");
        (uint256 deposited,, uint256 pending,) = escrow.pools(8);
        require(deposited == 30 && pending == 30, "batched liabilities not reserved");
    }
}
