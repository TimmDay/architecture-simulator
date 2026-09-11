import type { Metadata } from "next"
import "~/styles/globals.css"
import { Nav } from "~/components/Nav"

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
      <body className="min-h-screen font-sans antialiased">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  )
}
