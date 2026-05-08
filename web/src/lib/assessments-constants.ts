// Shared assessment-domain constants used by both server actions and client
// components. Lives outside `actions/` because Next.js 16 forbids exporting
// non-async values from `'use server'` files. Mirrors the mobile keys in
// mobile/lib/assessmentComputed.ts so subject context written by either
// surface is interoperable.

export const SUBJECT_SEX_KEY = 'subject_sex' as const
export const SUBJECT_AGE_KEY = 'subject_age_years' as const
