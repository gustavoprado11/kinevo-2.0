export function rpeColor(rpe: number): string {
    if (rpe >= 9) return '#EF4444';
    if (rpe >= 7) return '#F59E0B';
    if (rpe >= 5) return '#34D399';
    return '#60A5FA';
}
