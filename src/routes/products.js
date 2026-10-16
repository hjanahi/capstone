const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const { optionalAuth } = require("../middleware/auth");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const PAGE_ERROR = "page must be a positive integer";
const LIMIT_ERROR = "limit must be an integer between 1 and 100";

/**
 * Parse an optional positive-integer query value. Returns the default when
 * absent, or null when the value is empty, repeated, or not a positive integer.
 */
function parsePositiveInt(value, defaultValue) {
  if (value === undefined) return defaultValue;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

/**
 * GET /api/products
 * List active products, paginated. Optional ?category=, ?page=, ?limit=.
 */
router.get("/", optionalAuth(), async (req, res, next) => {
  try {
    const { category } = req.query;

    const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
    if (page === null) {
      return res.status(400).json({ error: PAGE_ERROR });
    }
    const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT);
    if (limit === null || limit > MAX_LIMIT) {
      return res.status(400).json({ error: LIMIT_ERROR });
    }

    const offset = (page - 1) * limit;
    const [products, totalItems] = await Promise.all([
      Product.findAll({ category, limit, offset }),
      Product.countAll({ category }),
    ]);

    res.json({
      products,
      count: products.length,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/products/:id
 */
router.get("/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
