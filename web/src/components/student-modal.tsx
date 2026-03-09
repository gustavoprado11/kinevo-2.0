import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createStudent } from '@/actions/create-student'
import { assignFormToStudents } from '@/actions/forms/assign-form'
import { StudentAccessDialog } from '@/components/students'
import { Button } from '@/components/ui/button'
import { X, User, Mail, Phone, Globe, MapPin, Loader2, AlertCircle, FileText, ChevronDown } from 'lucide-react'
import { useOnboardingStore } from '@/stores/onboarding-store'

interface Student {
    id: string
    name: string
    email: string
    phone: string | null
    status: 'active' | 'inactive' | 'pending'
    modality: 'online' | 'presential'
    avatar_url: string | null
    created_at: string
}

export interface FormTemplateOption {
    id: string
    title: string
    trainer_id: string | null
}

interface StudentModalProps {
    isOpen: boolean
    onClose: () => void
    onStudentCreated?: (student: Student) => void
    onStudentUpdated?: (student: Student) => void
    trainerId: string
    initialData?: Student | null
    formTemplates?: FormTemplateOption[]
}

export function StudentModal({
    isOpen,
    onClose,
    onStudentCreated,
    onStudentUpdated,
    trainerId,
    initialData,
    formTemplates = [],
}: StudentModalProps) {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [modality, setModality] = useState<'online' | 'presential'>('online')
    const [selectedFormId, setSelectedFormId] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [createdCredentials, setCreatedCredentials] = useState<{
        name: string
        email: string
        password: string
        whatsapp: string | null
        formName?: string | null
    } | null>(null)

    // Sort templates: system first, then trainer-owned
    const sortedTemplates = [...formTemplates].sort((a, b) => {
        if (a.trainer_id === null && b.trainer_id !== null) return -1
        if (a.trainer_id !== null && b.trainer_id === null) return 1
        return a.title.localeCompare(b.title, 'pt-BR')
    })

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
                setSelectedFormId('')
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
                modality
            })

            if (!result.success) {
                setError(result.error || 'Erro ao criar aluno')
                setLoading(false)
                return
            }

            // Assign form if selected
            let assignedFormName: string | null = null
            if (selectedFormId && result.studentId) {
                const selectedTemplate = formTemplates.find(t => t.id === selectedFormId)
                try {
                    const assignResult = await assignFormToStudents({
                        formTemplateId: selectedFormId,
                        studentIds: [result.studentId],
                    })
                    if (assignResult.success) {
                        assignedFormName = selectedTemplate?.title || null
                    } else {
                        console.error('[StudentModal] form assign failed:', assignResult.error)
                    }
                } catch (err) {
                    console.error('[StudentModal] form assign error:', err)
                }
            }

            // Success! Mark onboarding milestone
            useOnboardingStore.getState().completeMilestone('first_student_created')
            setLoading(false)

            // Set credentials for the second modal
            setCreatedCredentials({
                name: result.name!,
                email: result.email!,
                password: result.password!,
                whatsapp: result.whatsapp || null,
                formName: assignedFormName,
            })

            // Trigger parent update (optional, usually done via revalidatePath, but good for local state)
            if (onStudentCreated) {
                onStudentCreated({
                    id: result.studentId || '',
                    name: result.name!,
                    email: result.email!,
                    phone: result.whatsapp || null,
                    status: 'active',
                    modality: modality,
                    avatar_url: null,
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                        onClick={handleClose}
                    />

                    {/* Modal Content */}
                    <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-surface-card shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-2xl dark:border dark:border-transparent dark:backdrop-blur-xl dark:ring-1 dark:ring-k-border-primary animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-inset px-8 py-6">
                            <div>
                                <h2 className="text-xl font-semibold text-[#1D1D1F] dark:text-white tracking-tight">
                                    {isEdit ? 'Editar Aluno' : 'Novo Aluno'}
                                </h2>
                                <p className="text-xs text-[#86868B] dark:text-muted-foreground/60 font-medium mt-1">
                                    {isEdit ? 'Atualize as informações' : 'Adicione um novo aluno'}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleClose}
                                className="h-8 w-8 text-[#AEAEB2] dark:text-muted-foreground/50 hover:text-[#1D1D1F] dark:hover:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg-active rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" strokeWidth={1.5} />
                            </Button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="bg-white dark:bg-transparent p-8 space-y-6">
                            {error && (
                                <div className="bg-[#FF3B30]/10 dark:bg-red-500/10 border border-[#FF3B30]/20 dark:border-red-500/20 text-[#FF3B30] dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-5">
                                <div>
                                    <label htmlFor="name" className="mb-1.5 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-tertiary uppercase tracking-wide">
                                        Nome completo <span className="text-[#FF3B30] dark:text-violet-500">*</span>
                                    </label>
                                    <div className="relative group">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary group-focus-within:text-[#007AFF] dark:group-focus-within:text-violet-400 transition-colors" strokeWidth={1.5} />
                                        <input
                                            id="name"
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                            className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-10 py-3 text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:border-[#007AFF] dark:focus:border-violet-500/50 focus:ring-4 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20 transition-all text-sm"
                                            placeholder="Ex: João Silva"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="email" className="mb-1.5 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide">
                                        Email <span className="text-[#FF3B30] dark:text-violet-500">*</span>
                                    </label>
                                    <div className="relative group">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary group-focus-within:text-[#007AFF] dark:group-focus-within:text-violet-400 transition-colors" strokeWidth={1.5} />
                                        <input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-10 py-3 text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:border-[#007AFF] dark:focus:border-violet-500/50 focus:ring-4 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20 transition-all text-sm"
                                            placeholder="aluno@email.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="phone" className="mb-1.5 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide">
                                        Telefone <span className="font-medium text-[#86868B] dark:text-k-text-quaternary ml-1">(WhatsApp)</span>
                                    </label>
                                    <div className="relative group">
                                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary group-focus-within:text-[#007AFF] dark:group-focus-within:text-violet-400 transition-colors" strokeWidth={1.5} />
                                        <input
                                            id="phone"
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg px-10 py-3 text-[#1D1D1F] dark:text-k-text-primary placeholder:text-[#AEAEB2] dark:placeholder:text-k-text-quaternary focus:outline-none focus:border-[#007AFF] dark:focus:border-violet-500/50 focus:ring-4 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20 transition-all text-sm"
                                            placeholder="(11) 99999-9999"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide">
                                        Modalidade
                                    </label>
                                    <div className="grid grid-cols-2 gap-1 bg-[#F5F5F7] dark:bg-surface-inset p-1 rounded-lg">
                                        <label className={`
                                            flex items-center justify-center gap-2 rounded-md px-3 py-2.5 cursor-pointer transition-all duration-200
                                            ${modality === 'online'
                                                ? 'bg-white dark:bg-glass-bg-active text-[#1D1D1F] dark:text-k-text-primary shadow-sm'
                                                : 'text-[#86868B] dark:text-k-text-tertiary hover:text-[#6E6E73] dark:hover:text-k-text-secondary'}
                                        `}>
                                            <input
                                                type="radio"
                                                name="modality"
                                                value="online"
                                                checked={modality === 'online'}
                                                onChange={() => setModality('online')}
                                                className="sr-only"
                                            />
                                            <Globe className="h-4 w-4" strokeWidth={1.5} />
                                            <span className="font-semibold text-xs tracking-wide">Online</span>
                                        </label>

                                        <label className={`
                                            flex items-center justify-center gap-2 rounded-md px-3 py-2.5 cursor-pointer transition-all duration-200
                                            ${modality === 'presential'
                                                ? 'bg-white dark:bg-glass-bg-active text-[#1D1D1F] dark:text-k-text-primary shadow-sm'
                                                : 'text-[#86868B] dark:text-k-text-tertiary hover:text-[#6E6E73] dark:hover:text-k-text-secondary'}
                                        `}>
                                            <input
                                                type="radio"
                                                name="modality"
                                                value="presential"
                                                checked={modality === 'presential'}
                                                onChange={() => setModality('presential')}
                                                className="sr-only"
                                            />
                                            <MapPin className="h-4 w-4" strokeWidth={1.5} />
                                            <span className="font-semibold text-xs tracking-wide">Presencial</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Form template dropdown — only show in create mode */}
                                {!isEdit && sortedTemplates.length > 0 && (
                                    <div>
                                        <label htmlFor="formTemplate" className="mb-1.5 block text-[11px] font-bold text-[#6E6E73] dark:text-k-text-quaternary uppercase tracking-wide">
                                            Enviar formulário de boas-vindas
                                        </label>
                                        <div className="relative group">
                                            <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary group-focus-within:text-[#007AFF] dark:group-focus-within:text-violet-400 transition-colors" strokeWidth={1.5} />
                                            <select
                                                id="formTemplate"
                                                value={selectedFormId}
                                                onChange={(e) => setSelectedFormId(e.target.value)}
                                                className="w-full rounded-lg border border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-glass-bg pl-10 pr-10 py-3 text-[#1D1D1F] dark:text-k-text-primary focus:outline-none focus:border-[#007AFF] dark:focus:border-violet-500/50 focus:ring-4 focus:ring-[#007AFF]/20 dark:focus:ring-violet-500/20 transition-all text-sm appearance-none"
                                            >
                                                <option value="">Nenhum</option>
                                                {sortedTemplates.map(t => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.title}{t.trainer_id === null ? ' (Kinevo)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2] dark:text-k-text-quaternary pointer-events-none" strokeWidth={1.5} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleClose}
                                    className="flex-1 text-[#007AFF] dark:text-k-text-secondary hover:text-[#0056B3] dark:hover:text-k-text-primary hover:bg-[#F5F5F7] dark:hover:bg-glass-bg rounded-full transition-all"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-[#007AFF] dark:bg-violet-600 hover:bg-[#0056B3] dark:hover:bg-violet-500 text-white font-semibold rounded-full shadow-sm dark:shadow-lg dark:shadow-violet-500/20 transition-all active:scale-95"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="animate-spin w-4 h-4 mr-2" />
                                            Processando...
                                        </>
                                    ) : (
                                        isEdit ? 'Salvar Alterações' : 'Criar Aluno'
                                    )}
                                </Button>
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
