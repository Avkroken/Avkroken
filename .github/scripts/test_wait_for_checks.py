#!/usr/bin/env python3
import importlib.util
import pathlib
import unittest

MODULE_PATH = pathlib.Path(__file__).with_name("wait_for_checks.py")
SPEC = importlib.util.spec_from_file_location("wait_for_checks", MODULE_PATH)
wait_for_checks = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(wait_for_checks)


def check(name, details_url="https://github.com/example/actions/runs/1/job/1"):
    return {"name": name, "details_url": details_url}


class RelevantCheckRunsTests(unittest.TestCase):
    def test_ignores_dynamic_dependabot_when_not_required(self):
        items = [
            check("Portal"),
            check("Dependabot"),
            check("CodeQL"),
            check("Workers Builds: avkroken"),
        ]

        relevant = wait_for_checks.relevant_check_runs(
            items,
            {"Portal"},
            "/actions/runs/999/",
        )

        self.assertEqual(
            [item["name"] for item in relevant],
            ["Portal", "CodeQL", "Workers Builds: avkroken"],
        )

    def test_keeps_dependabot_when_explicitly_required(self):
        items = [check("Dependabot")]

        relevant = wait_for_checks.relevant_check_runs(
            items,
            {"Dependabot"},
            "/actions/runs/999/",
        )

        self.assertEqual(relevant, items)

    def test_always_ignores_release_self_checks(self):
        items = [
            check("Semantic release"),
            check("Validate semantic release"),
            check("Portal"),
        ]

        relevant = wait_for_checks.relevant_check_runs(
            items,
            {"Portal"},
            "/actions/runs/999/",
        )

        self.assertEqual([item["name"] for item in relevant], ["Portal"])

    def test_ignores_checks_from_the_current_release_run(self):
        items = [
            check(
                "Portal",
                "https://github.com/Avkroken/Avkroken/actions/runs/123/job/456",
            ),
            check(
                "Portal",
                "https://github.com/Avkroken/Avkroken/actions/runs/124/job/457",
            ),
        ]

        relevant = wait_for_checks.relevant_check_runs(
            items,
            {"Portal"},
            "/actions/runs/123/",
        )

        self.assertEqual(len(relevant), 1)
        self.assertIn("/actions/runs/124/", relevant[0]["details_url"])

    def test_non_required_failures_remain_in_gate_except_explicit_exceptions(self):
        items = [
            check("CodeQL"),
            check("Workers Builds: avkroken"),
            check("External policy"),
        ]

        relevant = wait_for_checks.relevant_check_runs(
            items,
            {"Portal"},
            "/actions/runs/999/",
        )

        self.assertEqual(relevant, items)


if __name__ == "__main__":
    unittest.main()
