import type { ReactNode } from 'react'

export function Table({
  headers,
  children,
}: {
  headers: string[]
  children: ReactNode
}) {
  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-sand-100 bg-white">
      <table className="min-w-full text-left text-xs sm:text-sm">
        <thead className="bg-sand-50 text-[11px] font-semibold tracking-wide text-ink-600 uppercase sm:text-xs">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2.5 whitespace-nowrap sm:px-4 sm:py-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-50">{children}</tbody>
      </table>
    </div>
  )
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-middle text-ink-800 sm:px-4 sm:py-3 ${className}`}>{children}</td>
}
