/**
 * `distDir` is overridable so that a production build can be told to write
 * somewhere other than `.next`.
 *
 * Running `next build` while `next dev` is live otherwise replaces the dev
 * server's cache with production artifacts underneath it, and the running app
 * starts 404ing on `layout.css` and `app-pages-internals.js` with no clue as to
 * why. `pnpm build` and `pnpm preview` therefore use `.next-build`, leaving a
 * dev server undisturbed. Deploys are unaffected -- Vercel sets no override and
 * gets the standard `.next`.
 */

/** @type {import("next").NextConfig} */
const config = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  pageExtensions: ["ts", "tsx"],
  outputFileTracingRoot: process.cwd(),
}

export default config
