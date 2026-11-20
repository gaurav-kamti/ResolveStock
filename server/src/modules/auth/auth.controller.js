const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("./models/user.model");
const env = require("../../config/env");

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

// Verify initial admin setup key
const isValidSetupKey = (providedKey) => {
  if (typeof providedKey !== "string") {
    return false;
  }

  const providedBuffer = Buffer.from(providedKey);
  const actualBuffer = Buffer.from(env.ADMIN_SETUP_KEY);

  if (providedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, actualBuffer);
};

// One-time initial admin setup
const setupAdmin = async (req, res, next) => {
  try {
    // Verify private setup key
    const setupKey = req.headers["x-admin-setup-key"];

    if (!isValidSetupKey(setupKey)) {
      return res.status(403).json({
        success: false,
        message: "Invalid or missing admin setup key.",
      });
    }

    // Ensure database indexes exist before creating admin
    await User.init();

    // Check whether admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin account has already been created.",
      });
    }

    const { name, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
    });

    const token = generateToken(admin._id);

    return res.status(201).json({
      success: true,
      message: "Admin account created successfully.",
      data: {
        user: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
        token,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Admin account has already been created.",
      });
    }

    next(error);
  }
};

// Admin login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({ email }).select("+password");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = generateToken(admin._id);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        user: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  setupAdmin,
  login,
};
