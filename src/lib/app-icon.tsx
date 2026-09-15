/**
 * Shared glyph for every generated app icon (favicon, apple touch icon, and
 * the two PWA manifest sizes) so the four call sites can't drift into four
 * slightly different marks. Three linked nodes, in the same ink/accent pair
 * as the rest of the app.
 */
export function appIconGlyph(size: number) {
  const box = size * 0.2
  const barWidth = size * 0.16
  const barHeight = size * 0.028
  const radius = size * 0.05
  const color = "#6ea8fe"
  const node = {
    width: box,
    height: box,
    borderRadius: radius,
    background: color,
  }
  const link = { width: barWidth, height: barHeight, background: color }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0e14",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={node} />
        <div style={link} />
        <div style={node} />
        <div style={link} />
        <div style={node} />
      </div>
    </div>
  )
}
