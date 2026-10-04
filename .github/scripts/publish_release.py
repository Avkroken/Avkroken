#!/usr/bin/env python3
import argparse
import json
import pathlib
import re
import subprocess
import sys

STABLE = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")
RC = re.compile(r"^v(\d+)\.(\d+)\.(\d+)-rc\.(\d+)$")
TOMBSTONE_MARKER = "tag_name was used by an immutable release"


def command(*args):
    return subprocess.run(
        list(args),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def release_info(repository, tag):
    result = command(
        "gh",
        "release",
        "view",
        tag,
        "--repo",
        repository,
        "--json",
        "tagName,isDraft,isPrerelease,targetCommitish",
    )
    if result.returncode == 0:
        return json.loads(result.stdout)
    combined = (result.stdout + "\n" + result.stderr).strip().lower()
    if "release not found" in combined:
        return None
    raise RuntimeError(combined or f"failed to inspect release {tag}")


def advance_unavailable_tag(tag, bump):
    rc_match = RC.fullmatch(tag)
    if rc_match:
        major, minor, patch, sequence = (int(part) for part in rc_match.groups())
        return f"v{major}.{minor}.{patch}-rc.{sequence + 1}"

    stable_match = STABLE.fullmatch(tag)
    if not stable_match:
        raise ValueError(f"unsupported release tag: {tag}")
    major, minor, patch = (int(part) for part in stable_match.groups())

    if bump == "patch":
        return f"v{major}.{minor}.{patch + 1}"
    if bump == "minor":
        return f"v{major}.{minor + 1}.0"
    if bump == "major":
        return f"v{major + 1}.0.0"
    if bump == "promote":
        raise RuntimeError(
            "The stable tag for an active prerelease is permanently unavailable; "
            "refusing to retarget the promotion."
        )
    raise ValueError(f"unsupported stable release bump: {bump}")


def rewrite_notes_heading(path, old_tag, new_tag):
    notes_path = pathlib.Path(path)
    text = notes_path.read_text(encoding="utf-8")
    expected = f"# {old_tag}"
    lines = text.splitlines()
    if not lines or lines[0] != expected:
        raise RuntimeError(
            f"release notes must start with {expected!r} before tag recovery"
        )
    lines[0] = f"# {new_tag}"
    suffix = "\n" if text.endswith("\n") else ""
    notes_path.write_text("\n".join(lines) + suffix, encoding="utf-8")


def verify_existing_release(info, tag, target_sha, prerelease):
    if info.get("tagName") != tag:
        raise RuntimeError(f"release lookup returned unexpected tag for {tag}")
    if info.get("targetCommitish") != target_sha:
        raise RuntimeError(
            f"release {tag} targets {info.get('targetCommitish')}, expected {target_sha}"
        )
    if bool(info.get("isPrerelease")) != prerelease:
        raise RuntimeError(
            f"release {tag} prerelease state does not match the calculated channel"
        )


def create_draft(repository, tag, target_sha, notes, prerelease):
    args = [
        "gh",
        "release",
        "create",
        tag,
        "--repo",
        repository,
        "--target",
        target_sha,
        "--title",
        tag,
        "--notes-file",
        notes,
        "--draft",
    ]
    if prerelease:
        args.append("--prerelease")
    return command(*args)


def publish_draft(repository, tag):
    return command(
        "gh",
        "release",
        "edit",
        tag,
        "--repo",
        repository,
        "--draft=false",
    )


def delete_draft(repository, tag):
    return command(
        "gh",
        "release",
        "delete",
        tag,
        "--repo",
        repository,
        "--yes",
    )


def write_output(path, name, value):
    if not path:
        return
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(f"{name}={value}\n")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository", required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--target-sha", required=True)
    parser.add_argument("--notes", required=True)
    parser.add_argument(
        "--bump",
        choices=("patch", "minor", "major", "promote", "prerelease"),
        required=True,
    )
    parser.add_argument("--prerelease", choices=("true", "false"), required=True)
    parser.add_argument("--output")
    return parser.parse_args()


def main():
    args = parse_args()
    prerelease = args.prerelease == "true"
    candidate = args.tag

    for attempt in range(20):
        created_here = False
        info = release_info(args.repository, candidate)
        if info is not None:
            verify_existing_release(info, candidate, args.target_sha, prerelease)
            if not info.get("isDraft"):
                print(f"Release {candidate} already exists and matches the target.")
                write_output(args.output, "tag", candidate)
                return
            print(f"Recovering existing draft release {candidate}.")
        else:
            created = create_draft(
                args.repository,
                candidate,
                args.target_sha,
                args.notes,
                prerelease,
            )
            if created.returncode != 0:
                combined = (created.stdout + "\n" + created.stderr).strip()
                if TOMBSTONE_MARKER in combined.lower():
                    next_tag = advance_unavailable_tag(candidate, args.bump)
                    rewrite_notes_heading(args.notes, candidate, next_tag)
                    print(
                        f"GitHub permanently reserves {candidate}; "
                        f"retrying with {next_tag}.",
                        file=sys.stderr,
                    )
                    candidate = next_tag
                    continue
                raise RuntimeError(combined or f"failed to create draft {candidate}")
            created_here = True
            print(f"Created draft release {candidate}.")

        published = publish_draft(args.repository, candidate)
        if published.returncode != 0:
            combined = (published.stdout + "\n" + published.stderr).strip()
            if TOMBSTONE_MARKER in combined.lower() and created_here:
                stale = release_info(args.repository, candidate)
                if stale is not None:
                    if not stale.get("isDraft"):
                        raise RuntimeError(
                            f"release {candidate} became published despite a failed publish response"
                        )
                    deleted = delete_draft(args.repository, candidate)
                    if deleted.returncode != 0:
                        cleanup_error = (deleted.stdout + "\n" + deleted.stderr).strip()
                        raise RuntimeError(
                            cleanup_error
                            or f"failed to remove unusable draft release {candidate}"
                        )
                next_tag = advance_unavailable_tag(candidate, args.bump)
                rewrite_notes_heading(args.notes, candidate, next_tag)
                print(
                    f"GitHub rejected {candidate} at immutable publication; "
                    f"retrying with {next_tag}.",
                    file=sys.stderr,
                )
                candidate = next_tag
                continue
            raise RuntimeError(
                combined or f"failed to publish draft release {candidate}"
            )
        print(f"Published immutable release {candidate}.")
        write_output(args.output, "tag", candidate)
        return

    raise RuntimeError("exhausted immutable-release tag recovery attempts")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError) as error:
        raise SystemExit(str(error))
