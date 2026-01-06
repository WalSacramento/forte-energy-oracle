// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOracleAggregator
 * @notice Interface for the Energy-Aware Oracle Network Aggregator
 * @dev Defines the public interface for oracle registration, data requests, and aggregation
 */
interface IOracleAggregator {
    // ============ Structs ============

    /**
     * @notice Represents an oracle node in the network
     * @param nodeAddress The Ethereum address of the oracle
     * @param reputation Current reputation score (0-100)
     * @param isActive Whether the oracle is currently active
     * @param totalResponses Total number of responses submitted
     * @param validResponses Number of valid (non-outlier) responses
     */
    struct OracleNode {
        address nodeAddress;
        uint256 reputation;
        bool isActive;
        uint256 totalResponses;
        uint256 validResponses;
    }

    /**
     * @notice Represents a data request
     * @param id Unique identifier for the request
     * @param meterId Identifier of the smart meter
     * @param createdAt Timestamp when request was created
     * @param deadline Timestamp after which responses are not accepted
     * @param status Current status (0: Pending, 1: Aggregating, 2: Completed, 3: Failed)
     * @param responseCount Number of responses received
     * @param aggregatedValue Final aggregated value after consensus
     */
    struct DataRequest {
        uint256 id;
        string meterId;
        uint256 createdAt;
        uint256 deadline;
        uint8 status;
        uint256 responseCount;
        uint256 aggregatedValue;
    }

    /**
     * @notice Represents an oracle response
     * @param oracle Address of the responding oracle
     * @param value The reported meter reading
     * @param timestamp When the response was submitted
     * @param isOutlier Whether this response was flagged as an outlier
     */
    struct OracleResponse {
        address oracle;
        uint256 value;
        uint256 timestamp;
        bool isOutlier;
    }

    // ============ Events ============

    /**
     * @notice Emitted when a new oracle is registered
     * @param oracle Address of the registered oracle
     */
    event OracleRegistered(address indexed oracle);

    /**
     * @notice Emitted when an oracle is removed
     * @param oracle Address of the removed oracle
     */
    event OracleRemoved(address indexed oracle);

    /**
     * @notice Emitted when a new data request is created
     * @param requestId Unique identifier for the request
     * @param meterId Identifier of the smart meter
     * @param deadline Timestamp after which responses are not accepted
     */
    event DataRequested(uint256 indexed requestId, string meterId, uint256 deadline);

    /**
     * @notice Emitted when an oracle submits a response
     * @param requestId ID of the request being responded to
     * @param oracle Address of the responding oracle
     * @param value The reported meter reading
     */
    event ResponseSubmitted(uint256 indexed requestId, address indexed oracle, uint256 value);

    /**
     * @notice Emitted when data is aggregated and finalized
     * @param requestId ID of the completed request
     * @param aggregatedValue Final aggregated value
     * @param responseCount Number of responses used in aggregation
     */
    event DataAggregated(uint256 indexed requestId, uint256 aggregatedValue, uint256 responseCount);

    /**
     * @notice Emitted when an outlier is detected
     * @param requestId ID of the request
     * @param oracle Address of the oracle that submitted the outlier
     * @param value The outlier value
     */
    event OutlierDetected(uint256 indexed requestId, address indexed oracle, uint256 value);

    /**
     * @notice Emitted when an oracle's reputation is updated
     * @param oracle Address of the oracle
     * @param newReputation Updated reputation score
     */
    event ReputationUpdated(address indexed oracle, uint256 newReputation);

    // ============ Functions ============

    /**
     * @notice Register a new oracle node
     * @param oracle Address of the oracle to register
     */
    function registerOracle(address oracle) external;

    /**
     * @notice Remove an oracle from the network
     * @param oracle Address of the oracle to remove
     */
    function removeOracle(address oracle) external;

    /**
     * @notice Create a new data request
     * @param meterId Identifier of the smart meter to query
     * @return requestId Unique identifier for the created request
     */
    function requestData(string calldata meterId) external returns (uint256 requestId);

    /**
     * @notice Submit an oracle response
     * @param requestId ID of the request to respond to
     * @param value The meter reading value
     * @param signature ECDSA signature of the response
     */
    function submitResponse(uint256 requestId, uint256 value, bytes calldata signature) external;

    /**
     * @notice Get request details
     * @param requestId ID of the request
     * @return Request struct with all details
     */
    function getRequest(uint256 requestId) external view returns (DataRequest memory);

    /**
     * @notice Get oracle information
     * @param oracle Address of the oracle
     * @return OracleNode struct with all details
     */
    function getOracleInfo(address oracle) external view returns (OracleNode memory);

    /**
     * @notice Get the number of active oracles
     * @return count Number of active oracles
     */
    function getActiveOracleCount() external view returns (uint256 count);

    /**
     * @notice Get responses for a request
     * @param requestId ID of the request
     * @return Array of OracleResponse structs
     */
    function getResponses(uint256 requestId) external view returns (OracleResponse[] memory);
}

