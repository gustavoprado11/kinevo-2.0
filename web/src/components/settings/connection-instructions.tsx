'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

export function ConnectionInstructions() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-k-border-subtle bg-glass-bg">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-k-text-primary hover:bg-glass-bg-active transition-colors rounded-xl"
      >
        <span className="flex items-center gap-2">
          <ExternalLink size={16} className="text-violet-500" />
          Como conectar no Claude.ai
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t border-k-border-subtle px-4 py-4 text-sm text-k-text-secondary space-y-3">
          <ol className="list-decimal list-inside space-y-2">
            <li>Copie sua API Key acima</li>
            <li>Abra o Claude.ai</li>
            <li>
              Vá em <strong>Settings &gt; Connectors &gt; Add Connector</strong>
            </li>
            <li>
              Configure:
              <ul className="ml-6 mt-1 list-disc space-y-1 text-k-text-tertiary">
                <li>
                  Name: <code className="text-xs bg-glass-bg px-1.5 py-0.5 rounded">Kinevo</code>
                </li>
                <li>
                  URL:{' '}
                  <code className="text-xs bg-glass-bg px-1.5 py-0.5 rounded">
                    https://www.kinevoapp.com/api/mcp
                  </code>
                </li>
                <li>Authentication: Bearer Token</li>
                <li>Token: [cole sua API Key aqui]</li>
              </ul>
            </li>
            <li>Pronto!</li>
          </ol>

          <div className="mt-4 rounded-lg border border-k-border-subtle bg-glass-bg p-3">
            <p className="text-xs font-semibold text-k-text-tertiary mb-2">
              Exemplos do que voce pode fazer:
            </p>
            <ul className="text-xs text-k-text-quaternary space-y-1">
              <li>&quot;Lista meus alunos ativos&quot;</li>
              <li>&quot;Cria um programa de hipertrofia para a Maria&quot;</li>
              <li>&quot;Quais alunos nao treinaram essa semana?&quot;</li>
              <li>&quot;Manda uma mensagem pro Carlos&quot;</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
