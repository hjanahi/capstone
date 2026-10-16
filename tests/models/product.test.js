/**
 * Tests for Product model pagination queries (SPEC.md: Product Pagination).
 *
 * The database module is mocked at the module boundary so these tests
 * assert the SQL text and parameter values sent to PostgreSQL.
 */

const db = require("../../src/config/database");
const Product = require("../../src/models/Product");

jest.mock("../../src/config/database", () => ({ query: jest.fn() }));

// Guard so a missing count method fails as an assertion, not a TypeError.
function expectCountAllDefined() {
  expect(Product.countAll).toEqual(expect.any(Function));
}

describe("Product.findAll pagination", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    db.query.mockResolvedValue({ rows: [] });
  });

  it("applies limit and offset as parameterized values", async () => {
    await Product.findAll({ limit: 10, offset: 20 });

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/LIMIT \$1 OFFSET \$2/);
    expect(params).toEqual([10, 20]);
  });

  it("parameterizes category, limit, and offset in that order", async () => {
    await Product.findAll({ category: "electronics", limit: 20, offset: 0 });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/category = \$1/);
    expect(sql).toMatch(/LIMIT \$2 OFFSET \$3/);
    expect(params).toEqual(["electronics", 20, 0]);
  });

  it("never interpolates values into the SQL text", async () => {
    await Product.findAll({ category: "electronics", limit: 37, offset: 74 });

    const [sql] = db.query.mock.calls[0];
    expect(sql).not.toContain("electronics");
    expect(sql).not.toMatch(/\b37\b/);
    expect(sql).not.toMatch(/\b74\b/);
  });

  it("orders retrieval by name, id", async () => {
    await Product.findAll({ limit: 20, offset: 0 });

    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(/ORDER BY name, id/);
  });

  it("requires is_active = true when no active override is given", async () => {
    await Product.findAll({ limit: 20, offset: 0 });

    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(/is_active = true/);
  });

  it("returns the rows from the query", async () => {
    const rows = [
      { id: 1, name: "Keyboard" },
      { id: 2, name: "Mouse" },
    ];
    db.query.mockResolvedValue({ rows });

    await expect(Product.findAll({ limit: 20, offset: 0 })).resolves.toEqual(
      rows
    );
  });
});

describe("Product.countAll", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    db.query.mockResolvedValue({ rows: [{ count: "0" }] });
  });

  it("is exported as a function", () => {
    expectCountAllDefined();
  });

  it("converts the PostgreSQL count string to a number", async () => {
    expectCountAllDefined();
    db.query.mockResolvedValue({ rows: [{ count: "21" }] });

    const total = await Product.countAll({});

    expect(total).toBe(21);
  });

  it("requires is_active = true when no active override is given", async () => {
    expectCountAllDefined();

    await Product.countAll({});

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/COUNT\(\*\)/i);
    expect(sql).toMatch(/is_active = true/);
    expect(params).toEqual([]);
  });

  it("parameterizes the category filter", async () => {
    expectCountAllDefined();

    await Product.countAll({ category: "electronics" });

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/is_active = true/);
    expect(sql).toMatch(/category = \$1/);
    expect(sql).not.toContain("electronics");
    expect(params).toEqual(["electronics"]);
  });

  it("returns 0 when no products match", async () => {
    expectCountAllDefined();

    await expect(Product.countAll({ category: "none" })).resolves.toBe(0);
  });
});
