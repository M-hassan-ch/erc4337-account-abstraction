// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {EntryPoint} from "@account-abstraction/contracts/core/EntryPoint.sol";

contract SampleEntryPoint is EntryPoint{
    // inheriting all the logic from the parent contract
    constructor() EntryPoint()  {
    }
}