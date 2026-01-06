// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GridValidator
 * @notice Validates energy transactions against grid constraints
 * @dev Simplified version for PoC - validates physical feasibility of energy trades
 */
contract GridValidator is Ownable {
    // ============ Structs ============

    /**
     * @notice Represents grid capacity limits for a line
     * @param lineId Identifier of the grid line
     * @param maxCapacity Maximum capacity in Wh
     * @param currentLoad Current load on the line
     * @param isActive Whether the line is operational
     */
    struct GridLine {
        string lineId;
        uint256 maxCapacity;
        uint256 currentLoad;
        bool isActive;
    }

    /**
     * @notice Represents a prosumer's generation capacity
     * @param prosumer Address of the prosumer
     * @param maxGeneration Maximum generation capacity in Wh
     * @param currentGeneration Current generation reading
     */
    struct ProsumerCapacity {
        address prosumer;
        uint256 maxGeneration;
        uint256 currentGeneration;
    }

    // ============ Events ============

    event GridLineAdded(string indexed lineId, uint256 maxCapacity);
    event GridLineUpdated(string indexed lineId, uint256 newLoad);
    event ProsumerRegistered(address indexed prosumer, uint256 maxGeneration);
    event ValidationPassed(address indexed prosumer, uint256 amount, string lineId);
    event ValidationFailed(address indexed prosumer, uint256 amount, string reason);

    // ============ State Variables ============

    /// @notice Mapping of line ID to grid line info
    mapping(string => GridLine) public gridLines;

    /// @notice Mapping of prosumer address to capacity info
    mapping(address => ProsumerCapacity) public prosumerCapacities;

    /// @notice List of all line IDs
    string[] public lineIds;

    /// @notice Default grid line for validation
    string public defaultLineId;

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        // Initialize with a default grid line
        defaultLineId = "LINE001";
        gridLines[defaultLineId] = GridLine({
            lineId: defaultLineId,
            maxCapacity: 1000000, // 1 MWh default capacity
            currentLoad: 0,
            isActive: true
        });
        lineIds.push(defaultLineId);

        emit GridLineAdded(defaultLineId, 1000000);
    }

    // ============ Grid Management ============

    /**
     * @notice Add a new grid line
     * @param lineId Identifier for the line
     * @param maxCapacity Maximum capacity in Wh
     */
    function addGridLine(string calldata lineId, uint256 maxCapacity) external onlyOwner {
        require(bytes(lineId).length > 0, "Invalid line ID");
        require(maxCapacity > 0, "Invalid capacity");
        require(!gridLines[lineId].isActive, "Line already exists");

        gridLines[lineId] = GridLine({
            lineId: lineId,
            maxCapacity: maxCapacity,
            currentLoad: 0,
            isActive: true
        });

        lineIds.push(lineId);
        emit GridLineAdded(lineId, maxCapacity);
    }

    /**
     * @notice Update current load on a grid line
     * @param lineId Identifier of the line
     * @param newLoad New load value
     */
    function updateGridLoad(string calldata lineId, uint256 newLoad) external onlyOwner {
        require(gridLines[lineId].isActive, "Line not active");
        gridLines[lineId].currentLoad = newLoad;
        emit GridLineUpdated(lineId, newLoad);
    }

    /**
     * @notice Set the default grid line for validation
     * @param lineId Identifier of the line to set as default
     */
    function setDefaultLine(string calldata lineId) external onlyOwner {
        require(gridLines[lineId].isActive, "Line not active");
        defaultLineId = lineId;
    }

    // ============ Prosumer Management ============

    /**
     * @notice Register a prosumer with generation capacity
     * @param prosumer Address of the prosumer
     * @param maxGeneration Maximum generation capacity
     */
    function registerProsumer(address prosumer, uint256 maxGeneration) external onlyOwner {
        require(prosumer != address(0), "Invalid address");
        require(maxGeneration > 0, "Invalid capacity");

        prosumerCapacities[prosumer] = ProsumerCapacity({
            prosumer: prosumer,
            maxGeneration: maxGeneration,
            currentGeneration: 0
        });

        emit ProsumerRegistered(prosumer, maxGeneration);
    }

    /**
     * @notice Update prosumer's current generation reading
     * @param prosumer Address of the prosumer
     * @param currentGeneration Current generation value from oracle
     */
    function updateProsumerGeneration(address prosumer, uint256 currentGeneration) external {
        require(prosumerCapacities[prosumer].prosumer != address(0), "Prosumer not registered");
        prosumerCapacities[prosumer].currentGeneration = currentGeneration;
    }

    // ============ Validation Functions ============

    /**
     * @notice Validate if an energy trade is physically feasible
     * @param prosumer Address of the prosumer selling energy
     * @param amount Amount of energy to trade (Wh)
     * @param lineId Grid line to use (empty for default)
     * @return isValid Whether the trade is valid
     * @return reason Reason if invalid
     */
    function validateTrade(
        address prosumer,
        uint256 amount,
        string calldata lineId
    ) external view returns (bool isValid, string memory reason) {
        string memory line;
        if (bytes(lineId).length > 0) {
            line = lineId;
        } else {
            line = defaultLineId;
        }

        // Check grid line is active
        if (!gridLines[line].isActive) {
            return (false, "Grid line not active");
        }

        // Check grid capacity
        GridLine memory gridLine = gridLines[line];
        if (gridLine.currentLoad + amount > gridLine.maxCapacity) {
            return (false, "Exceeds grid capacity");
        }

        // Check prosumer is registered
        ProsumerCapacity memory capacity = prosumerCapacities[prosumer];
        if (capacity.prosumer == address(0)) {
            // If prosumer not registered, allow trade (simplified for PoC)
            return (true, "");
        }

        // Check generation capacity
        if (amount > capacity.currentGeneration) {
            return (false, "Exceeds generation capacity");
        }

        // Check doesn't exceed max generation
        if (amount > capacity.maxGeneration) {
            return (false, "Exceeds maximum generation");
        }

        return (true, "");
    }

    /**
     * @notice Validate and record a trade (updates load)
     * @param prosumer Address of the prosumer
     * @param amount Amount of energy traded
     * @param lineId Grid line used
     * @return success Whether validation passed
     */
    function validateAndRecordTrade(
        address prosumer,
        uint256 amount,
        string calldata lineId
    ) external returns (bool success) {
        (bool isValid, string memory reason) = this.validateTrade(prosumer, amount, lineId);

        if (!isValid) {
            emit ValidationFailed(prosumer, amount, reason);
            return false;
        }

        // Update grid load
        string memory line;
        if (bytes(lineId).length > 0) {
            line = lineId;
        } else {
            line = defaultLineId;
        }
        gridLines[line].currentLoad += amount;

        emit ValidationPassed(prosumer, amount, line);
        return true;
    }

    // ============ View Functions ============

    /**
     * @notice Get grid line information
     * @param lineId Identifier of the line
     * @return GridLine struct
     */
    function getGridLine(string calldata lineId) external view returns (GridLine memory) {
        return gridLines[lineId];
    }

    /**
     * @notice Get prosumer capacity information
     * @param prosumer Address of the prosumer
     * @return ProsumerCapacity struct
     */
    function getProsumerCapacity(address prosumer) external view returns (ProsumerCapacity memory) {
        return prosumerCapacities[prosumer];
    }

    /**
     * @notice Get available capacity on a grid line
     * @param lineId Identifier of the line
     * @return available Available capacity in Wh
     */
    function getAvailableCapacity(string calldata lineId) external view returns (uint256 available) {
        GridLine memory line = gridLines[lineId];
        if (!line.isActive || line.currentLoad >= line.maxCapacity) {
            return 0;
        }
        return line.maxCapacity - line.currentLoad;
    }

    /**
     * @notice Get all line IDs
     * @return Array of line IDs
     */
    function getAllLines() external view returns (string[] memory) {
        return lineIds;
    }
}

