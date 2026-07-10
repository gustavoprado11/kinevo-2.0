import React from "react";
import { View, Text, Image } from "react-native";
import { Check } from "lucide-react-native";
import type { SchemaQuestion } from "../../../hooks/useTrainerFormSubmissionDetail";
import { useV2Colors } from "../../../hooks/useV2Colors";
import { supabase } from "../../../lib/supabase";

interface Props {
    question: SchemaQuestion;
    // { value } | { values: string[] } | { files: Array<{ path, url }> } (ou strings legadas)
    answer: any;
}

export function AnswerRenderer({ question: rawQuestion, answer }: Props) {
    const colors = useV2Colors();
    // Normalize options: plain strings → { value, label } objects
    const question = {
        ...rawQuestion,
        options: rawQuestion.options
            ? rawQuestion.options.map((opt: any, i: number) =>
                typeof opt === "string" ? { value: `opt_${i + 1}`, label: opt } : opt
            )
            : undefined,
    };
    return (
        <View style={{ marginBottom: 20 }}>
            {/* Question label */}
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text.secondary, marginBottom: 6 }}>
                {question.label}
                {question.required && <Text style={{ color: colors.semantic.danger.default }}> *</Text>}
            </Text>

            {/* Answer */}
            {renderAnswer(question, answer, colors)}
        </View>
    );
}

type V2Palette = ReturnType<typeof useV2Colors>;

function renderAnswer(question: SchemaQuestion, answer: any, colors: V2Palette) {
    const value = answer?.value;
    const files = answer?.files;
    const values: string[] = Array.isArray(answer?.values) ? answer.values : [];
    switch (question.type) {
        case "short_text":
        case "long_text":
            return (
                <View style={{ backgroundColor: colors.surface.card2, borderRadius: 10, padding: 12 }}>
                    <Text style={{ fontSize: 15, color: colors.text.primary, lineHeight: 22 }}>
                        {value || "—"}
                    </Text>
                </View>
            );

        case "single_choice":
            return (
                <View>
                    {(question.options || []).map((opt) => {
                        const isSelected = opt.value === value;
                        return (
                            <View
                                key={opt.value}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    marginBottom: 4,
                                    backgroundColor: isSelected ? colors.purple[100] : colors.surface.card2,
                                    borderRadius: 10,
                                    borderWidth: isSelected ? 1.5 : 0,
                                    borderColor: isSelected ? colors.purple[600] : "transparent",
                                }}
                            >
                                <View
                                    style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 9,
                                        borderWidth: 2,
                                        borderColor: isSelected ? colors.purple[600] : colors.border.default,
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginRight: 10,
                                    }}
                                >
                                    {isSelected && (
                                        <View
                                            style={{
                                                width: 10,
                                                height: 10,
                                                borderRadius: 5,
                                                backgroundColor: colors.purple[600],
                                            }}
                                        />
                                    )}
                                </View>
                                <Text
                                    style={{
                                        fontSize: 14,
                                        color: isSelected ? colors.purple[600] : colors.text.secondary,
                                        fontWeight: isSelected ? "600" : "400",
                                    }}
                                >
                                    {opt.label}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            );

        case "multi_choice":
            return (
                <View>
                    {(question.options || []).map((opt) => {
                        const isSelected = values.includes(opt.value);
                        return (
                            <View
                                key={opt.value}
                                style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    marginBottom: 4,
                                    backgroundColor: isSelected ? colors.purple[100] : colors.surface.card2,
                                    borderRadius: 10,
                                    borderWidth: isSelected ? 1.5 : 0,
                                    borderColor: isSelected ? colors.purple[600] : "transparent",
                                }}
                            >
                                <View
                                    style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 5,
                                        borderWidth: 2,
                                        borderColor: isSelected ? colors.purple[600] : colors.border.default,
                                        backgroundColor: isSelected ? colors.purple[600] : "transparent",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        marginRight: 10,
                                    }}
                                >
                                    {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                                </View>
                                <Text
                                    style={{
                                        fontSize: 14,
                                        color: isSelected ? colors.purple[600] : colors.text.secondary,
                                        fontWeight: isSelected ? "600" : "400",
                                    }}
                                >
                                    {opt.label}
                                </Text>
                            </View>
                        );
                    })}
                    {values.length === 0 && (
                        <View style={{ backgroundColor: colors.surface.card2, borderRadius: 10, padding: 12 }}>
                            <Text style={{ fontSize: 15, color: colors.text.primary }}>—</Text>
                        </View>
                    )}
                </View>
            );

        case "scale": {
            const min = question.scale?.min ?? 1;
            const max = question.scale?.max ?? 5;
            const selected = typeof value === "number" ? value : parseInt(value, 10);
            const items = [];
            for (let i = min; i <= max; i++) {
                items.push(i);
            }
            return (
                <View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 }}>
                        {items.map((num) => {
                            const isSelected = num === selected;
                            const btnSize = items.length > 7 ? 30 : 36;
                            return (
                                <View
                                    key={num}
                                    style={{
                                        width: btnSize,
                                        height: btnSize,
                                        borderRadius: btnSize / 2,
                                        backgroundColor: isSelected ? colors.purple[600] : colors.surface.card2,
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontSize: items.length > 7 ? 12 : 14,
                                            fontWeight: "600",
                                            color: isSelected ? "#FFFFFF" : colors.text.secondary,
                                        }}
                                    >
                                        {num}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                    {(question.scale?.minLabel || question.scale?.maxLabel) && (
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                            <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                                {question.scale?.minLabel || ""}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.text.tertiary }}>
                                {question.scale?.maxLabel || ""}
                            </Text>
                        </View>
                    )}
                </View>
            );
        }

        case "photo":
            return <PhotoAnswer files={files} colors={colors} />;

        default:
            return (
                <View style={{ backgroundColor: colors.surface.card2, borderRadius: 10, padding: 12 }}>
                    <Text style={{ fontSize: 15, color: colors.text.primary }}>
                        {typeof value === "string" || typeof value === "number" ? String(value) : "—"}
                    </Text>
                </View>
            );
    }
}

// O aluno grava cada foto como { path, url, ... } onde `url` é uma signed URL de
// 1h (expira antes de o treinador abrir). Re-assinamos pelo `path` (o treinador
// tem policy de leitura dos arquivos dos seus alunos). Aceita também strings
// legadas. O render antigo passava o OBJETO como uri → imagem sempre quebrada.
function PhotoAnswer({ files, colors }: { files: any; colors: V2Palette }) {
    const list: any[] = Array.isArray(files) ? files : [];
    const [uris, setUris] = React.useState<(string | null)[]>(() =>
        list.map((f) => (typeof f === "string" ? f : (f?.url ?? null)))
    );

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            const resolved = await Promise.all(
                list.map(async (f) => {
                    const path = typeof f === "object" && f ? f.path : undefined;
                    if (path) {
                        const { data } = await supabase.storage
                            .from("form-uploads")
                            .createSignedUrl(path, 3600);
                        if (data?.signedUrl) return data.signedUrl;
                    }
                    return typeof f === "string" ? f : (f?.url ?? null);
                })
            );
            if (!cancelled) setUris(resolved);
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files]);

    if (list.length === 0) {
        return <Text style={{ fontSize: 14, color: colors.text.tertiary }}>Nenhuma foto</Text>;
    }

    return (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {uris.map((uri, idx) => (
                <Image
                    key={idx}
                    source={uri ? { uri } : undefined}
                    style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: colors.border.default }}
                />
            ))}
        </View>
    );
}
