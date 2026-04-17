'use client'

import { FileText, FileSpreadsheet } from 'lucide-react'

export default function ReportButtons({ loteId, loteName }: { loteId: string; loteName: string }) {
  async function downloadReport(format: 'pdf' | 'excel') {
    const res = await fetch(`/api/reports/${format}?loteId=${encodeURIComponent(loteId)}&loteName=${encodeURIComponent(loteName)}`)
    if (!res.ok) { alert('Error generando reporte'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte_${loteName.replace(/\s/g, '_')}.${format === 'excel' ? 'xlsx' : 'pdf'}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex gap-2 pt-1">
      <button
        onClick={() => downloadReport('pdf')}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors"
      >
        <FileText size={13} /> PDF
      </button>
      <button
        onClick={() => downloadReport('excel')}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors"
      >
        <FileSpreadsheet size={13} /> Excel
      </button>
    </div>
  )
}
