# Manifold CSP adapter

The pinned `manifold-3d@3.0.1` WASM glue constructs its Embind function and method
invokers with `Function`. Desktop permits WebAssembly compilation but keeps string
evaluation blocked. `manifoldCspPlugin` replaces only those two glue factories
with closure-based equivalents, including wire conversions, argument counts,
receiver/constructor semantics, destructors and return conversions.

The WASM binary/API are unchanged. The transform runs for the main bundle and
workers, in development and production. Exact upstream markers fail the build if
the generated ABI changes. Review the adapter when upgrading Manifold.

The test executes the transformed module in a separate Node process with
`--disallow-code-generation-from-strings`, covering constructors, polygon holes,
booleans, property access, callbacks/warp, refinement and mesh export. Browser QA
also uses the exact desktop CSP, without enabling `unsafe-eval`.

Background: [Emscripten DYNAMIC_EXECUTION](https://emscripten.org/docs/tools_reference/settings_reference.html#dynamic-execution)
and [Tauri WebAssembly CSP](https://v2.tauri.app/security/csp/).
