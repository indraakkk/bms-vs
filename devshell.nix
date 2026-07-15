# Project-scoped Postgres, not the shared home-manager server: this
# project's Postgres binary has TimescaleDB compiled in and preloaded,
# which the shared server (used by every other project on this machine)
# does not. Building it here means only *this* project's server needs
# rebuilding/restarting to change that — nothing shared is touched.
{
  pkgs ? import <nixpkgs> { },
}:

let
  projectDb = "venturesea";
  pgPort = "5544"; # distinct from the shared server's 5432
  pgPackage = pkgs.postgresql_16.withPackages (p: [ p.timescaledb ]);
in
pkgs.mkShell {
  packages = [
    pkgs.bun
    pkgs.nodejs_22
    pgPackage
  ];

  shellHook = ''
    export PGDATA="$PWD/.pgdata"
    export PGHOST="$PWD/.pgrun"
    export PGPORT="${pgPort}"
    export PGUSER="$(whoami)"
    export PGDATABASE="${projectDb}"
    export DATABASE_URL="postgresql:///${projectDb}?host=$PGHOST&port=${pgPort}"

    mkdir -p "$PGHOST"

    if [ ! -s "$PGDATA/PG_VERSION" ]; then
      echo "initializing project-local postgres (with timescaledb) in $PGDATA..."
      initdb --pgdata="$PGDATA" --username="$PGUSER" --auth-local=trust --auth-host=reject \
        --encoding=UTF8 --locale=C >/dev/null
    fi

    if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
      pg_ctl -D "$PGDATA" -l "$PGDATA/postmaster.log" -o "-c shared_preload_libraries=timescaledb -c port=${pgPort} -c unix_socket_directories=$PGHOST -c listen_addresses=127.0.0.1" start >/dev/null
      for _ in $(seq 1 20); do
        pg_isready -h "$PGHOST" -p "${pgPort}" >/dev/null 2>&1 && break
        sleep 0.25
      done
    fi

    if ! psql -lqt | cut -d '|' -f 1 | grep -qw ${projectDb}; then
      echo "creating database ${projectDb}..."
      createdb ${projectDb}
    fi
    psql -d ${projectDb} -c "CREATE EXTENSION IF NOT EXISTS timescaledb;" >/dev/null

    echo "venturesea dev shell — bun $(bun --version), postgres $(psql --version | grep -o '[0-9.]*' | head -1) + timescaledb on 127.0.0.1:${pgPort} (PGDATA=$PGDATA)"
    echo "  stop server:  pg_ctl -D \$PGDATA stop"
  '';
}
