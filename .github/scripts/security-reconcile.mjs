// Repository-local security issue and coding-agent reconciliation.
// Security payloads remain in GitHub Security: never publish them into issues.
const sources = [
  ['code-scanning','code-scanning/alerts','Code scanning'],
  ['dependabot','dependabot/alerts','Dependabot'],
  ['secret-scanning','secret-scanning/alerts','Secret scanning']
];
const marker = (kind,num) => '<!-- avkroken-security-alert:' + kind + ':' + num + ' -->';
const known = (body,kind,num) => {
  const text = String(body || '');
  return text.includes(marker(kind,num)) ||
    text.includes('<!-- skvallerbyttan-alert:' + kind + ':' + num + ' -->');
};
const isIssue = x => Number.isInteger(x.number) && !x.pull_request;
const trustedOrigin = (issue,owner) =>
  [owner.toLowerCase(), 'github-actions[bot]', 'gamnacken[bot]']
    .includes(issue.user?.login?.toLowerCase());
const isTrackingIssue = (issue,kind,num,owner) =>
  trustedOrigin(issue,owner) && known(issue.body,kind,num);
const isTrustedForAgent = (issue,owner) => {
  // External issue bodies are untrusted inputs. Only the repository owner
  // and GitHub Actions-created, marker-bearing tracking issues are eligible.
  const author=issue.user?.login?.toLowerCase();
  if(author===owner.toLowerCase()) return true;
  return author==='github-actions[bot]' &&
    sources.some(([kind]) => known(issue.body,kind,
      Number((issue.body || '').match(new RegExp('(?:avkroken-security-alert|skvallerbyttan-alert):'+kind+':(\\d+)'))?.[1])));
};
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
const repo = process.env.GITHUB_REPOSITORY;
const owner = repo?.split('/')[0];
const token = process.env.GH_TOKEN;
if (!/^[-\w.]+\/[-\w.]+$/.test(repo || '') || !token) {
  throw Error('Missing GITHUB_REPOSITORY or GH_TOKEN');
}
const root = 'repos/' + repo;
const safeAlertUrl = alert => {
  // Provider-supplied links are untrusted. Restrict navigation to this
  // repository on GitHub and never copy a query string into a public issue.
  try {
    const u = new URL(alert.html_url);
    if(u.protocol === 'https:' && u.hostname === 'github.com' &&
       u.pathname.startsWith('/' + repo + '/')) {
      return u.origin + u.pathname;
    }
  } catch {}
  return 'https://github.com/' + repo + '/security';
};
const errors = [];
let writes = 0;
let deferred = 0;
async function api(path,method='GET',data) {
  const url = path.startsWith('https://') ? path : 'https://api.github.com/' + path;
  for(let attempt=0; attempt<4; attempt++) {
    const response = await fetch(url,{
      method,
      headers:{
        Accept:'application/vnd.github+json',
        Authorization:'Bearer ' + token,
        'X-GitHub-Api-Version':'2022-11-28',
        ...(data ? {'Content-Type':'application/json'} : {})
      },
      ...(data ? {body:JSON.stringify(data)} : {})
    });
    if(response.ok) return response.status === 204 ? null : response.json();
    // An ambiguous response to a write must never cause a duplicate issue.
    if(method==='GET' && [429,502,503,504].includes(response.status) && attempt < 3) {
      await sleep(1500 * (attempt+1)); continue;
    }
    throw Error(method + ' ' + url.split('?')[0] + ': HTTP ' + response.status);
  }
}
async function list(path) {
  const found=[];
  for(let page=1;page<=100;page++) {
    const batch=await api(path + (path.includes('?') ? '&' : '?')+'per_page=100&page='+page);
    if(!Array.isArray(batch)) throw Error('Invalid list result: '+path);
    found.push(...batch);
    if(batch.length < 100) return found;
  }
  throw Error('Pagination bound reached: '+path);
}
const metadata=await api(root);
const defaultBranch=metadata.default_branch || 'main';
const issues=(await list(root+'/issues?state=all')).filter(isIssue);
async function assignOwner(issue) {
  if((issue.assignees||[]).some(x=>x.login?.toLowerCase()===owner.toLowerCase())) return;
  await api(root+'/issues/'+issue.number+'/assignees','POST',{assignees:[owner]});
  issue.assignees=[...(issue.assignees||[]),{login:owner}];
}
if(process.env.GITHUB_EVENT_NAME !== 'issues') {
  for(const [kind,endpoint,label] of sources) {
    // Public GitHub issues cannot contain private secret-scanning findings.
    // Keep security-restricted alert details in GitHub's Security interface.
    if(kind==='secret-scanning') {
      console.warn('::notice::Secret-scanning issue mirroring disabled until an authorized credential and confidential tracking channel are configured.');
      continue;
    }
    let alerts;
    try { alerts=await list(root+'/'+endpoint+'?state=open'); }
    catch(e) {
      errors.push(kind+' read: '+e.message);
      console.warn('::warning::Unable to read '+kind+' alerts: '+e.message);
      continue;
    }
    for(const alert of alerts) {
      const number=Number(alert.number);
      if(!Number.isInteger(number)||number<1) {errors.push('Invalid '+kind+' alert');continue;}
      const existing=issues.find(x=>isTrackingIssue(x,kind,number,owner));
      if((!existing || existing.state!=='open') && writes>=100) {
        deferred++;
        continue;
      }
      try {
        if(existing) {
          if(existing.state!=='open') {
            await api(root+'/issues/'+existing.number,'PATCH',{state:'open'});
            existing.state='open'; writes++;
          }
          if(existing.state==='open') await assignOwner(existing);
        } else {
          const body=[
            'An open '+label+' alert requires remediation.',
            'GitHub Security alert: '+safeAlertUrl(alert),
            'See Security and quality in this repository for the original alert. Never copy secrets, token values, private security payloads, or exploit details into public issues or PRs.',
            'Acceptance: verify the alert, implement and test the smallest safe fix, link this issue in the PR and respect AGENTS.md, CI and branch protections.',
            'Owner: Avkroken. Coding-agent work is pending manual Copilot assignment by an authorized user; no assignment was requested by this automation. Codex, Claude and CodeRabbit require separately installed integrations for agent execution or review.',
            marker(kind,number)
          ].join('\n\n');
          const created=await api(root+'/issues','POST',{
            title:'[Security] '+label+' alert requires remediation',
            body,assignees:[owner]
          });
          issues.push(created); writes++;
          console.log('Created issue #'+created.number+' for '+kind+' #'+number);
        }
      } catch(e) {errors.push(kind+' #'+number+': '+e.message);}
    }
  }
}
// The issue/PR inventory is retained for diagnostics and queue awareness.
// GitHub requires a user-to-server token for Copilot cloud-agent assignment;
// github.token is an installation token and cannot perform that write. The
// existing COPILOT_GITHUB_TOKEN is restricted to read-only release notes.
// Do not retry an unsupported write or manufacture a new credential here.
let pulls=null;
try { pulls=await list(root+'/pulls?state=open'); }
catch(e) {errors.push('PR list: '+e.message); }
const activeAgentIssue=issues.some(x=>x.state==='open' &&
  (x.assignees||[]).some(a=>a.login?.toLowerCase()==='copilot-swe-agent[bot]'));
const target=process.env.GITHUB_EVENT_NAME==='issues' ?
  issues.filter(x=>x.number===Number(process.env.ISSUE_NUMBER)) : issues;
const candidates=(pulls===null || pulls.length || activeAgentIssue ? [] : target)
  .filter(x=>x.state==='open' && isTrustedForAgent(x,owner))
  .sort((a,b)=>b.number-a.number)
  .filter(issue=>!(issue.assignees||[]).some(x=>x.login?.toLowerCase()==='copilot-swe-agent[bot]'));
if(candidates.length) {
  console.warn('::notice::Copilot cloud-agent delegation unavailable with Actions GITHUB_TOKEN; '+
    'issue #'+candidates[0].number+' remains queued for a user-authorized assignment.');
} else {
  console.log('No eligible pending agent assignment, or work already in progress.');
}
if(deferred) console.warn('::notice::Issue write budget reached; '+deferred+' tracking issues deferred until the next scheduled run.');
console.log('Security reconciliation: issue writes='+writes+', deferred='+deferred+', agent assignments=0, errors='+errors.length);
if(errors.length) throw Error(errors.join('; '));
