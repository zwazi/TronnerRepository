#!/usr/bin/env python3
"""Normalize imported maps and enforce immutable versioned resources."""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import stat
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


TARGET_WALL_HEIGHT = "4"
TARGET_AXES = "8"
RESOURCE_RE = re.compile(br"<Resource\b[^>]*>", re.IGNORECASE | re.DOTALL)
WALL_TAG_RE = re.compile(br"<Wall\b[^>]*>", re.IGNORECASE | re.DOTALL)
AXES_TAG_RE = re.compile(br"<Axes\b[^>]*>", re.IGNORECASE | re.DOTALL)
FIELD_TAG_RE = re.compile(br"<Field\b[^>]*>", re.IGNORECASE | re.DOTALL)
WALL_LINE_TRAILING_RE = re.compile(
    br"(<Wall\b[^>\r\n]*>)[ \t]+$", re.IGNORECASE | re.MULTILINE
)
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
    filename = f"{logical_name(record)}-{record.version}.aamap.xml"
    return canonical_parent(record, root) / filename


def update_map(record: MapRecord) -> tuple[bytes, int]:
    updated_data = record.data
    updated_data, target_count = TARGET_EFFECT_RE.subn(
        lambda match: match.group(1) + match.group(2) + b"win" + match.group(2),
        updated_data,
    )
    updated_data = WALL_TAG_RE.sub(normalize_wall_tag, updated_data)
    updated_data = WALL_LINE_TRAILING_RE.sub(br"\1", updated_data)
    updated_data = add_default_axes(updated_data, record.path)
    return updated_data, target_count


def set_resource_version(data: bytes, version: str, path: Path) -> bytes:
    resource_match = RESOURCE_RE.search(data)
    if resource_match is None:
        raise ValueError(f"{path}: aamap Resource tag is missing")
    resource_tag = resource_match.group(0)
    version_match = next(
        (
            match
            for match in ATTRIBUTE_RE.finditer(resource_tag)
            if match.group(1).lower() == b"version"
        ),
        None,
    )
    if version_match is None:
        raise ValueError(f"{path}: Resource tag has no version attribute")

    updated_tag = (
        resource_tag[: version_match.start(3)]
        + version.encode("ascii")
        + resource_tag[version_match.end(3) :]
    )
    return (
        data[: resource_match.start()]
        + updated_tag
        + data[resource_match.end() :]
    )


def bump_resource_version(version: str) -> str:
    match = re.match(r"^(.*?)(\d+)$", version)
    if match is None:
        return version + ".1"
    prefix, digits = match.groups()
    bumped = str(int(digits) + 1)
    if len(digits) > 1 and digits.startswith("0"):
        bumped = bumped.zfill(len(digits))
    return prefix + bumped


def destination_for_version(record: MapRecord, root: Path, version: str) -> Path:
    return canonical_parent(record, root) / (
        f"{logical_name(record)}-{version}.aamap.xml"
    )


def add_default_axes(data: bytes, path: Path) -> bytes:
    """Add the standard axis count when a map does not define one."""
    if AXES_TAG_RE.search(data) is not None:
        return data

    field = FIELD_TAG_RE.search(data)
    if field is None:
        raise ValueError(f"{path}: aamap Resource has no Field element")

    remainder = data[field.end() :]
    child = re.search(br"(?:\r\n|\n|\r)([ \t]*)<", remainder)
    if child is not None:
        newline_match = re.match(br"\r\n|\n|\r", child.group(0))
        assert newline_match is not None
        newline = newline_match.group(0)
        indentation = child.group(1)
    else:
        newline = b"\r\n" if b"\r\n" in data else b"\n"
        line_start = data.rfind(b"\n", 0, field.start()) + 1
        field_indentation = data[line_start:field.start()]
        indentation = (
            field_indentation + b"  "
            if field_indentation.strip() == b""
            else b"  "
        )

    axes = b'<Axes number="' + TARGET_AXES.encode("ascii") + b'"/>'
    return data[: field.end()] + newline + indentation + axes + data[field.end() :]


def normalize_wall_tag(match: re.Match[bytes]) -> bytes:
    tag = match.group(0)
    height_matches = [
        attribute
        for attribute in ATTRIBUTE_RE.finditer(tag)
        if attribute.group(1).lower() == b"height"
    ]
    if height_matches:
        for height in reversed(height_matches):
            tag = (
                tag[: height.start(3)]
                + TARGET_WALL_HEIGHT.encode("ascii")
                + tag[height.end(3) :]
            )
        return tag

    closing = re.search(br"(\s*/?>)$", tag, re.DOTALL)
    if closing is None:
        raise ValueError("Wall tag has no closing bracket")
    return (
        tag[: closing.start(1)]
        + b' height="4"'
        + closing.group(1)
    )


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
    reserved = {record.path for record in records}

    for winner in winners:
        updated_data, replaced = update_map(winner)
        if updated_data != winner.data:
            version = bump_resource_version(winner.version)
            destination = destination_for_version(winner, root, version)
            while destination in reserved or destination in outputs:
                version = bump_resource_version(version)
                destination = destination_for_version(winner, root, version)
            updated_data = set_resource_version(updated_data, version, winner.path)
            reserved.add(destination)
        else:
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
    print("output versions: preserved, or bumped when normalization changes bytes")
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


def apply_missing_axes(records: list[MapRecord], root: Path) -> int:
    """Add Axes and assign a new resource identity to every changed map."""
    reserved = {record.path for record in records}
    outputs: list[tuple[MapRecord, Path, bytes]] = []
    for record in records:
        if AXES_TAG_RE.search(record.data) is not None:
            continue
        version = bump_resource_version(record.version)
        destination = destination_for_version(record, root, version)
        while destination in reserved or destination.exists():
            version = bump_resource_version(version)
            destination = destination_for_version(record, root, version)
        data = add_default_axes(record.data, record.path)
        data = set_resource_version(data, version, record.path)
        outputs.append((record, destination, data))
        reserved.add(destination)

    written: list[Path] = []
    try:
        for record, destination, data in outputs:
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_name(
                f".{destination.name}.{os.getpid()}.tmp"
            )
            temporary.write_bytes(data)
            os.chmod(temporary, record.mode)
            os.replace(temporary, destination)
            written.append(destination)
    except Exception:
        for path in written:
            path.unlink(missing_ok=True)
        raise

    for record, destination, _ in outputs:
        if record.path != destination:
            record.path.unlink()
    return len(outputs)


def bump_changed_maps(records: list[MapRecord], root: Path, reference: str) -> int:
    """Bump every currently changed map relative to a Git reference."""
    try:
        changed_output = subprocess.run(
            [
                "git",
                "-C",
                str(root),
                "diff",
                "--name-only",
                "-z",
                reference,
                "--",
                "*.aamap.xml",
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        ).stdout
    except subprocess.CalledProcessError as error:
        detail = error.stderr.decode("utf-8", "replace").strip()
        raise ValueError(f"cannot diff Git reference {reference!r}: {detail}") from error

    changed = {
        (root / encoded.decode("utf-8", "surrogateescape")).resolve()
        for encoded in changed_output.rstrip(b"\0").split(b"\0")
        if encoded
    }
    selected = [record for record in records if record.path.resolve() in changed]
    reserved = {record.path for record in records}
    outputs: list[tuple[MapRecord, Path, bytes]] = []
    for record in selected:
        version = bump_resource_version(record.version)
        destination = destination_for_version(record, root, version)
        while destination in reserved or destination.exists():
            version = bump_resource_version(version)
            destination = destination_for_version(record, root, version)
        outputs.append(
            (
                record,
                destination,
                set_resource_version(record.data, version, record.path),
            )
        )
        reserved.add(destination)

    written: list[Path] = []
    try:
        for record, destination, data in outputs:
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_name(
                f".{destination.name}.{os.getpid()}.tmp"
            )
            temporary.write_bytes(data)
            os.chmod(temporary, record.mode)
            os.replace(temporary, destination)
            written.append(destination)
    except Exception:
        for path in written:
            path.unlink(missing_ok=True)
        raise

    for record, destination, _ in outputs:
        if record.path != destination:
            record.path.unlink()
    return len(outputs)


def immutable_resource_key(attributes: dict[str, str]) -> tuple[str, str, str, str]:
    return (
        attributes["author"].casefold(),
        attributes.get("category", "").strip("/").casefold(),
        attributes["name"].casefold(),
        attributes["version"].casefold(),
    )


def check_version_history(root: Path, reference: str) -> int:
    """Reject changed bytes that reuse an aamap resource identity from Git."""
    try:
        listed = subprocess.run(
            ["git", "-C", str(root), "ls-tree", "-rz", "--name-only", reference],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        ).stdout
    except subprocess.CalledProcessError as error:
        detail = error.stderr.decode("utf-8", "replace").strip()
        raise ValueError(f"cannot read Git reference {reference!r}: {detail}") from error

    historical: dict[tuple[str, str, str, str], set[str]] = defaultdict(set)
    for encoded_path in listed.rstrip(b"\0").split(b"\0"):
        if not encoded_path:
            continue
        relative = encoded_path.decode("utf-8", "surrogateescape")
        if not relative.casefold().endswith(".xml"):
            continue
        try:
            data = subprocess.run(
                ["git", "-C", str(root), "show", f"{reference}:{relative}"],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            ).stdout
        except subprocess.CalledProcessError:
            continue
        resource_match = RESOURCE_RE.search(data)
        if resource_match is None:
            continue
        attributes = parse_attributes(resource_match.group(0))
        if attributes.get("type", "").casefold() != "aamap":
            continue
        if not all(attributes.get(field) for field in ("author", "name", "version")):
            continue
        historical[immutable_resource_key(attributes)].add(
            hashlib.sha256(data).hexdigest()
        )

    errors: list[str] = []
    for record in discover_maps(root):
        key = immutable_resource_key(record.attributes)
        old_hashes = historical.get(key)
        if old_hashes and hashlib.sha256(record.data).hexdigest() not in old_hashes:
            resource = "/".join(part for part in key if part)
            errors.append(
                f"{record.path.relative_to(root)}: changed bytes reuse resource "
                f"identity {resource}; bump its version"
            )

    if errors:
        print("Immutable resource check failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(
        f"Immutable resource check passed against {reference} for "
        f"{len(discover_maps(root))} maps."
    )
    return 0


def check_repository(root: Path) -> int:
    records = discover_maps(root)
    errors: list[str] = []
    identities: dict[tuple[str, str], list[Path]] = defaultdict(list)
    resource_identities: dict[
        tuple[str, str, str, str], list[Path]
    ] = defaultdict(list)
    cockpit_count = 0

    for record in records:
        identities[map_identity(record, root)].append(record.path)
        resource_identities[immutable_resource_key(record.attributes)].append(
            record.path
        )
        expected_name = f"{logical_name(record)}-{record.version}.aamap.xml"
        if record.path.name != expected_name:
            errors.append(f"{record.path}: expected filename {expected_name!r}")
        if record.path.parent != canonical_parent(record, root):
            errors.append(f"{record.path}: retained map is still inside a backup directory")
        target_count = len(TARGET_EFFECT_RE.findall(record.data))
        if target_count:
            errors.append(f"{record.path}: still contains {target_count} target zone(s)")
        if AXES_TAG_RE.search(record.data) is None:
            errors.append(
                f"{record.path}: has no Axes element (expected number={TARGET_AXES!r})"
            )
        incorrect_walls = sum(
            parse_attributes(wall.group(0)).get("height") != TARGET_WALL_HEIGHT
            for wall in WALL_TAG_RE.finditer(record.data)
        )
        if incorrect_walls:
            errors.append(
                f"{record.path}: contains {incorrect_walls} wall(s) without "
                f"height={TARGET_WALL_HEIGHT!r}"
            )

    for paths in identities.values():
        if len(paths) > 1:
            errors.append("duplicate map identity: " + ", ".join(str(path) for path in paths))

    for paths in resource_identities.values():
        if len(paths) > 1:
            errors.append(
                "duplicate immutable resource identity: "
                + ", ".join(str(path) for path in paths)
            )

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
    action.add_argument(
        "--apply-missing-axes",
        action="store_true",
        help=(
            f"add Axes number={TARGET_AXES} to maps that do not define Axes "
            "and bump their versions"
        ),
    )
    action.add_argument("--check", action="store_true", help="verify an already normalized tree")
    action.add_argument(
        "--check-version-history",
        metavar="GIT_REF",
        help="reject changed map bytes that reuse a resource identity from GIT_REF",
    )
    action.add_argument(
        "--bump-changed-since",
        metavar="GIT_REF",
        help="bump every map currently changed relative to GIT_REF",
    )
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
        if args.apply_missing_axes:
            count = apply_missing_axes(discover_maps(root), root)
            print(
                f"Added Axes number={TARGET_AXES} and bumped the version of "
                f"{count} map(s)."
            )
            return 0
        if args.check:
            return check_repository(root)
        if args.check_version_history:
            return check_version_history(root, args.check_version_history)
        if args.bump_changed_since:
            count = bump_changed_maps(
                discover_maps(root), root, args.bump_changed_since
            )
            print(f"Bumped the version of {count} changed map(s).")
            return 0

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
