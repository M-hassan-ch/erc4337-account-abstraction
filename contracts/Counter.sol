// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract Counter {
    event ValueUpdated(address, uint);
    uint public value;

    function updateTo(uint newValue) public {
        value = newValue;
        emit ValueUpdated(msg.sender, newValue);
    }
}
