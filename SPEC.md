# Specification: Product Pagination

## Goal

Add page-based pagination to `GET /api/products`. Preserve the existing active-only behavior, optional `category` filter, optional authentication, and top-level `count` field.

## Contract

Request:

```text
GET /api/products?page=2&limit=20&category=electronics
```

Rules:

- `page` defaults to `1` and must be a positive integer.
- `limit` defaults to `20` and must be an integer from `1` to `100`.
- Empty, decimal, negative, non-numeric, or repeated values return HTTP `400`.
- Validate `page` before `limit`.
- A valid page beyond the results returns HTTP `200` with an empty array.

Errors:

```json
{ "error": "page must be a positive integer" }
```

```json
{ "error": "limit must be an integer between 1 and 100" }
```

Success:

```json
{
  "products": [],
  "count": 0,
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

`count` is the current page size. `totalPages` is `Math.ceil(totalItems / limit)`, or `0` when no products match.

## Database requirements

- Offset is `(page - 1) * limit`.
- Retrieval and counting use the same active-only and optional category filters.
- Category, limit, and offset are parameterized.
- Retrieval uses `ORDER BY name, id`.
- PostgreSQL count strings are converted to numbers.

## Files in scope

- `src/routes/products.js`
- `src/models/Product.js`
- `tests/routes/products.test.js`
- `tests/models/product.test.js`

No other application or test files may change without approval.

## Test-first order

1. Write tests from this specification.
2. Run them and confirm RED for missing pagination behavior.
3. Commit the failing tests.
4. Implement the smallest required change.
5. Run targeted and complete tests until GREEN.
6. Confirm the committed tests were not changed.
7. Review the final diff against this specification.

## Test matrix

| Scenario | Expected result |
|---|---|
| No parameters | Page 1, limit 20, offset 0 |
| `page=3&limit=10` | Page 3, limit 10, offset 20 |
| `limit=100` | Accepted |
| `limit=101` | 400 limit error; no model calls |
| Page is `0`, `-1`, `1.5`, `abc`, or empty | 400 page error; no model calls |
| Limit is `0`, `-1`, `1.5`, `abc`, or empty | 400 limit error; no model calls |
| Repeated page or limit | 400 matching error; no model calls |
| Both values invalid | Page error first; no model calls |
| Category supplied | Same category used for retrieval and count |
| Two products returned | Top-level count is 2 |
| 21 matches with limit 10 | Total pages is 3 |
| No matches | Empty products and zero counts/pages |
| Valid page beyond results | 200 with empty products |
| Retrieval query | Parameterized values and `ORDER BY name, id` |
| No active override | Retrieval and count require `is_active = true` |
| Database count is `"21"` | Model returns number `21` |
| Model rejects | Existing error handler receives the error |

Tests may parameterize similar invalid cases. Temporarily break one pagination behavior during verification, confirm a test fails, and revert the mutation.

## Security and limits

- Validate pagination before model access.
- Never interpolate values into SQL.
- Enforce the maximum limit of `100`.
- Invalid input causes no model or database calls.
- Preserve existing authentication and error handling.
- Cursor pagination, indexes, migrations, caching, new dependencies, other endpoints, and unrelated refactoring are out of scope.
- Very large offsets are a known performance limitation.

## Done when

- RED tests are committed before implementation.
- RED fails for missing behavior, not broken test code.
- The endpoint matches this contract.
- Every matrix case is covered.
- Targeted and complete tests pass.
- Tests remain unchanged during implementation.
- `npm run lint` is attempted and its result reported.
- Only approved files change.
- The complete final diff is reviewed.

## Verification

```bash
npm test -- tests/models/product.test.js tests/routes/products.test.js
npm test
npm run lint
git status --short
git diff
```
