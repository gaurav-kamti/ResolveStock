const mongoose = require("mongoose");

const Party = require("./models/party.model");
const PartyLedger = require("./models/partyLedger.model");

const ApiError = require("../../utils/ApiError");

// Round currency values to two decimal places.
const roundMoney = (amount) => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

// Create a party and record its opening balance.
const createParty = async (partyData, performedBy) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const openingBalance = roundMoney(partyData.openingBalance ?? 0);

      const openingBalanceType = partyData.openingBalanceType ?? "none";

      // Prepare initial balances.
      const receivableBalance =
        openingBalanceType === "receivable" ? openingBalance : 0;

      const payableBalance =
        openingBalanceType === "payable" ? openingBalance : 0;

      // Create the party.
      const [party] = await Party.create(
        [
          {
            ...partyData,
            openingBalance,
            openingBalanceType,
            receivableBalance,
            payableBalance,
          },
        ],
        { session },
      );

      // Record the opening balance in the ledger.
      if (openingBalance > 0) {
        await PartyLedger.create(
          [
            {
              party: party._id,
              transactionType: "opening_balance",
              balanceType: openingBalanceType,
              direction: "increase",
              amount: openingBalance,
              referenceType: "opening_balance",
              referenceId: party._id,
              note: "Opening balance",
              performedBy,
            },
          ],
          { session },
        );
      }

      result = party;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createParty,
};
