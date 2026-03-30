import { useState } from "react";
import {
  LayoutDashboard, MessageCircle, Sparkles, Users, Activity, Target,
  TrendingUp, Wallet, FileText, Calendar, ChevronRight, ChevronDown,
  Monitor, Bell, Search, Plus, Send, Bot, ArrowRight, Star, Zap,
  CheckCircle2, AlertTriangle, Clock, Eye, Layers, Maximize2,
  Smartphone, BarChart3, Settings, MousePointer, Lightbulb, Grip,
  PanelRight, MessagesSquare, UserPlus, Dumbbell, ClipboardList
} from "lucide-react";

// ─── Tabs Component ───
function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            active === t.id
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Priority Badge ───
function Priority({ level }) {
  const colors = {
    critical: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-blue-100 text-blue-700 border-blue-200",
    quick: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colors[level]}`}>
      {level === "critical" ? "CRITICAL" : level === "high" ? "HIGH" : level === "medium" ? "MEDIUM" : "QUICK WIN"}
    </span>
  );
}

// ─── Effort Badge ───
function Effort({ days }) {
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
      ~{days} dias
    </span>
  );
}

// ─── Expandable Section ───
function ExpandableSection({ title, subtitle, priority, effort, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${open ? 'bg-violet-500' : 'bg-gray-300'}`} />
          <div className="text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">{title}</span>
              <Priority level={priority} />
              <Effort days={effort} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100">{children}</div>}
    </div>
  );
}

// ─── Current Dashboard Wireframe ───
function CurrentDashboardWireframe() {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Layout Atual do Dashboard</p>
      <div className="flex gap-3">
        {/* Sidebar */}
        <div className="w-14 bg-white rounded-lg border border-gray-200 p-2 flex flex-col gap-2 shrink-0">
          <div className="w-6 h-6 bg-violet-100 rounded mx-auto" />
          <div className="w-6 h-1.5 bg-gray-200 rounded mx-auto" />
          <div className="w-6 h-1.5 bg-blue-200 rounded mx-auto" />
          <div className="w-6 h-1.5 bg-gray-200 rounded mx-auto" />
          <div className="w-6 h-1.5 bg-gray-200 rounded mx-auto" />
          <div className="w-6 h-1.5 bg-gray-200 rounded mx-auto" />
        </div>
        {/* Main content */}
        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-2">
            <div>
              <div className="w-32 h-3 bg-gray-200 rounded" />
              <div className="w-20 h-2 bg-gray-100 rounded mt-1" />
            </div>
            <div className="flex gap-1">
              <div className="w-14 h-5 bg-violet-100 rounded text-[8px] text-violet-600 flex items-center justify-center font-medium">Assist.</div>
              <div className="w-16 h-5 bg-blue-100 rounded text-[8px] text-blue-600 flex items-center justify-center font-medium">Sala</div>
            </div>
          </div>
          {/* Grid: Assistant + Expiring */}
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-3 bg-white rounded-lg border border-gray-200 p-2">
              <div className="flex items-center gap-1 mb-2">
                <Sparkles className="w-3 h-3 text-violet-500" />
                <span className="text-[8px] font-bold text-gray-600">Assistente Kinevo</span>
              </div>
              <div className="space-y-1">
                <div className="w-full h-4 bg-red-50 rounded" />
                <div className="w-full h-4 bg-teal-50 rounded" />
                <div className="w-full h-4 bg-amber-50 rounded" />
              </div>
            </div>
            <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-2">
              <span className="text-[8px] font-bold text-gray-600">Prog. encerrando</span>
              <div className="space-y-1 mt-2">
                <div className="w-full h-4 bg-blue-50 rounded" />
                <div className="w-full h-4 bg-blue-50 rounded" />
              </div>
            </div>
          </div>
          {/* Activity */}
          <div className="bg-white rounded-lg border border-gray-200 p-2">
            <span className="text-[8px] font-bold text-gray-600">Treinos de hoje</span>
            <div className="space-y-1 mt-1">
              <div className="w-full h-3 bg-gray-100 rounded" />
              <div className="w-full h-3 bg-gray-100 rounded" />
            </div>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-1">
            {["Alunos", "Treinos", "Receita", "Ader."].map(s => (
              <div key={s} className="bg-white rounded-lg border border-gray-200 p-1.5 text-center">
                <div className="text-[7px] text-gray-400">{s}</div>
                <div className="w-6 h-3 bg-gray-200 rounded mx-auto mt-0.5" />
              </div>
            ))}
          </div>
          {/* Compact tools */}
          <div className="grid grid-cols-2 gap-1">
            <div className="bg-white rounded-lg border border-gray-200 p-1.5 text-[8px] text-gray-500 text-center">+ Novo aluno</div>
            <div className="bg-white rounded-lg border border-gray-200 p-1.5 text-[8px] text-gray-500 text-center">App Kinevo</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Proposed Dashboard Wireframe ───
function ProposedDashboardWireframe() {
  const [chatMode, setChatMode] = useState("assistant");
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Layout Proposto do Dashboard</p>
      <div className="flex gap-3">
        {/* Sidebar */}
        <div className="w-14 bg-white rounded-lg border border-gray-200 p-2 flex flex-col gap-2 shrink-0">
          <div className="w-6 h-6 bg-violet-100 rounded mx-auto" />
          <div className="w-6 h-1.5 bg-blue-300 rounded mx-auto" />
          <div className="w-6 h-1.5 bg-gray-200 rounded mx-auto" />
          <div className="w-6 h-1.5 bg-gray-200 rounded mx-auto" />
          <div className="w-6 h-1.5 bg-gray-200 rounded mx-auto" />
          <div className="w-6 h-1.5 bg-gray-200 rounded mx-auto" />
          <div className="flex-1" />
          <div className="w-6 h-6 bg-violet-500 rounded-full mx-auto flex items-center justify-center">
            <MessageCircle className="w-3 h-3 text-white" />
          </div>
        </div>
        {/* Main content - left column */}
        <div className="flex-1 space-y-2">
          {/* Header with search */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-2">
            <div>
              <div className="w-32 h-3 bg-gray-200 rounded" />
              <div className="w-20 h-2 bg-gray-100 rounded mt-1" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-28 h-5 bg-gray-100 rounded-full flex items-center px-2">
                <Search className="w-2.5 h-2.5 text-gray-400" />
                <span className="text-[7px] text-gray-400 ml-1">Buscar aluno...</span>
              </div>
              <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center">
                <Bell className="w-2.5 h-2.5 text-gray-400" />
              </div>
              <div className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center">
                <Plus className="w-2.5 h-2.5 text-gray-400" />
              </div>
            </div>
          </div>
          {/* Quick Actions bar */}
          <div className="flex gap-1">
            {[
              { icon: <UserPlus className="w-2.5 h-2.5" />, label: "Novo aluno", color: "bg-blue-50 text-blue-600 border-blue-200" },
              { icon: <Dumbbell className="w-2.5 h-2.5" />, label: "Novo programa", color: "bg-violet-50 text-violet-600 border-violet-200" },
              { icon: <ClipboardList className="w-2.5 h-2.5" />, label: "Enviar avaliação", color: "bg-teal-50 text-teal-600 border-teal-200" },
              { icon: <Monitor className="w-2.5 h-2.5" />, label: "Sala de Treino", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
            ].map(a => (
              <div key={a.label} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-[7px] font-medium ${a.color}`}>
                {a.icon}
                {a.label}
              </div>
            ))}
          </div>
          {/* Stats row - compacto no topo */}
          <div className="grid grid-cols-4 gap-1">
            {[
              { label: "Alunos", value: "24", trend: "+2", color: "text-blue-600" },
              { label: "Treinos/sem", value: "47/58", trend: "81%", color: "text-emerald-600" },
              { label: "MRR", value: "R$ 8.4k", trend: "+12%", color: "text-violet-600" },
              { label: "Aderência", value: "78%", trend: "+3%", color: "text-amber-600" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-lg border border-gray-200 p-1.5">
                <div className="text-[7px] text-gray-400">{s.label}</div>
                <div className={`text-[11px] font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[7px] text-emerald-500 font-medium">{s.trend}</div>
              </div>
            ))}
          </div>
          {/* Two columns: Insights + Activity */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-lg border border-gray-200 p-2">
              <div className="flex items-center gap-1 mb-2">
                <Sparkles className="w-3 h-3 text-violet-500" />
                <span className="text-[8px] font-bold text-gray-600">Ações pendentes</span>
                <span className="text-[7px] bg-red-100 text-red-600 px-1 rounded-full ml-auto">5</span>
              </div>
              <div className="space-y-1">
                <div className="w-full h-4 bg-red-50 rounded flex items-center px-1">
                  <span className="text-[6px] text-red-600">Carlos - 5d sem treinar</span>
                </div>
                <div className="w-full h-4 bg-amber-50 rounded flex items-center px-1">
                  <span className="text-[6px] text-amber-600">R$150 vencido - Ana</span>
                </div>
                <div className="w-full h-4 bg-teal-50 rounded flex items-center px-1">
                  <span className="text-[6px] text-teal-600">Pedro pronto p/ progredir</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-2">
              <div className="flex items-center gap-1 mb-2">
                <Activity className="w-3 h-3 text-emerald-500" />
                <span className="text-[8px] font-bold text-gray-600">Treinos de hoje</span>
                <span className="text-[7px] bg-emerald-100 text-emerald-600 px-1 rounded-full ml-auto">3</span>
              </div>
              <div className="space-y-1">
                <div className="w-full h-4 bg-gray-50 rounded flex items-center px-1">
                  <span className="text-[6px] text-gray-600">Maria - Treino A - 08:30</span>
                </div>
                <div className="w-full h-4 bg-gray-50 rounded flex items-center px-1">
                  <span className="text-[6px] text-gray-600">João - Treino B - 10:15</span>
                </div>
                <div className="w-full h-4 bg-emerald-50 rounded flex items-center px-1">
                  <span className="text-[6px] text-emerald-600">+ 2 agendados</span>
                </div>
              </div>
            </div>
          </div>
          {/* Programs expiring */}
          <div className="bg-white rounded-lg border border-gray-200 p-2">
            <span className="text-[8px] font-bold text-gray-600">Programas encerrando</span>
            <div className="flex gap-1 mt-1 overflow-x-auto">
              {["Ana - 2d", "Carlos - 5d", "Pedro - 7d"].map(p => (
                <div key={p} className="shrink-0 px-2 py-1 bg-orange-50 border border-orange-200 rounded-lg text-[7px] text-orange-600 font-medium">
                  {p}
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Right panel - Chat/Assistant toggle */}
        <div className="w-48 bg-white rounded-lg border border-gray-200 flex flex-col shrink-0">
          {/* Toggle tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setChatMode("assistant")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-[8px] font-medium border-b-2 transition-all ${
                chatMode === "assistant"
                  ? "border-violet-500 text-violet-600 bg-violet-50/50"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Bot className="w-3 h-3" />
              Assistente
            </button>
            <button
              onClick={() => setChatMode("chat")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-[8px] font-medium border-b-2 transition-all ${
                chatMode === "chat"
                  ? "border-blue-500 text-blue-600 bg-blue-50/50"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <MessageCircle className="w-3 h-3" />
              Chat
              <span className="w-3 h-3 bg-red-500 text-white rounded-full text-[6px] flex items-center justify-center">3</span>
            </button>
          </div>
          {/* Panel content */}
          <div className="flex-1 p-2 overflow-y-auto">
            {chatMode === "assistant" ? (
              <div className="space-y-2">
                <div className="bg-violet-50 rounded-lg p-2">
                  <p className="text-[7px] text-violet-700">Como posso ajudar? Posso analisar dados dos seus alunos, gerar programas, ou responder dúvidas.</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {["Gerar programa", "Analisar aderência", "Resumo semanal"].map(chip => (
                    <span key={chip} className="text-[6px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {[
                  { name: "Ana Silva", msg: "Oi professor, posso trocar...", unread: 2, time: "2min" },
                  { name: "Carlos", msg: "Fiz o treino hoje!", unread: 0, time: "1h" },
                  { name: "Maria", msg: "Pode ver meu vídeo?", unread: 1, time: "3h" },
                ].map(c => (
                  <div key={c.name} className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-[7px] font-bold text-blue-600">{c.name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-semibold text-gray-800 truncate">{c.name}</span>
                        <span className="text-[6px] text-gray-400">{c.time}</span>
                      </div>
                      <p className="text-[7px] text-gray-500 truncate">{c.msg}</p>
                    </div>
                    {c.unread > 0 && (
                      <span className="w-3.5 h-3.5 bg-blue-500 text-white rounded-full text-[6px] flex items-center justify-center shrink-0">
                        {c.unread}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Input */}
          <div className="border-t border-gray-200 p-2">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1.5">
              <span className="text-[7px] text-gray-400 flex-1">
                {chatMode === "assistant" ? "Pergunte algo..." : "Digite mensagem..."}
              </span>
              <Send className="w-2.5 h-2.5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chat Panel Wireframe ───
function ChatPanelConcept() {
  const [mode, setMode] = useState("assistant");
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Conceito: Painel Unificado Assistente + Chat</p>
      <div className="max-w-xs mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Header with toggle */}
          <div className="bg-gradient-to-r from-violet-600 to-blue-600 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-xs font-semibold">Kinevo</span>
              <div className="w-4 h-4 bg-white/20 rounded flex items-center justify-center">
                <Maximize2 className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div className="flex bg-white/20 rounded-lg p-0.5">
              <button
                onClick={() => setMode("assistant")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                  mode === "assistant" ? "bg-white text-violet-600 shadow-sm" : "text-white/80"
                }`}
              >
                <Sparkles className="w-3 h-3" />
                Assistente IA
              </button>
              <button
                onClick={() => setMode("chat")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                  mode === "chat" ? "bg-white text-blue-600 shadow-sm" : "text-white/80"
                }`}
              >
                <MessageCircle className="w-3 h-3" />
                Mensagens
                <span className="w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center">3</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="h-64 overflow-y-auto p-3">
            {mode === "assistant" ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
                    <Bot className="w-3 h-3 text-violet-600" />
                  </div>
                  <div className="bg-gray-100 rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%]">
                    <p className="text-[11px] text-gray-700 leading-relaxed">
                      Bom dia! Aqui estão as prioridades de hoje: 3 alunos sem treinar, 1 pagamento vencido e 2 programas encerrando essa semana.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 ml-8">
                  {["Ver alunos inativos", "Resumo financeiro", "Renovar programas"].map(c => (
                    <button key={c} className="text-[9px] bg-violet-100 text-violet-700 px-2.5 py-1 rounded-full hover:bg-violet-200 transition-colors font-medium">
                      {c}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end">
                  <div className="bg-violet-600 text-white rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%]">
                    <p className="text-[11px] leading-relaxed">Quero ver o resumo semanal dos meus alunos</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center shrink-0">
                    <Bot className="w-3 h-3 text-violet-600" />
                  </div>
                  <div className="bg-gray-100 rounded-xl rounded-tl-sm px-3 py-2 max-w-[85%]">
                    <p className="text-[11px] text-gray-700 leading-relaxed">
                      Esta semana seus alunos completaram 47 de 58 treinos esperados (81% de aderência). Os destaques foram...
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { name: "Ana Silva", msg: "Oi professor, posso trocar o supino por outro exercício?", unread: 2, time: "2min", avatar: "A" },
                  { name: "Carlos Souza", msg: "Fiz o treino hoje! Mandei as fotos", unread: 0, time: "1h", avatar: "C" },
                  { name: "Maria Santos", msg: "Pode ver meu vídeo de agachamento?", unread: 1, time: "3h", avatar: "M" },
                  { name: "Pedro Lima", msg: "Qual horário posso ir amanhã?", unread: 0, time: "5h", avatar: "P" },
                  { name: "Julia Costa", msg: "Obrigada pelo feedback!", unread: 0, time: "1d", avatar: "J" },
                ].map(c => (
                  <div key={c.name} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="relative">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">{c.avatar}</span>
                      </div>
                      {c.unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white rounded-full text-[7px] flex items-center justify-center border-2 border-white">
                          {c.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-800">{c.name}</span>
                        <span className="text-[9px] text-gray-400">{c.time}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">{c.msg}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 p-3">
            <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2">
              <input
                type="text"
                placeholder={mode === "assistant" ? "Pergunte ao assistente..." : "Digite uma mensagem..."}
                className="flex-1 text-[11px] bg-transparent outline-none text-gray-700 placeholder-gray-400"
                readOnly
              />
              <button className="w-6 h-6 bg-violet-600 rounded-full flex items-center justify-center">
                <Send className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───
export default function KinevoDashboardAnalysis() {
  const [activeTab, setActiveTab] = useState("diagnosis");

  const tabs = [
    { id: "diagnosis", label: "Diagnóstico", icon: <Eye className="w-3.5 h-3.5" /> },
    { id: "opportunities", label: "Oportunidades", icon: <Lightbulb className="w-3.5 h-3.5" /> },
    { id: "wireframes", label: "Wireframes", icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "roadmap", label: "Roadmap", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 font-sans">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 px-3 py-1 rounded-full text-xs font-medium">
          <Sparkles className="w-3 h-3" />
          Análise de Front-End
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Kinevo Dashboard — Mapa de Melhorias</h1>
        <p className="text-sm text-gray-500 max-w-xl mx-auto">
          Análise completa da arquitetura atual, oportunidades de melhoria e proposta de evolução para transformar o Kinevo no melhor sistema para treinadores.
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* ═══════════════════════════════════ DIAGNÓSTICO ═══════════════════════════════════ */}
      {activeTab === "diagnosis" && (
        <div className="space-y-6">
          {/* Current wireframe */}
          <CurrentDashboardWireframe />

          {/* Strengths */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4" />
              Pontos Fortes Atuais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { title: "Insights com IA em tempo real", desc: "Supabase realtime + engine de insights já detecta gaps, estagnação e progressão" },
                { title: "Design system Apple HIG", desc: "Consistência visual com tokens de cor, glassmorphism e dark mode bem implementados" },
                { title: "Assistente contextual", desc: "O AssistantChatPanel já passa studentId + insightId para respostas contextualizadas" },
                { title: "Ações diretas nos cards", desc: "Marcar como pago, dispensar insight, e abrir assistente diretamente dos cards" },
                { title: "Sparkline de treinos", desc: "Visualização inline da semana no card de treinos — bom uso de espaço" },
                { title: "Arquitetura Server Components", desc: "Uso correto de RSC para data fetching + client components onde necessário" },
              ].map(s => (
                <div key={s.title} className="bg-white rounded-lg p-3 border border-emerald-100">
                  <p className="text-xs font-semibold text-emerald-700">{s.title}</p>
                  <p className="text-[11px] text-gray-600 mt-1">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pain Points */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4" />
              Problemas Identificados
            </h3>
            <div className="space-y-3">
              {[
                {
                  title: "Stats Cards estão no fundo — baixa visibilidade",
                  desc: "KPIs (alunos, treinos, MRR, aderência) ficam depois de Insights + Activity + Programas. Treinadores precisam rolar para ver seus números chave. Em dashboards de referência (TrueCoach, TrainHeroic), as stats são sempre o primeiro bloco.",
                  severity: "high"
                },
                {
                  title: "Chat de mensagens desconectado do fluxo de trabalho",
                  desc: "Mensagens vivem em /messages como página separada. Quando um insight mostra 'Carlos sem treinar há 5 dias', o treinador precisa sair do dashboard, ir até mensagens, encontrar Carlos e escrever. São 4 cliques para uma ação que deveria ser 1.",
                  severity: "critical"
                },
                {
                  title: "Assistente IA é overlay temporário sem persistência",
                  desc: "O AssistantChatPanel abre como overlay lateral e perde todo o histórico ao fechar. Não há continuidade — se o treinador fecha sem querer, perde a conversa inteira. Além disso, compete por espaço com o conteúdo principal.",
                  severity: "high"
                },
                {
                  title: "Quick Actions limitadas — só 'Novo Aluno' + 'Copiar Link'",
                  desc: "CompactTools tem apenas 2 ações. Faltam: criar programa, enviar avaliação, ver relatórios, acessar sala de treino. Treinadores saem do dashboard para quase tudo.",
                  severity: "medium"
                },
                {
                  title: "Zero busca global — sem Command Palette",
                  desc: "Não existe busca por alunos, programas ou exercícios. Para encontrar um aluno, precisa ir até /students. Interfaces modernas de SaaS (Linear, Notion, Vercel) todas têm ⌘K.",
                  severity: "high"
                },
                {
                  title: "Programas Encerrando não aparece sem dados",
                  desc: "Se programs.length === 0 retorna null. O componente desaparece e o grid fica assimétrico. Deveria mostrar um empty state consistente.",
                  severity: "quick"
                },
                {
                  title: "Sem tendências visuais nos KPIs",
                  desc: "Os stat cards mostram números absolutos mas não mostram comparação com período anterior. Treinadores não sabem se estão melhorando ou piorando.",
                  severity: "medium"
                },
                {
                  title: "Feed de atividades não tem filtro",
                  desc: "DailyActivityFeed mostra tudo linearmente sem filtro por aluno, tipo de treino ou RPE. Com 20+ alunos ativos, fica difícil encontrar algo específico.",
                  severity: "medium"
                },
              ].map(p => (
                <div key={p.title} className="bg-white rounded-lg p-3 border border-red-100 flex gap-3">
                  <div className={`w-1.5 rounded-full shrink-0 ${
                    p.severity === 'critical' ? 'bg-red-500' : p.severity === 'high' ? 'bg-orange-400' : p.severity === 'medium' ? 'bg-blue-400' : 'bg-gray-300'
                  }`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-gray-800">{p.title}</p>
                      <Priority level={p.severity === "quick" ? "quick" : p.severity} />
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════ OPORTUNIDADES ═══════════════════════════════════ */}
      {activeTab === "opportunities" && (
        <div className="space-y-3">
          <ExpandableSection
            title="1. Painel Unificado: Assistente + Chat no Dashboard"
            subtitle="Eliminar a navegação para /messages. Chat e Assistente na mesma posição, alternáveis."
            priority="critical"
            effort={5}
            defaultOpen={true}
          >
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-bold text-gray-700 mb-2">Conceito</h4>
                  <p className="text-[11px] text-gray-600 leading-relaxed">
                    Criar um <code className="text-violet-600 bg-violet-50 px-1 rounded">UnifiedChatPanel</code> que vive como coluna fixa à direita no dashboard (desktop) ou como bottom sheet (mobile). Duas abas: "Assistente IA" e "Mensagens". Ambas compartilham a mesma posição e input field.
                  </p>
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] font-semibold text-gray-700">Comportamento:</p>
                    <ul className="text-[11px] text-gray-600 space-y-1.5">
                      <li className="flex items-start gap-1.5">
                        <ChevronRight className="w-3 h-3 text-violet-500 mt-0.5 shrink-0" />
                        <span><strong>Assistente:</strong> Conversação com IA contextual. Mostra chips de ação rápida. Histórico persistido em memória durante sessão.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <ChevronRight className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                        <span><strong>Chat:</strong> Lista de conversas com alunos. Badge de não-lidas. Clicar em um aluno abre a conversa inline. Realtime via Supabase channels.</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <ChevronRight className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                        <span><strong>Deep-link:</strong> Quando insight sugere "falar com aluno", alterna automaticamente para aba Chat com o aluno pré-selecionado.</span>
                      </li>
                    </ul>
                  </div>
                </div>
                <ChatPanelConcept />
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <h4 className="text-xs font-bold text-gray-700 mb-2">Implementação Técnica</h4>
                <ul className="text-[11px] text-gray-600 space-y-1">
                  <li>• Novo componente <code className="bg-white px-1 rounded">UnifiedChatPanel</code> que compõe AssistantChatPanel + ChatPanel</li>
                  <li>• Expandir <code className="bg-white px-1 rounded">assistant-chat-store.ts</code> com state <code className="bg-white px-1 rounded">activeTab: 'assistant' | 'chat'</code></li>
                  <li>• Adicionar <code className="bg-white px-1 rounded">selectedStudentId</code> ao store para deep-link Insight → Chat</li>
                  <li>• Layout: CSS Grid <code className="bg-white px-1 rounded">grid-cols-[1fr_380px]</code> no dashboard quando painel aberto</li>
                  <li>• Reutilizar lógica existente de <code className="bg-white px-1 rounded">getConversations()</code> e <code className="bg-white px-1 rounded">getMessages()</code></li>
                  <li>• Manter /messages como rota completa para acesso mobile/full-screen</li>
                </ul>
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="2. Stats Cards como Hero — Mover para o Topo"
            subtitle="KPIs são a primeira coisa que o treinador quer ver ao abrir o dashboard."
            priority="high"
            effort={1}
          >
            <div className="space-y-3 mt-4">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Trocar a ordem no <code className="bg-gray-50 px-1 rounded">dashboard-client.tsx</code>: StatCards sobe logo abaixo do header, antes dos insights. Adicionar indicadores de tendência (comparação com semana anterior) em cada card.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Antes vs Depois</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-[10px] text-gray-600 space-y-1">
                    <p className="font-semibold">Atual:</p>
                    <p>1. Header</p>
                    <p>2. Insights + Programas</p>
                    <p>3. Activity Feed</p>
                    <p className="text-red-500 font-semibold">4. Stat Cards ← longe</p>
                    <p>5. Compact Tools</p>
                  </div>
                  <div className="text-[10px] text-gray-600 space-y-1">
                    <p className="font-semibold">Proposto:</p>
                    <p>1. Header + Quick Actions</p>
                    <p className="text-emerald-600 font-semibold">2. Stat Cards ← topo</p>
                    <p>3. Insights + Activity (grid)</p>
                    <p>4. Programas encerrando</p>
                    <p className="text-gray-400">(Compact Tools removido — absorvido pelo Quick Actions)</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-bold text-gray-700 mb-2">Tendências nos Stats</p>
                <p className="text-[11px] text-gray-600">Calcular delta vs. semana anterior em <code className="bg-white px-1 rounded">get-dashboard-data.ts</code>. Mostrar como <code className="bg-white px-1 rounded">+12% ↑</code> em verde ou <code className="bg-white px-1 rounded">-5% ↓</code> em vermelho ao lado do valor.</p>
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="3. Quick Actions Bar — Ações Primárias no Dashboard"
            subtitle="Barra de ações rápidas substituindo CompactTools. Tudo que o treinador faz com frequência."
            priority="high"
            effort={2}
          >
            <div className="space-y-3 mt-4">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Substituir o <code className="bg-gray-50 px-1 rounded">CompactTools</code> atual (apenas 2 botões) por uma barra horizontal de ações primárias logo abaixo do header. Cada ação abre seu respectivo modal ou navega diretamente.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  { icon: <UserPlus className="w-3.5 h-3.5" />, label: "Novo aluno", desc: "Abre StudentModal" },
                  { icon: <Dumbbell className="w-3.5 h-3.5" />, label: "Novo programa", desc: "Navega /programs/new" },
                  { icon: <ClipboardList className="w-3.5 h-3.5" />, label: "Enviar avaliação", desc: "Modal de envio de form" },
                  { icon: <Monitor className="w-3.5 h-3.5" />, label: "Sala de Treino", desc: "Navega /training-room" },
                  { icon: <Wallet className="w-3.5 h-3.5" />, label: "Vender plano", desc: "Navega /financial/subscriptions" },
                ].map(a => (
                  <div key={a.label} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                    <div className="text-violet-500">{a.icon}</div>
                    <div>
                      <p className="text-[11px] font-semibold text-gray-700">{a.label}</p>
                      <p className="text-[9px] text-gray-400">{a.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="4. Command Palette (⌘K) — Busca Global"
            subtitle="Buscar alunos, programas, exercícios e ações de qualquer tela."
            priority="high"
            effort={3}
          >
            <div className="space-y-3 mt-4">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Implementar um Command Palette estilo Spotlight/Linear que abre com <code className="bg-gray-50 px-1 rounded">⌘K</code> (ou <code className="bg-gray-50 px-1 rounded">Ctrl+K</code>). Busca fuzzy por alunos, programas, exercícios e ações do sistema.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="bg-white rounded-xl border border-gray-300 shadow-2xl max-w-sm mx-auto overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
                    <Search className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">Buscar alunos, programas, ações...</span>
                  </div>
                  <div className="p-2 space-y-1">
                    <p className="text-[9px] font-bold text-gray-400 uppercase px-2 pt-1">Alunos</p>
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-violet-50 rounded-lg">
                      <Users className="w-3 h-3 text-violet-500" />
                      <span className="text-xs text-gray-700">Ana Silva</span>
                      <span className="text-[9px] text-gray-400 ml-auto">Aluna ativa</span>
                    </div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase px-2 pt-1">Ações</p>
                    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg">
                      <Plus className="w-3 h-3 text-blue-500" />
                      <span className="text-xs text-gray-700">Criar novo aluno</span>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-lg">
                      <Dumbbell className="w-3 h-3 text-emerald-500" />
                      <span className="text-xs text-gray-700">Criar programa</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-bold text-gray-700 mb-1">Implementação</p>
                <ul className="text-[11px] text-gray-600 space-y-1">
                  <li>• Usar lib <code className="bg-white px-1 rounded">cmdk</code> (2KB, sem dependências, acessível)</li>
                  <li>• Registrar listener global <code className="bg-white px-1 rounded">useEffect</code> para ⌘K no layout</li>
                  <li>• Busca local em alunos (já carregados no estado) + search server action para exercícios/programas</li>
                  <li>• Categorias: Alunos, Programas, Exercícios, Ações, Navegação</li>
                </ul>
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="5. Dashboard Grid Responsivo — Layout de Duas Colunas"
            subtitle="Reorganizar o dashboard em um grid inteligente que acomoda o painel de chat."
            priority="medium"
            effort={2}
          >
            <div className="space-y-3 mt-4">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Quando o chat panel está aberto, o dashboard principal comprime de <code className="bg-gray-50 px-1 rounded">max-w-5xl</code> para usar um grid <code className="bg-gray-50 px-1 rounded">grid-cols-[1fr_380px]</code>. Quando fechado, o conteúdo expande. Transição suave com <code className="bg-gray-50 px-1 rounded">transition-all duration-300</code>.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-bold text-gray-700 mb-2">Breakpoints</p>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="bg-white p-2 rounded-lg border border-gray-200 text-center">
                    <Smartphone className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                    <p className="font-semibold">Mobile</p>
                    <p className="text-gray-400">Chat = bottom sheet</p>
                    <p className="text-gray-400">Dashboard full width</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-gray-200 text-center">
                    <Monitor className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                    <p className="font-semibold">Tablet</p>
                    <p className="text-gray-400">Chat = overlay direita</p>
                    <p className="text-gray-400">Dashboard comprime</p>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-gray-200 text-center">
                    <Maximize2 className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                    <p className="font-semibold">Desktop</p>
                    <p className="text-gray-400">Chat = coluna fixa</p>
                    <p className="text-gray-400">Grid side-by-side</p>
                  </div>
                </div>
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="6. Insight → Ação Direta (sem sair do dashboard)"
            subtitle="Cada insight deve ter uma ação 1-click: mensagem, programa, cobrança."
            priority="high"
            effort={3}
          >
            <div className="space-y-3 mt-4">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Hoje os insights abrem o Assistente IA. Proposta: adicionar ações diretas por tipo de insight, sem precisar do assistente para tarefas simples.
              </p>
              <div className="space-y-2">
                {[
                  { insight: "gap_alert (aluno sem treinar)", actions: ["Enviar mensagem", "Ver perfil", "Perguntar ao assistente"], color: "border-red-200 bg-red-50" },
                  { insight: "program_expiring", actions: ["Renovar programa", "Gerar novo via IA", "Enviar lembrete"], color: "border-orange-200 bg-orange-50" },
                  { insight: "stagnation / ready_to_progress", actions: ["Ajustar carga", "Analisar com IA", "Ver histórico"], color: "border-teal-200 bg-teal-50" },
                  { insight: "financial (pagamento pendente)", actions: ["Marcar pago", "Enviar cobrança", "Vender novo plano"], color: "border-amber-200 bg-amber-50" },
                ].map(i => (
                  <div key={i.insight} className={`rounded-lg p-3 border ${i.color}`}>
                    <p className="text-[11px] font-semibold text-gray-700 mb-1">{i.insight}</p>
                    <div className="flex flex-wrap gap-1">
                      {i.actions.map(a => (
                        <span key={a} className="text-[9px] bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">{a}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 italic">
                A ação "Enviar mensagem" abre a aba Chat do painel unificado com o aluno pré-selecionado. Zero navegação.
              </p>
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="7. Feed de Atividades com Filtro e Agrupamento"
            subtitle="Permitir filtrar por aluno, tipo, RPE. Agrupar por período."
            priority="medium"
            effort={2}
          >
            <div className="space-y-3 mt-4">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Adicionar ao <code className="bg-gray-50 px-1 rounded">DailyActivityFeed</code>: filtro dropdown por aluno, chips de RPE (verde/amarelo/vermelho), e separadores de período (manhã/tarde/noite). Para treinadores com 20+ alunos, isso é essencial.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-xs font-bold text-gray-700 mb-1">Filtros sugeridos</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Todos alunos", "RPE Alto (8-10)", "RPE Médio (5-7)", "Com feedback", "Último 7 dias"].map(f => (
                    <span key={f} className="text-[9px] bg-white px-2 py-1 rounded-full border border-gray-200 text-gray-600">{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="8. Drag-and-Drop para Personalização do Dashboard"
            subtitle="Permitir que cada treinador organize os widgets na ordem que preferir."
            priority="medium"
            effort={5}
          >
            <div className="space-y-3 mt-4">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Usar <code className="bg-gray-50 px-1 rounded">@dnd-kit</code> (já instalado no projeto!) para permitir reordenação dos blocos do dashboard. Salvar a ordem em <code className="bg-gray-50 px-1 rounded">localStorage</code> ou no perfil do treinador no Supabase. Treinadores que focam mais em financeiro podem subir esse card; os que focam em treino sobem o feed.
              </p>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                <Grip className="w-4 h-4 text-gray-400" />
                <p className="text-[11px] text-gray-600">
                  O @dnd-kit já é dependência (<code className="bg-white px-1 rounded">@dnd-kit/sortable</code>). Implementação relativamente simples com <code className="bg-white px-1 rounded">SortableContext</code> + <code className="bg-white px-1 rounded">arrayMove</code>.
                </p>
              </div>
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="9. Notificações Push In-App com Centro de Notificações"
            subtitle="NotificationBell já existe, mas precisa de um painel rico com histórico."
            priority="medium"
            effort={3}
          >
            <div className="space-y-3 mt-4">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                O <code className="bg-gray-50 px-1 rounded">NotificationBell</code> existe mas é basic. Expandir para um dropdown com: lista de notificações recentes, agrupadas por tipo, com ações inline (marcar como lida, ir para origem). Mostrar badge de contagem no ícone.
              </p>
            </div>
          </ExpandableSection>

          <ExpandableSection
            title="10. Skeleton Loading States Consistentes"
            subtitle="Melhorar a percepção de velocidade com skeletons em todos os cards."
            priority="quick"
            effort={1}
          >
            <div className="space-y-3 mt-4">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                O componente <code className="bg-gray-50 px-1 rounded">skeleton.tsx</code> já existe em ui/. Usar Suspense boundaries com skeletons no formato de cada card: stat cards, insight rows, activity feed, expiring programs. Hoje o dashboard carrega tudo de uma vez no server component — adicionar streaming com React Suspense.
              </p>
            </div>
          </ExpandableSection>
        </div>
      )}

      {/* ═══════════════════════════════════ WIREFRAMES ═══════════════════════════════════ */}
      {activeTab === "wireframes" && (
        <div className="space-y-6">
          <ProposedDashboardWireframe />

          <ChatPanelConcept />

          {/* Command Palette mockup */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Conceito: Command Palette (⌘K)</p>
            <div className="max-w-sm mx-auto">
              <div className="bg-white rounded-xl border border-gray-300 shadow-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
                  <Search className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Ana</span>
                  <span className="ml-auto text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">ESC</span>
                </div>
                <div className="p-2 space-y-0.5">
                  <p className="text-[9px] font-bold text-gray-400 uppercase px-2 pt-1 pb-0.5">Alunos</p>
                  <div className="flex items-center gap-2 px-2 py-2 bg-violet-50 rounded-lg">
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white">A</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-medium text-gray-700"><strong className="text-violet-600">Ana</strong> Silva</span>
                      <span className="text-[9px] text-gray-400 ml-2">Ativa · Treino B hoje</span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg">
                    <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white">A</span>
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-medium text-gray-700"><strong className="text-violet-600">Ana</strong> Costa</span>
                      <span className="text-[9px] text-gray-400 ml-2">Inativa</span>
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase px-2 pt-2 pb-0.5">Ações rápidas</p>
                  <div className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg">
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-gray-700">Enviar mensagem para <strong className="text-violet-600">Ana</strong> Silva</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-2 hover:bg-gray-50 rounded-lg">
                    <Dumbbell className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-gray-700">Criar programa para <strong className="text-violet-600">Ana</strong> Silva</span>
                  </div>
                </div>
                <div className="border-t border-gray-200 px-3 py-2 flex items-center gap-3 text-[9px] text-gray-400">
                  <span><kbd className="bg-gray-100 px-1 rounded">↑↓</kbd> navegar</span>
                  <span><kbd className="bg-gray-100 px-1 rounded">↵</kbd> selecionar</span>
                  <span><kbd className="bg-gray-100 px-1 rounded">⌘K</kbd> abrir</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions bar mockup */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Conceito: Quick Actions Bar</p>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
              <div className="flex gap-2 overflow-x-auto">
                {[
                  { icon: <UserPlus className="w-4 h-4" />, label: "Novo aluno", color: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100" },
                  { icon: <Dumbbell className="w-4 h-4" />, label: "Novo programa", color: "bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100" },
                  { icon: <ClipboardList className="w-4 h-4" />, label: "Enviar avaliação", color: "bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100" },
                  { icon: <Monitor className="w-4 h-4" />, label: "Sala de Treino", color: "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100" },
                  { icon: <Wallet className="w-4 h-4" />, label: "Vender plano", color: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100" },
                ].map(a => (
                  <button key={a.label} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-medium transition-colors shrink-0 ${a.color}`}>
                    {a.icon}
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════ ROADMAP ═══════════════════════════════════ */}
      {activeTab === "roadmap" && (
        <div className="space-y-6">
          {/* Phase overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                phase: "Fase 1 — Quick Wins",
                time: "1-2 semanas",
                color: "border-emerald-200 bg-emerald-50",
                textColor: "text-emerald-700",
                items: [
                  "Mover Stats Cards para o topo",
                  "Quick Actions bar substituindo CompactTools",
                  "Skeleton loading states",
                  "Fix empty state ExpiringPrograms",
                  "Tendências (+/-%) nos KPIs",
                ]
              },
              {
                phase: "Fase 2 — Core",
                time: "2-4 semanas",
                color: "border-blue-200 bg-blue-50",
                textColor: "text-blue-700",
                items: [
                  "Command Palette (⌘K)",
                  "Painel Unificado Chat + Assistente",
                  "Ações diretas nos Insights",
                  "Filtros no Activity Feed",
                  "Layout responsivo para chat panel",
                ]
              },
              {
                phase: "Fase 3 — Polish",
                time: "4-6 semanas",
                color: "border-violet-200 bg-violet-50",
                textColor: "text-violet-700",
                items: [
                  "Drag-and-drop widgets",
                  "Centro de notificações rico",
                  "Persistência do assistente entre sessões",
                  "Animações e micro-interações",
                  "A/B testing do novo layout",
                ]
              },
            ].map(p => (
              <div key={p.phase} className={`rounded-xl border p-4 ${p.color}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-xs font-bold ${p.textColor}`}>{p.phase}</h3>
                  <span className="text-[9px] font-medium text-gray-500 bg-white px-2 py-0.5 rounded-full">{p.time}</span>
                </div>
                <ul className="space-y-1.5">
                  {p.items.map(i => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-700">
                      <CheckCircle2 className={`w-3 h-3 mt-0.5 shrink-0 ${p.textColor} opacity-50`} />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Impact vs Effort Matrix */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Impacto vs Esforço</h3>
            <div className="relative bg-gray-50 rounded-xl border border-gray-200 p-4" style={{ height: 320 }}>
              {/* Axes */}
              <div className="absolute left-8 top-4 bottom-8 w-px bg-gray-300" />
              <div className="absolute left-8 bottom-8 right-4 h-px bg-gray-300" />
              <span className="absolute left-0 top-0 text-[9px] text-gray-400 font-medium">Alto impacto</span>
              <span className="absolute left-0 bottom-2 text-[9px] text-gray-400 font-medium">Baixo impacto</span>
              <span className="absolute left-10 bottom-0 text-[9px] text-gray-400 font-medium">Pouco esforço</span>
              <span className="absolute right-0 bottom-0 text-[9px] text-gray-400 font-medium">Muito esforço</span>

              {/* Items positioned */}
              {[
                { label: "Stats no topo", x: "15%", y: "12%", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
                { label: "Quick Actions", x: "25%", y: "18%", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
                { label: "Chat unificado", x: "48%", y: "8%", color: "bg-red-100 text-red-700 border-red-300" },
                { label: "⌘K Palette", x: "35%", y: "15%", color: "bg-blue-100 text-blue-700 border-blue-300" },
                { label: "Ações nos insights", x: "38%", y: "22%", color: "bg-blue-100 text-blue-700 border-blue-300" },
                { label: "Filtros feed", x: "28%", y: "45%", color: "bg-blue-100 text-blue-700 border-blue-300" },
                { label: "Skeleton loading", x: "12%", y: "55%", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
                { label: "Drag-and-drop", x: "62%", y: "48%", color: "bg-violet-100 text-violet-700 border-violet-300" },
                { label: "Notificações", x: "50%", y: "38%", color: "bg-violet-100 text-violet-700 border-violet-300" },
                { label: "Tendências KPI", x: "20%", y: "30%", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
              ].map(item => (
                <div
                  key={item.label}
                  className={`absolute text-[9px] font-medium px-2 py-1 rounded-full border shadow-sm whitespace-nowrap ${item.color}`}
                  style={{ left: item.x, top: item.y }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* Key metrics to track */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Métricas de Sucesso</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { metric: "Tempo no dashboard", target: "+40%", desc: "Treinador resolve tudo sem sair" },
                { metric: "Cliques p/ ação", target: "-60%", desc: "De 4 cliques para 1 em média" },
                { metric: "Mensagens enviadas", target: "+50%", desc: "Chat acessível incentiva comunicação" },
                { metric: "Uso do assistente", target: "+80%", desc: "Painel visível vs overlay escondido" },
              ].map(m => (
                <div key={m.metric} className="bg-white rounded-lg p-3 border border-gray-200 text-center">
                  <p className="text-lg font-bold text-violet-600">{m.target}</p>
                  <p className="text-xs font-semibold text-gray-700 mt-1">{m.metric}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* References */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Referências de Mercado</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { name: "TrueCoach", lesson: "Dashboard com compliance automática, filtro por status de treino, messaging integrado com GIFs/fotos. Risk Assessment automatizado alerta sobre churn.", url: "truecoach.co" },
                { name: "TrainHeroic", lesson: "Tracking de compliance + progresso + status de programação em um dashboard. Chat com leaderboards para engajamento.", url: "trainheroic.com" },
                { name: "Linear", lesson: "Command palette (⌘K) com busca fuzzy, keyboard-first navigation, painel lateral contextual. A referência em UX de SaaS B2B.", url: "linear.app" },
              ].map(r => (
                <div key={r.name} className="bg-white rounded-lg p-3 border border-gray-200">
                  <p className="text-xs font-bold text-gray-700">{r.name}</p>
                  <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{r.lesson}</p>
                  <p className="text-[9px] text-violet-500 mt-1">{r.url}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[11px] text-gray-400 pt-4 border-t border-gray-200">
        Kinevo Dashboard Analysis — Março 2026 — Todas as recomendações baseadas na análise do codebase atual
      </div>
    </div>
  );
}
