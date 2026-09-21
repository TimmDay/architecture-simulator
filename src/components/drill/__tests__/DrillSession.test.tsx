import { describe, expect, it, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DrillSession } from "../DrillSession"
import { ALL_CARDS } from "~/drill/cards"
import { speedItems } from "~/drill/speed"
import type { CardState } from "~/drill/types"

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

  /**
   * Which question Speed opens on is random, so the test works out which one is
   * on screen from its four options rather than assuming one. Matching on the
   * option set rather than the prompt avoids the two cards that phrase a
   * question the same way.
   */
  const ITEMS = speedItems(ALL_CARDS)
  const onScreen = () => {
    const group = screen.getByRole("group", { name: "Answer options" })
    const buttons = within(group).getAllByRole("button")
    const texts = buttons.map((b) => b.textContent ?? "")
    const item = ITEMS.find(
      (i) =>
        texts.includes(i.variant.correct) &&
        i.variant.distractors.every((d) => texts.includes(d)),
    )
    if (!item)
      throw new Error(`no card matches the options: ${texts.join(" | ")}`)
    return { item, buttons }
  }

  const answer = async (
    user: ReturnType<typeof userEvent.setup>,
    correctly: boolean,
  ) => {
    const { item, buttons } = onScreen()
    const wanted = correctly
      ? item.variant.correct
      : item.variant.distractors[0]
    await user.click(buttons.find((b) => b.textContent === wanted)!)
    return item
  }

  const storedState = (cardId: string) => {
    const raw = window.localStorage.getItem(
      "architecture-simulator:progress:v1",
    )
    const blob = JSON.parse(raw!) as { cardStates: Record<string, CardState> }
    return blob.cardStates[cardId]
  }

  const openConcepts = async (user: ReturnType<typeof userEvent.setup>) => {
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Concepts" }),
      ).toBeInTheDocument(),
    )
    // Vocabulary is Speed-only, so Concepts is where the review queue applies.
    await user.click(screen.getByRole("button", { name: "Concepts" }))
  }

  const reviewQueue = () =>
    screen.queryByRole("button", { name: /review queue/i })

  it("offers the review queue only once a question has gone right", async () => {
    const user = userEvent.setup()
    render(<DrillSession />)
    await openConcepts(user)

    expect(reviewQueue()).not.toBeInTheDocument()
    await answer(user, true)
    expect(screen.getByText("Correct.")).toBeInTheDocument()
    expect(reviewQueue()).toBeInTheDocument()
  })

  it("does not offer it on a wrong answer, which is queued already", async () => {
    const user = userEvent.setup()
    render(<DrillSession />)
    await openConcepts(user)

    const item = await answer(user, false)
    expect(reviewQueue()).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        new Date(storedState(item.card.id)!.dueAt).getTime(),
      ).toBeLessThanOrEqual(Date.now()),
    )
  })

  it("queues a right answer for review without counting it wrong", async () => {
    const user = userEvent.setup()
    render(<DrillSession />)
    await openConcepts(user)

    const item = await answer(user, true)
    await user.click(screen.getByRole("button", { name: /review queue/i }))

    await waitFor(() => {
      const state = storedState(item.card.id)!
      // Due now, with the interval capped so a later "good" cannot leap it
      // away again. A card never graded in Discuss sits at 0 and stays there,
      // which is right -- it is already queued as a new card.
      expect(new Date(state.dueAt).getTime()).toBeLessThanOrEqual(Date.now())
      expect(state.intervalDays).toBeLessThanOrEqual(1)
      // Still one attempt, still right. Flagging must not re-record the answer
      // or the recognition stats would show two questions where there was one.
      expect(state.speedSeen).toBe(1)
      expect(state.speedRight).toBe(1)
      // Discuss owns the memory model; this only ever pulls a card forward.
      expect(state.lastReviewedAt).toBeNull()
      expect(state.enqueuedBy).toBeUndefined()
    })

    // And it moved on, as Next would have.
    expect(screen.queryByText("Correct.")).not.toBeInTheDocument()
    expect(reviewQueue()).not.toBeInTheDocument()
  })

  it("hides it on vocabulary, which the Discuss queue never draws from", async () => {
    const user = userEvent.setup()
    render(<DrillSession />)
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Vocabulary" }),
      ).toBeInTheDocument(),
    )
    await user.click(screen.getByRole("button", { name: "Vocabulary" }))

    await answer(user, true)
    expect(screen.getByText("Correct.")).toBeInTheDocument()
    // A button that moved a due date nothing reads would be a lie on screen.
    expect(reviewQueue()).not.toBeInTheDocument()
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
