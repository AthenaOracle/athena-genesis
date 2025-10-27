// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * --------------------------------------------------------------------
 *  Athena Token ($ATA)
 *
 *  Network: Base Mainnet (Chain ID 8453)
 *  Total Supply: 21,000,000 ATA (fixed)
 *  Decimals: 18
 *  All tokens minted to deployer at Genesis.
 *
 *  Philosophy:
 *  • Minimal, auditable, and immutable ERC-20 base.
 *  • No mint or burn beyond Genesis allocation.
 *  • Open and forkable — internal functions marked `virtual` for extension.
 *  • Fully EVM-compatible (Base, Ethereum, Sonic, etc.).
 * --------------------------------------------------------------------
 */
contract AthenaToken {
    // --- Token metadata ---
    string public constant name = "Athena";
    string public constant symbol = "ATA";
    uint8 public constant decimals = 18;

    // Fixed total supply: 21,000,000 * 10^18
    uint256 public constant totalSupply = 21_000_000 * 10 ** uint256(decimals);

    // --- Storage ---
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // --- Events ---
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @notice Genesis constructor
     * Mints the entire supply to the deployer wallet.
     */
    constructor() {
        _balances[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    // ------------------------------------------------------------------------
    // ERC-20 Standard Functions
    // ------------------------------------------------------------------------

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "ATA: insufficient allowance");
        _approve(from, msg.sender, currentAllowance - amount);
        _transfer(from, to, amount);
        return true;
    }

    // ------------------------------------------------------------------------
    // Internal Logic
    // These are marked `virtual` to allow safe overrides in future forks.
    // ------------------------------------------------------------------------

    /**
     * @dev Moves `amount` tokens from `from` to `to`.
     * Emits a {Transfer} event.
     */
    function _transfer(address from, address to, uint256 amount) internal virtual {
        require(to != address(0), "ATA: transfer to zero address");
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ATA: insufficient balance");
        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the `owner`'s tokens.
     * Emits an {Approval} event.
     */
    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "ATA: approve from zero address");
        require(spender != address(0), "ATA: approve to zero address");
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
}
