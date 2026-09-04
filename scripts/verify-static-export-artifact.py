#!/usr/bin/env python3
"""Validate and extract a static-export tarball without following archive links."""

from __future__ import annotations

import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import sys
import tarfile

MAX_ARCHIVE_BYTES = 512 * 1024 * 1024
MAX_EXPANDED_BYTES = 1024 * 1024 * 1024
MAX_FILE_BYTES = 128 * 1024 * 1024
MAX_MEMBERS = 20_000


class UnsafeArchiveError(ValueError):
    """Raised when an archive is unsafe or outside the static-export contract."""


def normalized_member_path(member: tarfile.TarInfo) -> Path | None:
    name = member.name
    if not name or "\x00" in name or "\\" in name:
        raise UnsafeArchiveError(f"invalid archive member name: {name!r}")

    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts:
        raise UnsafeArchiveError(f"archive member escapes output root: {name!r}")

    parts = tuple(part for part in path.parts if part not in ("", "."))
    if not parts:
        if member.isdir():
            return None
        raise UnsafeArchiveError("archive root entry must be a directory")

    return Path(*parts)


def validated_members(archive: tarfile.TarFile) -> tuple[list[tuple[tarfile.TarInfo, Path]], int]:
    members: list[tuple[tarfile.TarInfo, Path]] = []
    seen: set[Path] = set()
    expanded_bytes = 0

    for member in archive:
        if len(members) >= MAX_MEMBERS:
            raise UnsafeArchiveError(f"archive exceeds {MAX_MEMBERS} members")
        if not (member.isdir() or member.isfile()):
            raise UnsafeArchiveError(
                f"archive member is not a regular file or directory: {member.name!r}"
            )

        relative = normalized_member_path(member)
        if relative is None:
            continue
        if relative in seen:
            raise UnsafeArchiveError(f"duplicate archive member: {member.name!r}")
        seen.add(relative)

        if member.isfile():
            if member.size < 0 or member.size > MAX_FILE_BYTES:
                raise UnsafeArchiveError(f"archive member is too large: {member.name!r}")
            expanded_bytes += member.size
            if expanded_bytes > MAX_EXPANDED_BYTES:
                raise UnsafeArchiveError("archive exceeds expanded-size limit")

        members.append((member, relative))

    if not members:
        raise UnsafeArchiveError("archive contains no static-export files")
    return members, expanded_bytes


def verify_extracted_tree(output: Path) -> None:
    for root, directories, files in os.walk(output, followlinks=False):
        for name in [*directories, *files]:
            entry = Path(root, name)
            mode = entry.lstat().st_mode
            if not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
                raise UnsafeArchiveError(f"extracted entry is not a regular file or directory: {entry}")

    index = output / "index.html"
    if not index.is_file() or index.is_symlink():
        raise UnsafeArchiveError("static export is missing a regular index.html")


def extract_static_export(archive_path: Path, output: Path) -> tuple[int, int]:
    mode = archive_path.lstat().st_mode
    if not stat.S_ISREG(mode):
        raise UnsafeArchiveError("archive path must be a regular file")
    if archive_path.stat().st_size > MAX_ARCHIVE_BYTES:
        raise UnsafeArchiveError("compressed archive exceeds size limit")
    if output.exists() or output.is_symlink():
        raise UnsafeArchiveError("output path must not already exist")

    created_output = False
    try:
        with tarfile.open(archive_path, mode="r:gz") as archive:
            members, expanded_bytes = validated_members(archive)
            output.mkdir(mode=0o700)
            created_output = True

            for member, relative in members:
                target = output / relative
                if member.isdir():
                    target.mkdir(mode=0o700, parents=True, exist_ok=True)
                    continue

                target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                source = archive.extractfile(member)
                if source is None:
                    raise UnsafeArchiveError(f"unable to read archive member: {member.name!r}")
                with source, target.open("xb") as destination:
                    shutil.copyfileobj(source, destination, length=1024 * 1024)

        verify_extracted_tree(output)
        return len(members), expanded_bytes
    except Exception:
        if created_output:
            shutil.rmtree(output)
        raise


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(f"Usage: {argv[0]} ARCHIVE OUTPUT_DIR", file=sys.stderr)
        return 2

    try:
        members, expanded_bytes = extract_static_export(Path(argv[1]), Path(argv[2]))
    except (OSError, tarfile.TarError, UnsafeArchiveError) as error:
        print(f"Unsafe static-export artifact: {error}", file=sys.stderr)
        return 1

    print(f"Validated {members} members ({expanded_bytes} expanded bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
