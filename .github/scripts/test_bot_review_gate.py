#!/usr/bin/env python3
"""Execute the bot lifecycle shell against a local, mutation-recording GitHub stub."""
import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / '.github/workflows/bot-pr-lifecycle.yml'
SHA = 'a' * 40

GH_STUB = r'''#!/usr/bin/env python3
import json
import os
from pathlib import Path
import sys

args = sys.argv[1:]
fixture = json.loads(Path(os.environ['FIXTURE']).read_text())
with open(os.environ['CALLS'], 'a') as log:
    log.write(json.dumps(args) + '\n')
if args[:2] == ['api', 'graphql']:
    if fixture.get('withdraw_queue_during_review'):
        fixture['pr']['auto_merge'] = None
        Path(os.environ['FIXTURE']).write_text(json.dumps(fixture))
    response = fixture['review']
    if 'review_after_first' in fixture:
        fixture['review'] = fixture.pop('review_after_first')
        Path(os.environ['FIXTURE']).write_text(json.dumps(fixture))
    print(json.dumps(response))
    sys.exit(fixture.get('review_exit', 0))
if args[:2] == ['pr', 'merge']:
    sys.exit(fixture.get('disable_exit', 0) if '--disable-auto' in args else 0)
if args[0] == 'api':
    endpoint = next((arg for arg in args if arg.startswith('repos/')), '')
    if endpoint.endswith('/update-branch'):
        sys.exit(1)  # Do not enter the polling loop in a unit test.
    if '/pulls?' in endpoint:
        print(17)
    elif endpoint.endswith('/pulls/17'):
        print(json.dumps(fixture['pr']))
    elif endpoint.endswith('/permission'):
        print(json.dumps({'permission': 'write'}))
    elif '--jq' in args:
        print('main')
    else:
        print(json.dumps({'allow_squash_merge': True}))
    sys.exit(0)
raise SystemExit('Unexpected gh call: ' + repr(args))
'''


def review(state, author='reviewer', order=1, sha=SHA):
    return {'author': {'login': author}, 'state': state,
            'commit': {'oid': sha},
            'submittedAt': f'2026-10-09T00:00:{order:02d}Z'}


class BotReviewGateTests(unittest.TestCase):
    def setUp(self):
        self.fixture = {
            'pr': {'user': {'login': 'dependabot[bot]', 'type': 'Bot'}, 'state': 'open',
                   'draft': False, 'base': {'ref': 'main'},
                   'head': {'repo': {'full_name': 'Avkroken/Avkroken'},
                            'ref': 'dependabot/example', 'sha': SHA},
                   'html_url': 'https://github.com/Avkroken/Avkroken/pull/17',
                   'mergeable_state': 'clean', 'auto_merge': {'enabled_by': {'login': 'maintainer'}}},
            'review': {'data': {'repository': {'pullRequest': {
                'headRefOid': SHA, 'reviewDecision': 'APPROVED',
                'reviewThreads': {'nodes': [], 'pageInfo': {'hasNextPage': False}},
                'reviews': {'nodes': [review('APPROVED')], 'pageInfo': {'hasNextPage': False}},
            }}}},
        }
        self.state = self.fixture['review']['data']['repository']['pullRequest']

    def run_workflow(self, workflow=WORKFLOW):
        script = textwrap.dedent(workflow.read_text().split('        run: |\n', 1)[1])
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stub = root / 'gh'
            stub.write_text(GH_STUB)
            stub.chmod(0o755)
            fixture = root / 'fixture.json'
            fixture.write_text(json.dumps(self.fixture))
            calls = root / 'calls.jsonl'
            env = {**os.environ, 'PATH': f'{root}:{os.environ["PATH"]}',
                   'FIXTURE': str(fixture), 'CALLS': str(calls),
                   'REPOSITORY': 'Avkroken/Avkroken', 'GH_TOKEN': 'test-only',
                   'EVENT_PR_NUMBER': '', 'BASH_ENV': '/dev/null'}
            result = subprocess.run(['bash'], input=script, text=True, env=env,
                                    capture_output=True, timeout=10)
            return result, [json.loads(line) for line in calls.read_text().splitlines()]

    def assert_blocked(self):
        result, calls = self.run_workflow()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any('--auto' in call for call in calls), calls)
        self.assertFalse(any(any('/update-branch' in arg for arg in call) for call in calls), calls)
        if self.fixture['pr'].get('auto_merge') is not None:
            self.assertTrue(any('--disable-auto' in call for call in calls), calls)

    def assert_pending(self):
        result, calls = self.run_workflow()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any(call[:2] == ['pr', 'merge'] for call in calls), calls)
        self.assertFalse(any('/update-branch' in arg for call in calls for arg in call), calls)
        self.assertIn('review gate pending', result.stdout)

    def test_clean_queued_reviews_never_resubmit_auto_merge(self):
        result, calls = self.run_workflow()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(any('graphql' in call for call in calls), calls)
        self.assertFalse(any(call[:2] == ['pr', 'merge'] for call in calls), calls)
        self.assertIn('remains queued', result.stdout)

    def test_unqueued_bot_pr_never_enables_auto_merge(self):
        # A GitHub approval is not user consent to enter the native queue.
        self.fixture['pr']['auto_merge'] = None
        result, calls = self.run_workflow()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any('--auto' in call for call in calls), calls)
        self.assertFalse(any('--disable-auto' in call for call in calls), calls)
        self.assertFalse(any('graphql' in call for call in calls), calls)
        self.assertFalse(any('/update-branch' in arg
                             for call in calls for arg in call), calls)

    def test_explicitly_queued_bot_pr_passes_review_gate(self):
        self.assertIsNotNone(self.fixture['pr']['auto_merge'])
        result, calls = self.run_workflow()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(any('graphql' in call for call in calls), calls)
        self.assertFalse(any(call[:2] == ['pr', 'merge'] for call in calls), calls)

    def test_withdrawal_during_review_does_not_requeue(self):
        # An earlier PR snapshot still says queued; the user revokes consent
        # while the independent review lookup is running.
        self.fixture['withdraw_queue_during_review'] = True
        result, calls = self.run_workflow()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(any('graphql' in call for call in calls), calls)
        self.assertFalse(any(call[:2] == ['pr', 'merge'] for call in calls), calls)

    def test_unresolved_threads_including_outdated_block(self):
        for outdated in (False, True):
            with self.subTest(outdated=outdated):
                self.state['reviewThreads']['nodes'] = [{'isResolved': False, 'isOutdated': outdated}]
                self.assert_blocked()

    def test_active_request_survives_later_comment(self):
        self.state['reviews']['nodes'] = [review('CHANGES_REQUESTED'), review('COMMENTED', order=2)]
        self.assert_blocked()

    def test_other_reviewer_approval_does_not_clear_request(self):
        self.state['reviews']['nodes'] = [review('CHANGES_REQUESTED'), review('APPROVED', 'other', 2)]
        self.assert_blocked()

    def test_later_approval_or_dismissal_clears_same_reviewer_request(self):
        for state in ('APPROVED', 'DISMISSED'):
            with self.subTest(state=state):
                self.state['reviews']['nodes'] = [
                    review('APPROVED', 'other', 1),
                    review('CHANGES_REQUESTED'),
                    review(state, order=2),
                ]
                result, calls = self.run_workflow()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertFalse(any(call[:2] == ['pr', 'merge'] for call in calls), calls)

    def test_negative_aggregate_review_blocks(self):
        self.state['reviewDecision'] = 'CHANGES_REQUESTED'
        self.assert_blocked()

    def test_pending_or_unknown_aggregate_review_preserves_queue(self):
        for decision in ('REVIEW_REQUIRED', 'UNKNOWN', None):
            with self.subTest(decision=decision):
                self.state['reviewDecision'] = decision
                self.assert_pending()

    def test_missing_or_pending_approval_preserves_queue(self):
        for reviews in ([], [review('PENDING')], [review('COMMENTED')]):
            with self.subTest(reviews=reviews):
                self.state['reviews']['nodes'] = reviews
                self.assert_pending()

    def test_truncated_review_connections_preserve_queue(self):
        for connection in ('reviews', 'reviewThreads'):
            with self.subTest(connection=connection):
                self.state[connection]['pageInfo']['hasNextPage'] = True
                result, calls = self.run_workflow()
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(any('--disable-auto' in call for call in calls), calls)
                self.state[connection]['pageInfo']['hasNextPage'] = False

    def test_api_failure_and_incomplete_responses_preserve_queue(self):
        valid = copy.deepcopy(self.fixture['review'])
        for payload, exit_code in ((valid, 1), ({}, 0),
                                   ({'data': {'repository': {'pullRequest': None}}}, 0),
                                   ({**valid, 'errors': [{'message': 'partial response'}]}, 0)):
            with self.subTest(payload=payload, exit_code=exit_code):
                self.fixture['review'] = payload
                self.fixture['review_exit'] = exit_code
                result, calls = self.run_workflow()
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(any('--disable-auto' in call for call in calls), calls)
                self.assertFalse(any('--auto' in call for call in calls), calls)

    def test_stale_commit_approval_cannot_authorize_current_head(self):
        self.state['reviewDecision'] = 'APPROVED'
        self.state['reviews']['nodes'] = [review('APPROVED', sha='b' * 40)]
        self.assert_pending()

    def test_dismissed_current_head_approval_does_not_count(self):
        self.state['reviewDecision'] = 'APPROVED'
        self.state['reviews']['nodes'] = [
            review('APPROVED', 'reviewer', 1, SHA),
            review('DISMISSED', 'reviewer', 2, SHA),
            review('APPROVED', 'other', 3, 'b' * 40),
        ]
        self.assert_pending()

    def test_missing_commit_identity_preserves_queue(self):
        self.state['reviews']['nodes'] = [
            {'author': {'login': 'reviewer'}, 'state': 'APPROVED',
             'submittedAt': '2026-10-09T00:00:01Z'}
        ]
        self.assert_pending()

    def test_latest_commit_approval_permits_gated_bot_queue(self):
        self.state['reviews']['nodes'] = [
            review('APPROVED', 'reviewer', sha='b' * 40),
            review('APPROVED', 'reviewer', 2, SHA),
        ]
        result, calls = self.run_workflow()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any(call[:2] == ['pr', 'merge'] for call in calls), calls)

    def test_changed_head_preserves_queue(self):
        self.state['headRefOid'] = 'b' * 40
        self.assert_pending()

    def test_malformed_review_fields_preserve_queue(self):
        valid = copy.deepcopy(self.state)
        variants = [
            ({'reviews': {'nodes': [], 'pageInfo': {}}}, True),
            ({'reviewThreads': {'nodes': None, 'pageInfo': {'hasNextPage': False}}}, True),
            ({'reviewThreads': {'nodes': [{}], 'pageInfo': {'hasNextPage': False}}}, False),
            ({'reviews': {'nodes': [review('UNKNOWN')], 'pageInfo': {'hasNextPage': False}}}, False),
            ({'reviews': {'nodes': [review('CHANGES_REQUESTED', None)],
                          'pageInfo': {'hasNextPage': False}}}, False),
        ]
        for fields, unreadable in variants:
            with self.subTest(fields=fields):
                self.state.clear()
                self.state.update({**valid, **fields})
                if unreadable:
                    result, calls = self.run_workflow()
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse(any('--disable-auto' in call for call in calls), calls)
                else:
                    self.assert_pending()
        self.state.clear()
        self.state.update(valid)
        del self.state['reviewDecision']
        result, calls = self.run_workflow()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any('--disable-auto' in call for call in calls), calls)

    def test_resolved_outdated_thread_still_requires_real_approval(self):
        self.state['reviewDecision'] = None
        self.state['reviewThreads']['nodes'] = [{'isResolved': True, 'isOutdated': True}]
        self.assert_pending()

    def test_agent_gate_statuses_at_both_call_sites(self):
        self.fixture['pr']['user'] = {'login': 'maintainer', 'type': 'User'}
        self.fixture['pr']['mergeable'] = True
        valid = copy.deepcopy(self.state)
        variants = [
            ({'reviewDecision': 'CHANGES_REQUESTED'}, 0, True),
            ({'reviewThreads': {'nodes': [{'isResolved': False}],
                               'pageInfo': {'hasNextPage': False}}}, 0, True),
            ({'reviewDecision': 'REVIEW_REQUIRED'}, 0, False),
            ({'reviews': {'nodes': [], 'pageInfo': {'hasNextPage': False}}}, 0, False),
            ({'reviews': {'nodes': [review('APPROVED', sha='b' * 40)],
                         'pageInfo': {'hasNextPage': False}}}, 0, False),
            ({'headRefOid': 'b' * 40}, 0, False),
            ({'reviews': {'nodes': [], 'pageInfo': {'hasNextPage': True}}}, 1, False),
        ]
        workflow = WORKFLOW.with_name('agent-automerge-policy.yml')
        for fields, exit_code, disable in variants:
            for gate_call in (1, 2):
                with self.subTest(fields=fields, gate_call=gate_call):
                    payload = {'data': {'repository': {'pullRequest': {**valid, **fields}}}}
                    self.fixture['review'] = copy.deepcopy(payload)
                    self.fixture.pop('review_after_first', None)
                    if gate_call == 2:
                        self.fixture['review'] = {'data': {'repository': {'pullRequest': valid}}}
                        self.fixture['review_after_first'] = payload
                    result, calls = self.run_workflow(workflow)
                    self.assertEqual(result.returncode, exit_code, result.stderr)
                    self.assertEqual(sum('graphql' in call for call in calls), gate_call, calls)
                    merges = [call for call in calls if call[:2] == ['pr', 'merge']]
                    if disable:
                        self.assertEqual(len(merges), 1, calls)
                        self.assertIn('--disable-auto', merges[0])
                    else:
                        self.assertEqual(merges, [], calls)

    def test_draft_fork_and_other_authors_remain_excluded(self):
        valid = copy.deepcopy(self.fixture['pr'])
        for fields in ({'draft': True}, {'user': {'login': 'another-user', 'type': 'User'}},
                       {'head': {**valid['head'], 'repo': {'full_name': 'other/fork'}}}):
            with self.subTest(fields=fields):
                self.fixture['pr'] = {**valid, **fields}
                result, calls = self.run_workflow()
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertFalse(any(call[:2] == ['pr', 'merge'] for call in calls), calls)
                self.assertFalse(any('graphql' in call for call in calls), calls)

    def test_existing_automerge_is_revoked_before_behind_branch_update(self):
        self.fixture['pr'].update(auto_merge={'enabled_by': {}}, mergeable_state='behind')
        self.state['reviewThreads']['nodes'] = [{'isResolved': False}]
        self.assert_blocked()

    def test_revocation_failure_is_reported(self):
        self.state['reviewDecision'] = 'CHANGES_REQUESTED'
        self.fixture['pr']['auto_merge'] = {'enabled_by': {}}
        self.fixture['disable_exit'] = 1
        result, calls = self.run_workflow()
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(any('--auto' in call for call in calls), calls)


if __name__ == '__main__':
    unittest.main()
