#!/usr/bin/env python3
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

import publish_release


class PublishReleaseTests(unittest.TestCase):
    def test_advances_stable_tombstones_by_release_class(self):
        self.assertEqual(
            publish_release.advance_unavailable_tag("v0.10.0", "minor"),
            "v0.11.0",
        )
        self.assertEqual(
            publish_release.advance_unavailable_tag("v0.9.3", "patch"),
            "v0.9.4",
        )
        self.assertEqual(
            publish_release.advance_unavailable_tag("v1.0.0", "major"),
            "v2.0.0",
        )

    def test_advances_rc_tombstones_by_sequence(self):
        self.assertEqual(
            publish_release.advance_unavailable_tag("v0.10.0-rc.1", "minor"),
            "v0.10.0-rc.2",
        )
        self.assertEqual(
            publish_release.advance_unavailable_tag("v0.10.0-rc.7", "prerelease"),
            "v0.10.0-rc.8",
        )

    def test_promotion_fails_closed_when_stable_tag_is_tombstoned(self):
        with self.assertRaisesRegex(RuntimeError, "refusing to retarget"):
            publish_release.advance_unavailable_tag("v1.0.0", "promote")

    def test_notes_heading_tracks_recovered_tag(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "notes.md"
            path.write_text("# v0.10.0\n\nChanges.\n", encoding="utf-8")
            publish_release.rewrite_notes_heading(path, "v0.10.0", "v0.11.0")
            self.assertEqual(
                path.read_text(encoding="utf-8"),
                "# v0.11.0\n\nChanges.\n",
            )

    def test_notes_recovery_refuses_unexpected_input(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "notes.md"
            path.write_text("# wrong\n", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "must start with"):
                publish_release.rewrite_notes_heading(path, "v0.10.0", "v0.11.0")

    def test_main_skips_provider_tombstone_and_publishes_next_minor(self):
        calls = []

        def fake_command(*args):
            calls.append(args)
            if args[:3] == ("gh", "release", "view"):
                return subprocess.CompletedProcess(args, 1, "", "release not found")
            if args[:3] == ("gh", "release", "create"):
                tag = args[3]
                if tag == "v0.10.0":
                    return subprocess.CompletedProcess(
                        args,
                        1,
                        "",
                        "HTTP 422: tag_name was used by an immutable release",
                    )
                return subprocess.CompletedProcess(args, 0, "", "")
            if args[:3] == ("gh", "release", "edit"):
                return subprocess.CompletedProcess(args, 0, "", "")
            raise AssertionError(args)

        with tempfile.TemporaryDirectory() as directory:
            notes = pathlib.Path(directory) / "notes.md"
            output = pathlib.Path(directory) / "output.txt"
            notes.write_text("# v0.10.0\n\nChanges.\n", encoding="utf-8")
            argv = [
                "publish_release.py",
                "--repository",
                "Avkroken/Avkroken",
                "--tag",
                "v0.10.0",
                "--target-sha",
                "abc123",
                "--notes",
                str(notes),
                "--bump",
                "minor",
                "--prerelease",
                "false",
                "--output",
                str(output),
            ]
            with mock.patch.object(publish_release, "command", fake_command):
                with mock.patch.object(sys, "argv", argv):
                    publish_release.main()

            self.assertEqual(
                notes.read_text(encoding="utf-8").splitlines()[0],
                "# v0.11.0",
            )
            self.assertEqual(output.read_text(encoding="utf-8"), "tag=v0.11.0\n")
            self.assertTrue(
                any(
                    call[:4] == ("gh", "release", "create", "v0.11.0")
                    for call in calls
                )
            )

    def test_main_cleans_new_draft_if_publish_hits_tombstone(self):
        calls = []
        created = set()

        def fake_command(*args):
            calls.append(args)
            if args[:3] == ("gh", "release", "view"):
                tag = args[3]
                if tag in created:
                    payload = {
                        "tagName": tag,
                        "isDraft": True,
                        "isPrerelease": False,
                        "targetCommitish": "abc123",
                    }
                    return subprocess.CompletedProcess(args, 0, json.dumps(payload), "")
                return subprocess.CompletedProcess(args, 1, "", "release not found")
            if args[:3] == ("gh", "release", "create"):
                created.add(args[3])
                return subprocess.CompletedProcess(args, 0, "", "")
            if args[:3] == ("gh", "release", "edit"):
                if args[3] == "v0.10.0":
                    return subprocess.CompletedProcess(
                        args,
                        1,
                        "",
                        "tag_name was used by an immutable release",
                    )
                return subprocess.CompletedProcess(args, 0, "", "")
            if args[:3] == ("gh", "release", "delete"):
                created.discard(args[3])
                return subprocess.CompletedProcess(args, 0, "", "")
            raise AssertionError(args)

        with tempfile.TemporaryDirectory() as directory:
            notes = pathlib.Path(directory) / "notes.md"
            output = pathlib.Path(directory) / "output.txt"
            notes.write_text("# v0.10.0\n\nChanges.\n", encoding="utf-8")
            argv = [
                "publish_release.py",
                "--repository",
                "Avkroken/Avkroken",
                "--tag",
                "v0.10.0",
                "--target-sha",
                "abc123",
                "--notes",
                str(notes),
                "--bump",
                "minor",
                "--prerelease",
                "false",
                "--output",
                str(output),
            ]
            with mock.patch.object(publish_release, "command", fake_command):
                with mock.patch.object(sys, "argv", argv):
                    publish_release.main()

            self.assertEqual(output.read_text(encoding="utf-8"), "tag=v0.11.0\n")
            self.assertTrue(
                any(
                    call[:4] == ("gh", "release", "delete", "v0.10.0")
                    for call in calls
                )
            )


if __name__ == "__main__":
    unittest.main()
