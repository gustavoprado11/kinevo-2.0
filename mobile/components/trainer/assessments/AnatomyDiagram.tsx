import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '@/theme';
import type { SkinfoldSite } from '@kinevo/shared/lib/assessment-protocols';

type AnatomyView = 'front' | 'back';

interface SiteMarker {
    site: SkinfoldSite;
    view: AnatomyView;
    cx: number;
    cy: number;
    label_pt: string;
}

// Silhouette is normalized to a 100×220 viewBox so positions are easy to
// reason about. Highlighted marker scales up + becomes brand color.
const VB_W = 100;
const VB_H = 220;

// Single-path silhouette (front view). Symmetric and stylized — head + neck +
// arms + torso + legs as one closed loop. Same path mirrored for back.
const SILHOUETTE_PATH =
    'M50,8 ' +
    'C57,8 62,13 62,21 ' +
    'C62,29 57,34 50,34 ' +
    'C43,34 38,29 38,21 ' +
    'C38,13 43,8 50,8 Z ' +
    'M44,36 H56 L60,46 L72,52 L86,86 L80,92 L72,72 L70,90 L72,140 L66,210 L58,212 L56,160 L50,158 L44,160 L42,212 L34,210 L28,140 L30,90 L28,72 L20,92 L14,86 L28,52 L40,46 Z';

const FRONT_MARKERS: SiteMarker[] = [
    { site: 'chest', view: 'front', cx: 41, cy: 60, label_pt: 'Peitoral' },
    { site: 'abdomen', view: 'front', cx: 50, cy: 95, label_pt: 'Abdominal' },
    { site: 'suprailiac', view: 'front', cx: 60, cy: 88, label_pt: 'Supra-ilíaca' },
    { site: 'thigh', view: 'front', cx: 44, cy: 130, label_pt: 'Coxa' },
    { site: 'biceps', view: 'front', cx: 28, cy: 70, label_pt: 'Bíceps' },
    { site: 'midaxillary', view: 'front', cx: 70, cy: 70, label_pt: 'Axilar média' },
    { site: 'calf', view: 'front', cx: 41, cy: 180, label_pt: 'Panturrilha' },
];

const BACK_MARKERS: SiteMarker[] = [
    { site: 'subscapular', view: 'back', cx: 60, cy: 56, label_pt: 'Subescapular' },
    { site: 'triceps', view: 'back', cx: 30, cy: 70, label_pt: 'Tríceps' },
];

export interface AnatomyDiagramProps {
    highlight_site?: SkinfoldSite | null;
    /** Initial view; toggled by a button when the highlighted site lives
     *  on the other side. */
    initial_view?: AnatomyView;
    /** Compact mode hides the front/back toggle (useful in small slots). */
    compact?: boolean;
}

/**
 * Lightweight anatomy diagram (~3KB once minified). Renders a stylized
 * silhouette and 9 site markers; the marker matching `highlight_site` is
 * scaled up and brand-colored. Toggle button switches front/back when
 * the highlighted site lives on the other side.
 */
export function AnatomyDiagram({ highlight_site, initial_view, compact }: AnatomyDiagramProps) {
    const naturalView = React.useMemo<AnatomyView>(() => {
        if (!highlight_site) return initial_view ?? 'front';
        return BACK_MARKERS.some((m) => m.site === highlight_site) ? 'back' : 'front';
    }, [highlight_site, initial_view]);

    // Manual toggle is only meaningful in exploratory mode (no highlight).
    // When a `highlight_site` is set, always force the view that contains
    // that marker — otherwise the highlight goes invisible if the trainer
    // toggled to the other side and then advanced.
    const [manualView, setManualView] = React.useState<AnatomyView>(naturalView);
    const view: AnatomyView = highlight_site ? naturalView : manualView;

    // Keep the manual toggle in sync with the natural view so that, after
    // the wizard finishes the highlighted site list, the trainer doesn't
    // see a stale toggle state.
    React.useEffect(() => {
        setManualView(naturalView);
    }, [naturalView]);

    const markers = view === 'front' ? FRONT_MARKERS : BACK_MARKERS;
    const activeMarker = markers.find((m) => m.site === highlight_site);

    return (
        <View style={{ alignItems: 'center', gap: 8 }}>
            <Svg
                width={140}
                height={280}
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                accessibilityLabel={
                    activeMarker
                        ? `Diagrama anatômico — ${activeMarker.label_pt} destacado`
                        : 'Diagrama anatômico'
                }>
                <Path
                    d={SILHOUETTE_PATH}
                    fill={colors.background.inset}
                    transform={view === 'back' ? 'translate(100,0) scale(-1,1)' : undefined}
                />
                {markers.map((m) => {
                    const isActive = m.site === highlight_site;
                    return (
                        <Circle
                            key={`${m.view}-${m.site}`}
                            cx={m.cx}
                            cy={m.cy}
                            r={isActive ? 4.5 : 2.2}
                            fill={isActive ? colors.brand.primary : colors.text.quaternary}
                            stroke={isActive ? colors.brand.primaryDark : 'none'}
                            strokeWidth={isActive ? 1.2 : 0}
                        />
                    );
                })}
            </Svg>

            {activeMarker && (
                <Text
                    style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: colors.brand.primaryDark,
                    }}>
                    {activeMarker.label_pt}
                </Text>
            )}

            {!compact && !highlight_site && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <ToggleButton label="Frente" active={view === 'front'} onPress={() => setManualView('front')} />
                    <ToggleButton label="Costas" active={view === 'back'} onPress={() => setManualView('back')} />
                </View>
            )}
        </View>
    );
}

function ToggleButton(props: { label: string; active: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={props.onPress}
            accessibilityRole="button"
            accessibilityLabel={`Vista ${props.label}`}
            accessibilityState={{ selected: props.active }}
            style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: props.active ? colors.brand.primaryLight : colors.background.card,
                borderWidth: 1,
                borderColor: props.active ? colors.brand.primary : colors.border.secondary,
            }}>
            <Text
                style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: props.active ? colors.brand.primaryDark : colors.text.secondary,
                }}>
                {props.label}
            </Text>
        </TouchableOpacity>
    );
}
