// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IEnergyAuction
 * @notice Interface for the Dutch auction contract for P2P energy trading
 */
interface IEnergyAuction {
    // ============ Enums ============

    enum AuctionStatus {
        Active,            // Auction is open for bids
        PendingValidation, // Bid accepted, awaiting oracle validation
        Finalized,         // Trade completed, ETH transferred to seller
        Cancelled          // Auction cancelled (by seller or due to failed oracle)
    }

    // ============ Structs ============

    /**
     * @notice Represents a Dutch auction for an energy lot
     * @param id Unique auction identifier
     * @param seller Address of the prosumer selling energy
     * @param meterId Smart meter identifier
     * @param energyAmount Amount of energy offered (Wh)
     * @param startPrice Price per Wh at auction start (wei)
     * @param minPrice Minimum price per Wh — floor of the decay (wei)
     * @param priceDecayRate Wei per Wh per second
     * @param startTime Timestamp when the auction started
     * @param endTime Timestamp when the auction expires
     * @param oracleRequestId ID of the oracle data request created at auction creation
     * @param winner Address of the winning bidder (address(0) if no bid yet)
     * @param finalPrice Price per Wh at the moment the winning bid was placed (wei)
     * @param status Current auction status
     */
    struct Auction {
        uint256 id;
        address seller;
        string meterId;
        uint256 energyAmount;
        uint256 startPrice;
        uint256 minPrice;
        uint256 priceDecayRate;
        uint256 startTime;
        uint256 endTime;
        uint256 oracleRequestId;
        address winner;
        uint256 finalPrice;
        AuctionStatus status;
    }

    // ============ Events ============

    /**
     * @notice Emitted when a new auction is created
     * @param auctionId Unique identifier for the auction
     * @param seller Address of the seller
     * @param meterId Smart meter identifier
     * @param energyAmount Amount of energy (Wh)
     * @param startPrice Starting price per Wh (wei)
     * @param minPrice Minimum price per Wh (wei)
     * @param endTime Auction expiry timestamp
     */
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        string meterId,
        uint256 energyAmount,
        uint256 startPrice,
        uint256 minPrice,
        uint256 endTime
    );

    /**
     * @notice Emitted when a bid is accepted
     * @param auctionId Auction identifier
     * @param winner Address of the winning bidder
     * @param finalPrice Price per Wh at bid time (wei)
     * @param totalPaid Total ETH locked in contract
     */
    event BidAccepted(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 finalPrice,
        uint256 totalPaid
    );

    /**
     * @notice Emitted when an auction is finalized (oracle validated)
     * @param auctionId Auction identifier
     * @param seller Seller address
     * @param winner Winner address
     * @param amount ETH transferred to seller
     */
    event AuctionFinalized(
        uint256 indexed auctionId,
        address indexed seller,
        address indexed winner,
        uint256 amount
    );

    /**
     * @notice Emitted when an auction is cancelled
     * @param auctionId Auction identifier
     * @param reason Short reason string
     */
    event AuctionCancelled(uint256 indexed auctionId, string reason);

    /**
     * @notice Emitted when an oracle validation is requested at auction creation
     * @param auctionId Auction identifier
     * @param requestId Oracle request identifier
     */
    event ValidationRequested(uint256 indexed auctionId, uint256 indexed requestId);

    // ============ Functions ============

    function createAuction(
        string calldata meterId,
        uint256 energyAmount,
        uint256 startPrice,
        uint256 minPrice,
        uint256 duration
    ) external returns (uint256 auctionId);

    function getCurrentPrice(uint256 auctionId) external view returns (uint256);

    function placeBid(uint256 auctionId) external payable;

    function finalizeAuction(uint256 auctionId) external;

    function cancelAuction(uint256 auctionId) external;

    function getAuction(uint256 auctionId) external view returns (Auction memory);

    function getActiveAuctions() external view returns (uint256[] memory);
}
