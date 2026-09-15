import { describe, expect, it, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DrillSession } from "../DrillSession"

/**
 * The interactive surface: type an answer, flip, see both side by side, grade.
 * Covered here because it is the loop the whole Drill mode exists to run, and a
 * regression in it is invisible to the engine tests.
 */
describe("DrillSession", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  /** Discuss is no longer the landing mode, so every card test starts here. */
  const openDiscuss = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() =>
      expect(
        screen.getByRole("radio", { name: "Discuss" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("radio", { name: "Discuss" }))
    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument())
  }

  it("opens in Speed, with the modes in escalating order", async () => {
    render(<DrillSession />)
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Speed" })).toBeInTheDocument(),
    )
    expect(screen.getByRole("radio", { name: "Speed" })).toBeChecked()
    // No typing on arrival.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()

    const modes = ["Speed", "Discuss", "Mix"]
    const rendered = screen
      .getAllByRole("radio")
      .map((el) => el.textContent ?? "")
    expect(rendered.slice(0, 3)).toEqual(modes)
  })

  it("offers every difficulty, with All selected", async () => {
    render(<DrillSession />)
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: /^All/ })).toBeInTheDocument(),
    )
    for (const level of [/^Easy/, /^Mid/, /^Tricky/, /^All/]) {
      expect(screen.getByRole("radio", { name: level })).toBeInTheDocument()
    }
    expect(screen.getByRole("radio", { name: /^All/ })).toBeChecked()
  })

  it("keeps the mastery stats collapsed so the card has the page", async () => {
    render(<DrillSession />)
    const toggle = await screen.findByRole("button", { name: /mastery stats/i })
    expect(toggle).toHaveAttribute("aria-expanded", "false")

    const user = userEvent.setup()
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
  })

  it("hides the model answer until you have committed to one", async () => {
    const user = userEvent.setup()
    render(<DrillSession />)
    await openDiscuss(user)

    expect(screen.queryByText("Model answer")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /reveal answer/i }),
    ).toBeInTheDocument()
  })

  it("shows your answer beside the model answer on the flip, then offers grades", async () => {
    const user = userEvent.setup()
    render(<DrillSession />)
    await openDiscuss(user)

    await user.type(screen.getByRole("textbox"), "my attempt at the answer")
    await user.click(screen.getByRole("button", { name: /reveal answer/i }))

    expect(screen.getByText("What you wrote")).toBeInTheDocument()
    // Shown once, in the comparison panel -- the input is gone by now.
    expect(screen.getByText("my attempt at the answer")).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.getByText("Model answer")).toBeInTheDocument()

    for (const label of ["Again", "Hard", "Good", "Easy"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(label) }),
      ).toBeInTheDocument()
    }
  })

  it("advances to the next card and persists the grade", async () => {
    const user = userEvent.setup()
    render(<DrillSession />)
    await openDiscuss(user)

    const first = screen.getByRole("textbox").closest("div")?.textContent ?? ""
    await user.click(screen.getByRole("button", { name: /reveal answer/i }))
    await user.click(screen.getByRole("button", { name: /Good/ }))

    await waitFor(() => {
      const next = screen.getByRole("textbox").closest("div")?.textContent ?? ""
      expect(next).not.toBe(first)
    })
    // Back to an empty box for the next card.
    expect(screen.getByRole("textbox")).toHaveValue("")

    await waitFor(() => {
      const raw = window.localStorage.getItem(
        "architecture-simulator:progress:v1",
      )
      expect(raw).toBeTruthy()
      const graded = Object.values(
        JSON.parse(raw!).cardStates as Record<
          string,
          { lastGrade: string | null }
        >,
      )
      expect(graded.some((s) => s.lastGrade === "good")).toBe(true)
    })
  })

  it("narrows the deck when a difficulty is picked", async () => {
    const user = userEvent.setup()
    render(<DrillSession />)
    await waitFor(() =>
      expect(
        screen.getByRole("radio", { name: /^Tricky/ }),
      ).toBeInTheDocument(),
    )

    const all = Number(
      screen
        .getByRole("radio", { name: /^All/ })
        .textContent?.match(/\d+/)?.[0],
    )
    const tricky = Number(
      screen
        .getByRole("radio", { name: /^Tricky/ })
        .textContent?.match(/\d+/)?.[0],
    )
    expect(tricky).toBeGreaterThan(0)
    expect(tricky).toBeLessThan(all)

    await user.click(screen.getByRole("radio", { name: /^Tricky/ }))
    expect(screen.getByRole("radio", { name: /^Tricky/ })).toBeChecked()
  })

  it("runs Mix as Speed until a Discuss card is owed", async () => {
    const user = userEvent.setup()
    render(<DrillSession />)
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Mix" })).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("radio", { name: "Mix" }))

    // Opens on a multiple-choice question, not a textarea: the Discuss card
    // arrives after a stretch of Speed, never as the first thing you see.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.getByText(/Pick the answer/i)).toBeInTheDocument()
  })
})
