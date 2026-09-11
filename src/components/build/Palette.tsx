"use client"

import { CATALOGUE, HOURS_PER_MONTH } from "~/sim/catalogue"
import type { ComponentKind } from "~/sim/types"

export function Palette({ kinds }: { kinds: ComponentKind[] }) {
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
          <div
            key={kind}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/architecture-kind", kind)
              e.dataTransfer.effectAllowed = "move"
            }}
            className="border-line bg-panel hover:border-accent/60 cursor-grab rounded-lg border px-2.5 py-2 active:cursor-grabbing"
          >
            <div className="text-chalk text-[12px] font-medium">
              {spec.label}
            </div>
            <div className="text-fog/70 mt-0.5 text-[10px]">
              {spec.capacity.readRps.toLocaleString()} r/s
              {spec.capacity.writeRps !== spec.capacity.readRps &&
                ` · ${spec.capacity.writeRps.toLocaleString()} w/s`}{" "}
              · ${monthly}/mo
            </div>
          </div>
        )
      })}
      <p className="text-fog/50 pt-2 text-[10px] leading-relaxed">
        Drag onto the canvas. Not everything here belongs in every design —
        picking the wrong component is part of the exercise.
      </p>
    </div>
  )
}
