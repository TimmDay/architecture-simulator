import { notFound } from "next/navigation"
import { BuildWorkspace } from "~/components/build/BuildWorkspace"
import { SCENARIOS, scenarioById } from "~/sim/scenarios"

export function generateStaticParams() {
  return SCENARIOS.map((s) => ({ scenarioId: s.id }))
}

export default async function BuildScenarioPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>
}) {
  const { scenarioId } = await params
  const scenario = scenarioById(scenarioId)
  if (!scenario) notFound()
  return <BuildWorkspace scenario={scenario} />
}
