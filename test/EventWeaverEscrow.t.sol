// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/base/EventWeaverEscrow.sol";

interface Vm {
    struct Log { bytes32[] topics; bytes data; address emitter; }
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
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
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
    MockUSDC token;
    EventWeaverEscrow escrow;
    address authority;
    address alice = address(0xA1);
    address bob = address(0xB2);

    function setUp() public {
        authority = vm.addr(AUTHORITY_PK);
        token = new MockUSDC();
        escrow = new EventWeaverEscrow(address(token), address(this), authority);
        token.mint(alice, 1_000);
        vm.prank(alice); token.approve(address(escrow), type(uint256).max);
    }

    function _signature(bytes32 digest) internal returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AUTHORITY_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _deposit(uint256 marketId, uint256 amount) internal {
        vm.prank(alice); escrow.stake(marketId, 1, amount);
    }

    function testActiveStakeCannotBeAdministrativelyWithdrawn() public {
        _deposit(1, 100);
        (bool ok,) = address(escrow).call(abi.encodeWithSignature("withdrawUnallocated(uint256,address,uint256)", 1, address(this), 100));
        require(!ok, "legacy withdrawal unexpectedly exists");
        require(token.balanceOf(address(escrow)) == 100, "active custody changed");
    }

    function testRelayerCannotAlterSignedSettlement() public {
        _deposit(2, 100);
        address[] memory recipients = new address[](1); recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1); amounts[0] = 100;
        bytes32 verdict = keccak256("finalized-genlayer-verdict");
        bytes memory sig = _signature(escrow.settlementDigest(2, recipients, amounts, verdict));
        amounts[0] = 99;
        vm.expectRevert(); escrow.settle(2, recipients, amounts, verdict, sig);
        amounts[0] = 100;
        escrow.settle(2, recipients, amounts, verdict, sig);
        require(escrow.claimable(2, alice) == 100, "canonical allocation missing");
    }

    function testSettlementCannotPrecedeAuthorityVerdict() public {
        _deposit(3, 100);
        address[] memory recipients = new address[](1); recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1); amounts[0] = 100;
        vm.expectRevert(); escrow.settle(3, recipients, amounts, keccak256("not-final"), bytes(""));
    }

    function testLateDepositRefundAfterSettlement() public {
        _deposit(4, 100);
        address[] memory recipients = new address[](1); recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1); amounts[0] = 80;
        bytes32 verdict = keccak256("final");
        escrow.settle(4, recipients, amounts, verdict, _signature(escrow.settlementDigest(4, recipients, amounts, verdict)));
        bytes32 depositId = keccak256("0xabc:7");
        bytes32 typeHash = keccak256("EventWeaverLateRefund(uint256 chainId,address escrow,uint256 marketId,bytes32 depositId,address recipient,uint256 amount)");
        bytes32 inner = keccak256(abi.encode(typeHash, block.chainid, address(escrow), 4, depositId, bob, 20));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", inner));
        escrow.allocateLateRefund(4, depositId, bob, 20, _signature(digest));
        require(escrow.claimable(4, bob) == 20, "late refund absent");
        vm.expectRevert(); escrow.allocateLateRefund(4, depositId, bob, 20, _signature(digest));
    }

    function testTwoStakesInOneTransactionEmitDistinctEvents() public {
        BatchStaker batch = new BatchStaker(); token.mint(address(batch), 30);
        vm.recordLogs(); batch.approveAndStake(token, escrow, 5);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 topic = keccak256("Staked(uint256,address,uint8,uint256)");
        uint256 count;
        for (uint256 i; i < logs.length; ++i) if (logs[i].topics.length > 0 && logs[i].topics[0] == topic) count++;
        require(count == 2, "both same-tx deposits must be observable by log index");
        (uint256 deposited,,) = escrow.pools(5); require(deposited == 30, "pool lost a batched deposit");
    }
}
