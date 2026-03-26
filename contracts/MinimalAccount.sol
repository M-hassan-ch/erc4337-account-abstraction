// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {
    IEntryPoint
} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {
    PackedUserOperation
} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {
    MessageHashUtils
} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {
    SIG_VALIDATION_FAILED,
    SIG_VALIDATION_SUCCESS
} from "@account-abstraction/contracts/core/Helpers.sol";

contract MinimalAccount is Ownable, IAccount {
    IEntryPoint public i_entrypoint;

    constructor(address entrypoint) Ownable(msg.sender) {
        i_entrypoint = IEntryPoint(entrypoint);
    }

    function execute(
        address dest,
        uint256 value,
        bytes calldata functionData
    ) external {
        _requireFromEntrypointOrOwner();

        (bool success, ) = dest.call{value: value}(functionData);
        require(success, "execute call failed");
    }

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        _requireFromEntrypoint();
        validationData = _validateSignature(userOp, userOpHash);
        _payPreFund(missingAccountFunds);
        return 0;
    }

    function updateEntrypoint(address entrypoint) public onlyOwner() {
        i_entrypoint = IEntryPoint(entrypoint);
    }

    receive() external payable{}

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) private returns (uint256) {
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(
            userOpHash
        );
        address signer = ECDSA.recover(ethSignedMessageHash, userOp.signature);
        if (signer != owner()) {
            return SIG_VALIDATION_FAILED;
        }
        return SIG_VALIDATION_SUCCESS;
    }

    function _payPreFund(uint amount) private {
        if (amount != 0) {
            (bool success, ) = payable(msg.sender).call{
                value: amount,
                gas: type(uint256).max
            }("");
        }
    }

    function _requireFromEntrypoint() private {
        require(
            msg.sender == address(i_entrypoint),
            "Caller is not a valid entrypint"
        );
    }

    function _requireFromEntrypointOrOwner() private {
        require(
            msg.sender == address(i_entrypoint) || msg.sender == owner(),
            "Caller is not a valid entrypint"
        );
    }
}
