const mongoose = require("mongoose");
const Product = require("../products/models/product.model");
const Stock = require("./models/stock.model");
const StockMovement = require("./models/stockMovement.model");

const ApiError = require("../../utils/ApiError");

const { createStockMovement } = require("./inventory.service");

// Create a stock movement.
const createMovement = async (req, res, next) => {
  try {
    const { product, type, quantity, unitCost, note } = req.validated.body;

    const result = await createStockMovement({
      productId: product,
      type,
      quantity,
      unitCost,
      note,
      performedBy: req.user.id,
    });

    await result.stock.populate({
      path: "product",
      select: "name sku",
    });

    await result.movement.populate([
      {
        path: "product",
        select: "name sku",
      },
      {
        path: "performedBy",
        select: "name email",
      },
    ]);

    return res.status(201).json({
      success: true,
      message: "Stock movement created successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

// Get inventory overview.
const getInventory = async (req, res, next) => {
  try {
    const { page, limit, search, category, lowStock } = req.validated.query;

    const skip = (page - 1) * limit;

    // Only show active products.
    const productFilter = {
      isActive: true,
    };

    if (category) {
      productFilter.category = new mongoose.Types.ObjectId(category);
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      productFilter.$or = [
        { name: { $regex: escapedSearch, $options: "i" } },
        { sku: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const pipeline = [
      {
        $match: productFilter,
      },
      {
        $lookup: {
          from: Stock.collection.name,
          localField: "_id",
          foreignField: "product",
          as: "stock",
        },
      },
      {
        $unwind: {
          path: "$stock",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          stockQuantity: {
            $ifNull: ["$stock.quantity", 0],
          },
          averageCost: {
            $ifNull: ["$stock.averageCost", 0],
          },
        },
      },
      {
        $addFields: {
          stockValue: {
            $round: [
              {
                $multiply: ["$stockQuantity", "$averageCost"],
              },
              2,
            ],
          },
          isLowStock: {
            $lte: ["$stockQuantity", "$minimumStockLevel"],
          },
        },
      },
    ];

    // Apply low-stock filter after stock data is calculated.
    if (lowStock === true) {
      pipeline.push({
        $match: {
          isLowStock: true,
        },
      });
    }

    // Count and fetch results using the same filters.
    const [result] = await Product.aggregate([
      ...pipeline,
      {
        $facet: {
          inventory: [
            {
              $sort: {
                name: 1,
                _id: 1,
              },
            },
            {
              $skip: skip,
            },
            {
              $limit: limit,
            },
            {
              $project: {
                name: 1,
                sku: 1,
                description: 1,
                category: 1,
                unit: 1,
                purchasePrice: 1,
                sellingPrice: 1,
                gstRate: 1,
                minimumStockLevel: 1,
                stockQuantity: 1,
                averageCost: 1,
                stockValue: 1,
                isLowStock: 1,
              },
            },
          ],
          total: [
            {
              $count: "count",
            },
          ],
        },
      },
    ]);

    const inventory = result.inventory;
    const totalProducts = result.total[0]?.count || 0;

    return res.status(200).json({
      success: true,
      message: "Inventory overview fetched successfully.",
      data: {
        inventory,
        pagination: {
          currentPage: page,
          limit,
          totalProducts,
          totalPages: Math.ceil(totalProducts / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get stock for one product.
const getProductStock = async (req, res, next) => {
  try {
    const { productId } = req.validated.params;

    const product = await Product.findById(productId);

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    const stock = await Stock.findOne({
      product: productId,
    }).populate({
      path: "product",
      select: "name sku purchasePrice sellingPrice minimumStockLevel",
    });

    // Return zero stock if no movement has been recorded yet.
    const stockData = stock || {
      product: {
        _id: product._id,
        name: product.name,
        sku: product.sku,
        purchasePrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        minimumStockLevel: product.minimumStockLevel,
      },
      quantity: 0,
      averageCost: 0,
    };

    return res.status(200).json({
      success: true,
      message: "Product stock fetched successfully.",
      data: {
        stock: stockData,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get stock movement history.
const getStockMovements = async (req, res, next) => {
  try {
    const { page, limit, product, type, direction } = req.validated.query;

    const filter = {};

    if (product) {
      filter.product = product;
    }

    if (type) {
      filter.type = type;
    }

    if (direction) {
      filter.direction = direction;
    }

    const skip = (page - 1) * limit;

    const [movements, totalMovements] = await Promise.all([
      StockMovement.find(filter)
        .populate({
          path: "product",
          select: "name sku",
        })
        .populate({
          path: "performedBy",
          select: "name email",
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),

      StockMovement.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Stock movements fetched successfully.",
      data: {
        movements,
        pagination: {
          currentPage: page,
          limit,
          totalMovements,
          totalPages: Math.ceil(totalMovements / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createMovement,
  getInventory,
  getProductStock,
  getStockMovements,
};
