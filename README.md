# Schedular

The current app is published on [ChatGPT Sites](https://schedular.marcusgohtx.chatgpt.site/). This repository contains the original Next.js application extracted from the portfolio and configured for GitHub Pages.

Repository: https://github.com/marcusgohtx/schedular-app

Original GitHub Pages URL: https://marcusgohtx.github.io/schedular-app/

The local folder and app name remain `schedular`. The older private `marcusgohtx/schedular` repository is not used.

## Current app and source

The migration to ChatGPT Sites used a separate source checkout and the Sites source repository. Changes pushed to this GitHub repository do not update the live ChatGPT Site.

To work on the current app, use the Sites skill to open the existing project `appgprj_6ac20ff868208191b3c807935bdbc96f`. Read that checkout's `README.md` and `.openai/hosting.json` before editing or publishing. Preserve its public access.

The local Sites checkout from the migration is:

```text
C:\Users\marcu\.codex\visualizations\2026\10\04\01a10609-cd96-70e1-9ed2-172dfdfa6849\sites\schedular
```

The Sites app preserves local saving and ICS download, and adds Google Calendar export. Each Google export creates a new calendar containing the schedule; later edits do not sync automatically. No database is required. Lint, build, and six mocked Calendar API tests passed during migration. A real Google account export remained unverified at handoff.

Drafts are stored per website origin. Schedules saved on GitHub Pages do not automatically appear on the ChatGPT Site.

## Development of the GitHub Pages app

Run `npm ci`, then `npm run dev`. Open http://localhost:3000.

Run `npm run lint` and `npm run build` before publishing. The static build is in `out/`.

After building, run `npm run preview` and open http://127.0.0.1:3001/schedular-app/ to inspect the static output.

## GitHub Pages deployment

Enable GitHub Pages with **GitHub Actions** as its source. Pushing to `main` runs the included build and deploy workflow for the original app. The production base path comes from the repository name in GitHub Actions. Publishing the current ChatGPT Site uses the Sites workflow in its separate checkout.

The portfolio stays at https://marcusgohtx.github.io/projects/.

This GitHub Pages version saves schedules in browser localStorage and exports ICS files. No server or account is required. Existing storage keys are preserved so drafts remain available when hosted on the same origin. Direct Google Calendar export is implemented in the Sites version.
