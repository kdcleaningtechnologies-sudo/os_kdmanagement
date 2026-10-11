import { printClientOperationsGuide } from '../lib/clientBriefing'
import { Button } from '../components/ui/Button'

export function HowItWorksPage() {
  return (
    <div className="min-h-svh bg-sand-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/kd-logo-mark.png" alt="KD Facilities Management Services" className="h-10 w-10 object-contain" />
          <div>
            <p className="text-xs font-semibold tracking-wide text-tide-700 uppercase">KD Facilities Management Services</p>
            <p className="text-sm text-ink-700">Client briefing — print this and send it as a PDF</p>
          </div>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => printClientOperationsGuide()}>
          Print / Save PDF
        </Button>
      </div>
      <iframe
        title="How FacilityOS works"
        src="/client-operations-guide.html"
        className="h-[calc(100svh-7.5rem)] w-full border-0 bg-white sm:h-[calc(100svh-64px)]"
      />
    </div>
  )
}
