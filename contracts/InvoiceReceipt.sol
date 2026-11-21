// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title InvoiceReceipt
/// @notice Forwards cNGN from the agent wallet to a named recipient and stores the invoice receipt.
///         The agent address is fixed at deploy. Use the same wallet that registers ERC-8004.
contract InvoiceReceipt {
    struct Receipt {
        address recipient;
        uint256 usdtIn;
        uint256 cngnOut;
        bytes32 paymentTx;
        bytes32 swapTx;
        string recipientName;
        string clientName;
        uint64 settledAt;
    }

    address public immutable agent;

    mapping(bytes32 => Receipt) private _receipts;
    mapping(bytes32 => bool) public settled;
    mapping(bytes32 => bool) public usedPayment;

    event InvoiceSettled(
        bytes32 indexed invoiceId,
        address indexed recipient,
        address indexed agent,
        uint256 usdtIn,
        uint256 cngnOut,
        bytes32 paymentTx,
        bytes32 swapTx,
        string recipientName,
        string clientName
    );

    error NotAgent();
    error AlreadySettled();
    error PaymentUsed();
    error ZeroAddress();
    error NameLength();
    error Amount();
    error TransferFailed();

    constructor(address agent_) {
        if (agent_ == address(0)) revert ZeroAddress();
        agent = agent_;
    }

    function settle(
        bytes32 invoiceId,
        address cngn,
        address recipient,
        uint256 cngnOut,
        uint256 usdtIn,
        bytes32 paymentTx,
        bytes32 swapTx,
        string calldata recipientName,
        string calldata clientName
    ) external {
        if (msg.sender != agent) revert NotAgent();
        if (settled[invoiceId]) revert AlreadySettled();
        if (usedPayment[paymentTx]) revert PaymentUsed();
        if (recipient == address(0) || cngn == address(0)) revert ZeroAddress();
        if (cngnOut == 0 || usdtIn == 0) revert Amount();
        uint256 nameLen = bytes(recipientName).length;
        uint256 clientLen = bytes(clientName).length;
        if (nameLen == 0 || nameLen > 64 || clientLen == 0 || clientLen > 80) revert NameLength();

        settled[invoiceId] = true;
        usedPayment[paymentTx] = true;

        _transferFrom(cngn, msg.sender, recipient, cngnOut);

        _receipts[invoiceId] = Receipt({
            recipient: recipient,
            usdtIn: usdtIn,
            cngnOut: cngnOut,
            paymentTx: paymentTx,
            swapTx: swapTx,
            recipientName: recipientName,
            clientName: clientName,
            settledAt: uint64(block.timestamp)
        });

        emit InvoiceSettled(
            invoiceId,
            recipient,
            msg.sender,
            usdtIn,
            cngnOut,
            paymentTx,
            swapTx,
            recipientName,
            clientName
        );
    }

    function getReceipt(bytes32 invoiceId) external view returns (Receipt memory) {
        return _receipts[invoiceId];
    }

    /// @dev Accepts tokens that return bool and tokens that return nothing.
    function _transferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, amount)
        );
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
