// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockAggregatorV3 {
    uint8 public immutable decimals;
    string public description;
    uint256 public version = 1;
    int256 private answer;
    uint256 private updatedAt;

    constructor(uint8 _decimals, int256 _answer) {
        decimals = _decimals;
        description = "Mock feed";
        setAnswer(_answer);
    }

    function setAnswer(int256 _answer) public {
        answer = _answer;
        updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 latestAnswer, uint256 startedAt, uint256 latestUpdatedAt, uint80 answeredInRound)
    {
        return (1, answer, updatedAt, updatedAt, 1);
    }
}
