// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Base USDC custody for EventWeaver. The transaction-sending relayer
/// cannot choose payouts: financial mutations require an independent
/// authority signature bound to this chain, contract, market and payload.
contract EventWeaverEscrow {
    struct MarketPool {
        uint256 deposited;
        uint256 allocated;
        uint256 pending;
        bool settled;
    }
    bytes32 private constant MARKET_TYPEHASH = keccak256(
        "EventWeaverMarketRegistration(uint256 chainId,address escrow,address genLayerContract,uint256 marketId,bytes32 marketHash)"
    );
    bytes32 private constant DEPOSIT_ACK_TYPEHASH = keccak256(
        "EventWeaverDepositAcknowledgement(uint256 chainId,address escrow,address genLayerContract,uint256 marketId,bytes32 depositId,address recipient,uint256 amount,bytes32 applicationHash)"
    );
    bytes32 private constant DEPOSIT_REFUND_TYPEHASH = keccak256(
        "EventWeaverDepositRefund(uint256 chainId,address escrow,address genLayerContract,uint256 marketId,bytes32 depositId,address recipient,uint256 amount,bytes32 reasonHash)"
    );
    bytes32 private constant SETTLEMENT_TYPEHASH = keccak256(
        "EventWeaverSettlement(uint256 chainId,address escrow,address genLayerContract,uint256 marketId,bytes32 settlementId,bytes32 payoutsHash,bytes32 verdictHash,uint256 deposited)"
    );
    bytes32 private constant SURPLUS_TYPEHASH = keccak256(
        "EventWeaverSurplus(uint256 chainId,address escrow,uint256 marketId,address recipient,uint256 amount,uint256 nonce)"
    );
    uint256 private constant SECP256K1_HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    IERC20 public immutable usdc;
    address public immutable genLayerContract;
    address public owner;
    address public relayer;
    address public settlementAuthority;
    bool private locked;
    uint256 public surplusNonce;
    mapping(uint256 => MarketPool) public pools;
    mapping(uint256 => bytes32) public registeredMarketHash;
    mapping(uint256 => mapping(address => uint256)) public claimable;
    mapping(bytes32 => bool) public handledDeposit;
    mapping(bytes32 => bool) public usedSettlementId;

    event Staked(uint256 indexed marketId, address indexed staker, uint8 side, uint256 amount);
    event MarketRegistered(uint256 indexed marketId, bytes32 indexed marketHash);
    event DepositAcknowledged(
        uint256 indexed marketId,
        bytes32 indexed depositId,
        address indexed recipient,
        uint256 amount,
        bytes32 applicationHash
    );
    event DepositRefundAllocated(
        uint256 indexed marketId,
        bytes32 indexed depositId,
        address indexed recipient,
        uint256 amount,
        bytes32 reasonHash
    );
    event Settled(
        uint256 indexed marketId,
        bytes32 indexed settlementId,
        bytes32 indexed verdictHash,
        bytes32 payoutsHash,
        uint256 allocated
    );
    event Claimed(uint256 indexed marketId, address indexed recipient, uint256 amount);
    event SurplusWithdrawn(uint256 indexed marketId, address indexed recipient, uint256 amount, uint256 nonce);
    event RelayerUpdated(address indexed relayer);
    event SettlementAuthorityUpdated(address indexed authority);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }
    modifier onlyRelayer() {
        require(msg.sender == relayer, "not relayer");
        _;
    }
    modifier nonReentrant() {
        require(!locked, "reentrant");
        locked = true;
        _;
        locked = false;
    }

    constructor(address usdc_, address relayer_, address settlementAuthority_, address genLayerContract_) {
        require(
            usdc_ != address(0) && relayer_ != address(0) && settlementAuthority_ != address(0)
                && genLayerContract_ != address(0),
            "zero address"
        );
        usdc = IERC20(usdc_);
        owner = msg.sender;
        relayer = relayer_;
        settlementAuthority = settlementAuthority_;
        genLayerContract = genLayerContract_;
    }

    function marketRegistrationDigest(uint256 marketId, bytes32 marketHash) public view returns (bytes32) {
        return _ethSigned(
            keccak256(abi.encode(MARKET_TYPEHASH, block.chainid, address(this), genLayerContract, marketId, marketHash))
        );
    }

    function registerMarket(uint256 marketId, bytes32 marketHash, bytes calldata authoritySignature)
        external
        onlyRelayer
    {
        require(marketHash != bytes32(0) && registeredMarketHash[marketId] == bytes32(0), "invalid market registration");
        require(
            _recover(marketRegistrationDigest(marketId, marketHash), authoritySignature) == settlementAuthority,
            "bad authority signature"
        );
        registeredMarketHash[marketId] = marketHash;
        emit MarketRegistered(marketId, marketHash);
    }

    function stake(uint256 marketId, uint8 side, uint256 amount) external nonReentrant {
        require(registeredMarketHash[marketId] != bytes32(0), "unknown market");
        require(amount > 0 && !pools[marketId].settled, "invalid stake");
        require(side == 1 || side == 2, "invalid side");
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC transferFrom failed");
        pools[marketId].deposited += amount;
        pools[marketId].pending += amount;
        emit Staked(marketId, msg.sender, side, amount);
    }

    function acknowledgeDepositDigest(
        uint256 marketId,
        bytes32 depositId,
        address recipient,
        uint256 amount,
        bytes32 applicationHash
    ) public view returns (bytes32) {
        return _ethSigned(
            keccak256(
                abi.encode(
                    DEPOSIT_ACK_TYPEHASH,
                    block.chainid,
                    address(this),
                    genLayerContract,
                    marketId,
                    depositId,
                    recipient,
                    amount,
                    applicationHash
                )
            )
        );
    }

    function acknowledgeDeposit(
        uint256 marketId,
        bytes32 depositId,
        address recipient,
        uint256 amount,
        bytes32 applicationHash,
        bytes calldata authoritySignature
    ) external onlyRelayer {
        MarketPool storage pool = pools[marketId];
        require(
            !handledDeposit[depositId] && recipient != address(0) && amount > 0 && applicationHash != bytes32(0),
            "invalid acknowledgement"
        );
        require(pool.pending >= amount, "amount exceeds pending");
        require(
            _recover(
                    acknowledgeDepositDigest(marketId, depositId, recipient, amount, applicationHash),
                    authoritySignature
                ) == settlementAuthority,
            "bad authority signature"
        );
        handledDeposit[depositId] = true;
        pool.pending -= amount;
        emit DepositAcknowledged(marketId, depositId, recipient, amount, applicationHash);
    }

    function depositRefundDigest(
        uint256 marketId,
        bytes32 depositId,
        address recipient,
        uint256 amount,
        bytes32 reasonHash
    ) public view returns (bytes32) {
        return _ethSigned(
            keccak256(
                abi.encode(
                    DEPOSIT_REFUND_TYPEHASH,
                    block.chainid,
                    address(this),
                    genLayerContract,
                    marketId,
                    depositId,
                    recipient,
                    amount,
                    reasonHash
                )
            )
        );
    }

    /// @notice Resolve any confirmed but unregistered financial obligation
    /// without depending on market lifecycle or platform pause state.
    function allocateDepositRefund(
        uint256 marketId,
        bytes32 depositId,
        address recipient,
        uint256 amount,
        bytes32 reasonHash,
        bytes calldata authoritySignature
    ) external onlyRelayer {
        MarketPool storage pool = pools[marketId];
        require(
            !handledDeposit[depositId] && recipient != address(0) && amount > 0 && reasonHash != bytes32(0),
            "invalid refund"
        );
        require(pool.pending >= amount, "amount exceeds pending");
        require(
            _recover(depositRefundDigest(marketId, depositId, recipient, amount, reasonHash), authoritySignature)
                == settlementAuthority,
            "bad authority signature"
        );
        handledDeposit[depositId] = true;
        pool.pending -= amount;
        pool.allocated += amount;
        claimable[marketId][recipient] += amount;
        emit DepositRefundAllocated(marketId, depositId, recipient, amount, reasonHash);
    }

    function settlementDigest(
        uint256 marketId,
        bytes32 settlementId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32 verdictHash
    ) public view returns (bytes32) {
        bytes32 payoutsHash = keccak256(abi.encode(recipients, amounts));
        uint256 deposited = pools[marketId].deposited;
        bytes memory payload = abi.encode(
            SETTLEMENT_TYPEHASH,
            block.chainid,
            address(this),
            genLayerContract,
            marketId,
            settlementId,
            payoutsHash,
            verdictHash,
            deposited
        );
        return _ethSigned(keccak256(payload));
    }

    function settle(
        uint256 marketId,
        bytes32 settlementId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32 verdictHash,
        bytes calldata authoritySignature
    ) external onlyRelayer {
        require(recipients.length == amounts.length && recipients.length > 0, "invalid allocations");
        require(
            settlementId != bytes32(0) && verdictHash != bytes32(0) && !usedSettlementId[settlementId],
            "invalid settlement identity"
        );
        MarketPool storage pool = pools[marketId];
        require(!pool.settled && pool.pending == 0, "unresolved deposits");
        require(
            _recover(settlementDigest(marketId, settlementId, recipients, amounts, verdictHash), authoritySignature)
                == settlementAuthority,
            "bad authority signature"
        );
        uint256 total;
        for (uint256 i; i < amounts.length; ++i) {
            require(recipients[i] != address(0) && amounts[i] > 0, "invalid recipient");
            total += amounts[i];
        }
        require(total <= pool.deposited, "allocation exceeds pool");
        usedSettlementId[settlementId] = true;
        pool.settled = true;
        pool.allocated += total;
        for (uint256 i; i < amounts.length; ++i) {
            claimable[marketId][recipients[i]] += amounts[i];
        }
        emit Settled(marketId, settlementId, verdictHash, keccak256(abi.encode(recipients, amounts)), total);
    }

    function claim(uint256 marketId) external nonReentrant {
        uint256 amount = claimable[marketId][msg.sender];
        require(amount > 0, "nothing claimable");
        claimable[marketId][msg.sender] = 0;
        require(usdc.transfer(msg.sender, amount), "USDC transfer failed");
        emit Claimed(marketId, msg.sender, amount);
    }

    function setRelayer(address relayer_) external onlyOwner {
        require(relayer_ != address(0), "zero relayer");
        relayer = relayer_;
        emit RelayerUpdated(relayer_);
    }

    function setSettlementAuthority(address authority_) external onlyOwner {
        require(authority_ != address(0), "zero authority");
        settlementAuthority = authority_;
        emit SettlementAuthorityUpdated(authority_);
    }

    /// @notice Active funds are never withdrawable. After settlement, even
    /// apparent surplus needs a separate nonce-bound authority signature.
    function withdrawAuthorizedSurplus(uint256 marketId, address to, uint256 amount, bytes calldata authoritySignature)
        external
        onlyOwner
        nonReentrant
    {
        MarketPool storage pool = pools[marketId];
        require(
            pool.settled && to != address(0) && amount <= pool.deposited - pool.allocated - pool.pending,
            "invalid withdrawal"
        );
        uint256 nonce = surplusNonce++;
        bytes32 digest = _ethSigned(
            keccak256(abi.encode(SURPLUS_TYPEHASH, block.chainid, address(this), marketId, to, amount, nonce))
        );
        require(_recover(digest, authoritySignature) == settlementAuthority, "bad authority signature");
        pool.deposited -= amount;
        require(usdc.transfer(to, amount), "USDC transfer failed");
        emit SurplusWithdrawn(marketId, to, amount, nonce);
    }

    function _ethSigned(bytes32 hash) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function _recover(bytes32 digest, bytes calldata signature) private pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (uint256(s) > SECP256K1_HALF_N || (v != 27 && v != 28)) return address(0);
        return ecrecover(digest, v, r, s);
    }
}
