# Contributing to craftUI Pro

Thanks for your interest in contributing.

## Before you start

Check the open [issues](https://github.com/craftUI012/craftUI-Pro/issues) and pull requests first, to avoid duplicate work. If you want to work on something that doesn't have an issue yet, open one to discuss it.

## Local setup

```bash
git clone https://github.com/craftUI012/craftUI-Pro.git
cd craftUI-Pro
corepack enable   # provides pnpm
pnpm install
cp .env.example .env
pnpm dev
```

With `environment=development` in `.env`, the internal handbook at `http://localhost:3000/docs-admin` explains the architecture and the full workflow for adding a component.

## Adding or changing a component

1. Edit or add the source in `registry/new-york/<name>.tsx`.
2. Add or update its entry in `registry.json`.
3. Add or update its docs page in `content/docs/components/<name>.mdx` and list it in `content/docs/components/meta.json`.
4. Run `pnpm registry:build`.

## Before opening a pull request

```bash
pnpm check
pnpm build
pnpm typecheck
```

A pre-commit hook runs `pnpm fix` on staged files automatically. CI runs the same checks on every pull request.

Keep pull requests focused on one change, and describe what you changed and why.
