// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./interfaces/IOracleAggregator.sol";

/**
 * @title OracleAggregator
 * @notice Multi-oracle aggregator for Energy-Aware Oracle Network (EAON)
 * @dev Implements median-based consensus with outlier detection and reputation system
 */
contract OracleAggregator is IOracleAggregator, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Constants ============

    uint256 public constant INITIAL_REPUTATION = 70;
    uint256 public constant MAX_REPUTATION = 100;
    uint256 public constant REWARD_AMOUNT = 1;
    uint256 public constant PENALTY_AMOUNT = 5;

    // Request status enum values
    uint8 public constant STATUS_PENDING = 0;
    uint8 public constant STATUS_AGGREGATING = 1;
    uint8 public constant STATUS_COMPLETED = 2;
    uint8 public constant STATUS_FAILED = 3;

    // ============ State Variables ============

    /// @notice Minimum number of responses required for aggregation
    uint256 public minResponses;

    /// @notice Outlier detection threshold (percentage)
    uint256 public outlierThreshold;

    /// @notice Default deadline for requests (seconds)
    uint256 public requestDeadline;

    /// @notice Counter for request IDs
    uint256 public requestCounter;

    /// @notice Mapping of oracle addresses to their info
    mapping(address => OracleNode) public oracles;

    /// @notice List of all registered oracle addresses
    address[] public oracleList;

    /// @notice Mapping of request ID to request details
    mapping(uint256 => DataRequest) public requests;

    /// @notice Mapping of request ID to array of responses
    mapping(uint256 => OracleResponse[]) public responses;

    /// @notice Mapping to track if oracle has responded to a request
    mapping(uint256 => mapping(address => bool)) public hasResponded;

    /// @notice Mapping to track if reputation has been processed for a response
    mapping(uint256 => mapping(address => bool)) private reputationProcessed;

    /// @notice Authorized callers (contracts that can request data)
    mapping(address => bool) public authorizedCallers;

    // ============ Constructor ============

    /**
     * @notice Initialize the OracleAggregator
     * @param _minResponses Minimum responses required for aggregation
     * @param _outlierThreshold Percentage threshold for outlier detection
     * @param _requestDeadline Default deadline in seconds
     */
    constructor(
        uint256 _minResponses,
        uint256 _outlierThreshold,
        uint256 _requestDeadline
    ) Ownable(msg.sender) {
        require(_minResponses >= 2, "Min responses must be >= 2");
        require(_outlierThreshold > 0 && _outlierThreshold <= 100, "Invalid threshold");
        require(_requestDeadline > 0, "Invalid deadline");

        minResponses = _minResponses;
        outlierThreshold = _outlierThreshold;
        requestDeadline = _requestDeadline;
    }

    // ============ Modifiers ============

    modifier onlyActiveOracle() {
        require(oracles[msg.sender].isActive, "Not an active oracle");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner() || authorizedCallers[msg.sender],
            "Not authorized"
        );
        _;
    }

    // ============ Oracle Management ============

    /**
     * @notice Register a new oracle node
     * @param oracle Address of the oracle to register
     */
    function registerOracle(address oracle) external override onlyOwner {
        require(oracle != address(0), "Invalid address");
        require(!oracles[oracle].isActive, "Already registered");

        oracles[oracle] = OracleNode({
            nodeAddress: oracle,
            reputation: INITIAL_REPUTATION,
            isActive: true,
            totalResponses: 0,
            validResponses: 0
        });

        oracleList.push(oracle);
        emit OracleRegistered(oracle);
    }

    /**
     * @notice Remove an oracle from the network
     * @param oracle Address of the oracle to remove
     */
    function removeOracle(address oracle) external override onlyOwner {
        require(oracles[oracle].isActive, "Oracle not active");

        oracles[oracle].isActive = false;
        emit OracleRemoved(oracle);
    }

    /**
     * @notice Authorize a contract to request data
     * @param caller Address of the contract to authorize
     */
    function authorizeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = true;
    }

    /**
     * @notice Revoke authorization from a contract
     * @param caller Address of the contract to revoke
     */
    function revokeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = false;
    }

    // ============ Data Request Functions ============

    /**
     * @notice Create a new data request
     * @param meterId Identifier of the smart meter to query
     * @return requestId Unique identifier for the created request
     */
    function requestData(string calldata meterId) external override onlyAuthorized returns (uint256) {
        require(getActiveOracleCount() >= minResponses, "Not enough oracles");

        requestCounter++;
        uint256 requestId = requestCounter;

        requests[requestId] = DataRequest({
            id: requestId,
            meterId: meterId,
            createdAt: block.timestamp,
            deadline: block.timestamp + requestDeadline,
            status: STATUS_PENDING,
            responseCount: 0,
            aggregatedValue: 0
        });

        emit DataRequested(requestId, meterId, requests[requestId].deadline);
        return requestId;
    }

    /**
     * @notice Submit an oracle response
     * @param requestId ID of the request to respond to
     * @param value The meter reading value
     * @param signature ECDSA signature of the response
     */
    function submitResponse(
        uint256 requestId,
        uint256 value,
        bytes calldata signature
    ) external override onlyActiveOracle {
        DataRequest storage request = requests[requestId];

        require(request.id != 0, "Request does not exist");
        require(request.status != STATUS_FAILED, "Request failed");
        require(block.timestamp <= request.deadline, "Deadline passed");
        require(!hasResponded[requestId][msg.sender], "Already responded");

        // Allow late responses for reputation tracking even after completion
        bool isLateResponse = (request.status == STATUS_COMPLETED);

        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(requestId, value));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);
        require(signer == msg.sender, "Invalid signature");

        // Record response
        hasResponded[requestId][msg.sender] = true;

        if (isLateResponse) {
            // Handle late response after initial aggregation
            responses[requestId].push(OracleResponse({
                oracle: msg.sender,
                value: value,
                timestamp: block.timestamp,
                isOutlier: false
            }));

            request.responseCount++;
            emit ResponseSubmitted(requestId, msg.sender, value);

            // Re-aggregate with all responses including the late one
            _aggregate(requestId);
        } else {
            // Normal response before aggregation
            responses[requestId].push(OracleResponse({
                oracle: msg.sender,
                value: value,
                timestamp: block.timestamp,
                isOutlier: false
            }));

            request.responseCount++;
            request.status = STATUS_AGGREGATING;

            emit ResponseSubmitted(requestId, msg.sender, value);

            // Aggregate when minimum responses received
            if (request.responseCount >= minResponses) {
                _aggregate(requestId);
            }
        }
    }

    // ============ Aggregation Functions ============

    /**
     * @notice Perform aggregation on collected responses
     * @param requestId ID of the request to aggregate
     */
    function _aggregate(uint256 requestId) internal {
        DataRequest storage request = requests[requestId];
        OracleResponse[] storage resps = responses[requestId];

        uint256 count = resps.length;
        require(count >= minResponses, "Not enough responses");

        // Extract values and sort for median calculation
        uint256[] memory values = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            values[i] = resps[i].value;
        }
        _quickSort(values, 0, int256(count - 1));

        // Calculate median
        uint256 median;
        if (count % 2 == 0) {
            median = (values[count / 2 - 1] + values[count / 2]) / 2;
        } else {
            median = values[count / 2];
        }

        // Identify outliers and calculate final value
        uint256 validSum = 0;
        uint256 validCount = 0;

        for (uint256 i = 0; i < count; i++) {
            uint256 deviation = _calculateDeviation(resps[i].value, median);

            if (deviation > outlierThreshold) {
                // Mark as outlier
                resps[i].isOutlier = true;
                emit OutlierDetected(requestId, resps[i].oracle, resps[i].value);

                // Only process reputation if not already processed
                if (!reputationProcessed[requestId][resps[i].oracle]) {
                    _penalizeOracle(resps[i].oracle);
                    reputationProcessed[requestId][resps[i].oracle] = true;
                }
            } else {
                // Valid response
                validSum += resps[i].value;
                validCount++;

                // Only process reputation if not already processed
                if (!reputationProcessed[requestId][resps[i].oracle]) {
                    _rewardOracle(resps[i].oracle);
                    reputationProcessed[requestId][resps[i].oracle] = true;
                }
            }
        }

        // Calculate final aggregated value (mean of valid responses)
        uint256 aggregatedValue = validCount > 0 ? validSum / validCount : median;

        request.aggregatedValue = aggregatedValue;
        request.status = STATUS_COMPLETED;

        emit DataAggregated(requestId, aggregatedValue, validCount);
    }

    /**
     * @notice Calculate percentage deviation from median
     * @param value The value to check
     * @param median The median value
     * @return deviation Percentage deviation
     */
    function _calculateDeviation(uint256 value, uint256 median) internal pure returns (uint256) {
        if (median == 0) return 0;
        if (value > median) {
            return ((value - median) * 100) / median;
        } else {
            return ((median - value) * 100) / median;
        }
    }

    /**
     * @notice QuickSort implementation for on-chain sorting
     */
    function _quickSort(uint256[] memory arr, int256 left, int256 right) internal pure {
        int256 i = left;
        int256 j = right;
        if (i >= j) return;

        uint256 pivot = arr[uint256(left + (right - left) / 2)];
        while (i <= j) {
            while (arr[uint256(i)] < pivot) i++;
            while (pivot < arr[uint256(j)]) j--;
            if (i <= j) {
                (arr[uint256(i)], arr[uint256(j)]) = (arr[uint256(j)], arr[uint256(i)]);
                i++;
                j--;
            }
        }
        if (left < j) _quickSort(arr, left, j);
        if (i < right) _quickSort(arr, i, right);
    }

    // ============ Reputation Functions ============

    /**
     * @notice Reward an oracle for a valid response
     * @param oracle Address of the oracle to reward
     */
    function _rewardOracle(address oracle) internal {
        OracleNode storage node = oracles[oracle];
        node.totalResponses++;
        node.validResponses++;

        if (node.reputation + REWARD_AMOUNT <= MAX_REPUTATION) {
            node.reputation += REWARD_AMOUNT;
        } else {
            node.reputation = MAX_REPUTATION;
        }

        emit ReputationUpdated(oracle, node.reputation);
    }

    /**
     * @notice Penalize an oracle for an outlier response
     * @param oracle Address of the oracle to penalize
     */
    function _penalizeOracle(address oracle) internal {
        OracleNode storage node = oracles[oracle];
        node.totalResponses++;

        if (node.reputation >= PENALTY_AMOUNT) {
            node.reputation -= PENALTY_AMOUNT;
        } else {
            node.reputation = 0;
        }

        // Automatically deactivate oracle if reputation reaches 0
        if (node.reputation == 0) {
            node.isActive = false;
            emit OracleRemoved(oracle);
        }

        emit ReputationUpdated(oracle, node.reputation);
    }

    // ============ View Functions ============

    /**
     * @notice Get request details
     * @param requestId ID of the request
     * @return Request struct with all details
     */
    function getRequest(uint256 requestId) external view override returns (DataRequest memory) {
        return requests[requestId];
    }

    /**
     * @notice Get oracle information
     * @param oracle Address of the oracle
     * @return OracleNode struct with all details
     */
    function getOracleInfo(address oracle) external view override returns (OracleNode memory) {
        return oracles[oracle];
    }

    /**
     * @notice Get the number of active oracles
     * @return count Number of active oracles
     */
    function getActiveOracleCount() public view override returns (uint256 count) {
        for (uint256 i = 0; i < oracleList.length; i++) {
            if (oracles[oracleList[i]].isActive) {
                count++;
            }
        }
    }

    /**
     * @notice Get responses for a request
     * @param requestId ID of the request
     * @return Array of OracleResponse structs
     */
    function getResponses(uint256 requestId) external view override returns (OracleResponse[] memory) {
        return responses[requestId];
    }

    /**
     * @notice Get all registered oracle addresses
     * @return Array of oracle addresses
     */
    function getAllOracles() external view returns (address[] memory) {
        return oracleList;
    }

    /**
     * @notice Force aggregation after deadline (for cleanup)
     * @param requestId ID of the request to finalize
     */
    function finalizeRequest(uint256 requestId) external {
        DataRequest storage request = requests[requestId];

        require(request.id != 0, "Request does not exist");
        require(block.timestamp > request.deadline, "Deadline not passed");
        require(request.status == STATUS_PENDING || request.status == STATUS_AGGREGATING, "Already finalized");

        if (request.responseCount >= minResponses) {
            _aggregate(requestId);
        } else {
            request.status = STATUS_FAILED;
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Update configuration parameters
     * @param _minResponses New minimum responses
     * @param _outlierThreshold New outlier threshold
     * @param _requestDeadline New request deadline
     */
    function updateConfig(
        uint256 _minResponses,
        uint256 _outlierThreshold,
        uint256 _requestDeadline
    ) external onlyOwner {
        require(_minResponses >= 2, "Min responses must be >= 2");
        require(_outlierThreshold > 0 && _outlierThreshold <= 100, "Invalid threshold");
        require(_requestDeadline > 0, "Invalid deadline");

        minResponses = _minResponses;
        outlierThreshold = _outlierThreshold;
        requestDeadline = _requestDeadline;
    }
}

