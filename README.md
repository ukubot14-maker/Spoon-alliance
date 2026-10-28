# The Spoon Alliance

A small, browser-based top-down boss-fighting game. No backend, database, account, or build step is required.

## Play locally

1. Download or clone this repository.
2. Open `index.html` in a modern browser.
3. Click **Start Adventure**.

## Controls

- **WASD** or **Arrow Keys** — Move
- **Space** — Swipe your spoon
- **Shift** — Dash (uses stamina)
- **Escape** — Pause

## The adventure

Fight eight bosses, including Forkling the First, the Soup Warden, Count Crumb, the Tinfoil Titan, Lady Butterknife, the Whisk Witch, General Grater, and the Grand Fork. Defeating bosses earns spoon shards and improves your health.

## Deploy to GitHub Pages

1. Create a GitHub repository named `SpoonAlliance` (or any name you prefer).
2. Upload the files and folders in this project to the repository root.
3. In the repository, open **Settings → Pages** and set the source to **GitHub Actions**.
4. Push to the `main` branch. The workflow in `.github/workflows/pages.yml` publishes the static site.

Everything runs in the browser. There is no backend and no secret configuration.

## Project structure

```text
SpoonAlliance/
├── index.html
├── README.md
├── LICENSE
├── .nojekyll
├── web/
│   ├── style.css
│   └── game.js
└── .github/
    └── workflows/
        └── pages.yml
```
