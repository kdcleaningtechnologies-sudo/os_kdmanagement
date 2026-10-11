export const KD_LOGO_SRC = '/kd-logo-mark.png'
export const KD_LOGO_LIGHT_SRC = '/kd-logo-light.png'

export function Logo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${light ? 'text-white' : 'text-ink-950'}`}>
      <img
        src={KD_LOGO_SRC}
        alt="KD Facilities Management Services"
        className={`object-contain ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}
      />
      {compact ? null : (
        <span className="leading-tight">
          <span className="block text-sm font-bold tracking-tight">FacilityOS</span>
          <span className={`block text-[10px] font-medium tracking-[0.16em] uppercase ${light ? 'text-tide-100' : 'text-ink-600'}`}>
            Facilities
          </span>
        </span>
      )}
    </div>
  )
}
