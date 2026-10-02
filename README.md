# Schedular

Independent application extracted from marcusgohtx.github.io. The app opens at the root of its own GitHub Pages project site.

Repository: https://github.com/marcusgohtx/schedular-app

Public app: https://marcusgohtx.github.io/schedular-app/

The local folder and app name remain `schedular`. The older private `marcusgohtx/schedular` repository is not used or changed.

## Development

Run `npm ci`, then `npm run dev`. Open http://localhost:3000.

Run `npm run lint` and `npm run build` before publishing. The static build is in `out/`.

## Deployment

Enable GitHub Pages with **GitHub Actions** as its source. Pushing to `main` runs the included build and deploy workflow. The production base path comes from the repository name in GitHub Actions.

The portfolio stays at https://marcusgohtx.github.io/projects/.

Schedules stay in browser localStorage and can be exported as ICS files. No server or account is required. Existing storage keys are preserved so drafts remain available when hosted on the same origin.
