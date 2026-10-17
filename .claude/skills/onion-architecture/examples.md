# Onion Architecture — examples

All snippets are distilled from real `server/src` code. They show the dependency
direction, not full implementations.

## 1. Route delegates; it never calls an external adapter

### ✅ Good — `modules/reviews/routes.ts`

```ts
export default async function reviewsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;
  const service = new ReviewService(container); // construct from the container

  app.post('/pulls/:id/review', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(container, req); // tenancy via AuthProvider
    const body = RunRequest.parse(req.body ?? {});            // Zod at the edge
    const targets = await service.resolveTargets(workspaceId, body);
    const { runs, reviews } = await service.runReview(workspaceId, req.params.id, targets, req.log);
    return { pr_id: req.params.id, runs, reviews };           // DTO out
  });
}
```

### ❌ Bad — the route reaches past the service into an external system

```ts
app.post('/pulls/:id/review', async (req) => {
  const diff = await container.git.diff(repo, base, head);  // ❌ adapter call in a route
  const review = await container.llm.completeStructured(/* … */); // ❌ LLM in a route
  await container.db.insert(reviews).values(/* … */);       // ❌ db in a route
  return review;
});
```

> Allowed edge exception: `container.runBus` and `req.log` are platform plumbing,
> not external systems — the SSE handler subscribing to `runBus` is fine.

## 2. Services depend on the port, not the concrete class

### ✅ Good — service names the interface, resolved through the container

```ts
export class ReviewService {
  private repo: ReviewRepository;
  constructor(private container: Container) {
    this.repo = new ReviewRepository(container.db); // repo owns Drizzle
  }
  async run(/* … */) {
    const diff = await this.container.git.diff(/* … */); // GitClient interface
    // this.container.git is typed GitClient — no SimpleGitClient import here
  }
}
```

### ❌ Bad — service imports and news-up a concrete adapter

```ts
import { SimpleGitClient } from '../../adapters/git/simple-git.js'; // ❌ concrete impl
export class ReviewService {
  private git = new SimpleGitClient('/tmp/clones');  // ❌ bypasses the container; untestable
}
```

## 3. Port → adapter → composition root (the three steps)

### Step 1 — port in `vendor/shared/adapters.ts` (ring 0)

```ts
export interface GitClient {
  clone(repo: RepoRef, url: string, opts?: CloneOptions): Promise<{ path: string }>;
  diff(repo: RepoRef, base: string, head: string): Promise<UnifiedDiff>;
  // …
}
```

### Step 2 — implementation in `adapters/git/simple-git.ts` (ring 2)

```ts
import type { GitClient, RepoRef, UnifiedDiff } from '@devdigest/shared';

export class SimpleGitClient implements GitClient {   // implements the port
  constructor(private cloneDir: string) {}
  async diff(repo: RepoRef, base: string, head: string): Promise<UnifiedDiff> { /* … */ }
}
```

### Step 3 — wire it in `platform/container.ts` (composition root — the only importer)

```ts
import { SimpleGitClient } from '../adapters/git/simple-git.js';

get git(): GitClient {
  if (this.overrides.git) return this.overrides.git;   // test seam
  this._git ??= new SimpleGitClient(this.config.cloneDir); // lazy singleton
  return this._git;
}
```

Tests inject a mock `GitClient` via `ContainerOverrides` — the service code never
changes, because it only ever knew the interface.

## 4. Domain stays pure

### ✅ Good — `reviewer-core/` works on data, not infrastructure

```ts
// reviewer-core: diff + prompt in, findings out. No SDK, no DB, no container.
export function groundFindings(findings: Finding[], diff: UnifiedDiff): Finding[] { /* … */ }
```

### ❌ Bad — domain imports an outer ring

```ts
// inside reviewer-core/ or vendor/shared/
import { db } from '../../server/src/db/client.js';        // ❌ outward import
import OpenAI from 'openai';                                // ❌ SDK in the core
import type { Container } from '../platform/container.js';  // ❌ domain → edge
```
