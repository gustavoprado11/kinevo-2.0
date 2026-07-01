// Test-only no-op for the `server-only` / `client-only` build guards.
//
// Those packages exist ONLY to fail a client/server bundle boundary at BUILD
// time (so a service-role module can never be bundled into client code). Under
// vitest there is no client/server bundle boundary, so importing them resolves
// to the throwing variant and blows up any test that transitively imports a
// guarded module (e.g. the pure mapExerciseRows through get-trainer-library,
// which imports the server-only admin client since 28c52fa).
//
// This file is NOT part of the Next build/runtime — it is wired in ONLY via
// vitest.config's resolve.alias. The guards still exist and still trip in
// production, where they must.
export {}
