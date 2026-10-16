# Process: Product Pagination

## Approach

I used one implementation agent for the feature. Pagination was a small, tightly coupled change: the route contract determined the model parameters and tests, and the work was naturally sequential through RED and GREEN.

Parallel implementation workers would have added coordination overhead without creating meaningful independent work. I retained fresh, read-only specification and test reviewers to counter self-consistency bias.

The single-agent choice was appropriate. File ownership stayed simple, the tests remained protected by the RED commit, and the independent reviewers still found a real coverage gap.

## Evidence

- Specification: `6425d88` — `NO-TICKET: define product pagination specification`
- RED tests: `7e79e01` — `NO-TICKET: add failing product pagination tests`
- Approved specification clarification: `47ade41` — `NO-TICKET: clarify product error-path specification`
- Implementation and repair: `796b2d7` — `NO-TICKET: implement product pagination`

The RED run produced 31 expected assertion failures and 4 passes across 35 tests. The failures covered missing validation, pagination metadata, limit/offset SQL, deterministic ordering, and the missing count operation.

After implementation, the targeted suite passed 35 tests and the complete suite passed 79 tests. After the review repair, the targeted suite passed 36 tests and the complete suite passed 80 tests.

## Prompts that mattered

### RED

The agent was limited to creating:

- `tests/models/product.test.js`
- `tests/routes/products.test.js`

It was told to derive tests from `SPEC.md`, avoid application changes, produce assertion failures rather than broken imports or missing-function crashes, run the targeted suite, and stop before implementation.

### GREEN

The same agent was limited to:

- `src/models/Product.js`
- `src/routes/products.js`

It was told not to modify committed tests, to stop if a test appeared incorrect, and to run targeted and complete tests. Test integrity was checked with:

```bash
git diff 7e79e01 -- tests/models/product.test.js tests/routes/products.test.js
```

The result was empty.

### Review

Fresh `specs-reviewer` and `test-auditor` agents reviewed the staged implementation against `SPEC.md`. After both initially passed, the test audit was deliberately tightened around the two independent model failure paths.

The stricter audit returned FAIL because the route tests covered a rejected retrieval but not a rejected count operation. The finding was approved, `SPEC.md` was amended, and the same implementation agent added one focused count-rejection test. Fresh reviewers then returned PASS.

## What Claude got wrong

### Incorrect test counts

Claude initially misreported the RED route suite as 28 tests; the actual Jest run showed 24. It also reported 23 checks from a temporary in-process script, but those checks were not equivalent to the route test suite.

I caught this by reading the test file and trusting the Jest output rather than Claude’s summary.

### Incomplete verification

Claude could not run the Supertest route suite because its sandbox blocked local port binding. It used a temporary in-process check and reported that behavior looked correct, but I did not accept that as GREEN evidence.

I ran the committed targeted and complete Jest suites outside the sandbox. Those runs established the real GREEN results.

### Missing failure-path coverage

The initial test suite verified `Product.findAll` rejection but not `Product.countAll` rejection. The first audit treated this as optional.

I tightened the audit criterion because the route depends on both operations independently. The fresh audit returned FAIL and explained that code swallowing a count failure could pass every existing test.

The specification was amended transparently, and a new test now proves count failures reach the existing error handler.

## Verification discipline

- Baseline: 44 tests passed locally and in GitHub Actions.
- RED: both new suites failed for expected assertion reasons.
- Tests were committed before implementation.
- The committed RED tests were unchanged during implementation.
- A temporary mutation removed `id` from `ORDER BY name, id`; the ordering test failed and passed after restoration.
- Final targeted suite: 36 tests passed.
- Final complete suite: 80 tests passed across 9 suites.
- Final GitHub Actions run: passed.
- `npm run lint` was attempted and could not run because the supplied repository has no ESLint configuration.
- Final read-only reviewers: PASS and PASS.

## Review loop

```text
Initial review: PASS
-> stricter test audit: FAIL
-> approve finding
-> clarify specification
-> add missing count-failure test
-> targeted and complete suites pass
-> fresh specs review: PASS
-> fresh test audit: PASS
```

The review loop improved the test suite without weakening the original RED tests or changing the application contract.
