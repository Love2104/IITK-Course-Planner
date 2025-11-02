export interface TimeSlot {
  day: string;
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
  duration: number;
}

const DAY_MAP: Record<string, string> = {
  'M': 'Mon',
  'T': 'Tue',
  'W': 'Wed',
  'Th': 'Thu',
  'F': 'Fri',
  'S': 'Sat',
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function parseTimeRange(timeRange: string): { start: string; end: string } {
  const [start, end] = timeRange.split('-').map(s => s.trim());
  return { start, end };
}

function parseDays(dayString: string): string[] {
  const days: string[] = [];
  let i = 0;

  while (i < dayString.length) {
    if (dayString[i] === 'T' && dayString[i + 1] === 'h') {
      days.push('Th');
      i += 2;
    } else if (DAY_MAP[dayString[i]]) {
      days.push(dayString[i]);
      i += 1;
    } else {
      i += 1;
    }
  }

  return days;
}

export function parseSchedule(scheduleString: string): TimeSlot[] {
  if (!scheduleString || scheduleString === 'nan' || scheduleString.trim() === '') {
    return [];
  }

  const slots: TimeSlot[] = [];
  const segments = scheduleString.split(',').map(s => s.trim());

  for (const segment of segments) {
    const parts = segment.split(/\s+/);

    if (parts.length < 2) continue;

    const dayString = parts[0];
    const timeRange = parts[1];

    const days = parseDays(dayString);
    const { start, end } = parseTimeRange(timeRange);

    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    const duration = (endMinutes - startMinutes) / 60;

    for (const dayCode of days) {
      const dayName = DAY_MAP[dayCode] || dayCode;
      slots.push({
        day: dayName,
        start,
        end,
        startMinutes,
        endMinutes,
        duration
      });
    }
  }

  return slots;
}

export function getAllTimeSlots(course: any): TimeSlot[] {
  const allSlots: TimeSlot[] = [];

  if (course.lecture_schedule) {
    allSlots.push(...parseSchedule(course.lecture_schedule).map(slot => ({ ...slot, type: 'lecture' })));
  }

  if (course.tutorial_schedule) {
    allSlots.push(...parseSchedule(course.tutorial_schedule).map(slot => ({ ...slot, type: 'tutorial' })));
  }

  if (course.practical_schedule) {
    allSlots.push(...parseSchedule(course.practical_schedule).map(slot => ({ ...slot, type: 'practical' })));
  }

  return allSlots;
}

export function detectConflicts(courses: any[]): Set<string> {
  const conflictSet = new Set<string>();
  const slotMap: Map<string, Array<{ course: any; slot: TimeSlot & { type: string } }>> = new Map();

  for (const course of courses) {
    const slots = getAllTimeSlots(course);

    for (const slot of slots as Array<TimeSlot & { type: string }>) {
      const key = slot.day;

      if (!slotMap.has(key)) {
        slotMap.set(key, []);
      }

      const daySlots = slotMap.get(key)!;

      for (const existing of daySlots) {
        const overlap =
          (slot.startMinutes < existing.slot.endMinutes && slot.endMinutes > existing.slot.startMinutes);

        if (overlap) {
          conflictSet.add(`${course.course_code}-${slot.day}-${slot.start}`);
          conflictSet.add(`${existing.course.course_code}-${existing.slot.day}-${existing.slot.start}`);
        }
      }

      daySlots.push({ course, slot });
    }
  }

  return conflictSet;
}

export function getTimeRange(courses: any[]): { earliest: number; latest: number } {
  let earliest = Infinity;
  let latest = -Infinity;

  for (const course of courses) {
    const slots = getAllTimeSlots(course);

    for (const slot of slots) {
      earliest = Math.min(earliest, slot.startMinutes);
      latest = Math.max(latest, slot.endMinutes);
    }
  }

  if (earliest === Infinity) {
    earliest = 8 * 60;
    latest = 18 * 60;
  }

  earliest = Math.floor(earliest / 60) * 60;
  latest = Math.ceil(latest / 60) * 60;

  return { earliest, latest };
}
