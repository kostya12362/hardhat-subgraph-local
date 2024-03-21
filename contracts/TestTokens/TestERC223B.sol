//  pragma solidity ^0.7.6;

// import "@openzeppelin/contracts/access/Ownable.sol";
// import "../ERC223/IERC223.sol";
// import "../ERC223/IERC223Recipient.sol";
// import "../utils/Address.sol";

// /**
//  * @title Reference implementation of the ERC223 standard token.
//  */
// contract ERC223Token is IERC223, Ownable {

//     string  private _name;
//     string  private _symbol;
//     uint8   private _decimals;
//     uint256 private _totalSupply;

//     mapping(address => uint256) public balances; // List of user balances.

//     /**
//      * @dev Sets the values for {name} and {symbol}, initializes {decimals} with
//      * a default value of 18.
//      *
//      * To select a different value for {decimals}, use {_setupDecimals}.
//      *
//      * All three of these values are immutable: they can only be set once during
//      * construction.
//      */

//     constructor()
//     {
//         _name     = "Test ERC-223 B";
//         _symbol   = "Test223 B";
//         _decimals = 6;
//         balances[msg.sender] = 10000 * 1e6;
//     }

//     /**
//      * @dev Returns the name of the token.
//      */
//     function name() public view virtual override returns (string memory)
//     {
//         return _name;
//     }

//     /**
//      * @dev Returns the symbol of the token, usually a shorter version of the
//      * name.
//      */
//     function symbol() public view virtual override returns (string memory)
//     {
//         return _symbol;
//     }

//     /**
//      * @dev Returns the number of decimals used to get its user representation.
//      * For example, if `decimals` equals `2`, a balance of `505` tokens should
//      * be displayed to a user as `5,05` (`505 / 10 ** 2`).
//      *
//      * Tokens usually opt for a value of 18, imitating the relationship between
//      * Ether and Wei. This is the value {ERC223} uses, unless {_setupDecimals} is
//      * called.
//      *
//      * NOTE: This information is only used for _display_ purposes: it in
//      * no way affects any of the arithmetic of the contract, including
//      * {IERC223-balanceOf} and {IERC223-transfer}.
//      */
//     function decimals() public view virtual override returns (uint8)
//     {
//         return _decimals;
//     }

//     /**
//      * @dev See {IERC223-totalSupply}.
//      */
//     function totalSupply() public view override returns (uint256)
//     {
//         return _totalSupply;
//     }


//     /**
//      * @dev Returns balance of the `_owner`.
//      *
//      * @param _owner   The address whose balance will be returned.
//      * @return balance Balance of the `_owner`.
//      */
//     function balanceOf(address _owner) public view override returns (uint256)
//     {
//         return balances[_owner];
//     }

//     /**
//      * @dev Transfer the specified amount of tokens to the specified address.
//      *      Invokes the `tokenFallback` function if the recipient is a contract.
//      *      The token transfer fails if the recipient is a contract
//      *      but does not implement the `tokenFallback` function
//      *      or the fallback function to receive funds.
//      *
//      * @param _to    Receiver address.
//      * @param _value Amount of tokens that will be transferred.
//      * @param _data  Transaction metadata.
//      */
//     function transfer(address _to, uint _value, bytes calldata _data) public override returns (bool success)
//     {
//         // Standard function transfer similar to ERC20 transfer with no _data .
//         // Added due to backwards compatibility reasons .
//         balances[msg.sender] = balances[msg.sender] - _value;
//         balances[_to] = balances[_to] + _value;
//         if(Address.isContract(_to)) {
//             // It is subjective if the contract call must fail or not
//             // when ERC-223 token transfer does not trigger the `tokenReceived` function
//             // by the standard if the receiver did not explicitly rejected the call
//             // the transfer can be considered valid.
//             IERC223Recipient(_to).tokenReceived(msg.sender, _value, _data);
//         }
//         emit Transfer(msg.sender, _to, _value, _data);
//         return true;
//     }



//     /**
//      * @dev Transfer the specified amount of tokens to the specified address.
//      *      This function works the same with the previous one
//      *      but doesn't contain `_data` param.
//      *      Added due to backwards compatibility reasons.
//      *
//      * @param _to    Receiver address.
//      * @param _value Amount of tokens that will be transferred.
//      */
//     function transfer(address _to, uint _value) public override returns (bool success)
//     {
//         bytes memory _empty = hex"00000000";
//         balances[msg.sender] = balances[msg.sender] - _value;
//         balances[_to] = balances[_to] + _value;
//         if(Address.isContract(_to)) {
//             IERC223Recipient(_to).tokenReceived(msg.sender, _value, _empty);
//         }
//         emit Transfer(msg.sender, _to, _value, _empty);
//         return true;
//     }

//     function mint(address to, uint256 amount) public onlyOwner {
//         require(to != address(0), "ERC223Token: mint to the zero address");

//         _beforeTokenTransfer(address(0), to, amount);

//         _totalSupply += amount;
//         balances[to] += amount;

//         emit Transfer(address(0), to, amount, "");

//         _afterTokenTransfer(address(0), to, amount);
//     }

//     // Остальные функции контракта...
//     function _afterTokenTransfer(address from, address to, uint256 amount) internal virtual { }
//     function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual { }

// }
