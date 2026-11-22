const { getPartyLedger } = require("./partyLedger.service");

const getPartyLedgerHistory = async (req, res, next) => {
  try {
    const { id: partyId } = req.params;

    const {
      page = 1,
      limit = 20,
      balanceType,
      transactionType,
      startDate,
      endDate,
    } = req.query;

    const result = await getPartyLedger({
      partyId,
      page: Number(page),
      limit: Number(limit),
      balanceType,
      transactionType,
      startDate,
      endDate,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPartyLedgerHistory,
};
