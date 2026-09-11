import { BuildWorkspace } from "~/components/build/BuildWorkspace"
import { SCENARIOS } from "~/sim/scenarios"

export default function BuildPage() {
  const scenario = SCENARIOS[0]
  if (!scenario) return null
  return <BuildWorkspace scenario={scenario} />
}
