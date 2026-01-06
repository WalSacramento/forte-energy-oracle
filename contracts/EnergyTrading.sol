// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IOracleAggregator.sol";
import "./GridValidator.sol";

/**
 * @title EnergyTrading
 * @notice Simplified P2P energy trading contract for EAON PoC
 * @dev Integrates with OracleAggregator for meter readings and GridValidator for feasibility checks
 */
contract EnergyTrading is Ownable, ReentrancyGuard {
    // ============ Structs ============

    /**
     * @notice Represents an energy offer
     * @param id Unique offer identifier
     * @param seller Address of the prosumer selling energy
     * @param meterId Smart meter identifier
     * @param amount Amount of energy offered (Wh)
     * @param pricePerWh Price per Wh in wei
     * @param createdAt Timestamp of offer creation
     * @param expiresAt Expiration timestamp
     * @param status Offer status (0: Active, 1: Filled, 2: Cancelled, 3: Expired)
     * @param validatedReading Oracle-validated meter reading
     * @param requestId Oracle request ID for validation
     */
    struct Offer {
        uint256 id;
        address seller;
        string meterId;
        uint256 amount;
        uint256 pricePerWh;
        uint256 createdAt;
        uint256 expiresAt;
        uint8 status;
        uint256 validatedReading;
        uint256 requestId;
    }

    /**
     * @notice Represents a completed trade
     * @param id Unique trade identifier
     * @param offerId Associated offer ID
     * @param buyer Address of the buyer
     * @param amount Amount traded (Wh)
     * @param totalPrice Total price paid (wei)
     * @param timestamp Trade timestamp
     */
    struct Trade {
        uint256 id;
        uint256 offerId;
        address buyer;
        uint256 amount;
        uint256 totalPrice;
        uint256 timestamp;
    }

    // Status constants
    uint8 public constant STATUS_ACTIVE = 0;
    uint8 public constant STATUS_FILLED = 1;
    uint8 public constant STATUS_CANCELLED = 2;
    uint8 public constant STATUS_EXPIRED = 3;

    // ============ Events ============

    event OfferCreated(
        uint256 indexed offerId,
        address indexed seller,
        string meterId,
        uint256 amount,
        uint256 pricePerWh
    );

    event OfferValidated(
        uint256 indexed offerId,
        uint256 requestId,
        uint256 validatedReading
    );

    event OfferCancelled(uint256 indexed offerId);

    event TradeExecuted(
        uint256 indexed tradeId,
        uint256 indexed offerId,
        address indexed buyer,
        uint256 amount,
        uint256 totalPrice
    );

    event ValidationRequested(uint256 indexed offerId, uint256 requestId);

    // ============ State Variables ============

    /// @notice Reference to the OracleAggregator contract
    IOracleAggregator public oracleAggregator;

    /// @notice Reference to the GridValidator contract
    GridValidator public gridValidator;

    /// @notice Counter for offer IDs
    uint256 public offerCounter;

    /// @notice Counter for trade IDs
    uint256 public tradeCounter;

    /// @notice Mapping of offer ID to offer details
    mapping(uint256 => Offer) public offers;

    /// @notice Mapping of trade ID to trade details
    mapping(uint256 => Trade) public trades;

    /// @notice Mapping of oracle request ID to offer ID
    mapping(uint256 => uint256) public requestToOffer;

    /// @notice Mapping of seller to their active offers
    mapping(address => uint256[]) public sellerOffers;

    /// @notice Default offer duration in seconds
    uint256 public defaultOfferDuration = 1 hours;

    // ============ Constructor ============

    /**
     * @notice Initialize the EnergyTrading contract
     * @param _oracleAggregator Address of the OracleAggregator contract
     * @param _gridValidator Address of the GridValidator contract
     */
    constructor(
        address _oracleAggregator,
        address _gridValidator
    ) Ownable(msg.sender) {
        require(_oracleAggregator != address(0), "Invalid oracle address");
        require(_gridValidator != address(0), "Invalid validator address");

        oracleAggregator = IOracleAggregator(_oracleAggregator);
        gridValidator = GridValidator(_gridValidator);
    }

    // ============ Offer Management ============

    /**
     * @notice Create a new energy offer
     * @param meterId Smart meter identifier
     * @param amount Amount of energy to sell (Wh)
     * @param pricePerWh Price per Wh in wei
     * @param duration Offer duration in seconds (0 for default)
     * @return offerId The created offer ID
     */
    function createOffer(
        string calldata meterId,
        uint256 amount,
        uint256 pricePerWh,
        uint256 duration
    ) external returns (uint256 offerId) {
        require(bytes(meterId).length > 0, "Invalid meter ID");
        require(amount > 0, "Amount must be > 0");
        require(pricePerWh > 0, "Price must be > 0");

        offerCounter++;
        offerId = offerCounter;

        uint256 offerDuration = duration > 0 ? duration : defaultOfferDuration;

        offers[offerId] = Offer({
            id: offerId,
            seller: msg.sender,
            meterId: meterId,
            amount: amount,
            pricePerWh: pricePerWh,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + offerDuration,
            status: STATUS_ACTIVE,
            validatedReading: 0,
            requestId: 0
        });

        sellerOffers[msg.sender].push(offerId);

        emit OfferCreated(offerId, msg.sender, meterId, amount, pricePerWh);

        // Request oracle validation
        _requestValidation(offerId, meterId);

        return offerId;
    }

    /**
     * @notice Request oracle validation for an offer
     * @param offerId The offer to validate
     * @param meterId The meter to query
     */
    function _requestValidation(uint256 offerId, string memory meterId) internal {
        uint256 requestId = oracleAggregator.requestData(meterId);
        offers[offerId].requestId = requestId;
        requestToOffer[requestId] = offerId;

        emit ValidationRequested(offerId, requestId);
    }

    /**
     * @notice Update offer with validated oracle reading
     * @param offerId The offer to update
     */
    function updateOfferValidation(uint256 offerId) external {
        Offer storage offer = offers[offerId];
        require(offer.id != 0, "Offer does not exist");
        require(offer.requestId != 0, "No validation pending");

        IOracleAggregator.DataRequest memory request = oracleAggregator.getRequest(offer.requestId);

        // Check if aggregation is complete (status 2 = COMPLETED)
        require(request.status == 2, "Validation not complete");

        offer.validatedReading = request.aggregatedValue;

        emit OfferValidated(offerId, offer.requestId, offer.validatedReading);
    }

    /**
     * @notice Cancel an active offer
     * @param offerId The offer to cancel
     */
    function cancelOffer(uint256 offerId) external {
        Offer storage offer = offers[offerId];
        require(offer.id != 0, "Offer does not exist");
        require(offer.seller == msg.sender || msg.sender == owner(), "Not authorized");
        require(offer.status == STATUS_ACTIVE, "Offer not active");

        offer.status = STATUS_CANCELLED;
        emit OfferCancelled(offerId);
    }

    // ============ Trading Functions ============

    /**
     * @notice Accept an offer and execute trade
     * @param offerId The offer to accept
     */
    function acceptOffer(uint256 offerId) external payable nonReentrant {
        Offer storage offer = offers[offerId];

        require(offer.id != 0, "Offer does not exist");
        require(offer.status == STATUS_ACTIVE, "Offer not active");
        require(block.timestamp <= offer.expiresAt, "Offer expired");
        require(msg.sender != offer.seller, "Cannot buy own offer");

        uint256 totalPrice = offer.amount * offer.pricePerWh;
        require(msg.value >= totalPrice, "Insufficient payment");

        // Validate with GridValidator
        (bool isValid, string memory reason) = gridValidator.validateTrade(
            offer.seller,
            offer.amount,
            ""
        );
        require(isValid, reason);

        // Update offer status
        offer.status = STATUS_FILLED;

        // Record trade
        tradeCounter++;
        trades[tradeCounter] = Trade({
            id: tradeCounter,
            offerId: offerId,
            buyer: msg.sender,
            amount: offer.amount,
            totalPrice: totalPrice,
            timestamp: block.timestamp
        });

        // Transfer payment to seller
        payable(offer.seller).transfer(totalPrice);

        // Refund excess payment
        if (msg.value > totalPrice) {
            payable(msg.sender).transfer(msg.value - totalPrice);
        }

        emit TradeExecuted(tradeCounter, offerId, msg.sender, offer.amount, totalPrice);
    }

    // ============ View Functions ============

    /**
     * @notice Get offer details
     * @param offerId The offer ID
     * @return Offer struct
     */
    function getOffer(uint256 offerId) external view returns (Offer memory) {
        return offers[offerId];
    }

    /**
     * @notice Get trade details
     * @param tradeId The trade ID
     * @return Trade struct
     */
    function getTrade(uint256 tradeId) external view returns (Trade memory) {
        return trades[tradeId];
    }

    /**
     * @notice Get all offers by a seller
     * @param seller Address of the seller
     * @return Array of offer IDs
     */
    function getSellerOffers(address seller) external view returns (uint256[] memory) {
        return sellerOffers[seller];
    }

    /**
     * @notice Get all active offers
     * @return offerIds Array of active offer IDs
     */
    function getActiveOffers() external view returns (uint256[] memory offerIds) {
        uint256 activeCount = 0;

        // Count active offers
        for (uint256 i = 1; i <= offerCounter; i++) {
            if (offers[i].status == STATUS_ACTIVE && block.timestamp <= offers[i].expiresAt) {
                activeCount++;
            }
        }

        // Populate array
        offerIds = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= offerCounter; i++) {
            if (offers[i].status == STATUS_ACTIVE && block.timestamp <= offers[i].expiresAt) {
                offerIds[index] = i;
                index++;
            }
        }

        return offerIds;
    }

    /**
     * @notice Check if an offer is valid and can be accepted
     * @param offerId The offer ID to check
     * @return isValid Whether the offer can be accepted
     * @return reason Reason if not valid
     */
    function canAcceptOffer(uint256 offerId) external view returns (bool isValid, string memory reason) {
        Offer memory offer = offers[offerId];

        if (offer.id == 0) {
            return (false, "Offer does not exist");
        }

        if (offer.status != STATUS_ACTIVE) {
            return (false, "Offer not active");
        }

        if (block.timestamp > offer.expiresAt) {
            return (false, "Offer expired");
        }

        // Check grid validation
        return gridValidator.validateTrade(offer.seller, offer.amount, "");
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the OracleAggregator address
     * @param _oracleAggregator New address
     */
    function setOracleAggregator(address _oracleAggregator) external onlyOwner {
        require(_oracleAggregator != address(0), "Invalid address");
        oracleAggregator = IOracleAggregator(_oracleAggregator);
    }

    /**
     * @notice Update the GridValidator address
     * @param _gridValidator New address
     */
    function setGridValidator(address _gridValidator) external onlyOwner {
        require(_gridValidator != address(0), "Invalid address");
        gridValidator = GridValidator(_gridValidator);
    }

    /**
     * @notice Update default offer duration
     * @param _duration New duration in seconds
     */
    function setDefaultOfferDuration(uint256 _duration) external onlyOwner {
        require(_duration > 0, "Invalid duration");
        defaultOfferDuration = _duration;
    }

    /**
     * @notice Expire old offers (cleanup function)
     * @param offerIds Array of offer IDs to check and expire
     */
    function expireOffers(uint256[] calldata offerIds) external {
        for (uint256 i = 0; i < offerIds.length; i++) {
            Offer storage offer = offers[offerIds[i]];
            if (offer.status == STATUS_ACTIVE && block.timestamp > offer.expiresAt) {
                offer.status = STATUS_EXPIRED;
            }
        }
    }
}

