import { Card } from './ui/Card'

export function ComingSoon({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <Card className="max-w-xl">
      <p className="text-xs font-semibold tracking-[0.18em] text-tide-600 uppercase">Coming soon</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink-950">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-ink-600">{description}</p>
    </Card>
  )
}
