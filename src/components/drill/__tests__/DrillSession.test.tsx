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

  it("hides the model answer until you have committed to one", async () => {
    render(<DrillSession />)
    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument())

    expect(screen.queryByText("Model answer")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /reveal answer/i }),
    ).toBeInTheDocument()
  })

  it("shows your answer beside the model answer on the flip, then offers grades", async () => {
    const user = userEvent.setup()
    render(<DrillSession />)
    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument())

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
    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument())

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
})
