/**
 * Tests for GET /api/products pagination (SPEC.md: Product Pagination).
 *
 * The Product model and database are mocked at the module boundary; the
 * real router, optionalAuth middleware, and errorHandler are exercised
 * through HTTP with supertest.
 */

const express = require("express");
const request = require("supertest");
const Product = require("../../src/models/Product");
const productRoutes = require("../../src/routes/products");
const errorHandler = require("../../src/middleware/errorHandler");

jest.mock("../../src/models/Product", () => ({
  findAll: jest.fn(),
  countAll: jest.fn(),
  findById: jest.fn(),
  findBySku: jest.fn(),
  updateStock: jest.fn(),
}));
jest.mock("../../src/config/database", () => ({ query: jest.fn() }));
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const PAGE_ERROR = { error: "page must be a positive integer" };
const LIMIT_ERROR = { error: "limit must be an integer between 1 and 100" };

const makeProduct = (overrides = {}) => ({
  id: 1,
  name: "Keyboard",
  category: "electronics",
  price: "89.99",
  is_active: true,
  ...overrides,
});

function buildApp() {
  const app = express();
  app.use("/api/products", productRoutes);
  app.use(errorHandler);
  return app;
}

function expectNoModelCalls() {
  expect(Product.findAll).not.toHaveBeenCalled();
  expect(Product.countAll).not.toHaveBeenCalled();
}

describe("GET /api/products pagination", () => {
  let app;

  beforeEach(() => {
    jest.resetAllMocks();
    Product.findAll.mockResolvedValue([]);
    Product.countAll.mockResolvedValue(0);
    app = buildApp();
  });

  // ── Defaults and valid values ─────────────────────────────────────────────

  describe("valid parameters", () => {
    it("defaults to page 1, limit 20, offset 0", async () => {
      const res = await request(app).get("/api/products");

      expect(res.status).toBe(200);
      expect(Product.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20, offset: 0 })
      );
      expect(res.body.pagination).toEqual(
        expect.objectContaining({ page: 1, limit: 20 })
      );
    });

    it("uses page 3, limit 10, offset 20 for page=3&limit=10", async () => {
      Product.countAll.mockResolvedValue(30);

      const res = await request(app).get("/api/products?page=3&limit=10");

      expect(res.status).toBe(200);
      expect(Product.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 20 })
      );
      expect(res.body.pagination).toEqual(
        expect.objectContaining({ page: 3, limit: 10 })
      );
    });

    it("accepts limit=100", async () => {
      const res = await request(app).get("/api/products?limit=100");

      expect(res.status).toBe(200);
      expect(Product.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100, offset: 0 })
      );
      expect(res.body.pagination).toEqual(
        expect.objectContaining({ page: 1, limit: 100 })
      );
    });
  });

  // ── Validation ────────────────────────────────────────────────────────────

  describe("validation", () => {
    it("rejects limit=101 with the limit error and no model calls", async () => {
      const res = await request(app).get("/api/products?limit=101");

      expect(res.status).toBe(400);
      expect(res.body).toEqual(LIMIT_ERROR);
      expectNoModelCalls();
    });

    it.each(["0", "-1", "1.5", "abc", ""])(
      "rejects page=%p with the page error and no model calls",
      async (value) => {
        const res = await request(app)
          .get("/api/products")
          .query({ page: value });

        expect(res.status).toBe(400);
        expect(res.body).toEqual(PAGE_ERROR);
        expectNoModelCalls();
      }
    );

    it.each(["0", "-1", "1.5", "abc", ""])(
      "rejects limit=%p with the limit error and no model calls",
      async (value) => {
        const res = await request(app)
          .get("/api/products")
          .query({ limit: value });

        expect(res.status).toBe(400);
        expect(res.body).toEqual(LIMIT_ERROR);
        expectNoModelCalls();
      }
    );

    it("rejects a repeated page parameter with the page error", async () => {
      const res = await request(app).get("/api/products?page=1&page=2");

      expect(res.status).toBe(400);
      expect(res.body).toEqual(PAGE_ERROR);
      expectNoModelCalls();
    });

    it("rejects a repeated limit parameter with the limit error", async () => {
      const res = await request(app).get("/api/products?limit=10&limit=20");

      expect(res.status).toBe(400);
      expect(res.body).toEqual(LIMIT_ERROR);
      expectNoModelCalls();
    });

    it("reports the page error first when both values are invalid", async () => {
      const res = await request(app).get("/api/products?page=0&limit=101");

      expect(res.status).toBe(400);
      expect(res.body).toEqual(PAGE_ERROR);
      expectNoModelCalls();
    });
  });

  // ── Filters ───────────────────────────────────────────────────────────────

  describe("filters", () => {
    it("uses the same category for retrieval and count", async () => {
      const res = await request(app).get(
        "/api/products?category=electronics&page=2&limit=5"
      );

      expect(res.status).toBe(200);
      expect(Product.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ category: "electronics", limit: 5, offset: 5 })
      );
      expect(Product.countAll).toHaveBeenCalledWith(
        expect.objectContaining({ category: "electronics" })
      );
    });

    it("does not let the query string override the active-only filter", async () => {
      const res = await request(app).get(
        "/api/products?activeOnly=false&is_active=false"
      );

      expect(res.status).toBe(200);
      expect(Product.countAll).toHaveBeenCalledTimes(1);
      for (const mockFn of [Product.findAll, Product.countAll]) {
        const [options = {}] = mockFn.mock.calls[0];
        expect(options.activeOnly).not.toBe(false);
        expect(options.activeOnly).not.toBe("false");
        expect(options).not.toHaveProperty("is_active");
      }
    });
  });

  // ── Response shape ────────────────────────────────────────────────────────

  describe("response", () => {
    it("sets the top-level count to the current page size", async () => {
      const products = [
        makeProduct({ id: 1, name: "Keyboard" }),
        makeProduct({ id: 2, name: "Mouse" }),
      ];
      Product.findAll.mockResolvedValue(products);
      Product.countAll.mockResolvedValue(25);

      const res = await request(app).get("/api/products?limit=2");

      expect(res.status).toBe(200);
      expect(res.body.products).toEqual(products);
      expect(res.body.count).toBe(2);
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 2,
        totalItems: 25,
        totalPages: 13,
      });
    });

    it("reports 3 total pages for 21 matches with limit 10", async () => {
      Product.findAll.mockResolvedValue([makeProduct()]);
      Product.countAll.mockResolvedValue(21);

      const res = await request(app).get("/api/products?limit=10");

      expect(res.status).toBe(200);
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 10,
        totalItems: 21,
        totalPages: 3,
      });
    });

    it("returns empty products and zero counts when nothing matches", async () => {
      const res = await request(app).get("/api/products");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        products: [],
        count: 0,
        pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
      });
    });

    it("returns 200 with empty products for a valid page beyond the results", async () => {
      Product.findAll.mockResolvedValue([]);
      Product.countAll.mockResolvedValue(5);

      const res = await request(app).get("/api/products?page=4&limit=5");

      expect(res.status).toBe(200);
      expect(Product.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5, offset: 15 })
      );
      expect(res.body).toEqual({
        products: [],
        count: 0,
        pagination: { page: 4, limit: 5, totalItems: 5, totalPages: 1 },
      });
    });
  });

  // ── Errors ────────────────────────────────────────────────────────────────

  describe("errors", () => {
    it("passes a model rejection to the existing error handler", async () => {
      Product.findAll.mockRejectedValue(new Error("connection lost"));

      const res = await request(app).get("/api/products");

      expect(res.status).toBe(500);
      expect(res.body.error).toBe("connection lost");
    });
  });
});
