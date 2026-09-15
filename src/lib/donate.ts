/**
 * Where "buy me a coffee" points.
 *
 * Null keeps the phrase as plain prose and hides the footer link, so a
 * half-finished payment setup never ships a dead link asking for money.
 *
 * Deliberately a plain outbound link everywhere it is used, never Ko-fi's
 * embeddable button or floating widget. Those load third-party script and set
 * cookies, which would make the home page's own claim -- "your data is your
 * own and stays in your browser" -- untrue on the page that makes it.
 */
export const DONATE_URL: string | null = "https://ko-fi.com/timmday"
