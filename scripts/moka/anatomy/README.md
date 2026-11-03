# Anatomy kit, vendored

The isometric drawing kit `scripts/moka/build.mjs` draws the moka with, copied here so that the generator reads nothing outside the repository.

- **Origin**: the `anatomy` agent skill, https://github.com/wheresryan22/anatomy (MIT, see `LICENSE`), as installed in `~/.claude/skills/anatomy`.
- **Version**: the skill has no version numbers nor tags (its `CHANGELOG.md` only has an `[Unreleased]` section). The installed copy is not a git clone: its files are dated 2026-10-12, and were copied here on 2026-11-03 (commit `fae7e7a`).
- **Files**: `kit/iso-kit.mjs`, `kit/lathe.mjs` and `LICENSE` as they are. `scripts/inline-kit.mjs` keeps only `kitScript`: its other exports read kit files that are not copied.
