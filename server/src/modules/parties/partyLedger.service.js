const Party = require("./models/party.model");
const PartyLedger = require("./models/partyLedger.model");

const ApiError = require("../../utils/ApiError");

// Round currency values to two decimal places.
const roundMoney = (amount) => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

// Get ledger entries for a party.
const getPartyLedger = async ({
  partyId,
  page = 1,
  limit = 20,
  balanceType,
  transactionType,
  startDate,
  endDate,
}) => {
  // Verify that the party exists.
  const party = await Party.findById(partyId).lean();

  if (!party) {
    throw new ApiError(404, "Party not found.");
  }

  // Build filter for the entries displayed in the response.
  const filter = {
    party: partyId,
  };

  if (balanceType) {
    filter.balanceType = balanceType;
  }

  if (transactionType) {
    filter.transactionType = transactionType;
  }

  // Filter by transaction date.
  if (startDate || endDate) {
    filter.transactionDate = {};

    if (startDate) {
      filter.transactionDate.$gte = new Date(`${startDate}T00:00:00.000Z`);
    }

    if (endDate) {
      filter.transactionDate.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }
  }

  const skip = (page - 1) * limit;

  // Fetch complete history to calculate accurate running balances.
  // These records are not affected by display filters or pagination.
  const allEntries = await PartyLedger.find({
    party: partyId,
  })
    .select("balanceType direction amount")
    .sort({
      transactionDate: 1,
      createdAt: 1,
      _id: 1,
    })
    .lean();

  // Maintain separate running balances for receivables and payables.
  const runningBalances = {
    receivable: 0,
    payable: 0,
  };

  // Store the balance after each transaction.
  const balanceAfterMap = new Map();

  for (const entry of allEntries) {
    const currentBalance = runningBalances[entry.balanceType];

    const change =
      entry.direction === "increase" ? entry.amount : -entry.amount;

    const newBalance = roundMoney(currentBalance + change);

    runningBalances[entry.balanceType] = newBalance;

    balanceAfterMap.set(entry._id.toString(), newBalance);
  }

  // Fetch filtered entries and total count.
  const [entries, total] = await Promise.all([
    PartyLedger.find(filter)
      .populate("performedBy", "name email")
      .sort({
        transactionDate: -1,
        createdAt: -1,
        _id: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),

    PartyLedger.countDocuments(filter),
  ]);

  // Attach the running balance after each transaction.
  const entriesWithBalance = entries.map((entry) => ({
    ...entry,
    balanceAfter: balanceAfterMap.get(entry._id.toString()) ?? 0,
  }));

  return {
    party: {
      _id: party._id,
      name: party.name,
      type: party.type,
      receivableBalance: party.receivableBalance,
      payableBalance: party.payableBalance,
    },

    entries: entriesWithBalance,

    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

module.exports = {
  getPartyLedger,
};
