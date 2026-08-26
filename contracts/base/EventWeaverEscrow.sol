// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Base Sepolia USDC custody for EventWeaver V1. GenLayer decides
/// outcomes; this contract only holds deposits and exposes pull-based claims.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract EventWeaverEscrow {
    struct MarketPool { uint256 deposited; uint256 allocated; bool settled; }

    IERC20 public immutable usdc;
    address public owner;
    address public relayer;
    bool private locked;
    mapping(uint256 => MarketPool) public pools;
    mapping(uint256 => mapping(address => uint256)) public claimable;

    event Staked(uint256 indexed marketId, address indexed staker, uint256 amount);
    event Settled(uint256 indexed marketId, uint256 recipientCount, uint256 allocated);
    event Claimed(uint256 indexed marketId, address indexed recipient, uint256 amount);
    event RelayerUpdated(address indexed relayer);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    modifier onlyRelayer() { require(msg.sender == relayer, "not relayer"); _; }
    modifier nonReentrant() { require(!locked, "reentrant"); locked = true; _; locked = false; }

    constructor(address usdc_, address relayer_) {
        require(usdc_ != address(0) && relayer_ != address(0), "zero address");
        usdc = IERC20(usdc_);
        owner = msg.sender;
        relayer = relayer_;
    }

    /// @dev Wallet must approve this contract first. Amount is USDC base units (6 decimals).
    function stake(uint256 marketId, uint256 amount) external nonReentrant {
        require(amount > 0 && !pools[marketId].settled, "invalid stake");
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transferFrom failed");
        pools[marketId].deposited += amount;
        emit Staked(marketId, msg.sender, amount);
    }

    /// @notice Idempotency is enforced on-chain: one finalized payout list per market.
    function settle(uint256 marketId, address[] calldata recipients, uint256[] calldata amounts) external onlyRelayer {
        require(recipients.length == amounts.length && recipients.length > 0, "invalid allocations");
        MarketPool storage pool = pools[marketId];
        require(!pool.settled, "already settled");
        uint256 total;
        for (uint256 i; i < amounts.length; ++i) {
            require(recipients[i] != address(0), "zero recipient");
            total += amounts[i];
        }
        require(total <= pool.deposited, "allocation exceeds pool");
        pool.settled = true;
        pool.allocated = total;
        for (uint256 i; i < amounts.length; ++i) claimable[marketId][recipients[i]] += amounts[i];
        emit Settled(marketId, recipients.length, total);
    }

    function claim(uint256 marketId) external nonReentrant {
        uint256 amount = claimable[marketId][msg.sender];
        require(amount > 0, "nothing claimable");
        claimable[marketId][msg.sender] = 0;
        require(usdc.transfer(msg.sender, amount), "USDC transfer failed");
        emit Claimed(marketId, msg.sender, amount);
    }

    function setRelayer(address relayer_) external onlyOwner {
        require(relayer_ != address(0), "zero relayer"); relayer = relayer_; emit RelayerUpdated(relayer_);
    }

    /// @notice Recover unallocated USDC (fees, dust, or cancelled before stake recording).
    function withdrawUnallocated(uint256 marketId, address to, uint256 amount) external onlyOwner nonReentrant {
        MarketPool storage pool = pools[marketId];
        require(to != address(0) && amount <= pool.deposited - pool.allocated, "invalid withdrawal");
        pool.deposited -= amount;
        require(usdc.transfer(to, amount), "USDC transfer failed");
    }
}
