# MSSQL itself is not packaged in nixpkgs at all (open packaging request
# nixpkgs#325922) — the server always runs via `docker compose up`
# (docker-compose.yml at repo root). This devshell only provides the
# client-side tooling: bun/node for the workspace, sqlcmd for the compose
# healthcheck / ad-hoc queries, openssl for generating AUTH_SECRET, and
# nixpkgs' prisma-engines so `prisma migrate`/`db seed` work on NixOS
# (Prisma's npm-downloaded engine binaries are dynamically linked and
# fail to run on NixOS without this).
{
  pkgs ? import <nixpkgs> { },
}:

pkgs.mkShell {
  packages = [
    pkgs.bun
    pkgs.nodejs_22
    pkgs.sqlcmd
    pkgs.openssl
    pkgs.prisma-engines_7
  ];

  shellHook = ''
    # prisma-engines_7 only ships schema-engine — Prisma 6+ with the
    # `prisma-client` generator + a driver adapter needs no Rust query
    # engine at runtime, so that's the only binary the NixOS fix requires.
    export PRISMA_SCHEMA_ENGINE_BINARY="${pkgs.prisma-engines_7}/bin/schema-engine"

    echo "bms-dashboard dev shell — bun $(bun --version)"
    echo "  MSSQL runs via Docker: docker compose up -d"
    echo "  then:  bun install && bun run db:migrate && bun run db:seed && bun run dev"
  '';
}
