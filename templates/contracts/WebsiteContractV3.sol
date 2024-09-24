// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.20;

import "@tw3/solidity/contracts/WebContract.sol";

contract MyWebContract is WebContract {

    constructor() WebContract(msg.sender) {}

}