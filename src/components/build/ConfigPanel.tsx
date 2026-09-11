"use client"

import { CATALOGUE } from "~/sim/catalogue"
import type { PlacedComponent } from "~/sim/types"

type Props = {
  component: PlacedComponent
  onChange: (next: PlacedComponent) => void
  onDelete: () => void
}

const Row = ({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) => (
  <div className="flex items-start justify-between gap-3 py-2">
    <div className="min-w-0">
      <div className="text-chalk text-[12px]">{label}</div>
      {hint && (
        <div className="text-fog/60 text-[10px] leading-snug">{hint}</div>
      )}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
)

const num =
  "border-line bg-ink text-chalk w-16 rounded border px-2 py-1 text-[12px] outline-none focus:border-accent"
const sel =
  "border-line bg-ink text-chalk rounded border px-2 py-1 text-[12px] outline-none focus:border-accent"

export function ConfigPanel({ component, onChange, onDelete }: Props) {
  const spec = CATALOGUE[component.kind]
  if (!spec) return null
  const cfg = component.config
  const set = (patch: Partial<PlacedComponent["config"]>) =>
    onChange({ ...component, config: { ...cfg, ...patch } })

  return (
    <div>
      <h3 className="text-fog mb-1 text-xs font-medium tracking-wide uppercase">
        Configure
      </h3>
      <input
        value={component.label}
        onChange={(e) => onChange({ ...component, label: e.target.value })}
        className="border-line bg-ink text-chalk focus:border-accent mb-2 w-full rounded border px-2 py-1.5 text-[13px] outline-none"
      />

      <div className="divide-line divide-y">
        <Row
          label="Instances"
          hint={`${spec.capacity.readRps.toLocaleString()} reads/s each`}
        >
          <input
            type="number"
            min={1}
            max={50}
            value={component.instances}
            onChange={(e) =>
              onChange({
                ...component,
                instances: Math.max(1, +e.target.value),
              })
            }
            className={num}
          />
        </Row>

        <Row
          label="Availability zones"
          hint={
            spec.managed
              ? "Managed service — the provider runs the redundancy."
              : "Instances spread round-robin. One instance can only sit in one zone."
          }
        >
          <input
            type="number"
            min={1}
            max={3}
            value={cfg.availabilityZones ?? 1}
            onChange={(e) =>
              set({ availabilityZones: Math.max(1, +e.target.value) })
            }
            className={num}
          />
        </Row>

        {spec.supports.sessionStore && (
          <Row label="Sessions" hint="Where login state lives">
            <select
              value={cfg.sessionStore ?? "none"}
              onChange={(e) =>
                set({
                  sessionStore: e.target.value as
                    "in-memory" | "shared" | "none",
                })
              }
              className={sel}
            >
              <option value="none">Stateless (tokens)</option>
              <option value="in-memory">In memory</option>
              <option value="shared">Shared store</option>
            </select>
          </Row>
        )}

        {spec.supports.backups && (
          <Row label="Backups" hint="Durability. Replication is not a backup.">
            <input
              type="checkbox"
              checked={cfg.backups?.enabled ?? false}
              onChange={(e) =>
                set({ backups: { enabled: e.target.checked, rpoMinutes: 5 } })
              }
              className="accent-accent h-4 w-4"
            />
          </Row>
        )}

        {spec.supports.encryptionAtRest && (
          <Row label="Encrypt at rest">
            <input
              type="checkbox"
              checked={cfg.encryptedAtRest ?? false}
              onChange={(e) => set({ encryptedAtRest: e.target.checked })}
              className="accent-accent h-4 w-4"
            />
          </Row>
        )}

        {(component.kind === "app-server" ||
          component.kind === "api-gateway") && (
          <Row
            label="Require auth"
            hint="Checked per request, not just at the edge"
          >
            <input
              type="checkbox"
              checked={cfg.authRequired ?? false}
              onChange={(e) => set({ authRequired: e.target.checked })}
              className="accent-accent h-4 w-4"
            />
          </Row>
        )}

        {(component.kind === "load-balancer" ||
          component.kind === "cdn" ||
          component.kind === "api-gateway") && (
          <Row label="Rate limit (rps)" hint="Per client. 0 = none.">
            <input
              type="number"
              min={0}
              value={cfg.rateLimitRps ?? 0}
              onChange={(e) =>
                set({ rateLimitRps: +e.target.value || undefined })
              }
              className={num}
            />
          </Row>
        )}

        {component.kind === "cache" && (
          <Row
            label="TTL (seconds)"
            hint="Longer TTL, better hit rate, staler reads"
          >
            <input
              type="number"
              min={1}
              value={cfg.ttlSeconds ?? 60}
              onChange={(e) =>
                set({ ttlSeconds: Math.max(1, +e.target.value) })
              }
              className={num}
            />
          </Row>
        )}

        {spec.supports.consistencyModes &&
          spec.supports.consistencyModes.length > 1 && (
            <Row label="Consistency">
              <select
                value={cfg.consistency ?? spec.supports.consistencyModes[0]}
                onChange={(e) =>
                  set({
                    consistency: e.target.value as
                      "strong" | "quorum" | "eventual",
                  })
                }
                className={sel}
              >
                {spec.supports.consistencyModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Row>
          )}
      </div>

      <button
        onClick={onDelete}
        className="text-fail hover:bg-fail/10 border-fail/30 mt-3 w-full rounded border py-1.5 text-[12px] transition-colors"
      >
        Remove component
      </button>
    </div>
  )
}
