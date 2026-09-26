// Stand-in for optional x402 packages that @coinbase/cdp-sdk imports lazily. AI City never
// reaches those code paths (no x402 payments), so they resolve to an empty module.
module.exports = {};
