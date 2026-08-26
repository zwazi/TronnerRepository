#!/usr/bin/env python3
"""Keep the newest copy of each map and normalize it to version v1."""

from __future__ import annotations

import argparse
import os
import re
import stat
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


TARGET_VERSION = "v1"
RESOURCE_RE = re.compile(br"<Resource\b[^>]*>", re.IGNORECASE | re.DOTALL)
ATTRIBUTE_RE = re.compile(
    br"([A-Za-z_:][A-Za-z0-9_:.-]*)\s*=\s*([\"'])(.*?)\2", re.DOTALL
)
TARGET_EFFECT_RE = re.compile(
    br"(\beffect\s*=\s*)([\"'])target\2", re.IGNORECASE
)
NUMERIC_VERSION_RE = re.compile(r"^[0-9]+(?:\.[0-9]+)*$")
VERSION_TOKEN_RE = re.compile(r"[0-9]+|[A-Za-z]+")
MAP_SUFFIX_RE = re.compile(r"\.aamap\.xml(?:\.xml)*$", re.IGNORECASE)
NUMERIC_FILENAME_VERSION_RE = re.compile(r"[-.]v?[0-9]+(?:\.[0-9]+)*$", re.IGNORECASE)


@dataclass(frozen=True)
class MapRecord:
    path: Path
    data: bytes
    mode: int
    resource_start: int
    resource_end: int
    attributes: dict[str, str]

    @property
    def name(self) -> str:
        return self.attributes["name"]

    @property
    def author(self) -> str:
        return self.attributes["author"]

    @property
    def version(self) -> str:
        return self.attributes["version"]


def parse_attributes(tag: bytes) -> dict[str, str]:
    return {
        match.group(1).decode("ascii").casefold(): match.group(3).decode(
            "utf-8", errors="surrogateescape"
        )
        for match in ATTRIBUTE_RE.finditer(tag)
    }


def discover_maps(root: Path) -> list[MapRecord]:
    records: list[MapRecord] = []
    errors: list[str] = []

    for path in sorted(root.rglob("*.xml")):
        if ".git" in path.parts:
            continue

        data = path.read_bytes()
        resource_match = RESOURCE_RE.search(data)
        if resource_match is None:
            continue

        attributes = parse_attributes(resource_match.group(0))
        if attributes.get("type", "").casefold() != "aamap":
            continue

        missing = [key for key in ("name", "author", "version") if not attributes.get(key)]
        if missing:
            errors.append(f"{path}: missing Resource attribute(s): {', '.join(missing)}")
            continue

        if "/" in attributes["name"] or "\\" in attributes["name"]:
            errors.append(f"{path}: Resource name cannot be used safely in a filename")
            continue

        records.append(
            MapRecord(
                path=path,
                data=data,
                mode=stat.S_IMODE(path.stat().st_mode),
                resource_start=resource_match.start(),
                resource_end=resource_match.end(),
                attributes=attributes,
            )
        )

    if errors:
        raise ValueError("\n".join(errors))
    if not records:
        raise ValueError(f"no aamap resources found beneath {root}")
    return records


def version_key(version: str) -> tuple[tuple[int, object], ...]:
    tokens = VERSION_TOKEN_RE.findall(version)
    return tuple(
        (1, int(token)) if token.isdigit() else (0, token.casefold())
        for token in tokens
    )


def is_backup_path(path: Path) -> bool:
    return any(part.casefold() == "backup" for part in path.parts)


def canonical_parent(record: MapRecord, root: Path) -> Path:
    relative_parent = record.path.relative_to(root).parent
    parts = [part for part in relative_parent.parts if part.casefold() != "backup"]
    return root.joinpath(*parts)


def logical_name(record: MapRecord) -> str:
    suffix_match = MAP_SUFFIX_RE.search(record.path.name)
    if suffix_match is None:
        return record.name
    stem = record.path.name[: suffix_match.start()]
    exact_version_suffix = re.compile(
        rf"[-.]{re.escape(record.version)}$", re.IGNORECASE
    )
    without_exact_version = exact_version_suffix.sub("", stem)
    if without_exact_version != stem:
        return without_exact_version
    return NUMERIC_FILENAME_VERSION_RE.sub("", stem)


def source_version(record: MapRecord) -> str:
    suffix_match = MAP_SUFFIX_RE.search(record.path.name)
    if suffix_match is None:
        return record.version
    stem = record.path.name[: suffix_match.start()]
    exact_version_suffix = re.search(
        rf"[-.]({re.escape(record.version)})$", stem, re.IGNORECASE
    )
    if exact_version_suffix is not None:
        return exact_version_suffix.group(1)
    numeric_version_suffix = NUMERIC_FILENAME_VERSION_RE.search(stem)
    if numeric_version_suffix is not None:
        return numeric_version_suffix.group(0)[1:]
    return record.version


def map_identity(record: MapRecord, root: Path) -> tuple[str, str]:
    relative_parent = canonical_parent(record, root).relative_to(root)
    return (str(relative_parent).casefold(), logical_name(record).casefold())


def tie_break_key(record: MapRecord, root: Path) -> tuple[object, ...]:
    relative = record.path.relative_to(root)
    expected_name = f"{logical_name(record)}-{source_version(record)}.aamap.xml"
    owner_directory = (
        bool(relative.parts)
        and relative.parts[0].casefold() == record.author.casefold()
    )
    return (
        is_backup_path(relative),
        not owner_directory,
        record.path.name.casefold() != expected_name.casefold(),
        len(relative.parts),
        str(relative).casefold(),
    )


def choose_winners(
    records: list[MapRecord], root: Path
) -> tuple[list[MapRecord], int]:
    groups: dict[tuple[str, str], list[MapRecord]] = defaultdict(list)
    for record in records:
        groups[map_identity(record, root)].append(record)

    winners: list[MapRecord] = []
    tied_newest_groups = 0
    for group in groups.values():
        newest_key = max(version_key(source_version(record)) for record in group)
        newest = [
            record
            for record in group
            if version_key(source_version(record)) == newest_key
        ]
        if len(newest) > 1:
            tied_newest_groups += 1
        winners.append(min(newest, key=lambda record: tie_break_key(record, root)))

    return winners, tied_newest_groups


def destination_for(record: MapRecord, root: Path) -> Path:
    filename = f"{logical_name(record)}-{TARGET_VERSION}.aamap.xml"
    return canonical_parent(record, root) / filename


def update_map(record: MapRecord) -> tuple[bytes, int]:
    resource_tag = record.data[record.resource_start : record.resource_end]
    version_match = next(
        (
            match
            for match in ATTRIBUTE_RE.finditer(resource_tag)
            if match.group(1).lower() == b"version"
        ),
        None,
    )
    if version_match is None:
        raise ValueError(f"{record.path}: Resource tag has no version attribute")

    updated_tag = (
        resource_tag[: version_match.start(3)]
        + TARGET_VERSION.encode("ascii")
        + resource_tag[version_match.end(3) :]
    )
    updated_data = (
        record.data[: record.resource_start]
        + updated_tag
        + record.data[record.resource_end :]
    )
    updated_data, target_count = TARGET_EFFECT_RE.subn(
        lambda match: match.group(1) + match.group(2) + b"win" + match.group(2),
        updated_data,
    )
    return updated_data, target_count


def build_plan(root: Path) -> tuple[
    list[MapRecord],
    list[MapRecord],
    dict[Path, tuple[bytes, int, int]],
    int,
    int,
]:
    records = discover_maps(root)
    winners, tied_newest_groups = choose_winners(records, root)
    outputs: dict[Path, tuple[bytes, int, int]] = {}
    target_count = 0

    for winner in winners:
        destination = destination_for(winner, root)
        if destination in outputs:
            other_source = next(
                record.path
                for record in winners
                if destination_for(record, root) == destination and record.path != winner.path
            )
            raise ValueError(
                f"destination collision: {winner.path} and {other_source} both map to {destination}"
            )
        updated_data, replaced = update_map(winner)
        outputs[destination] = (updated_data, winner.mode, replaced)
        target_count += replaced

    return records, winners, outputs, target_count, tied_newest_groups


def print_plan(
    root: Path,
    records: list[MapRecord],
    winners: list[MapRecord],
    target_count: int,
    tied_newest_groups: int,
) -> None:
    non_numeric = sorted(
        {
            source_version(record)
            for record in records
            if not NUMERIC_VERSION_RE.fullmatch(source_version(record))
        }
    )
    version_mismatch_count = sum(
        source_version(record).casefold() != record.version.casefold()
        for record in records
    )
    rename_count = sum(
        destination_for(winner, root) != winner.path for winner in winners
    )
    print(f"maps discovered: {len(records)}")
    print(f"unique maps retained: {len(winners)}")
    print(f"older/duplicate maps deleted: {len(records) - len(winners)}")
    print(f"retained maps renamed: {rename_count}")
    print(f"target zones changed to win: {target_count}")
    print(f"newest-version ties resolved: {tied_newest_groups}")
    print(f"source filename/header version mismatches: {version_mismatch_count}")
    print(f"output version: {TARGET_VERSION}")
    if non_numeric:
        print(f"non-numeric source versions: {', '.join(non_numeric)}")


def apply_plan(
    records: list[MapRecord], outputs: dict[Path, tuple[bytes, int, int]]
) -> None:
    for record in records:
        record.path.unlink()

    for destination, (data, mode, _) in sorted(outputs.items()):
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(data)
        os.chmod(destination, mode)


def check_repository(root: Path) -> int:
    records = discover_maps(root)
    errors: list[str] = []
    identities: dict[tuple[str, str], list[Path]] = defaultdict(list)
    cockpit_count = 0

    for record in records:
        identities[map_identity(record, root)].append(record.path)
        expected_name = f"{logical_name(record)}-{TARGET_VERSION}.aamap.xml"
        if record.version != TARGET_VERSION:
            errors.append(f"{record.path}: Resource version is {record.version!r}")
        if record.path.name != expected_name:
            errors.append(f"{record.path}: expected filename {expected_name!r}")
        if record.path.parent != canonical_parent(record, root):
            errors.append(f"{record.path}: retained map is still inside a backup directory")
        target_count = len(TARGET_EFFECT_RE.findall(record.data))
        if target_count:
            errors.append(f"{record.path}: still contains {target_count} target zone(s)")

    for paths in identities.values():
        if len(paths) > 1:
            errors.append("duplicate map identity: " + ", ".join(str(path) for path in paths))

    for path in sorted(root.rglob("*.xml")):
        if ".git" in path.parts:
            continue
        data = path.read_bytes()
        resource_match = RESOURCE_RE.search(data)
        if resource_match is None:
            continue
        attributes = parse_attributes(resource_match.group(0))
        resource_type = attributes.get("type", "").casefold()
        filename = path.name.casefold()
        map_suffix = bool(MAP_SUFFIX_RE.search(filename))
        cockpit_suffix = filename.endswith(".aacockpit.xml")

        if map_suffix and resource_type != "aamap":
            errors.append(f"{path}: .aamap.xml file contains Resource type {resource_type!r}")
        if resource_type == "aamap" and not map_suffix:
            errors.append(f"{path}: aamap Resource does not use the .aamap.xml suffix")
        if cockpit_suffix and resource_type != "aacockpit":
            errors.append(f"{path}: .aacockpit.xml file contains Resource type {resource_type!r}")
        if resource_type == "aacockpit":
            cockpit_count += 1
            if not cockpit_suffix:
                errors.append(f"{path}: aacockpit Resource does not use the .aacockpit.xml suffix")
                continue
            name = attributes.get("name")
            version = attributes.get("version")
            if not name or not version:
                errors.append(f"{path}: aacockpit Resource is missing its name or version")
                continue
            expected_name = f"{name}-{version}.aacockpit.xml"
            if path.name != expected_name:
                errors.append(f"{path}: expected cockpit filename {expected_name!r}")

    if errors:
        print("Map normalization check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"Resource normalization check passed for {len(records)} maps "
        f"and {cockpit_count} cockpits."
    )
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--apply", action="store_true", help="apply the normalization plan")
    action.add_argument("--check", action="store_true", help="verify an already normalized tree")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="repository root (defaults to the parent of this script directory)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    try:
        if args.check:
            return check_repository(root)

        records, winners, outputs, target_count, tied_newest_groups = build_plan(root)
        print_plan(root, records, winners, target_count, tied_newest_groups)
        if args.apply:
            apply_plan(records, outputs)
            print("Normalization applied.")
        else:
            print("Dry run only; pass --apply to modify files.")
        return 0
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
