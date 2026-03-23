import { NextRequest, NextResponse } from 'next/server'
import { getTrainerWithSubscription } from '@/lib/auth/get-trainer'
import { createClient } from '@/lib/supabase/server'
import { getReportByProgram, generateReport, getReport, regenerateReport } from '@/lib/reports/program-report-service'
import { generateReportHTML } from '@/lib/reports/program-report-html'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: programId } = await params
        const { trainer } = await getTrainerWithSubscription()
        const supabase = await createClient()
        const shouldRegenerate = request.nextUrl.searchParams.get('regenerate') === '1'

        // Try to fetch existing report, or generate one on-the-fly
        let report = await getReportByProgram(supabase, programId)

        if (report && shouldRegenerate) {
            const newId = await regenerateReport(supabase, report.id)
            report = newId ? await getReport(supabase, newId) : null
        }

        if (!report) {
            const reportId = await generateReport(supabase, programId)
            if (reportId) {
                report = await getReport(supabase, reportId)
            }
        }

        if (!report) {
            return new NextResponse(
                '<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#64748b">' +
                'Não foi possível gerar o relatório. O programa pode não ter sessões registradas.</body></html>',
                { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
        }

        // Fetch student name
        const { data: student } = await supabase
            .from('students')
            .select('name')
            .eq('id', report.student_id)
            .single()

        const html = generateReportHTML(report, student?.name || 'Aluno', trainer.name)

        return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
    } catch (error) {
        console.error('[report-route] Error:', error)
        return new NextResponse('Erro ao gerar relatório', { status: 500 })
    }
}
