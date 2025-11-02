import { useMemo, RefObject } from 'react';

// Assuming these utilities are available globally or imported from '../utils/scheduleParser'
declare function getAllTimeSlots(course: Course): TimeSlot[];
declare function detectConflicts(courses: Course[]): Set<string>;
declare function getTimeRange(courses: Course[]): { earliest: number, latest: number };

interface TimeSlot {
  day: string;
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
  duration: number;
  type?: string; 
}

interface Course {
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

interface TimetableGridProps {
  courses: Course[];
  gridRef: RefObject<HTMLDivElement>;
  conflictPairs: Set<string>; // Assuming this is now passed for convenience
  onDownload: () => void; // Assuming this is passed for the button, though not used here
}

const BRANCH_COLORS: Record<string, string> = {
  CE: 'bg-blue-100 border-blue-400 text-blue-900',
  CSE: 'bg-purple-100 border-purple-400 text-purple-900',
  EE: 'bg-yellow-100 border-yellow-400 text-yellow-900',
  ME: 'bg-green-100 border-green-400 text-green-900',
  AE: 'bg-red-100 border-red-400 text-red-900',
  CHE: 'bg-orange-100 border-orange-400 text-orange-900',
  MSE: 'bg-pink-100 border-pink-400 text-pink-900',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const CELL_HEIGHT = 60; // 1 hour per cell

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  // Use 12-hour format with AM/PM for better readability in the grid
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12; // Convert 0 to 12
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

export default function TimetableGrid({ courses, gridRef, conflictPairs }: TimetableGridProps) {
  // detect schedule conflicts (using passed prop if available, otherwise calculating)
  const conflicts = useMemo(() => conflictPairs || detectConflicts(courses), [courses, conflictPairs]);

  // conflict summary
  const conflictSummary = useMemo(() => {
    const pairs: string[] = [];
    conflicts.forEach(c => {
      const [code, day, start] = c.split('-');
      pairs.push(`${code} (${day} ${start})`);
    });
    return pairs;
  }, [conflicts]);

  // get earliest and latest class time
const earliest = 480;
  const latest = 1200;
  
  // create time slots for the grid (labels at the start of each hour)
  const timeSlots = useMemo(() => {
    const slots: number[] = [];
    // Go up to, but not past, the latest time (i.e., if latest is 18:30, we stop after 18:00 slot)
    for (let time = earliest; time <= latest; time += 60) {
      slots.push(time);
    }
    return slots;
  }, [earliest, latest]);

  // group courses by day
  const coursesByDay = useMemo(() => {
    const byDay: Record<
      string,
      Array<{ course: Course; slot: TimeSlot & { type: string } }>
    > = {};

    DAYS.forEach(day => {
      byDay[day] = [];
    });

    courses.forEach(course => {
      const slots = getAllTimeSlots(course);
      slots.forEach((slot: TimeSlot) => {
        const typedSlot = { ...slot, type: (slot as any).type ?? 'lecture' };
        if (byDay[typedSlot.day]) {
          byDay[typedSlot.day].push({ course, slot: typedSlot as TimeSlot & { type: string } });
        }
      });
    });

    return byDay;
  }, [courses]);

  // calculate position & height for timetable blocks
  const getPositionAndHeight = (slot: TimeSlot) => {
    // Calculate the minutes offset from the earliest time
    const minutesFromStart = slot.startMinutes - earliest; 
    // Position offset in pixels (minutesFromStart / 60 mins/hour * CELL_HEIGHT px/hour)
    const top = (minutesFromStart / 60) * CELL_HEIGHT;
    // Height in pixels (duration in hours * CELL_HEIGHT px/hour - minor offset)
    const height = (slot.duration * CELL_HEIGHT) - 2; 

    return { top, height };
  };

  const isConflict = (courseCode: string, day: string, start: string) =>
    conflicts.has(`${courseCode}-${day}-${start}`);

  const getBranchColor = (branch: string) =>
    BRANCH_COLORS[branch] || 'bg-gray-100 border-gray-400 text-gray-900';

  const getTypeLabel = (type: string) =>
    type === 'lecture' ? 'L' : type === 'tutorial' ? 'T' : type === 'practical' ? 'P' : '';

  return (
    // Set the ref here to capture the entire block including summary and legend
    // Set overflow-x-auto here for normal viewing
    <div ref={gridRef} className="w-full"> 
      
      {/* 🔴 Conflict Summary */}
      {conflictSummary.length > 0 && (
        <div className="bg-red-50 border border-red-400 text-red-700 rounded-lg p-4 mb-4 text-sm">
          <strong>⚠️ Time Conflicts Detected:</strong>
          <ul className="list-disc ml-6 mt-2">
            {conflictSummary.map((conflict, i) => (
              <li key={i}>{conflict}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Timetable Container with horizontal scroll */}
      <div className="overflow-x-auto rounded-lg shadow-lg"> 
        <div 
          className="bg-white min-w-[900px] border border-gray-300" 
          // Crucial for html2canvas: all children must be visually contained
          style={{ overflow: 'visible' }} 
        >
            
          {/* Header Row */}
          <div className="grid grid-cols-[80px_repeat(5,1fr)] border-b-2 border-gray-300">
            <div className="p-4 font-bold text-gray-700 bg-gray-50 text-center">Time</div>
            {DAYS.map(day => (
              <div
                key={day}
                className="p-4 font-bold text-center text-gray-700 bg-gray-50 border-l border-gray-300"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid Body */}
          <div className="grid grid-cols-[80px_repeat(5,1fr)] relative">
            
            {/* Time Column (Now the first column in the grid) */}
            <div className="relative border-r border-gray-200 bg-gray-50">
              {timeSlots.map(time => (
                <div
                  key={time}
                  className="border-b border-gray-200 px-2 py-1 text-xs text-gray-600 text-right h-[60px] flex items-start justify-end pr-2"
                >
                  {formatTime(time)}
                </div>
              ))}
              {/* Add an extra block for the end-time label if needed, or rely on the last time slot */}
              <div 
                  className="px-2 py-1 text-xs text-gray-600 text-right absolute bottom-[-10px] w-full"
                  style={{ height: '20px' }}
              >
                {formatTime(latest)}
              </div>
            </div>

            {/* Day Columns */}
            {DAYS.map((day, dayIndex) => (
              // This div is for the day's time blocks and must align with the grid structure
              <div key={day} className="relative border-l border-gray-200 grid-flow-row" style={{ gridColumn: `${dayIndex + 2}`}}>
                
                {/* Visual grid lines for the background of the schedule blocks */}
                {timeSlots.map(time => (
                  <div
                    key={time}
                    className="border-b border-gray-200"
                    style={{ height: `${CELL_HEIGHT}px` }}
                  />
                ))}
                
                {/* Course Blocks - positioned absolutely inside their column */}
                {coursesByDay[day].map(({ course, slot }, index) => {
                  const { top, height } = getPositionAndHeight(slot);
                  const hasConflict = isConflict(course.course_code, slot.day, slot.start);
                  const colorClass = getBranchColor(course.branch);

                  return (
                    <div
                      key={`${course.course_code}-${index}`}
                      className={`absolute left-1 right-1 rounded border-2 p-2 overflow-hidden transition-all hover:shadow-lg hover:z-10 group ${colorClass} ${
                        hasConflict ? 'border-red-600 ring-2 ring-red-500' : ''
                      }`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                      }}
                    >
                      <div className="text-xs font-bold truncate">
                        {course.course_code}
                        <span className="ml-1 px-1 py-0.5 bg-white bg-opacity-50 rounded text-[10px]">
                          {getTypeLabel(slot.type)}
                        </span>
                      </div>
                      <div className="text-[10px] truncate">{course.course_name}</div>
                      <div className="text-[10px] text-gray-600 truncate">
                        {slot.start} - {slot.end}
                      </div>

                      {/* Tooltip (will be hidden during capture by ignoreElements) */}
                      <div className="absolute hidden group-hover:block left-0 top-full mt-1 bg-gray-900 text-white text-xs rounded p-2 shadow-xl z-20 w-64">
                        <div className="font-bold">
                          {course.course_code}: {course.course_name}
                        </div>
                        <div className="mt-1">Type: {slot.type}</div>
                        <div>
                          Time: {slot.start} - {slot.end} ({slot.duration}h)
                        </div>
                        <div>Instructor: {course.instructor}</div>
                        <div>Branch: {course.branch}</div>
                        <div>Credits: {course.credits}</div>
                        {hasConflict && (
                          <div className="mt-1 text-red-400 font-bold">⚠️ Time Conflict!</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 items-center justify-center text-sm">
        <div className="font-semibold text-gray-700">Branch Colors:</div>
        {Object.entries(BRANCH_COLORS).map(([branch, colorClass]) => (
          <div key={branch} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded border-2 ${colorClass}`} />
            <span className="text-gray-600">{branch}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
