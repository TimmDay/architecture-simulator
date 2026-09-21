/**
 * A small circuit trace: one line in, forking to two.
 *
 * Decorative, but not arbitrary -- it sits between the pitch and the two
 * cards, so the fork lands on Drill and Build and the page diagrams itself.
 * It is also the one place the visual language of the Build canvas (nodes,
 * edges, junctions) shows up before you have opened it.
 *
 * Inline rather than an asset: it is a dozen path commands, it has to inherit
 * the palette, and a file would be a network request for six lines of SVG.
 */
export function CircuitMotif({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 240 72"
      className={`text-line h-[72px] w-[240px] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* The feed, with a resistor kink in it -- the detail that stops this
          reading as an org chart. It needs real amplitude to be legible at
          this size; a subtle one just looks like a wobbly line. */}
      <path d="M120 13 V18 l-6 3 l12 6 l-12 6 l6 3 V44" />
      {/* The bus, forking to the two cards below. */}
      <path d="M40 68 V52 a8 8 0 0 1 8-8 h144 a8 8 0 0 1 8 8 V68" />
      {/* Solder pads, filled with the page colour so the traces stop cleanly
          at them rather than running underneath. */}
      <circle cx="120" cy="10" r="3.5" className="fill-ink" />
      <circle cx="40" cy="68" r="3.5" className="fill-ink" />
      <circle cx="200" cy="68" r="3.5" className="fill-ink" />
      {/* The junction where the feed meets the bus. Filled, because on a real
          board a dot is what distinguishes a join from a crossing. */}
      <circle cx="120" cy="44" r="2.5" className="fill-accent" stroke="none" />
    </svg>
  )
}
