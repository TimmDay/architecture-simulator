import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { Footer } from "../Footer"
import { DONATE_URL } from "~/lib/donate"

const mockPath = vi.hoisted(() => ({ value: "/" }))
vi.mock("next/navigation", () => ({ usePathname: () => mockPath.value }))

describe("Footer", () => {
  it("links out to the donation page, safely", () => {
    mockPath.value = "/"
    render(<Footer />)
    const link = screen.getByRole("link", { name: /buy me a coffee/i })
    expect(link).toHaveAttribute("href", DONATE_URL)
    // An outbound link in a new tab must not hand the opener to the target.
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"))
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("stays off a scenario workspace", () => {
    // The canvas is sized to the viewport exactly; a footer under it adds a
    // scrollbar to a page deliberately built without one.
    mockPath.value = "/build/01-first-customers"
    const { container } = render(<Footer />)
    expect(container).toBeEmptyDOMElement()
  })

  it("still shows on the scenario list", () => {
    mockPath.value = "/build"
    render(<Footer />)
    expect(screen.getByText(/stays in your browser/i)).toBeInTheDocument()
  })
})
