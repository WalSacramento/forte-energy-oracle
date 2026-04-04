// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IOracleAggregator.sol";
import "./interfaces/IEnergyAuction.sol";
import "./GridValidator.sol";

/**
 * @title EnergyAuction
 * @notice Dutch auction contract for P2P energy trading in the EAON PoC
 * @dev Integrates with OracleAggregator for meter validation and GridValidator for capacity checks.
 *      Price decays linearly from startPrice to minPrice over the auction duration.
 *      First bidder at or above the current price wins; payment is released only after
 *      the oracle confirms the energy reading.
 */
contract EnergyAuction is IEnergyAuction, Ownable, ReentrancyGuard {
    // Oracle request status constants (mirrors OracleAggregator)
    uint8 private constant STATUS_PENDING = 0;
    uint8 private constant STATUS_AGGREGATING = 1;
    uint8 private constant STATUS_COMPLETED = 2;
    uint8 private constant STATUS_FAILED = 3;

    // ============ State Variables ============

    /// @notice Reference to the OracleAggregator contract
    IOracleAggregator public oracleAggregator;

    /// @notice Reference to the GridValidator contract
    GridValidator public gridValidator;

    /// @notice Auto-incrementing auction counter
    uint256 public auctionCounter;

    /// @notice mapping auctionId => Auction
    mapping(uint256 => Auction) public auctions;

    /// @notice mapping oracle requestId => auctionId (same pattern as EnergyTrading)
    mapping(uint256 => uint256) public requestToAuction;

    /// @notice mapping seller => list of their auction IDs
    mapping(address => uint256[]) public sellerAuctions;

    // ============ Constructor ============

    /**
     * @param _oracleAggregator Address of the deployed OracleAggregator
     * @param _gridValidator    Address of the deployed GridValidator
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

    // ============ Auction Creation ============

    /**
     * @notice Create a Dutch auction for an energy lot
     * @param meterId     Smart meter identifier
     * @param energyAmount Amount of energy to sell (Wh)
     * @param startPrice  Starting price per Wh (wei) — must be > minPrice
     * @param minPrice    Minimum price per Wh (wei) — price floor
     * @param duration    Auction duration in seconds
     * @return auctionId  The newly created auction ID
     */
    function createAuction(
        string calldata meterId,
        uint256 energyAmount,
        uint256 startPrice,
        uint256 minPrice,
        uint256 duration
    ) external override returns (uint256 auctionId) {
        require(bytes(meterId).length > 0, "Invalid meter ID");
        require(energyAmount > 0, "Energy amount must be > 0");
        require(startPrice > minPrice, "startPrice must be > minPrice");
        require(duration > 0, "Duration must be > 0");

        // priceDecayRate = (startPrice - minPrice) / duration  (wei per Wh per second)
        uint256 priceDecayRate = (startPrice - minPrice) / duration;

        auctionCounter++;
        auctionId = auctionCounter;

        // Request oracle data up-front so the reading is available at finalization
        uint256 requestId = oracleAggregator.requestData(meterId);
        requestToAuction[requestId] = auctionId;

        auctions[auctionId] = Auction({
            id: auctionId,
            seller: msg.sender,
            meterId: meterId,
            energyAmount: energyAmount,
            startPrice: startPrice,
            minPrice: minPrice,
            priceDecayRate: priceDecayRate,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            oracleRequestId: requestId,
            winner: address(0),
            finalPrice: 0,
            status: AuctionStatus.Active
        });

        sellerAuctions[msg.sender].push(auctionId);

        emit AuctionCreated(auctionId, msg.sender, meterId, energyAmount, startPrice, minPrice, block.timestamp + duration);
        emit ValidationRequested(auctionId, requestId);

        return auctionId;
    }

    // ============ Price Query ============

    /**
     * @notice Compute the current price per Wh for an auction
     * @dev currentPrice = startPrice - elapsed * priceDecayRate, clamped to minPrice
     * @param auctionId The auction to query
     * @return Current price per Wh in wei
     */
    function getCurrentPrice(uint256 auctionId) external view override returns (uint256) {
        Auction storage auction = auctions[auctionId];
        require(auction.id != 0, "Auction does not exist");
        return _currentPrice(auction);
    }

    // ============ Bidding ============

    /**
     * @notice Place a bid on an active Dutch auction
     * @dev Payable; msg.value must be >= currentPrice * energyAmount.
     *      Excess ETH is refunded in the same call.
     * @param auctionId The auction to bid on
     */
    function placeBid(uint256 auctionId) external payable override nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.id != 0, "Auction does not exist");
        require(auction.status == AuctionStatus.Active, "Auction not active");
        require(block.timestamp < auction.endTime, "Auction expired");

        uint256 price = _currentPrice(auction);
        uint256 totalCost = price * auction.energyAmount;
        require(msg.value >= totalCost, "Insufficient payment");

        // Grid capacity check
        (bool isValid, string memory reason) = gridValidator.validateTrade(
            auction.seller,
            auction.energyAmount,
            ""
        );
        require(isValid, reason);

        auction.winner = msg.sender;
        auction.finalPrice = price;
        auction.status = AuctionStatus.PendingValidation;

        emit BidAccepted(auctionId, msg.sender, price, totalCost);

        // Refund any excess ETH
        uint256 excess = msg.value - totalCost;
        if (excess > 0) {
            payable(msg.sender).transfer(excess);
        }
    }

    // ============ Finalization ============

    /**
     * @notice Finalize an auction after the oracle has responded
     * @dev Anyone can call. If oracle reading >= energyAmount → pay seller.
     *      Otherwise → refund buyer.
     * @param auctionId The auction to finalize
     */
    function finalizeAuction(uint256 auctionId) external override nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.id != 0, "Auction does not exist");
        require(auction.status == AuctionStatus.PendingValidation, "Auction not pending validation");

        IOracleAggregator.DataRequest memory request = oracleAggregator.getRequest(auction.oracleRequestId);
        require(request.status == STATUS_COMPLETED || request.status == STATUS_FAILED, "Oracle response pending");

        uint256 totalPayment = auction.finalPrice * auction.energyAmount;

        if (request.status == STATUS_COMPLETED && request.aggregatedValue >= auction.energyAmount) {
            // Oracle confirmed sufficient energy — pay seller
            auction.status = AuctionStatus.Finalized;
            payable(auction.seller).transfer(totalPayment);
            emit AuctionFinalized(auctionId, auction.seller, auction.winner, totalPayment);
        } else {
            // Insufficient reading or oracle failed — refund buyer
            auction.status = AuctionStatus.Cancelled;
            payable(auction.winner).transfer(totalPayment);
            emit AuctionCancelled(auctionId, "Oracle reading insufficient or failed");
        }
    }

    // ============ Cancellation ============

    /**
     * @notice Seller cancels an active auction (before any bid)
     * @param auctionId The auction to cancel
     */
    function cancelAuction(uint256 auctionId) external override {
        Auction storage auction = auctions[auctionId];
        require(auction.id != 0, "Auction does not exist");
        require(auction.seller == msg.sender, "Not the seller");
        require(auction.status == AuctionStatus.Active, "Auction not active");

        auction.status = AuctionStatus.Cancelled;
        emit AuctionCancelled(auctionId, "Cancelled by seller");
    }

    // ============ View Functions ============

    /**
     * @notice Get the full auction struct for a given ID
     */
    function getAuction(uint256 auctionId) external view override returns (Auction memory) {
        return auctions[auctionId];
    }

    /**
     * @notice Return IDs of all currently active auctions
     */
    function getActiveAuctions() external view override returns (uint256[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= auctionCounter; i++) {
            if (auctions[i].status == AuctionStatus.Active) {
                activeCount++;
            }
        }

        uint256[] memory result = new uint256[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 1; i <= auctionCounter; i++) {
            if (auctions[i].status == AuctionStatus.Active) {
                result[idx] = i;
                idx++;
            }
        }
        return result;
    }

    /**
     * @notice Get all auction IDs for a seller
     */
    function getSellerAuctions(address seller) external view returns (uint256[] memory) {
        return sellerAuctions[seller];
    }

    // ============ Admin ============

    function setOracleAggregator(address _oracleAggregator) external onlyOwner {
        require(_oracleAggregator != address(0), "Invalid address");
        oracleAggregator = IOracleAggregator(_oracleAggregator);
    }

    function setGridValidator(address _gridValidator) external onlyOwner {
        require(_gridValidator != address(0), "Invalid address");
        gridValidator = GridValidator(_gridValidator);
    }

    // ============ Internal ============

    function _currentPrice(Auction storage auction) internal view returns (uint256) {
        if (block.timestamp <= auction.startTime) {
            return auction.startPrice;
        }
        uint256 elapsed = block.timestamp - auction.startTime;
        uint256 decay = elapsed * auction.priceDecayRate;
        if (decay >= auction.startPrice - auction.minPrice) {
            return auction.minPrice;
        }
        return auction.startPrice - decay;
    }
}
