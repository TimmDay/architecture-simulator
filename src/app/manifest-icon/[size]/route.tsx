import { ImageResponse } from "next/og"
import { appIconGlyph } from "~/lib/app-icon"

/**
 * Only the two sizes the manifest actually lists. The favicon and apple
 * touch icon are separate, fixed-size files (icon.tsx, apple-icon.tsx) --
 * this route exists purely so manifest.ts has stable URLs to point at,
 * since Next doesn't expose a predictable path for those convention files.
 */
const MANIFEST_SIZES = [192, 512] as const

export function generateStaticParams() {
  return MANIFEST_SIZES.map((size) => ({ size: String(size) }))
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: sizeParam } = await params
  const size = MANIFEST_SIZES.find((s) => String(s) === sizeParam)
  if (!size) {
    return new Response(null, { status: 404 })
  }
  return new ImageResponse(appIconGlyph(size), { width: size, height: size })
}
