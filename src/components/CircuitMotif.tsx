/**
 * A small circuit trace feeding the two cards below it.
 *
 * Decorative, but not arbitrary -- it sits between the pitch and the cards,
 * so the trace lands on them and the page diagrams its own layout. It is also
 * the one place the visual language of the Build canvas (nodes, edges,
 * junctions) shows up before you have opened it.
 *
 * Two variants, because the layout it describes changes: side by side on a
 * wide screen, stacked on a phone. A fork drawn over stacked cards points at
 * nothing, and hiding it outright would leave the phone without the motif
 * altogether -- so the phone gets the shape its own layout actually has, a
 * single trace running down into the first card.
 *
 * Inline rather than an asset: it is a handful of path commands, it has to
 * inherit the palette, and a file would be a network request for that.
 */

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const

export function CircuitMotif({ className = "" }: { className?: string }) {
  return (
    <>
      {/* Stacked cards: straight down. */}
      <svg
        aria-hidden
        viewBox="0 0 24 64"
        className={`text-line h-16 w-6 sm:hidden ${className}`}
        {...stroke}
      >
        {/* The resistor kink is the detail that stops this reading as a
            plain rule. It needs real amplitude to be legible this small. */}
        <path d="M12 8 V16 l-6 3 l12 6 l-12 6 l6 3 V56" />
        <circle cx="12" cy="8" r="3.5" className="fill-ink" />
        <circle cx="12" cy="57" r="2.5" className="fill-accent" stroke="none" />
      </svg>

      {/* Side-by-side cards: one trace in, forking to two. */}
      <svg
        aria-hidden
        viewBox="0 0 240 72"
        className={`text-line hidden h-[72px] w-[240px] sm:block ${className}`}
        {...stroke}
      >
        <path d="M120 13 V18 l-6 3 l12 6 l-12 6 l6 3 V44" />
        {/* The bus, forking to the two cards below. */}
        <path d="M40 68 V52 a8 8 0 0 1 8-8 h144 a8 8 0 0 1 8 8 V68" />
        {/* Solder pads, filled with the page colour so the traces stop
            cleanly at them rather than running underneath. */}
        <circle cx="120" cy="10" r="3.5" className="fill-ink" />
        <circle cx="40" cy="68" r="3.5" className="fill-ink" />
        <circle cx="200" cy="68" r="3.5" className="fill-ink" />
        {/* The junction where the feed meets the bus. Filled, because on a
            real board a dot is what distinguishes a join from a crossing. */}
        <circle
          cx="120"
          cy="44"
          r="2.5"
          className="fill-accent"
          stroke="none"
        />
      </svg>
    </>
  )
}
