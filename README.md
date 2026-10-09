# intrin.org project site

Source for the static project showcase. The site uses Node.js without package dependencies.

## Local preview

Run `npm run build`, `npm run check`, and `npm run preview`, then open <http://127.0.0.1:4317/>.

## Cloudflare Pages Git build

Connect this repository to a new Cloudflare Pages Git project. Use the `main` production branch, no framework preset, the repository root as the root directory, `npm run build:release && npm run check:release` as the build command, and `release` as the output directory. `.node-version` selects Node.js 22.16.0. Pages builds and deploys when `main` changes.

`release/` and `dist/` are generated and excluded from Git. Only reviewed public content belongs in `content/` and `public/`; keep source reports, private logs, credentials, and local QA artifacts outside the repository.
