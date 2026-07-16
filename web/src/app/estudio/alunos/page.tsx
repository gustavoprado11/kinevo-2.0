import { redirect } from 'next/navigation'

/** Os alunos do estúdio vivem na lista normal (/students, com Responsável e reatribuição). */
export default function EstudioAlunosPage() {
    redirect('/students')
}
