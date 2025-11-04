import { DaywiseTimeFilter } from '../App';

// --- 1. INTERFACES ---

export interface Course {
    branch: string;
    course_name: string;
    course_code: string;
    slot: string;
    credits: number;
    course_type: string;
    instructor: string;
    instructor_email: string;
    lecture_schedule: string;
    tutorial_schedule: string;
    practical_schedule: string;
}

export interface TimeSlot {
    day: string;
    start: string;
    end: string;
    startMinutes: number;
    endMinutes: number;
    duration: number;
    type?: string; 
    courseCode: string;
}

export type ConflictPair = [Course, Course];

// --- 2. TIME CONVERSION UTILITIES ---

/**
 * Converts a time string (e.g., "10:30") into total minutes from midnight.
 * @param time Time string in "HH:MM" format.
 * @returns Total minutes from midnight.
 */
export function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours * 60 + minutes;
}

/**
 * Converts total minutes from midnight back into a time string (e.g., 630 -> "10:30").
 * @param minutes Total minutes from midnight.
 * @returns Time string in "HH:MM" format.
 */
export function formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// --- 3. SCHEDULE PARSING ---

/**
 * Maps short day abbreviations to full names for display in the grid.
 */
export const DAY_MAP: Record<string, string> = {
    'Mon': 'Monday',
    'Tue': 'Tuesday',
    'Wed': 'Wednesday',
    'Thu': 'Thursday',
    'Fri': 'Friday',
};

/**
 * Parses a single schedule string (e.g., "Mon:10:00-11:00, Thu:10:00-11:00") into TimeSlot objects.
 */
function parseSchedule(schedule: string, type: string, courseCode: string): TimeSlot[] {
    if (!schedule || schedule.toUpperCase() === 'NIL') return [];

    return schedule.split(', ').map(item => {
        const [day, timeRange] = item.split(':');
        const [start, end] = timeRange.split('-');
        const startMinutes = timeToMinutes(start);
        const endMinutes = timeToMinutes(end);

        return {
            day: day.trim(),
            start: start.trim(),
            end: end.trim(),
            startMinutes,
            endMinutes,
            duration: endMinutes - startMinutes,
            type,
            courseCode,
        };
    });
}

/**
 * Gets all time slots (Lecture, Tutorial, Practical) for a given course.
 * @param course The course object.
 * @returns Array of TimeSlot objects.
 */
export function getAllTimeSlots(course: Course): TimeSlot[] {
    return [
        ...parseSchedule(course.lecture_schedule, 'L', course.course_code),
        ...parseSchedule(course.tutorial_schedule, 'T', course.course_code),
        ...parseSchedule(course.practical_schedule, 'P', course.course_code),
    ];
}

// --- 4. CONFLICT AND FILTER LOGIC ---

/**
 * Checks for time conflicts between two time slots.
 */
export function hasConflict(slot1: TimeSlot, slot2: TimeSlot): boolean {
    if (slot1.day !== slot2.day) {
        return false;
    }
    // Conflict exists if one starts before the other ends, and vice versa.
    return (slot1.startMinutes < slot2.endMinutes && slot2.startMinutes < slot1.endMinutes);
}

/**
 * Checks if a course's schedule falls within the day-wise time filter.
 * @param course The course to check.
 * @param filter The day-wise time filter object.
 * @returns True if the course is within the constraints or if no filter applies.
 */
export const isCourseWithinDaywiseTimeRange = (course: Course, filter: DaywiseTimeFilter): boolean => {
    const courseSlots = getAllTimeSlots(course);

    for (const slot of courseSlots) {
        const dayKey = slot.day; // e.g., 'Mon', 'Tue'
        const dayFilter = filter[dayKey];

        // If a filter is set for this day, check the slot against it
        if (dayFilter && dayFilter.start && dayFilter.end) {
            const slotStart = timeToMinutes(slot.start);
            const slotEnd = timeToMinutes(slot.end);
            const filterStart = timeToMinutes(dayFilter.start);
            const filterEnd = timeToMinutes(dayFilter.end);
            
            // The course is EXCLUDED if the slot starts before the filter's start time 
            // OR ends after the filter's end time.
            if (slotStart < filterStart || slotEnd > filterEnd) {
                return false;
            }
        }
    }
    return true;
};
