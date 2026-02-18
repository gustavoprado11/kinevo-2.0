export interface ShareableCardProps {
    workoutName: string;
    duration: string;
    exerciseCount: number;
    volume: number;
    date: string;
    studentName: string;
    coach: { name: string; avatar_url: string | null } | null;
    // For Photo Template
    backgroundImageUri?: string;
    // For Max Loads Template
    maxLoads?: {
        exerciseName: string;
        weight: number;
        reps: number;
        isPr?: boolean;
    }[];
    // For Full Workout Template
    exerciseDetails?: {
        name: string;
        sets: number;
        reps: number;
        weight: number;
    }[];
}
