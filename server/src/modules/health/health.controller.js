const mongoose = require("mongoose");

// Checks whether the Node.js process is alive
const getLiveness = (req, res) => {
  res.status(200).json({
    success: true,
    message: "ResolveStock API is alive",
    data: {
      status: "alive",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
};

// Checks whether the application is ready to serve requests
const getReadiness = (req, res) => {
  const isDatabaseConnected = mongoose.connection.readyState === 1;

  if (!isDatabaseConnected) {
    return res.status(503).json({
      success: false,
      message: "ResolveStock API is not ready",
      data: {
        status: "not_ready",
        database: "disconnected",
      },
    });
  }

  return res.status(200).json({
    success: true,
    message: "ResolveStock API is ready",
    data: {
      status: "ready",
      database: "connected",
      timestamp: new Date().toISOString(),
    },
  });
};

module.exports = {
  getLiveness,
  getReadiness,
};
