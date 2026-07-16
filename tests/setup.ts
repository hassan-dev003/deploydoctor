// Keep the test suite hermetic. CI environments (for example Vercel, which defines the
// production CEREBRAS_API_KEY during the build) must never cause tests to make live
// network calls to the model provider. Clear the key by default; tests that exercise the
// provider path inject a client or pass an explicit apiKey instead of relying on env.
process.env.CEREBRAS_API_KEY = "";
