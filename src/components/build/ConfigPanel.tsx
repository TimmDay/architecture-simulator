"use client"

import { CATALOGUE } from "~/sim/catalogue"
import type { PlacedComponent } from "~/sim/types"

type Props = {
  component: PlacedComponent
  onChange: (next: PlacedComponent) => void
  onDelete: () => void
  /** Everything this one could point at, and whether it already does. */
  targets: { id: string; label: string; connected: boolean }[]
  onConnect: (targetId: string) => void
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

export function ConfigPanel({
  component,
  onChange,
  onDelete,
  targets,
  onConnect,
}: Props) {
  const spec = CATALOGUE[component.kind]
  if (!spec) return null
  const cfg = component.config
  const set = (patch: Partial<PlacedComponent["config"]>) =>
    onChange({ ...component, config: { ...cfg, ...patch } })

  const unconnected = targets.filter((t) => !t.connected)

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

      {spec.vendors.length > 0 && (
        <label className="mb-2 block">
          <span className="text-fog mb-1 block text-[11px]">Vendor</span>
          <select
            value={cfg.vendor ?? ""}
            onChange={(e) => set({ vendor: e.target.value || undefined })}
            className="border-line bg-ink text-chalk focus:border-accent w-full rounded border px-2 py-1.5 text-[12px] outline-none"
          >
            <option value="">Not decided</option>
            {spec.vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="divide-line divide-y">
        {/* A browser app has no instance count and no zone to sit in -- it runs
            wherever the user is. Offering those controls invites nonsense. */}
        {!spec.clientSide && (
          <>
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
          </>
        )}

        {component.kind === "api-gateway" && (
          <div className="py-2">
            <p className="text-fog/70 text-[10px] leading-snug">
              Not the same job as a load balancer. A{" "}
              <strong className="text-chalk/80">load balancer</strong> spreads
              traffic across instances of one service. A{" "}
              <strong className="text-chalk/80">gateway</strong> is one front
              door for many services — routing by path, auth, per-client rate
              limits. You want both once there is more than one service behind
              one public surface.
            </p>
          </div>
        )}

        {component.kind === "web-client" && (
          <>
            <Row label="Rendering" hint="Where the HTML is produced">
              <select
                value={cfg.rendering ?? "csr"}
                onChange={(e) =>
                  set({ rendering: e.target.value as "static" | "ssr" | "csr" })
                }
                className={sel}
              >
                <option value="static">Static</option>
                <option value="ssr">Server-rendered</option>
                <option value="csr">Client-rendered</option>
              </select>
            </Row>
            <Row
              label="Validate in browser"
              hint="Pleasant to use. Not a control — the API must still check."
            >
              <input
                type="checkbox"
                checked={cfg.clientValidation ?? false}
                onChange={(e) => set({ clientValidation: e.target.checked })}
                className="accent-accent h-4 w-4"
              />
            </Row>
            <Row
              label="Retry on failure"
              hint="Thousands of clients fail at the same instant"
            >
              <select
                value={cfg.clientRetry ?? "none"}
                onChange={(e) =>
                  set({
                    clientRetry: e.target.value as
                      "none" | "immediate" | "backoff-jitter",
                  })
                }
                className={sel}
              >
                <option value="none">Don&apos;t retry</option>
                <option value="immediate">Retry immediately</option>
                <option value="backoff-jitter">Backoff with jitter</option>
              </select>
            </Row>
          </>
        )}

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

        {spec.stateful && spec.supports.backups && (
          <Row
            label="Hot standby"
            hint="Second zone, promoted on failure. No extra capacity, double the cost."
          >
            <input
              type="checkbox"
              checked={cfg.standby ?? false}
              onChange={(e) => set({ standby: e.target.checked })}
              className="accent-accent h-4 w-4"
            />
          </Row>
        )}

        {component.kind === "queue" && (
          <Row
            label="Dead-letter queue"
            hint="So one bad message cannot block the line"
          >
            <input
              type="checkbox"
              checked={cfg.deadLetterQueue ?? false}
              onChange={(e) => set({ deadLetterQueue: e.target.checked })}
              className="accent-accent h-4 w-4"
            />
          </Row>
        )}

        {component.kind === "app-server" && (
          <Row
            label="Idempotency keys"
            hint="A timeout is an unknown, not a failure. Keys make a retry safe."
          >
            <input
              type="checkbox"
              checked={cfg.idempotencyKeys ?? false}
              onChange={(e) => set({ idempotencyKeys: e.target.checked })}
              className="accent-accent h-4 w-4"
            />
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
            label="Stampede protection"
            hint="Coalesce concurrent misses so one key expiring does not hit the origin N times"
          >
            <input
              type="checkbox"
              checked={cfg.stampedeProtection ?? false}
              onChange={(e) => set({ stampedeProtection: e.target.checked })}
              className="accent-accent h-4 w-4"
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

      {/*
        Connecting by dragging one 7px handle onto another is fine with a
        mouse and impossible with a thumb -- a real touch drag between two
        handles produces no edge at all. This is the same operation as a
        list, which also happens to be the easier way to point something
        backwards, at a database it reads from.
      */}
      {unconnected.length > 0 && (
        <div className="border-line mt-3 border-t pt-3">
          <h3 className="text-fog mb-1.5 text-xs font-medium tracking-wide uppercase">
            Connect to
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {unconnected.map((t) => (
              <button
                key={t.id}
                onClick={() => onConnect(t.id)}
                className="border-line text-chalk hover:border-accent/60 hover:text-accent rounded border px-2 py-1 text-[11px] transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onDelete}
        className="text-fail hover:bg-fail/10 border-fail/30 mt-3 w-full rounded border py-1.5 text-[12px] transition-colors"
      >
        Remove component
      </button>
    </div>
  )
}
