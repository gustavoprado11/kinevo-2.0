import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

/**
 * Legacy deep link `/student/<id>/prescribe` — used to open the standalone
 * prescription wizard before Fase 3. Now redirects to the program builder
 * with `mode=ai` so the unified flow takes over.
 */
export default function PrescribeRedirect() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    useEffect(() => {
        if (!id) return;
        router.replace({
            pathname: "/program-builder",
            params: { studentId: id, mode: "ai" },
        } as any);
    }, [id, router]);
    return null;
}
