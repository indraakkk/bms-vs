{
  description = "venturesea take-home scaffold";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";
  };

  outputs =
    { self, nixpkgs, systems }:
    let
      forAllSystems = nixpkgs.lib.genAttrs (import systems);
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs {
            inherit system;
            # TimescaleDB Community Edition is TSL-licensed ("unfree" by
            # nixpkgs' classification). Scoped to just this project's
            # nixpkgs instantiation, not the user's global config.
            config.allowUnfreePredicate =
              pkg: builtins.elem (nixpkgs.lib.getName pkg) [ "timescaledb" ];
          };
        in
        {
          default = pkgs.callPackage ./devshell.nix { };
        }
      );
    };
}
