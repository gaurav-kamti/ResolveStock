const express = require("express");

const { getLiveness, getReadiness } = require("./health.controller");

const router = express.Router();

router.get("/live", getLiveness);
router.get("/ready", getReadiness);

module.exports = router;
