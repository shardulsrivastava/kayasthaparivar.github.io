# Kayastha Parivar — Family Tree

An interactive, searchable family tree for the Kayastha Parivar of
Barabanki, deployed to GitHub Pages at
[kayasthaparivar.com](https://kayasthaparivar.com).

## Structure

```
web/                        Next.js app (the site itself)
  app/                      Routes: home, /tree, /person/[id]
  components/               UI components, incl. the family-tree visualization
  data/family.yaml          The family tree data — edit this to add people
  data/family.generated.json  Auto-generated from family.yaml — do not edit
  scripts/build-family-data.mjs  Converts family.yaml -> family.generated.json
  lib/family.ts             Data loading + generation/relationship logic
  public/photos/            Person photos (placeholders until real ones are added)

infra/terraform/      Cloudflare DNS + zone settings for the custom domain
.github/workflows/    CI: build & deploy the site, plan/apply Terraform
```

## Adding or editing family members

Edit `web/data/family.yaml`. It's a nested tree, not a flat list — each
person is written as a child of their parent, so the file's shape mirrors
the actual family tree. A person looks like:

```yaml
- name: Full Name
  gender: male
  bio: A sentence or two about them.
  spouse:
    name: Spouse's Full Name
    gender: female
  children:
    - name: Child One
      gender: female
    - name: Child Two
      gender: male
```

- Only `name` and `gender` are required. Omit `bio` entirely when there's
  nothing to say (don't write `bio: ""`).
- `spouse` is optional and holds a single nested person (same shape).
- `children` is an optional list of nested people — the shared children of
  this person and their spouse (if any).
- Top-level family founders go under the `roots:` list at the top of the
  file; everyone else nests under their parent.
- To add a real photo for someone, drop the image in `web/public/photos/`
  — photos are otherwise assigned automatically as a placeholder based on
  gender.

There's no `id` or `parents`/`spouses` bookkeeping to maintain by hand: a
build script (`npm run generate-data`, wired to run automatically before
`npm run dev` and `npm run build`) flattens `family.yaml` into
`web/data/family.generated.json` — assigning ids, wiring up `parents` and
`spouses` arrays, and filling in the always-empty fields (`birthYear`,
`deathYear`, `location`, `occupation`). That generated file is a build
artifact (gitignored) — `lib/family.ts` reads from it, but you should never
edit it directly; edit `family.yaml` and regenerate instead.

Generations, sibling groups, and the tree layout are all derived
automatically from the reconstructed `parents`/`spouses` — you don't need
to set a generation number yourself.

Open a pull request with your change; merging to `main` automatically
rebuilds and redeploys the site (see below).

## Local development

```sh
cd web
npm install
npm run dev
```

Visit `http://localhost:3000`.

To check what the production build will actually output:

```sh
npm run build   # writes static files to web/out
npx serve out   # preview it (don't use `serve -s`, this isn't an SPA)
```

## Deployment

`.github/workflows/deploy.yml` builds the Next.js static export and
publishes it to GitHub Pages on every push to `main` that touches `web/`.

One-time setup for this to work:

1. Repo Settings → Pages → Source → **GitHub Actions**.
2. Repo Settings → Pages → Custom domain → `kayasthaparivar.com` (once DNS
   is pointed there — see `infra/terraform/README.md`). Enable "Enforce
   HTTPS" once it's available.

The `CNAME` file in `web/public/CNAME` keeps the custom domain configured
across rebuilds.

## Infrastructure (Cloudflare)

DNS for `kayasthaparivar.com` and the zone's SSL settings are managed with
Terraform in `infra/terraform/`. See `infra/terraform/README.md` for setup —
it covers the Cloudflare API token, zone ID, and (importantly) why the
apply workflow is manual-only until a remote Terraform state backend is
configured.
