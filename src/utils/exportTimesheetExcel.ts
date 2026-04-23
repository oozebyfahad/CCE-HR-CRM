import ExcelJS from 'exceljs'
import type { RotaAttendance, RotaShift } from '../services/rotacloud'
import { unixToHHMM, unixToLocalDate } from '../hooks/useRotaAttendance'

// ── Palette ────────────────────────────────────────────────────────────
const C = {
  brand:       '1A3C5E',   // deep navy  (CCE primary)
  brandLight:  '2E86C1',   // mid blue
  brandBg:     'EBF5FB',   // very light blue
  headerText:  'FFFFFF',
  subHeader:   'D6EAF8',
  subText:     '2471A3',
  present:     'E9F7EF',
  presentText: '1E8449',
  late:        'FEF9E7',
  lateText:    'B7770D',
  halfDay:     'F4ECF7',
  halfText:    '7D3C98',
  absent:      'FDEDEC',
  absentText:  'B03A2E',
  weekend:     'F8F9FA',
  weekendText: 'ADB5BD',
  totals:      'EBF5FB',
  totalsText:  '1A3C5E',
  border:      'DEE2E6',
  muted:       '6C757D',
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hex(c: string): any { return { argb: 'FF' + c } }

function applyBorder(cell: ExcelJS.Cell, color = C.border) {
  const s: ExcelJS.Border = { style: 'thin', color: hex(color) }
  cell.border = { top: s, left: s, bottom: s, right: s }
}

function fmt12(hhmm: string | undefined): string {
  if (!hhmm) return '—'
  const [h, m] = hhmm.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtHours(h: number): string {
  if (!h) return '—'
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${hh}h ${String(mm).padStart(2, '0')}m`
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00').getDay()
  return d === 0 || d === 6
}

function dayOfWeek(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

// ── Main export ────────────────────────────────────────────────────────

export interface ExportTimesheetOptions {
  employeeName: string
  department:   string
  month:        string   // 'YYYY-MM'
  attendance:   RotaAttendance[]
  shifts:       RotaShift[]
}

export async function exportTimesheetExcel(opts: ExportTimesheetOptions) {
  const { employeeName, department, month, attendance, shifts } = opts

  // ── Index data ──────────────────────────────────────────────────────
  const attByDate = new Map<string, RotaAttendance>()
  for (const r of attendance) {
    const unix = (r.in_time_clocked ?? r.in_time) as number
    const d = unixToLocalDate(unix)
    const ex = attByDate.get(d)
    if (!ex || r.approved) attByDate.set(d, r)
  }

  const shiftByDate = new Map<string, RotaShift>()
  for (const s of shifts) {
    const d = unixToLocalDate(s.start_time)
    if (!shiftByDate.has(d)) shiftByDate.set(d, s)
  }

  const [y, mo] = month.split('-').map(Number)
  const daysInMonth = new Date(y, mo, 0).getDate()
  const todayStr = new Date().toISOString().slice(0, 10)

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const dd   = String(i + 1).padStart(2, '0')
    const date = `${month}-${dd}`
    return { date, att: attByDate.get(date), shift: shiftByDate.get(date) }
  })

  // ── Summary stats ───────────────────────────────────────────────────
  const attList      = [...attByDate.values()]
  const totalHours   = attList.reduce((s, r) => s + r.hours, 0)
  const totalDays    = attList.filter(r => r.hours > 0 || r.in_time_clocked).length
  const lateDays     = attList.filter(r => r.minutes_late > 30).length
  const approvedDays = attList.filter(r => r.approved).length
  const overtimeH    = attList.reduce((s, r) => s + Math.max(0, r.hours - 8), 0)
  const absentDays   = days.filter(({ date, att }) => !att && !isWeekend(date) && date < todayStr).length
  const totalBreak   = attList.reduce((s, r) => s + r.minutes_break, 0)

  // ── Workbook ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CCE HR Portal'
  wb.created = new Date()

  const ws = wb.addWorksheet('Timesheet', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    views: [{ state: 'frozen', xSplit: 0, ySplit: 11 }],  // freeze above data rows
  })

  // ── Column widths ───────────────────────────────────────────────────
  ws.columns = [
    { key: 'date',      width: 14 },
    { key: 'day',       width: 13 },
    { key: 'schedIn',   width: 13 },
    { key: 'schedOut',  width: 13 },
    { key: 'clockIn',   width: 13 },
    { key: 'clockOut',  width: 13 },
    { key: 'break',     width: 9  },
    { key: 'hours',     width: 11 },
    { key: 'overtime',  width: 11 },
    { key: 'late',      width: 9  },
    { key: 'status',    width: 13 },
  ]

  // ── Row 1: Title banner ─────────────────────────────────────────────
  ws.mergeCells('A1:K1')
  const titleCell = ws.getCell('A1')
  titleCell.value = 'CabCall Experts — Employee Timesheet'
  titleCell.font  = { name: 'Calibri', size: 16, bold: true, color: hex(C.headerText) }
  titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: hex(C.brand) }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 36

  // ── Row 2: Month subtitle ───────────────────────────────────────────
  ws.mergeCells('A2:K2')
  const monthCell = ws.getCell('A2')
  monthCell.value = fmtMonth(month)
  monthCell.font  = { name: 'Calibri', size: 12, bold: true, color: hex(C.brandLight) }
  monthCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: hex(C.brandBg) }
  monthCell.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(2).height = 22

  // ── Row 3: blank spacer ─────────────────────────────────────────────
  ws.getRow(3).height = 6

  // ── Rows 4-5: Employee info ─────────────────────────────────────────
  const infoRows: [string, string, string, string][] = [
    ['Employee',   employeeName,                  'Department', department || '—'],
    ['Period',     `1 – ${daysInMonth} ${fmtMonth(month)}`, 'Generated', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })],
  ]
  infoRows.forEach((info, idx) => {
    const rowNum = 4 + idx
    ws.mergeCells(`A${rowNum}:B${rowNum}`)
    ws.mergeCells(`C${rowNum}:F${rowNum}`)
    ws.mergeCells(`G${rowNum}:H${rowNum}`)
    ws.mergeCells(`I${rowNum}:K${rowNum}`)

    const [k1, v1, k2, v2] = info
    const labelStyle: Partial<ExcelJS.Style> = {
      font: { name: 'Calibri', size: 10, bold: true, color: hex(C.subText) },
      fill: { type: 'pattern', pattern: 'solid', fgColor: hex(C.subHeader) },
      alignment: { horizontal: 'right', vertical: 'middle', indent: 1 },
    }
    const valStyle: Partial<ExcelJS.Style> = {
      font: { name: 'Calibri', size: 10, color: hex(C.brand) },
      fill: { type: 'pattern', pattern: 'solid', fgColor: hex('FFFFFF') },
      alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
    }

    const lCell1 = ws.getCell(`A${rowNum}`); lCell1.value = k1; Object.assign(lCell1, labelStyle)
    const vCell1 = ws.getCell(`C${rowNum}`); vCell1.value = v1; Object.assign(vCell1, valStyle)
    const lCell2 = ws.getCell(`G${rowNum}`); lCell2.value = k2; Object.assign(lCell2, labelStyle)
    const vCell2 = ws.getCell(`I${rowNum}`); vCell2.value = v2; Object.assign(vCell2, valStyle)
    ws.getRow(rowNum).height = 18
  })

  // ── Row 6: blank spacer ─────────────────────────────────────────────
  ws.getRow(6).height = 6

  // ── Rows 7-8: Summary stats ─────────────────────────────────────────
  const stats = [
    { label: 'Days Worked', value: `${totalDays}` },
    { label: 'Total Hours', value: fmtHours(totalHours) },
    { label: 'Overtime',    value: fmtHours(overtimeH) },
    { label: 'Absent',      value: `${absentDays} days` },
    { label: 'Late',        value: `${lateDays} days` },
    { label: 'Approved',    value: `${approvedDays} days` },
  ]

  // Merge pairs of columns for each stat tile  (A:B, C:D, E:F, G:H, I:J, K)
  const statCols = ['A', 'C', 'E', 'G', 'I', 'K']
  stats.forEach((stat, i) => {
    const col = statCols[i]
    const nextCol = String.fromCharCode(col.charCodeAt(0) + 1)
    if (col !== 'K') ws.mergeCells(`${col}7:${nextCol}7`)
    if (col !== 'K') ws.mergeCells(`${col}8:${nextCol}8`)

    const labelCell = ws.getCell(`${col}7`)
    labelCell.value = stat.label
    labelCell.font  = { name: 'Calibri', size: 8, bold: true, color: hex(C.muted) }
    labelCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: hex(C.brandBg) }
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' }

    const valCell = ws.getCell(`${col}8`)
    valCell.value = stat.value
    valCell.font  = { name: 'Calibri', size: 13, bold: true, color: hex(C.brand) }
    valCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: hex(C.brandBg) }
    valCell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  ws.getRow(7).height = 16
  ws.getRow(8).height = 24

  // ── Row 9: blank spacer ─────────────────────────────────────────────
  ws.getRow(9).height = 6

  // ── Row 10: Column group headers ────────────────────────────────────
  ws.mergeCells('C10:D10')
  ws.mergeCells('E10:F10')

  const grpStyle = (fg: string, tc: string): Partial<ExcelJS.Style> => ({
    font:      { name: 'Calibri', size: 9, bold: true, color: hex(tc) },
    fill:      { type: 'pattern', pattern: 'solid', fgColor: hex(fg) },
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  const grpBlanks = ['A10', 'B10', 'G10', 'H10', 'I10', 'J10', 'K10']
  grpBlanks.forEach(addr => {
    const c = ws.getCell(addr)
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: hex(C.brand) }
  })
  const schedGrp = ws.getCell('C10')
  Object.assign(schedGrp, grpStyle('2471A3', 'FFFFFF'))
  schedGrp.value = 'SCHEDULED'

  const clockGrp = ws.getCell('E10')
  Object.assign(clockGrp, grpStyle('1A3C5E', 'FFFFFF'))
  clockGrp.value = 'ACTUAL CLOCK'

  ws.getRow(10).height = 14

  // ── Row 11: Column headers ───────────────────────────────────────────
  const headers = ['Date', 'Day', 'Start', 'Finish', 'Clock In', 'Clock Out', 'Break', 'Hours', 'Overtime', 'Late', 'Status']
  const hdrRow = ws.getRow(11)
  hdrRow.height = 20
  headers.forEach((h, i) => {
    const cell = hdrRow.getCell(i + 1)
    cell.value = h
    cell.font  = { name: 'Calibri', size: 10, bold: true, color: hex(C.headerText) }
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: hex(C.brand) }
    cell.alignment = { horizontal: i < 2 ? 'left' : 'center', vertical: 'middle' }
    applyBorder(cell, C.brand)
  })

  // ── Data rows (starting row 12) ─────────────────────────────────────
  days.forEach(({ date, att, shift }, _idx) => {
    const weekend = isWeekend(date)
    const future  = date > todayStr
    const stilIn  = !!att?.in_time_clocked && !att?.out_time_clocked

    const clockInActual  = att?.in_time_clocked  ? unixToHHMM(att.in_time_clocked)  : undefined
    const clockOutActual = att?.out_time_clocked ? unixToHHMM(att.out_time_clocked) : undefined
    const clockInLogged  = att && !clockInActual  ? unixToHHMM(att.in_time)  : undefined
    const clockOutLogged = att && !clockOutActual ? unixToHHMM(att.out_time) : undefined

    const schedIn  = shift ? unixToHHMM(shift.start_time) : undefined
    const schedOut = shift ? unixToHHMM(shift.end_time)   : undefined

    // Derive status
    let status = future ? '—' : '—'
    if (weekend && !att)       status = 'Day Off'
    else if (att) {
      if (stilIn)                                         status = 'Live'
      else if (att.hours > 0 && att.hours < 4)           status = 'Half Day'
      else if (att.hours >= 4 && att.minutes_late > 30)  status = 'Late'
      else if (att.hours >= 4)                            status = 'Present'
      else                                                status = 'Present'
    } else if (!future && !weekend) {
      status = 'Absent'
    }

    // Row background
    let rowFg = 'FFFFFF'
    let rowTc = '212529'
    if (weekend)              { rowFg = C.weekend;  rowTc = C.weekendText }
    else if (status === 'Absent')  { rowFg = C.absent;   rowTc = C.absentText  }
    else if (status === 'Late')    { rowFg = C.late;     rowTc = C.lateText    }
    else if (status === 'Half Day'){ rowFg = C.halfDay;  rowTc = C.halfText    }
    else if (status === 'Present' || status === 'Live') { rowFg = C.present; rowTc = C.presentText }

    const dataRow = ws.addRow([
      fmtDate(date),
      dayOfWeek(date),
      fmt12(schedIn),
      fmt12(schedOut),
      clockInActual  ? fmt12(clockInActual)  : clockInLogged  ? `(${fmt12(clockInLogged)})`  : '—',
      clockOutActual ? fmt12(clockOutActual) : clockOutLogged ? `(${fmt12(clockOutLogged)})` : stilIn ? 'Live' : '—',
      att?.minutes_break ? `${att.minutes_break}m` : '—',
      att?.hours ? fmtHours(att.hours) : '—',
      att?.hours && att.hours > 8 ? fmtHours(att.hours - 8) : '—',
      att?.minutes_late && att.minutes_late > 0 ? `${att.minutes_late}m` : '—',
      status + (att?.approved && status !== '—' && status !== 'Day Off' ? ' ✓' : ''),
    ])

    dataRow.height = 17
    dataRow.eachCell((cell, colNum) => {
      cell.font      = { name: 'Calibri', size: 10, color: hex(rowTc), bold: colNum === 8 }
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: hex(rowFg) }
      cell.alignment = { horizontal: colNum <= 2 ? 'left' : 'center', vertical: 'middle', indent: colNum <= 2 ? 1 : 0 }
      applyBorder(cell)
    })

    // Weekend rows slightly italic
    if (weekend) dataRow.eachCell(c => { c.font = { ...c.font, italic: true } })
  })

  // ── Totals row ───────────────────────────────────────────────────────
  const totRow = ws.addRow([
    'Monthly Total',
    `${totalDays} days worked`,
    '', '',
    '', '',
    totalBreak ? `${totalBreak}m` : '—',
    fmtHours(totalHours),
    fmtHours(overtimeH),
    `${lateDays} late`,
    `${approvedDays} approved`,
  ])
  totRow.height = 20
  totRow.eachCell((cell, colNum) => {
    cell.font      = { name: 'Calibri', size: 10, bold: true, color: hex(C.totalsText) }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: hex(C.totals) }
    cell.alignment = { horizontal: colNum <= 2 ? 'left' : 'center', vertical: 'middle', indent: colNum <= 2 ? 1 : 0 }
    applyBorder(cell, C.brand)
  })

  // ── Footer row ───────────────────────────────────────────────────────
  const footerRowNum = ws.rowCount + 2
  ws.mergeCells(`A${footerRowNum}:K${footerRowNum}`)
  const footerCell = ws.getCell(`A${footerRowNum}`)
  footerCell.value = `Generated by CCE HR Portal · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · Data sourced from RotaCloud`
  footerCell.font  = { name: 'Calibri', size: 8, italic: true, color: hex(C.muted) }
  footerCell.alignment = { horizontal: 'center' }

  // ── Download ─────────────────────────────────────────────────────────
  const buf  = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `CCE_Timesheet_${employeeName.replace(/\s+/g, '_')}_${month}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
