# decode-uri-component CommonJS compatibility build

This package contains the decoding algorithm from upstream
`decode-uri-component@0.5.0`, including the single-pass fix for
CVE-2026-45822. The sole compatibility change is exporting through CommonJS
for Expo Router's `query-string@7` dependency.

Upstream fix:
https://github.com/SamVerschueren/decode-uri-component/commit/fa479dafeede7bedf04e5c89aa78f2a78c664005

Remove this compatibility package once Expo Router uses a query-string release
that accepts upstream `decode-uri-component@0.5.0` directly.
