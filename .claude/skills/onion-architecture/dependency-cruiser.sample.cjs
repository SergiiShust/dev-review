// Onion-architecture gate for @devdigest/api. OPT-IN — not wired into
// package.json. To enable: copy to `server/.dependency-cruiser.cjs` and add
//   "lint:arch": "depcruise src --config .dependency-cruiser.cjs"
// to server/package.json scripts. Baseline measured 2026-10-16:
// 149 modules / 462 deps -> 0 errors, 20 warnings. See enforcement.md.
module.exports = {
  forbidden: [
    {
      // CLEAN today (0 violations) -> enforced as error.
      name: 'core-is-pure',
      comment: 'Ring 0 (vendor/shared) must not import outer rings.',
      severity: 'error',
      from: { path: '^src/vendor/shared' },
      to: { path: '^src/(adapters|modules|platform|db)(/|$)' },
    },
    {
      // Has existing drift -> warn baseline; promote to error once burned down.
      name: 'routes-are-thin',
      comment: 'Routes delegate to a service; no external adapters, no db.',
      severity: 'warn',
      from: { path: 'src/modules/[^/]+/routes\\.ts$' },
      to: { path: '^src/(adapters|db)(/|$)' },
    },
    {
      name: 'adapters-known-only-to-container',
      comment:
        'Only the composition root imports src/adapters. repo-intel is the ' +
        'indexer subsystem (infrastructure, reached via container.repoIntel) ' +
        'and composes low-level adapters directly — exempted via pathNot.',
      severity: 'warn',
      from: {
        pathNot:
          '(^src/platform/container\\.ts$|^src/adapters/|^src/modules/repo-intel/|\\.test\\.ts$)',
      },
      to: { path: '^src/adapters/', pathNot: '^src/adapters/index\\.ts$' },
    },
    {
      name: 'db-only-in-repository',
      comment: 'db/schema is reached only via a repository or db/ itself.',
      severity: 'warn',
      from: { pathNot: '(repository|\\.repo\\.ts$|^src/db/|\\.test\\.ts$)' },
      to: { path: '^src/db/schema' },
    },
    {
      name: 'no-circular',
      comment: 'No dependency cycles.',
      severity: 'warn',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(\\.test\\.ts$|\\.it\\.test\\.ts$|/__tests__/|/test/)' },
    enhancedResolveOptions: { extensions: ['.ts', '.js'] },
  },
};
