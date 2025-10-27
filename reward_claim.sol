// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * --------------------------------------------------------------------
 *  Athena RewardClaim — Final Optimized Version (Audit-Grade)
 *  Network: Base (Chain ID 8453)
 *  Token: $ATA
 *
 *  Key Features:
 *  • Funding locked to treasury (no admin drain)
 *  • Merkle proof uses sorted-pair keccak256 hashing (industry standard)
 *  • Tracks total claimed + sweep of unclaimed ATA
 *  • calldata optimization (~200 gas saved per claim)
 * --------------------------------------------------------------------
 */

/// @notice Minimal ERC-20 interface (no mint/burn)
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

library Merkle {
    /// @notice Verify Merkle proof for a given leaf and root (sorted-pair)
    /// @dev Uses calldata to reduce gas costs.
    function verify(bytes32[] calldata proof, bytes32 root, bytes32 leaf)
        internal
        pure
        returns (bool ok)
    {
        bytes32 computed = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            if (computed < p) {
                computed = keccak256(abi.encodePacked(computed, p));
            } else {
                computed = keccak256(abi.encodePacked(p, computed));
            }
        }
        return computed == root;
    }
}

contract RewardClaim {
    using Merkle for bytes32[];

    // ------------------------------------------------------------------
    // Immutable references
    // ------------------------------------------------------------------
    IERC20 public immutable token;
    address public immutable treasury;

    // Admin (for setting roots, not funding)
    address public admin;
    uint256 public constant CLAIM_WINDOW = 48 hours;

    struct Epoch {
        bytes32 root;         // Merkle root for epoch
        uint256 funded;       // total ATA funded for epoch
        uint256 start;        // epoch start timestamp
        uint256 claimsOpenAt; // when claim window opened
    }

    mapping(uint256 => Epoch) public epochs;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(uint256 => uint256) public totalClaimed; // per-epoch claimed amount

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------
    event AdminChanged(address indexed admin);
    event Funded(uint256 indexed epoch, uint256 amount);
    event RootSet(uint256 indexed epoch, bytes32 root);
    event Claimed(uint256 indexed epoch, address indexed user, uint256 amount);
    event UnclaimedSwept(uint256 indexed epoch, uint256 amount);

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------
    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    modifier onlyTreasury() {
        require(msg.sender == treasury, "only treasury");
        _;
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------
    constructor(address token_, address treasury_) {
        require(token_ != address(0) && treasury_ != address(0), "zero");
        token = IERC20(token_);
        treasury = treasury_;
        admin = msg.sender;
        emit AdminChanged(admin);
    }

    // ------------------------------------------------------------------
    // Admin controls
    // ------------------------------------------------------------------

    /// @notice Transfer admin privileges to a new address.
    function setAdmin(address a) external onlyAdmin {
        require(a != address(0), "zero");
        admin = a;
        emit AdminChanged(a);
    }

    /// @notice Treasury funds a given epoch with pre-computed ATA amount.
    /// @dev ATA must be approved beforehand.
    function fund(uint256 epoch, uint256 amount) external onlyTreasury {
        require(amount > 0, "amount");
        epochs[epoch].funded += amount;
        require(token.transferFrom(treasury, address(this), amount), "transfer");
        emit Funded(epoch, amount);
    }

    /// @notice Publish the Merkle root for an epoch; opens 48h claim window.
    function setMerkleRoot(uint256 epoch, bytes32 root) external onlyAdmin {
        require(root != bytes32(0), "root");
        Epoch storage e = epochs[epoch];
        e.root = root;
        e.claimsOpenAt = block.timestamp;
        if (e.start == 0) e.start = block.timestamp;
        emit RootSet(epoch, root);
    }

    // ------------------------------------------------------------------
    // Claim Logic
    // ------------------------------------------------------------------

    /// @notice Claim ATA reward for a given epoch using a valid proof.
    function claim(uint256 epoch, uint256 amount, bytes32[] calldata proof) external {
        Epoch storage e = epochs[epoch];
        require(e.root != bytes32(0), "no root");
        require(block.timestamp <= e.claimsOpenAt + CLAIM_WINDOW, "window closed");
        require(!claimed[epoch][msg.sender], "claimed");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount, epoch));
        require(proof.verify(e.root, leaf), "bad proof");

        claimed[epoch][msg.sender] = true;
        totalClaimed[epoch] += amount;
        require(token.transfer(msg.sender, amount), "transfer");

        emit Claimed(epoch, msg.sender, amount);
    }

    /// @notice After claim window, admin can sweep unclaimed rewards back to treasury.
    function sweepUnclaimed(uint256 epoch) external onlyAdmin {
        Epoch storage e = epochs[epoch];
        require(block.timestamp > e.claimsOpenAt + CLAIM_WINDOW, "window open");
        uint256 unclaimed = e.funded - totalClaimed[epoch];
        if (unclaimed > 0) {
            require(token.transfer(treasury, unclaimed), "sweep");
            emit UnclaimedSwept(epoch, unclaimed);
        }
    }
}
