import type { Metadata } from "next"
import "~/styles/globals.css"
import { Nav } from "~/components/Nav"
import { Footer } from "~/components/Footer"

export const metadata: Metadata = {
  title: "Architecture Simulator",
  description: "Drill system architecture, then defend what you build.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <Nav />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
