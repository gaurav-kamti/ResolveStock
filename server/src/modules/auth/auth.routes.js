const express = require("express");

const router = express.Router();

const { setupAdmin, login } = require("./auth.controller");

const { protect } = require("./auth.middleware");

const validate = require("../../middleware/validate.middleware");

const { setupAdminSchema, loginSchema } = require("./auth.validation");

// Initial admin setup
router.post("/setup", validate(setupAdminSchema), setupAdmin);

// Admin login
router.post("/login", validate(loginSchema), login);

// Protected admin profile
router.get("/me", protect, (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Authenticated successfully.",
    data: {
      user: req.user,
    },
  });
});

module.exports = router;
