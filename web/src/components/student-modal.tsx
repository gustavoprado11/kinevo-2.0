import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createStudent } from '@/actions/create-student'
import { StudentAccessDialog } from '@/components/students'

interface Student {
    id: string
    name: string
    email: string
    phone: string | null
    status: 'active' | 'inactive' | 'pending'
    modality: 'online' | 'presential'
    created_at: string
}

interface StudentModalProps {
    isOpen: boolean
    onClose: () => void
    onStudentCreated?: (student: Student) => void
    onStudentUpdated?: (student: Student) => void
    trainerId: string
    initialData?: Student | null
}

export function StudentModal({
    isOpen,
    onClose,
    onStudentCreated,
    onStudentUpdated,
    trainerId,
    initialData
}: StudentModalProps) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [modality, setModality] = useState<'online' | 'presential'>('online')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [createdCredentials, setCreatedCredentials] = useState<{
        name: string
        email: string
        password: string
        whatsapp: string | null
    } | null>(null)

    // Update state when initialData changes or modal opens/closes
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setName(initialData.name)
                setEmail(initialData.email)
                setPhone(initialData.phone ?? '')
                setModality(initialData.modality || 'online')
            } else {
                setName('')
                setEmail('')
                setPhone('')
                setModality('online')
            }
            setError(null)
            setCreatedCredentials(null)
        }
    }, [isOpen, initialData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        if (initialData) {
            // mode: EDIT - Continue using client-side update for simple details
            const supabase = createClient()
            const { data, error: updateError } = await supabase
                .from('students')
                .update({
                    name: name.trim(),
                    email: email.trim().toLowerCase(),
                    phone: phone.trim() || null,
                    // @ts-ignore - modality field mismatch in types
                    modality: modality
                })
                .eq('id', initialData.id)
                .select()
                .single()

            if (updateError) {
                setError(updateError.message)
                setLoading(false)
                return
            }

            setLoading(false)
            onStudentUpdated?.(data as unknown as Student)
            onClose()
        } else {
            // mode: CREATE - Use the new Server Action with Auth creation
            const result = await createStudent({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim(),
                trainerId,
                modality
            })

            if (!result.success) {
                setError(result.error || 'Erro ao criar aluno')
                setLoading(false)
                return
            }

            // Success!
            setLoading(false)

            // Set credentials for the second modal
            setCreatedCredentials({
                name: result.name!,
                email: result.email!,
                password: result.password!,
                whatsapp: result.whatsapp || null
            })

            // Trigger parent update (optional, usually done via revalidatePath, but good for local state)
            if (onStudentCreated) {
                onStudentCreated({
                    id: '', // Temporary
                    name: result.name!,
                    email: result.email!,
                    phone: result.whatsapp || null,
                    status: 'active',
                    modality: modality,
                    created_at: new Date().toISOString()
                } as Student)
            }
        }
    }

    const handleClose = () => {
        onClose()
    }

    if (!isOpen) return null

    const isEdit = !!initialData

    return (
        <>
            {!createdCredentials && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={handleClose}
                    />

                    {/* Modal Content */}
                    <div className="relative bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-700/50 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50 bg-gray-800/80">
                            <div>
                                <h2 className="text-lg font-semibold text-white">
                                    {isEdit ? 'Editar Aluno' : 'Novo Aluno'}
                                </h2>
                                <p className="text-sm text-gray-400">
                                    {isEdit ? 'Atualize as informações do aluno' : 'Adicione um novo aluno ao seu painel'}
                                </p>
                            </div>
                            <button
                                onClick={handleClose}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {error}
                                </div>
                            )}

                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                                    Nome <span className="text-red-400">*</span>
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                                    placeholder="Nome completo do aluno"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                                    Email <span className="text-red-400">*</span>
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                                    placeholder="aluno@email.com"
                                />
                            </div>

                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                                    Telefone <span className="text-gray-500 font-normal">(WhatsApp para credenciais)</span>
                                </label>
                                <input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all"
                                    placeholder="(11) 99999-9999"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-3">
                                    Modalidade
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className={`
                                        flex flex-col items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-all
                                        ${modality === 'online'
                                            ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                                            : 'border-gray-700 bg-gray-900/50 hover:bg-gray-800 text-gray-400 hover:text-white'}
                                    `}>
                                        <input
                                            type="radio"
                                            name="modality"
                                            value="online"
                                            checked={modality === 'online'}
                                            onChange={() => setModality('online')}
                                            className="sr-only"
                                        />
                                        <svg className="mb-2 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        Online
                                    </label>

                                    <label className={`
                                        flex flex-col items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-all
                                        ${modality === 'presential'
                                            ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                                            : 'border-gray-700 bg-gray-900/50 hover:bg-gray-800 text-gray-400 hover:text-white'}
                                    `}>
                                        <input
                                            type="radio"
                                            name="modality"
                                            value="presential"
                                            checked={modality === 'presential'}
                                            onChange={() => setModality('presential')}
                                            className="sr-only"
                                        />
                                        <svg className="mb-2 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Presencial
                                    </label>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 py-3 px-4 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-lg shadow-violet-500/20"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Processando...
                                        </span>
                                    ) : (
                                        isEdit ? 'Salvar Alterações' : 'Criar Aluno'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Credentials Step */}
            <StudentAccessDialog
                isOpen={!!createdCredentials}
                onClose={() => {
                    setCreatedCredentials(null)
                    onClose()
                }}
                studentData={createdCredentials}
            />
        </>
    )
}


