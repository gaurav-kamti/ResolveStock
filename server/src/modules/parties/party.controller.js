const mongoose = require("mongoose");

const Party = require("./models/party.model");
const { createParty: createPartyService } = require("./party.service");

const ApiError = require("../../utils/ApiError");

// Escape special regex characters in search input.
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Create a new party.
const createParty = async (req, res, next) => {
  try {
    const party = await createPartyService(req.body, req.user.id);

    res.status(201).json({
      success: true,
      message: "Party created successfully.",
      data: party,
    });
  } catch (error) {
    next(error);
  }
};

// Get all parties with filters and pagination.
const getParties = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, type, isActive } = req.query;

    const filter = {};

    if (type) {
      filter.type = type;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");

      filter.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { gstin: searchRegex },
      ];
    }

    const skip = (page - 1) * limit;

    const [parties, total] = await Promise.all([
      Party.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),

      Party.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: parties,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get a single party by ID.
const getParty = async (req, res, next) => {
  try {
    const { id } = req.params;

    const party = await Party.findById(id).lean();

    if (!party) {
      throw new ApiError(404, "Party not found.");
    }

    res.status(200).json({
      success: true,
      data: party,
    });
  } catch (error) {
    next(error);
  }
};

// Update an existing party.
const updateParty = async (req, res, next) => {
  try {
    const { id } = req.params;

    const updates = { ...req.body };

    // Opening balances must only be changed through
    // dedicated accounting operations.
    if (
      "openingBalance" in updates ||
      "openingBalanceType" in updates ||
      "receivableBalance" in updates ||
      "payableBalance" in updates
    ) {
      throw new ApiError(
        400,
        "Opening balances and current balances cannot be modified directly.",
      );
    }

    const party = await Party.findById(id);

    if (!party) {
      throw new ApiError(404, "Party not found.");
    }

    Object.assign(party, updates);

    await party.save();

    res.status(200).json({
      success: true,
      message: "Party updated successfully.",
      data: party,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createParty,
  getParties,
  getParty,
  updateParty,
};
