# Kayastha Parivar — Family Tree

An interactive, searchable family tree for the Kayastha Parivar of
Barabanki, deployed to GitHub Pages at
[kayasthaparivar.com](https://kayasthaparivar.com).

## Structure

```
web/                  Next.js app (the site itself)
  app/                Routes: home, /tree, /person/[id]
  components/         UI components, incl. the family-tree visualization
  data/family.json    The family tree data — edit this to add people
  lib/family.ts        Data loading + generation/relationship logic
  public/photos/       Person photos (placeholders until real ones are added)

infra/terraform/      Cloudflare DNS + zone settings for the custom domain
.github/workflows/    CI: build & deploy the site, plan/apply Terraform
```

## Adding or editing family members

Edit `web/data/family.json`. Each person looks like:

```json
{
  "id": "p21",
  "name": "Full Name",
  "gender": "male",
  "birthYear": 1990,
  "deathYear": null,
  "location": "City, State",
  "occupation": "",
  "bio": "A sentence or two about them.",
  "photo": "/photos/placeholder-male.svg",
  "parents": ["p13", "p14"],
  "spouses": []
}
```

- `id` must be unique and referenced by any children's `parents` array.
- `parents` holds 0–2 ids; leave empty for someone who married into the
  family with no ancestry recorded here.
- `spouses` is a list of ids (usually one).
- To add a real photo, drop the image in `web/public/photos/` and point
  `photo` at it, e.g. `"/photos/jane-doe.jpg"`.

Generations, sibling groups, and the tree layout are all derived
automatically from `parents`/`spouses` — you don't need to set a
generation number yourself.

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
