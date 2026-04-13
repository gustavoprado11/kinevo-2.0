import React, { useEffect } from "react";
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    SafeAreaView,
} from "react-native";
import {
    X,
    Clock,
    Dumbbell,
    Activity,
    Flame,
    Heart,
    StickyNote,
    Layers,
    ChevronLeft,
} from "lucide-react-native";
import { useSessionDetails } from "../../hooks/useSessionDetails";
import type { SessionItem, SessionSetLog } from "../../hooks/useSessionDetails";

// ── Helpers ──

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Intensity Gauge ──

function IntensityGauge({ value }: { value: number | null }) {
    if (!value) {
        return (
            <View
                style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: "#f8fafc",
                    borderWidth: 2,
                    borderColor: "#e2e8f0",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#cbd5e1" }}>N/A</Text>
            </View>
        );
    }

    const color =
        value >= 9 ? "#ef4444" : value >= 7 ? "#f59e0b" : value >= 5 ? "#3b82f6" : "#22c55e";

    return (
        <View
            style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: "#ffffff",
                borderWidth: 3,
                borderColor: color,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Text style={{ fontSize: 9, fontWeight: "900", color, letterSpacing: 1 }}>PSE</Text>
            <Text style={{ fontSize: 28, fontWeight: "900", color: "#0f172a", marginTop: -2 }}>
                {value}
            </Text>
        </View>
    );
}

// ── Stat Card ──

function StatCard({
    icon: Icon,
    iconColor,
    label,
    value,
}: {
    icon: typeof Clock;
    iconColor: string;
    label: string;
    value: string;
}) {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: "#f8fafc",
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.04)",
            }}
        >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <Icon size={12} color={iconColor} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {label}
                </Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#0f172a" }}>{value}</Text>
        </View>
    );
}

// ── Exercise Log ──

function ExerciseLogItem({ item }: { item: SessionItem }) {
    const hasLogs = item.setLogs.length > 0;
    const functionLabels: Record<string, string> = {
        warmup: "Aquec.",
        activation: "Ativação",
        main: "Principal",
        accessory: "Acessório",
        conditioning: "Condic.",
    };
    const functionLabel = item.exerciseFunction ? functionLabels[item.exerciseFunction] || null : null;

    return (
        <View style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#0f172a" }} numberOfLines={1}>
                        {item.exerciseName || "Exercício"}
                    </Text>
                    {functionLabel && (
                        <View style={{ backgroundColor: "#f5f3ff", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: "#7c3aed" }}>{functionLabel}</Text>
                        </View>
                    )}
                </View>
                {item.setsPrescribed != null && (
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#94a3b8" }}>
                        {item.setLogs.length}/{item.setsPrescribed} séries
                    </Text>
                )}
            </View>

            {hasLogs ? (
                <View style={{ backgroundColor: "#f8fafc", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "rgba(0,0,0,0.04)" }}>
                    {/* Header */}
                    <View style={{ flexDirection: "row", backgroundColor: "#f1f5f9", paddingHorizontal: 12, paddingVertical: 8 }}>
                        <Text style={{ flex: 1, fontSize: 10, fontWeight: "800", color: "#94a3b8" }}>Série</Text>
                        <Text style={{ flex: 1, fontSize: 10, fontWeight: "800", color: "#94a3b8", textAlign: "center" }}>Carga</Text>
                        <Text style={{ flex: 1, fontSize: 10, fontWeight: "800", color: "#94a3b8", textAlign: "right" }}>Reps</Text>
                    </View>
                    {/* Rows */}
                    {item.setLogs.map((set, idx) => (
                        <View
                            key={idx}
                            style={{
                                flexDirection: "row",
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                borderTopWidth: idx > 0 ? 0.5 : 0,
                                borderTopColor: "rgba(0,0,0,0.04)",
                            }}
                        >
                            <Text style={{ flex: 1, fontSize: 12, color: "#94a3b8", fontVariant: ["tabular-nums"] }}>
                                {set.setNumber}
                            </Text>
                            <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: "#0f172a", textAlign: "center" }}>
                                {set.weight > 0 ? `${set.weight}${set.weightUnit || "kg"}` : "—"}
                            </Text>
                            <Text style={{ flex: 1, fontSize: 13, color: "#475569", textAlign: "right", fontVariant: ["tabular-nums"] }}>
                                {set.reps}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>
                    Sem séries registradas{item.repsPrescribed ? ` (prescrito: ${item.setsPrescribed}×${item.repsPrescribed})` : ""}
                </Text>
            )}
        </View>
    );
}

// ── Warmup Log ──

function WarmupLogItem({ item }: { item: SessionItem }) {
    const config = item.itemConfig as any;
    const label = config?.warmup_type
        ? { general: "Aquecimento Geral", specific: "Aquecimento Específico", mobility: "Mobilidade", foam_roller: "Liberação Miofascial" }[config.warmup_type as string] || "Aquecimento"
        : "Aquecimento";
    const duration = config?.duration_minutes;

    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff7ed", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(249,115,22,0.15)" }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(249,115,22,0.1)", alignItems: "center", justifyContent: "center" }}>
                <Flame size={16} color="#f97316" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a" }}>{label}</Text>
                {(config?.description || duration) && (
                    <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }} numberOfLines={1}>
                        {duration ? `${duration} min` : ""}{duration && config?.description ? " · " : ""}{config?.description || ""}
                    </Text>
                )}
            </View>
        </View>
    );
}

// ── Cardio Log ──

function CardioLogItem({ item }: { item: SessionItem }) {
    const config = item.itemConfig as any;
    const result = item.cardioResult;
    const equipmentLabels: Record<string, string> = {
        treadmill: "Esteira", bike: "Bicicleta", elliptical: "Elíptico", rowing: "Remo",
        stair_climber: "Escada", jump_rope: "Corda", swimming: "Natação", running: "Corrida", other: "Outro",
    };
    const equipment = (result?.equipment || config?.equipment) as string;
    const equipmentLabel = equipment ? equipmentLabels[equipment] || "Aeróbio" : "Aeróbio";

    const details: string[] = [];
    if (result?.durationMinutes || config?.duration_minutes) details.push(`${result?.durationMinutes || config?.duration_minutes} min`);
    if (result?.distanceKm || config?.distance_km) details.push(`${result?.distanceKm || config?.distance_km} km`);

    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#eff6ff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(59,130,246,0.15)" }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(59,130,246,0.1)", alignItems: "center", justifyContent: "center" }}>
                <Heart size={16} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a" }}>{equipmentLabel}</Text>
                {details.length > 0 && (
                    <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{details.join(" · ")}</Text>
                )}
            </View>
        </View>
    );
}

// ── Note Log ──

function NoteLogItem({ item }: { item: SessionItem }) {
    if (!item.notes) return null;
    return (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.04)" }}>
            <StickyNote size={14} color="#94a3b8" />
            <Text style={{ flex: 1, fontSize: 12, color: "#64748b", fontStyle: "italic", lineHeight: 18 }}>{item.notes}</Text>
        </View>
    );
}

// ── Superset Log ──

function SupersetLogItem({ item }: { item: SessionItem }) {
    const childCount = item.children?.length || 0;
    const label = childCount <= 2 ? "Bi-set" : childCount === 3 ? "Tri-set" : `Super-set (${childCount})`;

    return (
        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: "rgba(124,58,237,0.2)", overflow: "hidden" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(124,58,237,0.05)", paddingHorizontal: 14, paddingVertical: 8 }}>
                <Layers size={13} color="#7c3aed" />
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1 }}>{label}</Text>
                {item.restSeconds != null && (
                    <Text style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" as any }}>Descanso: {item.restSeconds}s</Text>
                )}
            </View>
            <View style={{ padding: 14, gap: 16 }}>
                {(item.children || []).map((child) => (
                    <ExerciseLogItem key={child.id} item={child} />
                ))}
            </View>
        </View>
    );
}

// ── Item Router ──

function SessionItemRenderer({ item }: { item: SessionItem }) {
    switch (item.itemType) {
        case "warmup": return <WarmupLogItem item={item} />;
        case "cardio": return <CardioLogItem item={item} />;
        case "note": return <NoteLogItem item={item} />;
        case "superset": return <SupersetLogItem item={item} />;
        case "exercise": return <ExerciseLogItem item={item} />;
        default: return null;
    }
}

// ── Main Component ──

interface SessionDetailSheetProps {
    visible: boolean;
    sessionId: string | null;
    onClose: () => void;
}

export function SessionDetailSheet({ visible, sessionId, onClose }: SessionDetailSheetProps) {
    const { data, isLoading, error, fetchDetails, reset } = useSessionDetails();

    useEffect(() => {
        if (visible && sessionId) {
            fetchDetails(sessionId);
        } else {
            reset();
        }
    }, [visible, sessionId]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }}>
                {/* Header */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: 0.5,
                        borderBottomColor: "rgba(0,0,0,0.06)",
                    }}
                >
                    <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                        <ChevronLeft size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: "#0f172a", textAlign: "center", marginRight: 28 }}>
                        Detalhes da Sessão
                    </Text>
                </View>

                {/* Content */}
                {isLoading ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <ActivityIndicator size="large" color="#7c3aed" />
                        <Text style={{ fontSize: 13, color: "#94a3b8", marginTop: 12 }}>Carregando...</Text>
                    </View>
                ) : error ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
                        <X size={32} color="#ef4444" />
                        <Text style={{ fontSize: 15, fontWeight: "600", color: "#0f172a", marginTop: 12 }}>Erro ao carregar</Text>
                        <Text style={{ fontSize: 13, color: "#94a3b8", marginTop: 4, textAlign: "center" }}>{error}</Text>
                        <TouchableOpacity
                            onPress={onClose}
                            style={{ marginTop: 20, backgroundColor: "#f1f5f9", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}
                        >
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#0f172a" }}>Fechar</Text>
                        </TouchableOpacity>
                    </View>
                ) : data ? (
                    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                        {/* Session Header */}
                        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                            <View style={{ flex: 1, marginRight: 16 }}>
                                <Text style={{ fontSize: 10, fontWeight: "900", color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>
                                    Treino Executado
                                </Text>
                                <Text style={{ fontSize: 22, fontWeight: "900", color: "#0f172a", letterSpacing: -0.5 }} numberOfLines={2}>
                                    {data.workoutName}
                                </Text>
                                <Text style={{ fontSize: 12, fontWeight: "600", color: "#94a3b8", marginTop: 4 }}>
                                    {formatDate(data.completed_at)} • {formatTime(data.completed_at)}
                                </Text>
                            </View>
                            <IntensityGauge value={data.rpe} />
                        </View>

                        {/* Stats Grid */}
                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
                            <StatCard icon={Clock} iconColor="#3b82f6" label="Duração" value={formatDuration(data.stats.durationSeconds)} />
                            <StatCard icon={Dumbbell} iconColor="#7c3aed" label="Exercícios" value={String(data.stats.exerciseCount)} />
                        </View>
                        <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
                            <StatCard
                                icon={Activity}
                                iconColor="#16a34a"
                                label="Séries"
                                value={`${data.stats.completedSets}${data.stats.totalSetsPrescribed ? `/${data.stats.totalSetsPrescribed}` : ""}`}
                            />
                            <StatCard
                                icon={Activity}
                                iconColor="#f59e0b"
                                label="Tonelagem"
                                value={`${data.stats.totalTonnage.toLocaleString("pt-BR")} kg`}
                            />
                        </View>

                        {/* Workout Items */}
                        {data.items.length > 0 && (
                            <View>
                                <Text style={{ fontSize: 10, fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
                                    Log do Treino
                                </Text>
                                <View style={{ gap: 14 }}>
                                    {data.items.map((item) => (
                                        <SessionItemRenderer key={item.id} item={item} />
                                    ))}
                                </View>
                            </View>
                        )}

                        {data.items.length === 0 && (
                            <View style={{ alignItems: "center", paddingVertical: 32 }}>
                                <Text style={{ fontSize: 13, color: "#94a3b8" }}>Nenhum exercício registrado nesta sessão</Text>
                            </View>
                        )}

                        {/* Feedback */}
                        {data.feedback && (
                            <View style={{ marginTop: 24 }}>
                                <Text style={{ fontSize: 10, fontWeight: "900", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>
                                    Feedback do Aluno
                                </Text>
                                <View style={{ backgroundColor: "#f8fafc", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.04)" }}>
                                    <Text style={{ fontSize: 13, color: "#475569", fontStyle: "italic", lineHeight: 20 }}>
                                        &ldquo;{data.feedback}&rdquo;
                                    </Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                ) : null}
            </SafeAreaView>
        </Modal>
    );
}
