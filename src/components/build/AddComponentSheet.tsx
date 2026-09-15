"use client"

import { useEffect } from "react"
import { X } from "lucide-react"
import { CATALOGUE, HOURS_PER_MONTH } from "~/sim/catalogue"
import type { ComponentKind } from "~/sim/types"

/**
 * What comes after this one.
 *
 * A sheet rather than a dropdown: it is reachable with a thumb at the bottom of
 * the screen, and it can afford one line of capacity and cost per option, which
 * is the information the choice actually turns on.
 *
 * It offers the scenario's palette unfiltered. Narrowing it to what "makes
 * sense" downstream would quietly do the exercise for you -- picking the wrong
 * component is the part being practised.
 */
export function AddComponentSheet({
  sourceLabel,
  kinds,
  onPick,
  onClose,
}: {
  sourceLabel: string
  kinds: ComponentKind[]
  onPick: (kind: ComponentKind) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-black/60"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Add a component after ${sourceLabel}`}
        onClick={(e) => e.stopPropagation()}
        className="border-line bg-panel max-h-[75vh] w-full overflow-y-auto rounded-t-2xl border-t p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-chalk text-[14px] font-medium">
              Add after {sourceLabel}
            </h2>
            <p className="text-fog/70 mt-0.5 text-[11px]">
              It will be wired up from {sourceLabel}.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-fog hover:text-chalk shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 space-y-1.5 pb-2">
          {kinds.map((kind) => {
            const spec = CATALOGUE[kind]
            if (!spec) return null
            const monthly = Math.round(
              spec.costPerInstanceHourUsd * HOURS_PER_MONTH,
            )
            return (
              <button
                key={kind}
                onClick={() => onPick(kind)}
                className="border-line bg-panel-2 active:border-accent w-full rounded-lg border px-3 py-2.5 text-left transition-colors"
              >
                <div className="text-chalk text-[13px] font-medium">
                  {spec.label}
                </div>
                <div className="text-fog/70 mt-0.5 text-[10px]">
                  {spec.clientSide ? (
                    <>runs on the user&apos;s device · no server cost</>
                  ) : (
                    <>
                      {spec.capacity.readRps.toLocaleString()} r/s
                      {spec.capacity.writeRps !== spec.capacity.readRps &&
                        ` · ${spec.capacity.writeRps.toLocaleString()} w/s`}{" "}
                      · ${monthly}/mo
                    </>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
