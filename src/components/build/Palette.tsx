"use client"

import { CATALOGUE, HOURS_PER_MONTH } from "~/sim/catalogue"
import type { ComponentKind } from "~/sim/types"

export function Palette({
  kinds,
  armed,
  onArm,
}: {
  kinds: ComponentKind[]
  /** The component waiting to be placed by tapping the canvas. */
  armed: ComponentKind | null
  onArm: (kind: ComponentKind | null) => void
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-fog mb-2 text-xs font-medium tracking-wide uppercase">
        Components
      </h3>
      {kinds.map((kind) => {
        const spec = CATALOGUE[kind]
        if (!spec) return null
        const monthly = Math.round(
          spec.costPerInstanceHourUsd * HOURS_PER_MONTH,
        )
        return (
          <button
            key={kind}
            type="button"
            draggable
            aria-pressed={armed === kind}
            onDragStart={(e) => {
              onArm(null)
              e.dataTransfer.setData("application/architecture-kind", kind)
              e.dataTransfer.effectAllowed = "move"
            }}
            onClick={() => onArm(armed === kind ? null : kind)}
            className={`w-full cursor-grab rounded-lg border px-2.5 py-2 text-left transition-colors active:cursor-grabbing ${
              armed === kind
                ? "border-accent bg-accent/15"
                : "border-line bg-panel hover:border-accent/60"
            }`}
          >
            <div className="text-chalk text-[12px] font-medium">
              {spec.label}
            </div>
            <div className="text-fog/70 mt-0.5 text-[10px]">
              {spec.clientSide ? (
                // Capacity and cost are meaningless for something running on
                // the user's own device, and MAX_SAFE_INTEGER reads as noise.
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
      <p className="text-fog/50 pt-2 text-[10px] leading-relaxed">
        Drag onto the canvas, or tap one and then tap where it goes. Not
        everything here belongs in every design — picking the wrong component is
        part of the exercise.
      </p>
    </div>
  )
}
