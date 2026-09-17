const pool = require('./src/config/db');
const https = require('https');
const token = process.env.GITHUB_TOKEN || '';
function ghApi(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: '/repos/' + path,
      method: 'GET',
      headers: {
        'User-Agent': 'InternOps-Backfill/1.0',
        Accept: 'application/vnd.github.v3+json',
      },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const r = https.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(d));
        } catch {
          resolve(null);
        }
      });
    });
    r.on('error', reject);
    r.end();
  });
}
async function main() {
  const { rows } = await pool.query(
    `SELECT id, github_repo, github_issue_number FROM social_tasks WHERE source = 'github' AND deleted_at IS NULL AND (github_labels IS NULL OR github_labels::text NOT LIKE '%author%')`
  );
  console.log('Need backfill:', rows.length);
  let done = 0;
  for (const t of rows) {
    if (!t.github_repo || !t.github_issue_number) continue;
    await new Promise((r) => setTimeout(r, 100));
    const [issue, comments] = await Promise.all([
      ghApi(`${t.github_repo}/issues/${t.github_issue_number}`),
      ghApi(
        `${t.github_repo}/issues/${t.github_issue_number}/comments?per_page=100`
      ),
    ]);
    if (!issue || !issue.user) continue;
    const cc = Array.isArray(comments) ? comments.length : 0;
    const parts = [
      ...new Set(
        (Array.isArray(comments) ? comments : [])
          .map((c) => c.user?.login)
          .filter(Boolean)
      ),
    ];
    const meta = {
      author: issue.user.login,
      authorAvatar: issue.user.avatar_url,
      authorUrl: issue.user.html_url,
      commentCount: cc,
      commentParticipants: parts,
    };
    await pool.query(
      `UPDATE social_tasks SET github_labels = $1::jsonb, last_synced_at = NOW() WHERE id = $2`,
      [JSON.stringify(meta), t.id]
    );
    done++;
    if (done % 25 === 0) process.stdout.write(done + ' ');
  }
  console.log('\nDone:', done);
  process.exit(0);
}
main().catch((e) => {
  console.log('Error:', e.message);
  process.exit(1);
});
