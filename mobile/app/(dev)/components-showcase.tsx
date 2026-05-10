/**
 * Components V2 — DS Showcase (DEV ONLY)
 *
 * Rota dev pra inspecionar os componentes V2 isoladamente. Gate `__DEV__`
 * abaixo garante que o conteúdo não vaza pra production builds.
 *
 * Acesso: long-press no version text de Mais (mobile/app/(trainer-tabs)/more.tsx),
 * gated em __DEV__.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { v2 } from '@kinevo/shared/tokens';
import { Sparkles } from 'lucide-react-native';
import {
    KCard,
    KStatus,
    Avatar,
    KButton,
    KSegmented,
    KSearchBox,
    KPICard,
    BottomNav,
    KSkeleton,
    KSkeletonRow,
    KSkeletonKPICard,
    type KStatusType,
} from '../../components/v2';
import {
    ArrowRight,
    Plus,
    Trash2,
    Users,
    Dumbbell,
    DollarSign,
    Target,
    Home,
    MessageCircle,
    ClipboardList,
    MoreHorizontal,
} from 'lucide-react-native';

const AVATAR_NAMES = [
    'Alysson Lanza',
    'Gabriel Prado',
    'Giovanna Prado',
    'Gustavo Prado',
    'Ivo Júnior',
    'Marina Lanza',
    'Matheus Henrique',
    'Marcus Vinícius',
];

const STATUS_TYPES: Array<{ type: KStatusType; label: string }> = [
    { type: 'success', label: 'Treinou hoje' },
    { type: 'warning', label: 'Atenção' },
    { type: 'danger', label: 'Inativo' },
    { type: 'info', label: 'Online' },
    { type: 'neutral', label: 'Sem programa' },
];

const { colors, typography, spacing, radius } = v2;

export default function ComponentsShowcaseScreen() {
    if (!__DEV__) return null;

    const [darkBg, setDarkBg] = useState(false);
    const appVersion = Constants.expoConfig?.version ?? '1.0.0';
    const bg = darkBg ? colors.neutral[950] : colors.surface.canvas;
    const headerColor = darkBg ? '#FFFFFF' : colors.neutral[950];
    const subtitleColor = darkBg ? colors.neutral[400] : colors.neutral[500];

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: headerColor }]}>Components V2</Text>
                    <Text style={[styles.headerSubtitle, { color: subtitleColor }]}>
                        DS Showcase · dev only · build {appVersion}
                    </Text>

                    <View style={styles.toggleRow}>
                        <Pressable
                            onPress={() => setDarkBg(false)}
                            accessibilityRole="button"
                            accessibilityLabel="Fundo claro"
                            accessibilityState={{ selected: !darkBg }}
                            style={[styles.toggleBtn, !darkBg && styles.toggleBtnActive]}
                            hitSlop={6}
                        >
                            <Text
                                style={[styles.toggleBtnText, !darkBg && styles.toggleBtnTextActive]}
                            >
                                Light
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setDarkBg(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Fundo escuro"
                            accessibilityState={{ selected: darkBg }}
                            style={[styles.toggleBtn, darkBg && styles.toggleBtnActive]}
                            hitSlop={6}
                        >
                            <Text
                                style={[styles.toggleBtnText, darkBg && styles.toggleBtnTextActive]}
                            >
                                Dark
                            </Text>
                        </Pressable>
                    </View>
                </View>

                <Section title="KCard" subtitle="Shell padrão. 3 variants + pressable.">
                    <KCard>
                        <Text style={styles.cardLabel}>default · vazio</Text>
                    </KCard>
                    <KCard>
                        <View style={styles.row}>
                            <Sparkles size={18} color={colors.purple[600]} />
                            <Text style={styles.cardBody}>default · com children</Text>
                        </View>
                    </KCard>
                    <KCard variant="elevated">
                        <Text style={styles.cardBody}>elevated</Text>
                    </KCard>
                    <KCard variant="tinted">
                        <Text style={[styles.cardBody, { color: colors.purple[700] }]}>tinted</Text>
                    </KCard>
                    <KCard onPress={() => {}} accessibilityLabel="Card de exemplo (pressable)">
                        <Text style={styles.cardBody}>pressable · toque pra haptic</Text>
                    </KCard>
                </Section>

                <Section title="KStatus" subtitle="dot e pill · 5 types · 2 sizes.">
                    <View style={styles.statusGrid}>
                        {STATUS_TYPES.map(({ type, label }) => (
                            <KStatus key={`dot-${type}`} type={type} label={label} layout="dot" />
                        ))}
                    </View>
                    <View style={styles.statusGrid}>
                        {STATUS_TYPES.map(({ type, label }) => (
                            <KStatus key={`pill-${type}`} type={type} label={label} layout="pill" />
                        ))}
                    </View>
                    <View style={styles.statusGrid}>
                        <KStatus type="success" label="sm" layout="pill" size="sm" />
                        <KStatus type="success" label="md" layout="pill" size="md" />
                        <KStatus type="info" label="sm" layout="dot" size="sm" />
                        <KStatus type="info" label="md" layout="dot" size="md" />
                    </View>
                </Section>
                <Section title="Avatar" subtitle="Gradient determinístico por nome · 3 sizes · status overlay.">
                    <View style={styles.avatarGrid}>
                        {AVATAR_NAMES.map((name) => (
                            <Avatar key={name} name={name} />
                        ))}
                    </View>
                    <View style={styles.row}>
                        <Avatar name="Gustavo Prado" size="sm" />
                        <Avatar name="Gustavo Prado" size="md" />
                        <Avatar name="Gustavo Prado" size="lg" />
                    </View>
                    <View style={styles.row}>
                        <Avatar name="Ana Lima" status="online" />
                        <Avatar name="Bruno Costa" status="attention" />
                        <Avatar name="Carla Reis" status="inactive" />
                    </View>
                    <View style={styles.row}>
                        <Avatar
                            name="Foto"
                            src="https://i.pravatar.cc/120?img=12"
                            size="lg"
                            status="online"
                        />
                    </View>
                </Section>
                <Section title="KButton" subtitle="4 variants · 3 sizes · motion + haptics.">
                    <View style={styles.row}>
                        <KButton label="Primary" onPress={() => {}} variant="primary" size="sm" />
                        <KButton label="Primary" onPress={() => {}} variant="primary" size="md" />
                        <KButton label="Primary" onPress={() => {}} variant="primary" size="lg" />
                    </View>
                    <View style={styles.row}>
                        <KButton label="Ghost" onPress={() => {}} variant="ghost" size="md" />
                        <KButton label="Outline" onPress={() => {}} variant="outline" size="md" />
                        <KButton label="Destructive" onPress={() => {}} variant="destructive" size="md" />
                    </View>
                    <View style={styles.row}>
                        <KButton
                            label="Adicionar"
                            onPress={() => {}}
                            leadingIcon={<Plus size={16} color="#FFFFFF" />}
                        />
                        <KButton
                            label="Próximo"
                            onPress={() => {}}
                            variant="outline"
                            trailingIcon={<ArrowRight size={16} color={colors.purple[700]} />}
                        />
                    </View>
                    <View style={styles.row}>
                        <KButton label="Salvando…" onPress={() => {}} loading />
                        <KButton label="Disabled" onPress={() => {}} disabled />
                        <KButton
                            label="Excluir"
                            onPress={() => {}}
                            variant="destructive"
                            leadingIcon={<Trash2 size={16} color="#FFFFFF" />}
                        />
                    </View>
                </Section>
                <SegmentedDemo />

                <SearchBoxDemo />
                <Section title="KPICard" subtitle="Sparkline SVG · delta · 4 accents · estado vazio.">
                    <View style={styles.kpiGrid}>
                        <View style={styles.kpiCol}>
                            <KPICard
                                label="Alunos"
                                value="8"
                                icon={<Users size={14} color={colors.purple[600]} strokeWidth={2.5} />}
                                accent="purple"
                                delta={{ direction: 'up', label: '+2 essa semana' }}
                                data={[3, 4, 5, 5, 6, 7, 8]}
                            />
                        </View>
                        <View style={styles.kpiCol}>
                            <KPICard
                                label="Treinos"
                                value="10"
                                valueSub="/30"
                                icon={<Dumbbell size={14} color={colors.semantic.success.default} strokeWidth={2.5} />}
                                accent="success"
                                delta={{ direction: 'up', label: '+18% vs semana anterior' }}
                                data={[5, 7, 6, 8, 9, 10, 10]}
                            />
                        </View>
                        <View style={styles.kpiCol}>
                            <KPICard
                                label="MRR"
                                value="R$ 0"
                                icon={<DollarSign size={14} color={colors.semantic.warning.default} strokeWidth={2.5} />}
                                accent="warning"
                                delta={{ direction: 'down', label: '-7%' }}
                                data={[120, 140, 130, 110, 90, 70, 0]}
                            />
                        </View>
                        <View style={styles.kpiCol}>
                            <KPICard
                                label="Aderência"
                                value="33"
                                valueSub="%"
                                icon={<Target size={14} color={colors.semantic.info.default} strokeWidth={2.5} />}
                                accent="info"
                                data={[]}
                            />
                        </View>
                    </View>
                </Section>
                <BottomNavDemo />

                <Section title="KSkeleton" subtitle="Placeholder shimmer · 3 variants + composições.">
                    <View style={styles.row}>
                        <KSkeleton variant="rect" width={120} height={14} />
                        <KSkeleton variant="pill" width={60} height={20} />
                        <KSkeleton variant="circle" width={40} height={40} />
                    </View>
                    <KSkeletonRow />
                    <KSkeletonRow lines={3} avatar={false} />
                    <View style={styles.kpiGrid}>
                        <View style={styles.kpiCol}><KSkeletonKPICard /></View>
                        <View style={styles.kpiCol}><KSkeletonKPICard /></View>
                    </View>
                </Section>

                <Text style={styles.footer}>
                    Próximo: Fase 2 — aplicar componentes às telas.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

function Section({
    title,
    subtitle,
    children,
}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
            <View style={styles.sectionBody}>{children}</View>
        </View>
    );
}

function PlaceholderSection({ title }: { title: string }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>{title} · em breve</Text>
            </View>
        </View>
    );
}

function SegmentedDemo() {
    const [val, setVal] = React.useState('todos');
    return (
        <Section title="KSegmented" subtitle="Pill animado · spring · selection haptic.">
            <KSegmented
                value={val}
                onChange={setVal}
                items={[
                    { value: 'todos', label: 'Todos', count: 24 },
                    { value: 'ativos', label: 'Ativos', count: 18 },
                    { value: 'inativos', label: 'Inativos', count: 4 },
                    { value: 'novos', label: 'Novos', count: 2 },
                ]}
                accessibilityLabel="Filtro de alunos"
            />
        </Section>
    );
}

function BottomNavDemo() {
    const [active, setActive] = React.useState<'inicio' | 'alunos' | 'chat' | 'forms' | 'mais'>('inicio');
    return (
        <Section title="BottomNav" subtitle="Liquid Glass · 5 tabs · spring switch · haptic.">
            <View style={styles.bottomNavStage}>
                <BottomNav
                    activeKey={active}
                    onChange={setActive}
                    tabs={[
                        { key: 'inicio', label: 'Início', icon: <Home size={22} /> },
                        { key: 'alunos', label: 'Alunos', icon: <Users size={22} /> },
                        { key: 'chat', label: 'Chat', icon: <MessageCircle size={22} />, badge: 12 },
                        { key: 'forms', label: 'Forms', icon: <ClipboardList size={22} />, badge: 3 },
                        { key: 'mais', label: 'Mais', icon: <MoreHorizontal size={22} /> },
                    ]}
                />
            </View>
            <View style={styles.bottomNavStage}>
                <BottomNav
                    activeKey={active}
                    onChange={setActive}
                    tabs={[
                        { key: 'inicio', label: 'Início', icon: <Home size={22} /> },
                        { key: 'alunos', label: 'Alunos', icon: <Users size={22} /> },
                        { key: 'chat', label: 'Chat', icon: <MessageCircle size={22} /> },
                        { key: 'forms', label: 'Forms', icon: <ClipboardList size={22} /> },
                        { key: 'mais', label: 'Mais', icon: <MoreHorizontal size={22} /> },
                    ]}
                />
            </View>
        </Section>
    );
}

function SearchBoxDemo() {
    const [v1, setV1] = React.useState('');
    const [v2val, setV2val] = React.useState('Gustavo');
    return (
        <Section title="KSearchBox" subtitle="Input de busca · ícone · slot ⌘K / clear.">
            <KSearchBox
                value={v1}
                onChangeText={setV1}
                placeholder="Buscar aluno…"
                showShortcutHint
            />
            <KSearchBox
                value={v2val}
                onChangeText={setV2val}
                placeholder="Buscar aluno…"
                onClear={() => setV2val('')}
            />
        </Section>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: colors.surface.canvas,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing[5],
        paddingBottom: spacing[16],
    },
    header: {
        paddingTop: spacing[3],
        paddingBottom: spacing[6],
    },
    headerTitle: {
        fontFamily: 'PlusJakartaSans_800ExtraBold',
        fontSize: typography.display.size,
        lineHeight: typography.display.lineHeight,
        letterSpacing: typography.display.letterSpacing,
        color: colors.neutral[950],
    },
    headerSubtitle: {
        fontFamily: 'PlusJakartaSans_500Medium',
        fontSize: typography.bodySm.size,
        color: colors.neutral[500],
        marginTop: spacing[1],
    },
    toggleRow: {
        flexDirection: 'row',
        gap: spacing[2],
        marginTop: spacing[3],
    },
    toggleBtn: {
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1] + 2,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.neutral[300],
        minHeight: 28,
    },
    toggleBtnActive: {
        backgroundColor: colors.purple[600],
        borderColor: colors.purple[600],
    },
    toggleBtnText: {
        fontFamily: 'PlusJakartaSans_600SemiBold',
        fontSize: 11,
        color: colors.neutral[600],
        letterSpacing: 0.4,
    },
    toggleBtnTextActive: {
        color: '#FFFFFF',
    },
    section: {
        marginBottom: spacing[6],
    },
    sectionTitle: {
        fontFamily: 'PlusJakartaSans_700Bold',
        fontSize: typography.title2.size,
        lineHeight: typography.title2.lineHeight,
        letterSpacing: typography.title2.letterSpacing,
        color: colors.neutral[900],
    },
    sectionSubtitle: {
        fontFamily: 'PlusJakartaSans_500Medium',
        fontSize: typography.caption.size,
        color: colors.neutral[500],
        marginTop: spacing[1],
        marginBottom: spacing[3],
    },
    sectionBody: {
        gap: spacing[3],
    },
    placeholder: {
        backgroundColor: colors.neutral[100],
        borderRadius: radius.md,
        paddingVertical: spacing[6],
        paddingHorizontal: spacing[4],
        alignItems: 'center',
        marginTop: spacing[3],
    },
    placeholderText: {
        fontFamily: 'PlusJakartaSans_500Medium',
        fontSize: typography.bodySm.size,
        color: colors.neutral[500],
    },
    cardLabel: {
        fontFamily: 'PlusJakartaSans_500Medium',
        fontSize: typography.bodySm.size,
        color: colors.neutral[500],
    },
    cardBody: {
        fontFamily: 'PlusJakartaSans_600SemiBold',
        fontSize: typography.body.size,
        color: colors.neutral[900],
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    statusGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        rowGap: spacing[2],
    },
    avatarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[3],
    },
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[3],
    },
    kpiCol: {
        flexBasis: '48%',
        flexGrow: 1,
    },
    bottomNavStage: {
        backgroundColor: colors.neutral[100],
        padding: spacing[3],
        borderRadius: radius.lg,
    },
    footer: {
        fontFamily: 'PlusJakartaSans_500Medium',
        fontSize: typography.caption.size,
        color: colors.neutral[400],
        textAlign: 'center',
        marginTop: spacing[6],
    },
});
