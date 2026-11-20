const Party = require("./models/party.model");
const ApiError = require("../../utils/ApiError");

// Escape special regex characters in search text
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Create party
const createParty = async (req, res, next) => {
  try {
    const partyData = req.validated.body;

    const party = await Party.create(partyData);

    return res.status(201).json({
      success: true,
      message: "Party created successfully.",
      data: { party },
    });
  } catch (error) {
    return next(error);
  }
};

// Get all parties
const getParties = async (req, res, next) => {
  try {
    const { page, limit, search, type, isActive } = req.validated.query;

    const filter = {};

    if (type) {
      filter.type = type;
    }

    if (typeof isActive === "boolean") {
      filter.isActive = isActive;
    }

    if (search) {
      const searchRegex = {
        $regex: escapeRegex(search),
        $options: "i",
      };

      filter.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { gstin: searchRegex },
      ];
    }

    const skip = (page - 1) * limit;

    const [parties, totalParties] = await Promise.all([
      Party.find(filter).sort({ name: 1 }).skip(skip).limit(limit),

      Party.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Parties fetched successfully.",
      data: {
        parties,
        pagination: {
          currentPage: page,
          limit,
          totalParties,
          totalPages: Math.ceil(totalParties / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get a single party
const getParty = async (req, res, next) => {
  try {
    const { id } = req.validated.params;

    const party = await Party.findById(id);

    if (!party) {
      throw new ApiError(404, "Party not found.");
    }

    return res.status(200).json({
      success: true,
      message: "Party fetched successfully.",
      data: { party },
    });
  } catch (error) {
    return next(error);
  }
};

// Update party
const updateParty = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const updates = req.validated.body;

    const party = await Party.findById(id);

    if (!party) {
      throw new ApiError(404, "Party not found.");
    }

    Object.assign(party, updates);

    await party.save();

    return res.status(200).json({
      success: true,
      message: "Party updated successfully.",
      data: { party },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createParty,
  getParties,
  getParty,
  updateParty,
};
