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

contract SmartAccount is Ownable, IAccount {
    using MessageHashUtils for bytes32;
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

    function updateEntrypoint(address entrypoint) public onlyOwner {
        i_entrypoint = IEntryPoint(entrypoint);
    }

    receive() external payable {}

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) private returns (uint256) {
        bytes32 ethSignedMessageHash = formatHash(userOpHash);
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

    function getUserOpDigest(
        bytes memory _calldata,
        address sender,
        uint256 senderNonce
    ) public view returns (bytes32, PackedUserOperation memory) {
        PackedUserOperation memory unSignedUserOp = generateUnSignedUserOp(
            _calldata,
            sender,
            senderNonce
        );
        bytes32 unsignedUserOpHash = i_entrypoint.getUserOpHash(unSignedUserOp);
        bytes32 digest = formatHash(unsignedUserOpHash);
        return (digest, unSignedUserOp);
    }

    function generateSignedUserOp(
        PackedUserOperation memory unSignedUserOp,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) public pure returns (PackedUserOperation memory) {
        PackedUserOperation memory signedUserOp = unSignedUserOp;
        signedUserOp.signature = abi.encodePacked(r, s, v);
        return signedUserOp;
    }

    function generateUnSignedUserOp(
        bytes memory _calldata,
        address sender,
        uint nonce
    ) public pure returns (PackedUserOperation memory) {
        uint128 verificationGasLimit = 16777216;
        uint128 callGasLimit = verificationGasLimit;
        uint128 maxPriorityFeePerGas = 256;
        uint128 maxFeePerGas = maxPriorityFeePerGas;

        return
            PackedUserOperation({
                callData: _calldata,
                accountGasLimits: bytes32(
                    (uint256(verificationGasLimit) << 128) | callGasLimit
                ),
                preVerificationGas: verificationGasLimit,
                gasFees: bytes32(
                    (uint256(maxPriorityFeePerGas) << 128) | maxFeePerGas
                ),
                initCode: hex"",
                sender: sender,
                nonce: nonce,
                signature: hex"",
                paymasterAndData: hex""
            });
    }

    function formatHash(
        bytes32 _hash
    ) public pure returns (bytes32 formattedHash) {
        formattedHash = _hash.toEthSignedMessageHash();
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
