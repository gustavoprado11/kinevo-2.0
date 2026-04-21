export type StudentModality = "online" | "presential";

export type StudentStatus = "active" | "inactive" | "pending" | "archived";

export interface Student {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    modality: StudentModality | null;
    status: StudentStatus;
}
