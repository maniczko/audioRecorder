module.exports = {
  types: [
    { type: 'feat', section: 'Features', hidden: false },
    { type: 'fix', section: 'Bug Fixes', hidden: false },
    { type: 'perf', section: 'Performance Improvements', hidden: false },
    { type: 'revert', section: 'Reverts', hidden: false },
    { type: 'docs', section: 'Documentation', hidden: false },
    { type: 'style', section: 'Styles', hidden: false },
    { type: 'chore', section: 'Miscellaneous Chores', hidden: false },
    { type: 'refactor', section: 'Code Refactoring', hidden: false },
    { type: 'test', section: 'Tests', hidden: false },
    { type: 'build', section: 'Build System', hidden: false },
    { type: 'ci', section: 'Continuous Integration', hidden: false },
    { type: 'config', section: 'Configuration', hidden: false },
    { type: 'deps', section: 'Dependencies', hidden: false },
    { type: 'devops', section: 'DevOps', hidden: false },
    { type: 'infra', section: 'Infrastructure', hidden: false },
    { type: 'types', section: 'Type Definitions', hidden: false },
  ],
  commitUrlFormat: '{{host}}/{{owner}}/{{repository}}/commit/{{hash}}',
  compareUrlFormat: '{{host}}/{{owner}}/{{repository}}/compare/{{previousTag}}...{{currentTag}}',
  issueUrlFormat: '{{host}}/{{owner}}/{{repository}}/issues/{{id}}',
  userUrlFormat: '{{host}}/{{user}}',
  releaseCommitMessageFormat: 'chore(release): {{currentTag}} [skip ci]',
  issuePrefixes: ['#'],
  notePrefix: '### ',
  transform: function (commit, context) {
    const issues = [];

    commit.notes.forEach(function (note) {
      const ticketSplit = note.title.split('#');
      if (ticketSplit.length === 1) return;
      const ticket = ticketSplit[1].split(' ')[0];
      issues.push(ticket);
    });

    commit.references.forEach(function (reference) {
      if (reference.action === 'Closes') {
        issues.push(reference.issue);
      }
    });

    if (issues.length) {
      commit.notes.forEach(function (note) {
        note.title = note.title + ' #' + issues.join(', #');
      });
    }

    return commit;
  },
};
