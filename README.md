<p align="center">
  <img src="https://craftui-pro.vercel.app/og" alt="craftUI Pro banner" />
</p>

<h1 align="center">craftUI Pro</h1>

<p align="center">
  Crafted, production-ready components for shadcn/ui. Install any of them into your project with a single command.
</p>

## Usage

Set up [shadcn/ui](https://ui.shadcn.com/docs/installation) in your project, then add a component:

```bash
npx shadcn@latest add https://craftui-pro.vercel.app/r/<component>.json
```

Browse the components and their docs at [craftui-pro.vercel.app/docs](https://craftui-pro.vercel.app/docs).

## Development

Requires Node.js 22 and pnpm 10 (`corepack enable` installs pnpm from the version pinned by the project).

```bash
pnpm install
cp .env.example .env   # environment=development enables the internal /docs-admin handbook
pnpm dev
```

| Script | What it does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm registry:build` | Build `public/r/*.json` from `registry.json` |
| `pnpm build` | Build the registry, then the Next.js app |
| `pnpm check` / `pnpm fix` | Lint and format |
| `pnpm typecheck` | Type-check the project |

With `environment=development` set, the internal handbook at `/docs-admin` explains the architecture, the folder structure, and how to add a component.

## Project structure

```
├── registry/new-york/    # Component source (what gets published)
├── registry.json         # Registry manifest
├── public/r/             # Built registry JSON (generated)
├── content/docs/         # Public documentation (MDX)
├── content/docs-admin/   # Internal handbook (dev only)
└── app/                  # Next.js app
```

## Credits

Built on [startercn](https://github.com/shadcn-labs/startercn) by Shadcn Labs.

## License

[MIT](./LICENSE)
