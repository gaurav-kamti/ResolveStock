const express = require("express");
const validate = require("../../middleware/validate.middleware");

const { registerSchema } = require("./test.validation");

const router = express.Router();

router.post("/", validate(registerSchema), (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Validation passed",
    data: req.validated.body,
  });
});

module.exports = router;
