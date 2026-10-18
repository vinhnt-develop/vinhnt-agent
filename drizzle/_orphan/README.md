# Orphaned migrations (not part of the active chain)

These `.sql` files are **not** referenced by `drizzle/meta/_journal.json`, so
`drizzle-kit migrate` never runs them. They belong to an earlier, abandoned
schema iteration (the `credentials`, `mcp_servers`, `provider_configs`,
`custom_tools`, `plugin_configs`, `tool_configs` and `provider_api_keys` tables
— all since removed in favour of the file-based `JsonConfigStore`).

They are kept here for history only. Do **not** move them back into the
`drizzle/` root: the migrator resolves migrations by the journal `tag` and
stray `.sql` files only cause confusion.
