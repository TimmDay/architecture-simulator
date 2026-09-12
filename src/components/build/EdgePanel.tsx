"use client"

import type { Edge as SimEdge } from "~/sim/types"

export type EdgeConfig = {
  carries: NonNullable<SimEdge["carries"]>
  fanout: number
}

const sel =
  "border-line bg-ink text-chalk focus:border-accent w-full rounded border px-2 py-1 text-[12px] outline-none"

export function EdgePanel({
  from,
  to,
  config,
  onChange,
  onDelete,
}: {
  from: string
  to: string
  config: EdgeConfig
  onChange: (next: EdgeConfig) => void
  onDelete: () => void
}) {
  return (
    <div>
      <h3 className="text-fog mb-1 text-xs font-medium tracking-wide uppercase">
        Connection
      </h3>
      <p className="text-chalk mb-3 text-[13px]">
        {from} <span className="text-fog">→</span> {to}
      </p>

      <p className="text-fog/70 mb-3 text-[11px] leading-relaxed">
        This is a <strong className="text-chalk">request</strong> edge — the
        response comes back along it automatically. You never draw a second
        arrow back the other way.
      </p>

      <label className="mb-3 block">
        <span className="text-chalk mb-1 block text-[12px]">Carries</span>
        <select
          value={config.carries}
          onChange={(e) =>
            onChange({
              ...config,
              carries: e.target.value as EdgeConfig["carries"],
            })
          }
          className={sel}
        >
          <option value="all">Reads and writes</option>
          <option value="reads">Reads only</option>
          <option value="writes">Writes only</option>
        </select>
        <span className="text-fog/60 mt-1 block text-[10px] leading-snug">
          Split a read path from a write path by drawing two edges — writes to
          the primary, reads to a replica or cache.
        </span>
      </label>

      <label className="mb-3 block">
        <span className="text-chalk mb-1 block text-[12px]">
          Calls per request
        </span>
        <input
          type="number"
          min={1}
          max={100}
          value={config.fanout}
          onChange={(e) =>
            onChange({ ...config, fanout: Math.max(1, +e.target.value) })
          }
          className={sel}
        />
        <span className="text-fog/60 mt-1 block text-[10px] leading-snug">
          How many downstream calls one inbound request makes. Raise it above 1
          to see what an N+1 does to the component on the other end.
        </span>
      </label>

      <button
        onClick={onDelete}
        className="text-fail hover:bg-fail/10 border-fail/30 w-full rounded border py-1.5 text-[12px] transition-colors"
      >
        Delete connection
      </button>
      <p className="text-fog/50 mt-2 text-[10px]">
        Or press Backspace with it selected.
      </p>
    </div>
  )
}
