#!/usr/bin/env python3
"""Execute both lifecycle shells against a local, mutation-recording GitHub stub."""
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
    if fixture.get('review_exits'):
        fixture['review_exit'] = fixture['review_exits'].pop(0)
        Path(os.environ['FIXTURE']).write_text(json.dumps(fixture))
    if fixture.get('withdraw_queue_during_review'):
        fixture['pr']['auto_merge'] = None
        Path(os.environ['FIXTURE']).write_text(json.dumps(fixture))
    print(fixture.get('review_raw', json.dumps(fixture['review'])))
    sys.exit(fixture.get('review_exit', 0))
if args[:2] == ['pr', 'merge']:
    sys.exit(fixture.get('disable_exit', 0) if '--disable-auto' in args else 0)
if args[0] == 'api':
    endpoint = next((arg for arg in args if arg.startswith('repos/')), '')
    if endpoint.endswith('/update-branch'):
        sys.exit(1)  # Do not enter the polling loop in a unit test.
    if '/pulls?' in endpoint:
        print('\n'.join(map(str, fixture.get('candidates', [17]))))
    elif endpoint.endswith('/permission'):
        print(json.dumps({'permission': 'write'}))
    elif endpoint.endswith(('/pulls/17', '/pulls/18')):
        print(json.dumps(fixture['pr']))
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
    workflow = WORKFLOW

    def setUp(self):
        self.fixture = {
            'pr': {'user': {'login': 'dependabot[bot]', 'type': 'Bot'}, 'state': 'open',
                   'draft': False, 'base': {'ref': 'main'},
                   'head': {'repo': {'full_name': 'Avkroken/Avkroken'},
                            'ref': 'dependabot/example', 'sha': SHA},
                   'html_url': 'https://github.com/Avkroken/Avkroken/pull/17',
                   'mergeable': True, 'mergeable_state': 'clean', 'auto_merge': {'enabled_by': {'login': 'maintainer'}}},
            'review': {'data': {'repository': {'pullRequest': {
                'headRefOid': SHA, 'reviewDecision': 'APPROVED',
                'reviewThreads': {'nodes': [], 'pageInfo': {'hasNextPage': False}},
                'reviews': {'nodes': [review('APPROVED')], 'pageInfo': {'hasNextPage': False}},
            }}}},
        }
        self.state = self.fixture['review']['data']['repository']['pullRequest']

    def run_workflow(self):
        script = textwrap.dedent(self.workflow.read_text().split('        run: |\n', 1)[1])
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
                   'EVENT_PR_NUMBER': ''}
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

    def assert_retry(self):
        result, calls = self.run_workflow()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertFalse(any(call[:2] == ['pr', 'merge'] for call in calls), calls)
        self.assertFalse(any('/update-branch' in arg for call in calls for arg in call), calls)
        self.assertIn('retry', result.stdout)

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

    def test_required_or_negative_aggregate_review_blocks(self):
        for decision in ('REVIEW_REQUIRED', 'CHANGES_REQUESTED'):
            with self.subTest(decision=decision):
                self.state['reviewDecision'] = decision
                self.assert_blocked()

    def test_truncated_review_connections_preserve_consent(self):
        for connection in ('reviews', 'reviewThreads'):
            with self.subTest(connection=connection):
                self.state[connection]['pageInfo']['hasNextPage'] = True
                self.assert_retry()
                self.state[connection]['pageInfo']['hasNextPage'] = False

    def test_api_failure_and_incomplete_responses_preserve_consent(self):
        valid = copy.deepcopy(self.fixture['review'])
        for payload, exit_code in ((valid, 1), ({}, 0),
                                   ({'data': {'repository': {'pullRequest': None}}}, 0),
                                   ({**valid, 'errors': [{'message': 'partial response'}]}, 0)):
            with self.subTest(payload=payload, exit_code=exit_code):
                self.fixture['review'] = payload
                self.fixture['review_exit'] = exit_code
                self.assert_retry()

    def test_http_errors_preserve_consent(self):
        for status in (403, 429, 500, 502, 503):
            with self.subTest(status=status):
                self.fixture['review_exit'] = 1
                self.fixture['review_raw'] = f'HTTP {status}'
                self.assert_retry()

    def test_invalid_json_and_unknown_decision_preserve_consent(self):
        self.fixture['review_raw'] = '{'
        self.assert_retry()
        del self.fixture['review_raw']
        self.state['reviewDecision'] = 'UNKNOWN'
        self.assert_retry()

    def test_review_failure_does_not_skip_remaining_prs(self):
        self.fixture['candidates'] = [17, 18]
        self.fixture['review_exits'] = [1, 0, 0]
        result, calls = self.run_workflow()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertTrue(any('number=18' in call for call in calls), calls)
        self.assertFalse(any(call[:2] == ['pr', 'merge'] for call in calls), calls)

    def test_successful_retry_on_same_pr_does_not_requeue(self):
        self.fixture['review_exit'] = 1
        self.assert_retry()
        self.fixture['review_exit'] = 0
        result, calls = self.run_workflow()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('remains queued', result.stdout)
        self.assertFalse(any(call[:2] == ['pr', 'merge'] for call in calls), calls)

    def test_stale_commit_approval_cannot_authorize_current_head(self):
        self.state['reviewDecision'] = 'APPROVED'
        self.state['reviews']['nodes'] = [review('APPROVED', sha='b' * 40)]
        self.assert_blocked()

    def test_dismissed_current_head_approval_does_not_count(self):
        self.state['reviewDecision'] = 'APPROVED'
        self.state['reviews']['nodes'] = [
            review('APPROVED', 'reviewer', 1, SHA),
            review('DISMISSED', 'reviewer', 2, SHA),
            review('APPROVED', 'other', 3, 'b' * 40),
        ]
        self.assert_blocked()

    def test_missing_commit_identity_blocks_approval(self):
        self.state['reviews']['nodes'] = [
            {'author': {'login': 'reviewer'}, 'state': 'APPROVED',
             'submittedAt': '2026-10-09T00:00:01Z'}
        ]
        self.assert_blocked()

    def test_latest_commit_approval_permits_gated_bot_queue(self):
        self.state['reviews']['nodes'] = [
            review('APPROVED', 'reviewer', sha='b' * 40),
            review('APPROVED', 'reviewer', 2, SHA),
        ]
        result, calls = self.run_workflow()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any(call[:2] == ['pr', 'merge'] for call in calls), calls)

    def test_changed_head_requires_retry(self):
        self.state['headRefOid'] = 'b' * 40
        self.assert_retry()

    def test_malformed_review_fields_preserve_consent(self):
        valid = copy.deepcopy(self.state)
        variants = [
            {'reviews': {'nodes': [], 'pageInfo': {}}},
            {'reviewThreads': {'nodes': None, 'pageInfo': {'hasNextPage': False}}},
            {'reviewThreads': {'nodes': [{}], 'pageInfo': {'hasNextPage': False}}},
            {'reviews': {'nodes': [review('UNKNOWN')], 'pageInfo': {'hasNextPage': False}}},
            {'reviews': {'nodes': [review('CHANGES_REQUESTED', None)],
                         'pageInfo': {'hasNextPage': False}}},
        ]
        for fields in variants:
            with self.subTest(fields=fields):
                self.state.clear()
                self.state.update({**valid, **fields})
                self.assert_retry()
        self.state.clear()
        self.state.update(valid)
        del self.state['reviewDecision']
        self.assert_retry()

    def test_resolved_outdated_thread_still_requires_real_approval(self):
        self.state['reviewDecision'] = None
        self.state['reviewThreads']['nodes'] = [{'isResolved': True, 'isOutdated': True}]
        self.assert_blocked()

    def test_draft_fork_and_other_authors_remain_excluded(self):
        valid = copy.deepcopy(self.fixture['pr'])
        for fields in ({'draft': True}, {'state': 'closed'},
                       {'user': {'login': 'another-user',
                                 'type': 'User' if valid['user']['type'] == 'Bot' else 'Bot'}},
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


class AgentReviewGateTests(BotReviewGateTests):
    workflow = ROOT / '.github/workflows/agent-automerge-policy.yml'

    def setUp(self):
        super().setUp()
        self.fixture['pr']['user'] = {'login': 'collaborator', 'type': 'User'}

    def test_final_review_read_failure_preserves_consent(self):
        self.fixture['review_exits'] = [0, 1]
        self.assert_retry()


if __name__ == '__main__':
    unittest.main()
