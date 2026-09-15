import type { Metadata, Viewport } from "next"
import "~/styles/globals.css"
import { Nav } from "~/components/Nav"
import { Footer } from "~/components/Footer"
import { ServiceWorkerRegister } from "~/components/ServiceWorkerRegister"
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: "Architecture Simulator",
  description: "Drill system architecture, then defend what you build.",
  appleWebApp: {
    capable: true,
    title: "Architecture Sim",
    statusBarStyle: "black-translucent",
  },
}

export const viewport: Viewport = {
  themeColor: "#0b0e14",
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
        <ServiceWorkerRegister />
        {/*
          Page views only, and cookieless -- which is what lets the home page
          say "no cookies, no account, nothing that identifies you" and stay
          true. It is a counter, not an abuse log: rate limiting and DDoS
          evidence live in Vercel's firewall and runtime logs, not here.
          No-ops off Vercel, so local development sends nothing.
        */}
        <Analytics />
      </body>
    </html>
  )
}
