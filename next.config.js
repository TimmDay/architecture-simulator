/**
 * `distDir` is overridable so that a production build can be told to write
 * somewhere other than `.next`.
 *
 * Running `next build` while `next dev` is live otherwise replaces the dev
 * server's cache with production artifacts underneath it, and the running app
 * starts 404ing on `layout.css` and `app-pages-internals.js` with no clue as to
 * why. `pnpm build:local` and `pnpm preview` therefore use `.next-build`,
 * leaving a dev server undisturbed.
 *
 * `pnpm build` must NOT set it. Vercel runs that script and then looks for
 * output in `.next`; baking the override into it -- as this repo did until the
 * first deploy attempt -- points the build somewhere Vercel does not look.
 */

/** Replaced by Architech: every page goes there. */
const ARCHITECH = "https://tim-game-architech.firebaseapp.com/"

/** @type {import("next").NextConfig} */
const config = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  pageExtensions: ["ts", "tsx"],
  outputFileTracingRoot: process.cwd(),
  // Everything but /sw.js, which returning visitors' browsers must still be
  // able to fetch: it's the worker that clears their cache (see public/sw.js).
  async redirects() {
    return [
      {
        source: "/:path((?!sw\\.js$).*)",
        destination: ARCHITECH,
        permanent: false,
      },
    ]
  },
}

export default config
