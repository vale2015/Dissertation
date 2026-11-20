# Model authentication diagnostics

**20 November recovery:** PM saved a fresh token for Preview/Production; one harmless inference passed on a fresh protected preview. The 19 November failure below remains historical evidence. Production activation and full acceptance remain open; see [current verification](MODEL_VERIFICATION_2026-11-20.md).

The assistant trims surrounding whitespace from its configured Cloudflare account ID and API token before checking configuration availability and constructing the provider. This handles copy/paste whitespace consistently. It does not strip quotes, alter stored environment values, change models or claim that configuration presence proves successful inference.

Provider failures keep the existing public category and friendly response. The server warning contains only:

- The fixed failure category and an integer HTTP status between 100 and 599, when available.
- Up to five distinct integer Cloudflare error codes between 0 and 999999, read from `errors[].code` or `error.code`. Parsing ignores bodies above 16384 characters and examines at most ten array entries.
- Boolean flags for a 32-character hexadecimal account ID, surrounding whitespace, and surrounding quotes.

Messages, response bodies, URLs, headers, request input and credential values are never included in this warning or returned as diagnostics to the browser. Invalid JSON and nonnumeric codes are discarded. Quotes are reported as a shape flag and remain unchanged in provider construction.

The implementation uses the installed AI SDK provider's `statusCode` and `responseBody` error fields. No extra verification requests or endpoints are introduced. The controlled live check below established the precise failure and confirmed that whitespace normalization did not resolve it.

The existing `provider_auth` category groups HTTP 401/403 responses; it does not establish that credentials are wrong. Cloudflare also documents plan, private-model access, model agreement and account restrictions for some 403 responses. Use the captured numeric code and the [official Workers AI error reference](https://developers.cloudflare.com/workers-ai/platform/errors/) before drawing a conclusion. This change leaves the public category unchanged.

**Controlled live check, 19 November 2026:** the reviewed preview returned HTTP401 / Cloudflare10000. Shape flags confirmed a 32-character hexadecimal account ID and no surrounding whitespace or quotes. Whitespace normalization did not resolve this request. The PM confirmed the stored values, account and Read/Edit permissions and chose to keep model verification blocked for now. No credential was decrypted or changed; no plan or model was changed. See the [verification record](STAFF_CHAT_VERIFICATION_2026-11-19.md). Resume only after a deliberate configuration/credential change and new build, with the token kept out of chat.
