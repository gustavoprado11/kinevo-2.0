import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Trash2, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme';
import type { AssessmentSection, AssessmentTest } from '@kinevo/shared/types/assessments';
import { TestRow } from './TestRow';

interface Props {
    section: AssessmentSection;
    onRename: (title: string) => void;
    onRemove: () => void;
    /** B2 — abre TestLibrarySheet pra adicionar teste à seção. */
    onAddTest?: () => void;
    /** B2 — abre TestPropertiesSheet pra editar test específico. */
    onEditTest?: (test: AssessmentTest) => void;
    /** B2 — remove test da seção. */
    onRemoveTest?: (testId: string) => void;
}

// M10A/B1 — card de seção. Título editável inline + lista de testes
// (placeholder em B1) + botão remover. Em B2, adiciona TestRow + Add CTA
// que dispara TestLibrarySheet.
export function SectionCard({ section, onRename, onRemove, onAddTest, onEditTest, onRemoveTest }: Props) {
    const [editing, setEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(section.title);

    const handleEditBlur = () => {
        setEditing(false);
        const trimmed = draftTitle.trim();
        if (trimmed && trimmed !== section.title) {
            onRename(trimmed);
        } else {
            setDraftTitle(section.title);
        }
    };

    return (
        <View
            style={{
                backgroundColor: colors.background.card,
                borderWidth: 1,
                borderColor: colors.border.secondary,
                borderRadius: 12,
                marginBottom: 10,
                overflow: 'hidden',
            }}
        >
            {/* Header: título + delete */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    gap: 8,
                    borderBottomWidth: section.tests.length > 0 ? 1 : 0,
                    borderBottomColor: colors.border.secondary,
                }}
            >
                {editing ? (
                    <TextInput
                        value={draftTitle}
                        onChangeText={setDraftTitle}
                        autoFocus
                        onBlur={handleEditBlur}
                        onSubmitEditing={handleEditBlur}
                        style={{
                            flex: 1,
                            fontSize: 14,
                            fontWeight: '600',
                            color: colors.text.primary,
                            paddingVertical: 4,
                        }}
                    />
                ) : (
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.selectionAsync();
                            setEditing(true);
                        }}
                        style={{ flex: 1 }}
                    >
                        <Text
                            style={{
                                fontSize: 14,
                                fontWeight: '600',
                                color: colors.text.primary,
                            }}
                        >
                            {section.title}
                        </Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    onPress={onRemove}
                    style={{ padding: 6 }}
                    hitSlop={6}
                >
                    <Trash2 size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
            </View>

            {/* Tests list */}
            {section.tests.length > 0 ? (
                <View>
                    {section.tests.map(test => (
                        <TestRow
                            key={test.id}
                            test={test}
                            onEdit={() => onEditTest?.(test)}
                            onRemove={() => onRemoveTest?.(test.id)}
                        />
                    ))}
                </View>
            ) : (
                <View style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Text style={{ fontSize: 12, color: colors.text.tertiary, fontStyle: 'italic' }}>
                        Nenhum teste ainda. Toque em &quot;Adicionar teste&quot; abaixo.
                    </Text>
                </View>
            )}

            {/* Add test CTA — dispara onAddTest se provido (B2) */}
            {onAddTest && (
                <TouchableOpacity
                    onPress={onAddTest}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        paddingVertical: 10,
                        borderTopWidth: 1,
                        borderTopColor: colors.border.secondary,
                    }}
                >
                    <Plus size={14} color={colors.brand.primary} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand.primary }}>
                        Adicionar teste
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
