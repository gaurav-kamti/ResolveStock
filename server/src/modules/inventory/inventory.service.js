const mongoose = require("mongoose");

const Product = require("../products/models/product.model");
const Stock = require("./models/stock.model");
const StockMovement = require("./models/stockMovement.model");

const ApiError = require("../../utils/ApiError");

// Determine whether a movement increases or decreases stock.
const movementDirections = {
  opening: "in",
  purchase: "in",
  sales_return: "in",
  adjustment_in: "in",

  sale: "out",
  purchase_return: "out",
  purchase_cancel: "out",
  adjustment_out: "out",
};

// Perform stock movement operations using the supplied session.
const performStockMovement = async ({
  session,
  productId,
  type,
  quantity,
  unitCost,
  note,
  performedBy,
  referenceId,
  direction,
}) => {
  // Check that the product exists and is active.
  const productFilter = {
    _id: productId,
  };

  if (type !== "purchase_cancel") {
    productFilter.isActive = true;
  }

  const product = await Product.findOne(productFilter).session(session);

  if (!product) {
    throw new ApiError(404, "Product not found or inactive.");
  }

  // An opening stock entry can only be recorded once per product.
  if (type === "opening") {
    const existingOpening = await StockMovement.findOne({
      product: productId,
      type: "opening",
    }).session(session);

    if (existingOpening) {
      throw new ApiError(
        409,
        "Opening stock has already been recorded for this product.",
      );
    }
  }

  // Find the current stock record.
  let stock = await Stock.findOne({
    product: productId,
  }).session(session);

  // Create an empty stock record if this is the first movement.
  if (!stock) {
    stock = new Stock({
      product: productId,
      quantity: 0,
      averageCost: 0,
    });
  }

  let movementCost = 0;

  if (direction === "in") {
    // Use the supplied cost or fall back to the product purchase price.
    movementCost = unitCost ?? product.purchasePrice;

    // Calculate weighted average cost.
    const currentValue = stock.quantity * stock.averageCost;
    const incomingValue = quantity * movementCost;
    const newQuantity = stock.quantity + quantity;

    stock.averageCost = (currentValue + incomingValue) / newQuantity;

    stock.quantity = newQuantity;
  } else {
    // Prevent stock from becoming negative.
    if (stock.quantity < quantity) {
      throw new ApiError(
        400,
        `Insufficient stock. Available: ${stock.quantity}, requested: ${quantity}.`,
      );
    }

    movementCost = stock.averageCost;
    stock.quantity -= quantity;
  }

  // Save the updated stock balance.
  await stock.save({ session });

  // Determine the reference type.
  const referenceType = type.startsWith("adjustment_") ? "adjustment" : type;

  // Create permanent movement history.
  const [movement] = await StockMovement.create(
    [
      {
        product: productId,
        type,
        direction,
        quantity,
        unitCost: movementCost,
        referenceType,
        referenceId,
        note,
        performedBy,
      },
    ],
    { session },
  );

  return { stock, movement };
};

// Create a stock movement and update the stock balance.
const createStockMovement = async ({
  productId,
  type,
  quantity,
  unitCost,
  note = "",
  performedBy,
  referenceId = null,
  session: externalSession = null,
}) => {
  const direction = movementDirections[type];

  if (!direction) {
    throw new ApiError(400, "Invalid stock movement type.");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than zero.");
  }

  // If another service supplied a session, reuse it.
  if (externalSession) {
    try {
      return await performStockMovement({
        session: externalSession,
        productId,
        type,
        quantity,
        unitCost,
        note,
        performedBy,
        referenceId,
        direction,
      });
    } catch (error) {
      // Handle duplicate opening stock movement.
      if (
        error.code === 11000 &&
        type === "opening" &&
        error.keyPattern?.product
      ) {
        throw new ApiError(
          409,
          "Opening stock has already been recorded for this product.",
        );
      }

      throw error;
    }
  }

  // Otherwise, create and manage our own transaction.
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await performStockMovement({
        session,
        productId,
        type,
        quantity,
        unitCost,
        note,
        performedBy,
        referenceId,
        direction,
      });
    });

    return result;
  } catch (error) {
    // Handle duplicate opening stock movement.
    if (
      error.code === 11000 &&
      type === "opening" &&
      error.keyPattern?.product
    ) {
      throw new ApiError(
        409,
        "Opening stock has already been recorded for this product.",
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  createStockMovement,
};
