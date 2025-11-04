import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Calendar, Plus, RotateCcw, X, BookOpen, Lightbulb, Clock, Download, Zap, AlertCircle, Filter, Trash2 } from 'lucide-react';
// --- 0. FILE DEPENDENCY ---
// This application now attempts to fetch course data from a file named:
// /courses.json
// Please ensure this file is available in the public directory and contains
// an array of Course objects.
// --- 0. GEMINI API CONFIGURATION ---
const API_KEY = "";
// Canvas will provide this key at runtime
const MODEL_NAME = 'gemini-1.5-flash-preview-0514';
// --- 1. INTERFACES ---

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

interface TimeSlot {
    day: string;
start: string;
    end: string;
    startMinutes: number;
    endMinutes: number;
    duration: number;
    type?: string;
}

/**
 * NEW: Interface for the new day-time filter.
 */
interface DayTimeFilter {
    id: number;
    day: string;
start: number;
    end: number;
}


// --- 2. SCHEDULE UTILITIES (From scheduleParser.ts) ---

const DAY_MAP: Record<string, string> = {
    'M': 'Mon',
    'T': 'Tue',
    'W': 'Wed',
    'Th': 'Thu',
    'F': 'Fri',
    'S': 'Sat',
};
// All days available for filtering
const FILTER_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function parseTimeRange(timeRange: string): { start: string;
end: string } {
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

function parseSchedule(scheduleString: string): TimeSlot[] {
    if (!scheduleString || scheduleString === 'nan' || scheduleString.trim() === '') {
        return [];
}

    const slots: TimeSlot[] = [];
    const segments = scheduleString.split(',').map(s => s.trim()).filter(s => s);
for (const segment of segments) {
        const parts = segment.split(/\s+/).filter(p => p);
if (parts.length < 2) continue;

        const dayString = parts[0];
        const timeRange = parts[1];

        const days = parseDays(dayString);
const { start, end } = parseTimeRange(timeRange);

        const startMinutes = timeToMinutes(start);
        const endMinutes = timeToMinutes(end);
const duration = (endMinutes - startMinutes) / 60;

        // Skip invalid slots
        if (duration <= 0) continue;
for (const dayCode of days) {
            const dayName = DAY_MAP[dayCode] ||
dayCode;
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

function getAllTimeSlots(course: Course): (TimeSlot & { type: string })[] {
    const allSlots: (TimeSlot & { type: string })[] = [];
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

/**
 * ⭐ BUG FIX: Logic changed from "fits entirely inside" to "overlaps with".
 * This new logic checks if *any* of a course's slots *overlaps* with *any* of the filter windows.
*/
function isCourseWithinDayTimeFilters(course: Course, filters: DayTimeFilter[]): boolean {
    // If no filters are applied, show all courses.
if (filters.length === 0) {
        return true;
}
    
    const slots = getAllTimeSlots(course);
    
// If a course has no scheduled slots (e.g., UGP), it's considered available
    // (as it doesn't violate any time filter).
if (slots.length === 0) {
        return true;
}

    // Check if *ANY* course slot overlaps with *ANY* filter window
for (const slot of slots) {
        const overlapsWithAnyFilter = filters.some(filter => 
            slot.day === filter.day &&
            // Overlap check: (SlotStart < FilterEnd) AND (SlotEnd > FilterStart)
            (slot.startMinutes < filter.end && slot.endMinutes > filter.start)
        );
        
// If we find even one overlap, the course is a match.
if (overlapsWithAnyFilter) {
            return true;
}
    }

    // No slots overlapped with any filter. Hide the course.
    return false;
}


/**
 * NEW: Checks if a single course (courseA) clashes with any course in a list (courses).
* Returns a list of course codes it clashes with.
*/
function checkClash(courseA: Course, courses: Course[]): string[] {
    const clashes: string[] = [];
if (courses.length === 0) return clashes;
    
    const slotsA = getAllTimeSlots(courseA);
    if (slotsA.length === 0) return clashes;
// 1. Build a map of all slots from the existing selected courses
    const slotMap: Map<string, Array<{ course: Course;
slot: TimeSlot & { type: string } }>> = new Map();
for (const courseB of courses) {
        const slotsB = getAllTimeSlots(courseB);
for (const slotB of slotsB) {
            const key = slotB.day;
if (!slotMap.has(key)) slotMap.set(key, []);
            slotMap.get(key)!.push({ course: courseB, slot: slotB });
}
    }

    // 2. Check courseA's slots against the populated map
    for (const slotA of slotsA) {
        const daySlots = slotMap.get(slotA.day);
if (daySlots) {
            for (const existing of daySlots) {
                // Check for overlap
                const overlap = (slotA.startMinutes < existing.slot.endMinutes && slotA.endMinutes > existing.slot.startMinutes);
if (overlap) {
                    clashes.push(existing.course.course_code);
}
            }
        }
    }
    // Return unique clashing course codes
    return [...new Set(clashes)];
}


/**
 * Detects conflicts and returns keys for coloring and human-readable conflict pairs.
*/
function detectConflicts(courses: Course[]): { conflictKeys: Set<string>, conflictPairs: Set<string> } {
    const conflictKeys = new Set<string>();
const conflictPairs = new Set<string>();
    const slotMap: Map<string, Array<{ course: Course;
slot: TimeSlot & { type: string } }>> = new Map();
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
                    // 1. Add keys for grid coloring (Course-Day-Start)
                    conflictKeys.add(`${course.course_code}-${slot.day}-${slot.start}`);
conflictKeys.add(`${existing.course.course_code}-${existing.slot.day}-${existing.slot.start}`);

                    // 2. Add human-readable conflict pair (Course A clashes with Course B)
                    const courseA = course.course_code;
const courseB = existing.course.course_code;
                    // Standardize the pair (sort alphabetically) to prevent duplicates like 'A clashes with B' and 'B clashes with A'
                    const sortedPair = [courseA, courseB].sort();
conflictPairs.add(`${sortedPair[0]} clashes with ${sortedPair[1]} on ${slot.day} (${slot.start}-${slot.end})`);
                }
            }

            daySlots.push({ course, slot });
}
    }

    return { conflictKeys, conflictPairs };
}

/**
 * Calculates the overall time range based on courses or a provided filter.
*/
function getTimeRange(courses: Course[]): { earliest: number; latest: number } {
    let earliest = Infinity;
let latest = -Infinity;

    // Calculate range from courses
    for (const course of courses) {
        const slots = getAllTimeSlots(course);
for (const slot of slots) {
            earliest = Math.min(earliest, slot.startMinutes);
latest = Math.max(latest, slot.endMinutes);
        }
    }

    // Default range if no courses selected
    if (earliest === Infinity) {
        earliest = 8 * 60;
latest = 18 * 60;
    }
    
    // Snap to nearest hour for grid display
    earliest = Math.floor(earliest / 60) * 60;
latest = Math.ceil(latest / 60) * 60;

    // Ensure range is valid and at least one hour
    if (latest <= earliest) {
        latest = earliest + 60;
}

    return { earliest, latest };
}


// --- 3. TIMETABLE GRID COMPONENT (Integrated) ---

interface TimetableGridProps {
    courses: Course[];
    gridRef: React.RefObject<HTMLDivElement>;
    conflictPairs: Set<string>;
    onDownload: () => void;
}

const BRANCH_COLORS: Record<string, string> = {
    CE: 'bg-blue-100 border-blue-400 text-blue-900',
    CSE: 'bg-purple-100 border-purple-400 text-purple-900',
    EE: 'bg-yellow-100 border-yellow-400 text-yellow-900',
    ME: 'bg-green-100 border-green-400 text-green-900',
    AE: 'bg-red-100 border-red-400 text-red-900',
    CHE: 'bg-orange-100 border-orange-400 text-orange-900',
    MSE: 'bg-pink-100 border-pink-400 text-pink-900',
    PH: 'bg-cyan-100 border-cyan-400 text-cyan-900', 
    CH: 'bg-lime-100 border-lime-400 text-lime-900',
};
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const CELL_HEIGHT = 60;
// 60px per hour

function TimetableGrid({ courses, gridRef, conflictPairs, onDownload }: TimetableGridProps) {
    // Detect schedule conflicts and get the keys for red border coloring
    const { conflictKeys } = useMemo(() => detectConflicts(courses), [courses]);
// Calculate earliest/latest class time based on courses or filter
    const { earliest, latest } = useMemo(() => getTimeRange(courses), [courses]);
// Create time slots for the grid (hourly intervals)
    const timeSlots = useMemo(() => {
        const slots: number[] = [];
        for (let time = earliest; time < latest; time += 60) {
            slots.push(time);
        }
        return slots;
    }, [earliest, latest]);
// Group courses by day
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
                // Filter out slots that fall completely outside the visible time range
       
         if (typedSlot.startMinutes < latest && typedSlot.endMinutes > earliest && byDay[typedSlot.day]) {
                    byDay[typedSlot.day].push({ course, slot: typedSlot });
                }
            });
        });

        return byDay;
    }, [courses, earliest, latest]);
// Calculate position & height for timetable blocks
    const getPositionAndHeight = useCallback((slot: TimeSlot) => {
        // Calculate minutes from start of visible grid (earliest)
        const offsetMinutes = slot.startMinutes - earliest;
        const top = (offsetMinutes / 60) * CELL_HEIGHT;
        const height = slot.duration * CELL_HEIGHT;
        return { top, height };
    }, [earliest]);
// Check if course has conflict
    const isConflict = useCallback((courseCode: string, day: string, start: string) => {
        return conflictKeys.has(`${courseCode}-${day}-${start}`);
    }, [conflictKeys]);
// Color code by branch
    const getBranchColor = useCallback((branch: string) => {
        return BRANCH_COLORS[branch] || 'bg-gray-100 border-gray-400 text-gray-900';
    }, []);
// Label course type
    const getTypeLabel = useCallback((type: string) => {
        switch (type) {
            case 'lecture': return 'L';
            case 'tutorial': return 'T';
            case 'practical': return 'P';
            default: return '';
        }
    }, []);
const gridHeight = (latest - earliest) / 60 * CELL_HEIGHT;
return (
        <div className="w-full overflow-x-auto">

            {/* Conflict Header (Requirement 3) */}
            {conflictPairs.size > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-xl shadow-inner">
                    <h3 className="text-xl font-bold text-red-700 mb-2 flex items-center gap-2">
      
                  ⚠️ Detected Class Clashes ({conflictPairs.size})
                    </h3>
                    <ul className="text-red-600 text-sm list-disc pl-5 space-y-1">
                        {Array.from(conflictPairs).map((clash, index) => (
      
                      <li key={index} className="font-medium">{clash}</li>
                        ))}
                    </ul>
                </div>
            )}
    
        
            {/* Download Button (Requirement 2) - This is now in the main App header */}
            {/* <div className='flex justify-end mb-4'>
                <button
                    onClick={onDownload}
              
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-md flex items-center gap-2 text-sm"
                >
                    <Download className="w-4 h-4" />
                    Download Timetable (PNG)
                </button>
     
       </div>
            */}


            <div ref={gridRef} className="min-w-[800px] bg-white rounded-lg shadow-xl border border-gray-200" id="timetable-grid">
                {/* Header Row */}
                <div className="grid grid-cols-[80px_repeat(5,1fr)] border-b-2 border-gray-300">
                    <div className="p-4 
font-bold text-gray-700 bg-gray-50 rounded-tl-lg">Time</div>
                    {DAYS.map(day => (
                        <div
                            key={day}
                       
     className="p-4 font-bold text-center text-gray-700 bg-gray-50 border-l border-gray-300"
                        >
                            {day}
                        </div>
             
       ))}
                </div>

                {/* Grid Container */}
                <div className="grid grid-cols-[80px_repeat(5,1fr)] relative" style={{ height: `${gridHeight}px` }}>
                    {/* Time Column (Ticks) */}
           
         <div className="relative border-r border-gray-200">
                        {timeSlots.map(time => (
                            <div
                                key={time}
  
                              className="border-b border-gray-200 px-2 pt-0 pb-1 text-xs text-gray-600 text-right absolute w-full left-0"
                                style={{ top: `${(time - earliest) / 60 * CELL_HEIGHT}px` }}
                   
         >
                                <span className='absolute bottom-[-10px] right-2 transform translate-y-1/2'>
                                    {formatTime(time)}
                  
              </span>
                            </div>
                        ))}
                    </div>

              
      {/* Day Columns (Grid lines) */}
                    {DAYS.map(day => (
                        <div key={day} className="relative border-l border-gray-200">
                            {timeSlots.map(time => (
         
                       <div
                                    key={time}
                                    className="border-b border-gray-200 absolute w-full"
  
                                  style={{ 
                                        top: `${(time - earliest) / 60 * CELL_HEIGHT}px`,
                  
                      height: `${CELL_HEIGHT}px` 
                                    }}
                                />
        
                    ))}

                            {/* Course Blocks */}
                            {coursesByDay[day].map(({ course, slot }, index) => {
               
                 const { top, height } = getPositionAndHeight(slot);
const hasConflict = isConflict(course.course_code, slot.day, slot.start);
                                const colorClass = getBranchColor(course.branch);
// Clamp height to ensure it fits in the grid visually, especially with fractional times
                                const visibleHeight = Math.min(height, gridHeight - top);
return (
                                    <div
                                        key={`${course.course_code}-${index}`}
                       
                 className={`absolute left-1 right-1 rounded-lg border-2 p-2 overflow-hidden transition-all hover:shadow-xl hover:z-10 group cursor-pointer ${colorClass} ${
                                            hasConflict ? 'border-red-600 ring-2 ring-red-500' : ''
                    
                    }`}
                                        style={{
                                        
    top: `${top}px`,
                                            height: `${visibleHeight}px`,
                                            minHeight: '20px', // Minimum height for small classes
                                            zIndex: hasConflict ? 5 : 2,
                                        }}
          
                          >
                                        <div className="text-xs font-bold truncate">
                               
             {course.course_code}
                                            <span className="ml-1 px-1 py-0.5 bg-white bg-opacity-50 rounded text-[10px] font-normal">
                                   
             {getTypeLabel(slot.type ??
'L')}
                                            </span>
                                        </div>
                
                        <div className="text-[10px] truncate">{course.course_name}</div>
                                        {visibleHeight > 30 && (
                              
              <div className="text-[10px] text-gray-600 truncate">
                                                {slot.start} - {slot.end}
                                 
           </div>
                                        )}

                                        {/* Tooltip */}
       
                                 <div className="absolute hidden group-hover:block left-0 top-full mt-1 bg-gray-900 text-white text-xs rounded p-3 shadow-2xl z-20 w-64 ring-2 ring-white/20">
                                            <div className="font-bold border-b border-gray-700 pb-1 mb-1">
  
                                              {course.course_code}: {course.course_name}
                                            </div>
         
                                   <div className='flex justify-between'>
                                                <div>Type: {slot.type}</div>
              
                                  <div>{slot.duration}h</div>
                                            </div>
                      
                      <div>
                                                Time: {slot.start} - {slot.end}
                           
                 </div>
                                            <div>Instructor: {course.instructor}</div>
                                      
      <div>Branch: {course.branch}</div>
                                            {hasConflict && (
                                               
 <div className="mt-1 text-red-400 font-bold border-t border-gray-700 pt-1">⚠️ Time Conflict!</div>
                                            )}
                                        </div>
       
                             </div>
                                );
})}
                        </div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-8 
p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="font-semibold text-gray-700 mb-2">Branch Colors:</div>
                <div className='flex flex-wrap gap-4 items-center justify-start text-sm'>
                    {Object.entries(BRANCH_COLORS).map(([branch, colorClass]) => (
                        <div key={branch} className="flex items-center gap-2">
   
                         <div key={branch} className={`w-6 h-6 rounded-md border-2 ${colorClass}`} />
                            <span className="text-gray-600">{branch}</span>
                        </div>
               
     ))}
                </div>
            </div>
        </div>
    );
}

// --- 4. TIME FILTER MODAL COMPONENT (REMOVED) ---
// This component is no longer needed as the filter logic is moved into CourseSelector.
// --- 5. LLM ANALYSIS MODAL (Unchanged) ---

interface AnalysisModalProps {
    analysis: string;
    onClose: () => void;
}

const CourseLoadAnalysisModal = ({ analysis, onClose }: AnalysisModalProps) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-blue-50">
                    <h3 className="text-2xl font-bold text-blue-800 flex 
items-center gap-2">
                        <Zap className='w-6 h-6 text-blue-600' /> Academic Load Analysis (by Gemini)
                    </h3>
                    <button
                        onClick={onClose}
  
                      className="p-2 hover:bg-white rounded-lg transition-colors"
                    >
                        <X className="w-6 h-6 text-slate-600" />
                    </button>
       
         </div>
                <div className="p-6 overflow-y-auto prose max-w-none text-gray-700">
                    <div dangerouslySetInnerHTML={{ __html: analysis }} />
                </div>
                <div className="p-4 border-t border-slate-200 flex justify-end">
        
             <button
                        onClick={onClose}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl transition-all shadow-md"
                    >
           
             Got It!
</button>
                </div>
            </div>
        </div>
    );
};


// --- 6. COURSE SELECTOR COMPONENT (HEAVILY MODIFIED) ---

interface CourseSelectorProps {
    courses: Course[];
// NEW: Receive selected courses and handlers from parent
    selectedCourses: Course[];
    onAddCourse: (course: Course) => void;
onRemoveCourse: (courseCode: string) => void;
    onReset: () => void;
    // Day/Time Filter Props
    dayTimeFilters: DayTimeFilter[];
onAddFilter: (day: string, start: number, end: number) => void;
    onRemoveFilter: (id: number) => void;
    onClearAllFilters: () => void;
// Analysis Props
    onAnalyze: () => void;
    isAnalyzing: boolean;
}


function CourseSelector({
  courses,
  selectedCourses, // NEW: From props
  onAddCourse,     // NEW: From props
  onRemoveCourse,  // NEW: From props
  onReset,         // NEW: From props
  dayTimeFilters,
  onAddFilter,
  onRemoveFilter,
  onClearAllFilters,
  onAnalyze,
  isAnalyzing,
}: CourseSelectorProps) {
  // Local state for controlling the dropdowns
  const [selectedBranch, setSelectedBranch] = useState<string>('');
// placeholder by default
  const [selectedCourseType, setSelectedCourseType] = useState<string>('ALL'); 
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
// Local state for modals
  const [showAvailableCourses, setShowAvailableCourses] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
// --- NEW Filter Form State ---
  const [newFilterDay, setNewFilterDay] = useState<string>('Mon');
  const [newFilterStart, setNewFilterStart] = useState<string>('09:00');
const [newFilterEnd, setNewFilterEnd] = useState<string>('17:00');


  const branches = useMemo(() => {
    const uniqueBranches = Array.from(new Set(courses.map(c => c.branch))).sort();
    return uniqueBranches;
  }, [courses]);
const courseTypes = useMemo(() => {
      // ⭐ FIX: Base the course types on the *original* full course list, not the de-duplicated one
      // This logic is now correct as it receives the full `courses` prop.
      // But the `courses.json` has combined types like "DC,Minor / REGULAR".
      // Let's split them to make the filter more useful.
      const allTypes = new Set<string>();
      courses.forEach(c => {
      
    c.course_type.split(',').forEach(t => {
              const trimmedType = t.split('/')[0].trim(); // "DC,Minor / REGULAR" -> "DC" and "Minor"
              if (trimmedType && trimmedType !== 'nan') {
                allTypes.add(trimmedType);
              }
          });
      });
   
   const uniqueTypes = Array.from(allTypes).sort();
      return ['ALL', ...uniqueTypes];
  }, [courses]);
/**
   * UPDATED:
   * - Filters by Branch
   * - Filters by Course Type
   * - Filters by the new DayTimeFilter list
   */
  const filteredCourses = useMemo(() => {
    // 1. Filter by Branch
    let filtered = (!selectedBranch) 
        ? [] // No branch selected, show nothing
        : (selectedBranch === 'ALL')
            ? courses
      
      : courses.filter(c => c.branch === selectedBranch);

    // 2. Filter by Course Type (⭐ UPDATED to handle split types)
    filtered = (selectedCourseType === 'ALL')
        ? filtered
        : filtered.filter(c => c.course_type.includes(selectedCourseType)); // "DC,Minor / REGULAR" includes "DC"

    // 3. Apply new Day/Time filters
    if (dayTimeFilters.length > 0) {
        filtered = filtered.filter(course => 
           
 isCourseWithinDayTimeFilters(course, dayTimeFilters)
        );
    }

    return filtered;
  }, [courses, selectedBranch, selectedCourseType, dayTimeFilters]);
/**
   * NEW: Real-time clash detection
   * This memo calculates the clash status for every course in the filtered dropdown.
*/
  const courseClashStatus = useMemo(() => {
      const statusMap = new Map<string, string[]>(); // Map<course_code, clashing_course_codes[]>
      if (selectedCourses.length === 0) {
          return statusMap; // No clashes possible if nothing is selected
      }
      
      for (const course of filteredCourses) {
          // Don't check against itself if it's already selected
         
 const alreadySelected = selectedCourses.some(sc => sc.course_code === course.course_code);
          if (alreadySelected) continue;

          const clashes = checkClash(course, selectedCourses);
          if (clashes.length > 0) {
              statusMap.set(course.course_code, clashes);
          }
      }
      return statusMap;
  }, [filteredCourses, selectedCourses]);
const totalCredits = useMemo(
    () => selectedCourses.reduce((sum, course) => sum + course.credits, 0),
    [selectedCourses]
  );
const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBranch(e.target.value);
    setSelectedCourseCode('');
  };
const handleCourseTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedCourseType(e.target.value);
      setSelectedCourseCode('');
  };
const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCourseCode(e.target.value);
  };
const handleAddCourse = () => {
    if (!selectedCourseCode) return;

    const courseToAdd = courses.find(c => c.course_code === selectedCourseCode);
if (!courseToAdd) return;

    // Check if already in the parent's list
    const alreadyAdded = selectedCourses.some(c => c.course_code === selectedCourseCode);
if (alreadyAdded) {
      alert('This course is already in your selected list.');
      return;
}
    
    // Check for clashes before adding
    const clashes = checkClash(courseToAdd, selectedCourses);
if (clashes.length > 0) {
        if (!confirm(`⚠️ This course clashes with ${clashes.join(', ')}.\nAre you sure you want to add it?`)) {
            return;
}
    }
    
    // Call parent handler
    onAddCourse(courseToAdd);
setSelectedCourseCode('');
  };

  const handleRemoveCourse = (courseCode: string) => {
    // Call parent handler
    onRemoveCourse(courseCode);
};

  const handleReset = () => {
    // Reset local state
    setSelectedBranch('');
    setSelectedCourseType('ALL');
    setSelectedCourseCode('');
// Call parent handler to reset global state
    onReset();
  };
// --- NEW: Handler for the new filter form ---
  const handleAddFilterClick = () => {
      const startMin = timeToMinutes(newFilterStart);
const endMin = timeToMinutes(newFilterEnd);
      
      if (startMin >= endMin) {
          alert("Start time must be before end time.");
return;
      }
      
      onAddFilter(newFilterDay, startMin, endMin);
  };
const getRecommendedCourses = () => {
    if (selectedCourses.length === 0) return [];

    const keywords = new Set<string>();
selectedCourses.forEach(course => {
      const words = course.course_name.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 4) keywords.add(word);
      });
    });
return courses
      .filter(course => {
        if (selectedCourses.some(sc => sc.course_code === course.course_code)) return false;
        const courseName = course.course_name.toLowerCase();
        return Array.from(keywords).some(keyword => courseName.includes(keyword));
      })
      .slice(0, 10);
};

  return (
    <>
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-3xl font-bold text-slate-800 mb-8 text-center">
            Select Your Courses
          </h2>

          <div className="space-y-6">
            {/* Branch Selection */}
         
   <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                1. Select Branch
              </label>
              <select
                value={selectedBranch}
                
onChange={handleBranchChange}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">Select Branch...</option>
                <option value="ALL">All Branches</option>
                {branches.map(branch => (
   
               <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>
   
         
            {/* Course Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                2. Filter by Course Type (Optional)
              </label>
         
     <select
                  value={selectedCourseType}
                  onChange={handleCourseTypeChange}
                  disabled={!selectedBranch}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
         
     >
                  {courseTypes.map(type => (
                      <option key={type} value={type}>
                          {type}
                      </option>
   
               ))}
              </select>
            </div>

            {/* --- NEW Day/Time Filter UI --- */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
       
             3. Filter by Available Time (Optional)
                </label>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    
    {/* Day Select */}
                        <div className='md:col-span-2'>
                            <label className="block text-xs font-medium text-slate-600">Day</label>
                            <select 
       
                         value={newFilterDay}
                                onChange={e => setNewFilterDay(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 text-slate-800 focus:outline-none focus:ring-2 
focus:ring-blue-500"
                            >
                                {FILTER_DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                            </select>
        
                </div>
                        {/* Start Time */}
                        <div>
                            <label className="block text-xs font-medium text-slate-600">Start 
Time</label>
                            <input
                                type="time"
                                value={newFilterStart}
        
                        onChange={e => setNewFilterStart(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
     
                   </div>
                        {/* End Time */}
                        <div>
                            <label className="block 
text-xs font-medium text-slate-600">End Time</label>
                            <input
                                type="time"
                                value={newFilterEnd}
     
                           onChange={e => setNewFilterEnd(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
  
                      </div>
                    </div>
                    <button
                        onClick={handleAddFilterClick}
              
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
                    >
                        <Filter className="w-4 h-4" />
                        Add Time Window Filter
   
                 </button>

                    {/* Active Filters List */}
                    {dayTimeFilters.length > 0 && (
                        <div className="pt-3 space-y-2">
         
                   <div className="flex justify-between items-center">
                                <h4 className="text-sm font-semibold text-slate-700">Active Filters:</h4>
                                <button 
         
                           onClick={onClearAllFilters} 
                                    className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                              
  >
                                    <Trash2 className="w-3 h-3" /> Clear All
                                </button>
                         
   </div>
                            <div className="flex flex-wrap gap-2">
                                {dayTimeFilters.map(f => (
                                
    <div key={f.id} className="flex items-center gap-2 bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                                        <span>{f.day} ({formatTime(f.start)} - {formatTime(f.end)})</span>
                                        <button onClick={() => onRemoveFilter(f.id)} className="text-green-600 hover:text-green-800">
                                            <X className="w-4 h-4" />
                                        </button>
          
                          </div>
                                ))}
                            </div>
              
          </div>
                    )}
                </div>
            </div>


            {/* Course Selection (Filtered by branch + time) */}
            <div>
          
    <label className="block text-sm font-semibold text-slate-700 mb-2">
                4. Select Course
                {dayTimeFilters.length > 0 && (
                  <span className="text-sm text-orange-600 font-normal"> (Filtered by time)</span>
                )}
             
 </label>
              <select
                value={selectedCourseCode}
                onChange={handleCourseChange}
                disabled={!selectedBranch}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      
        >
                <option value="">
                    {selectedBranch ?
'Select a course...' : 'Please select a branch first'}
                </option>
                
                {/* --- NEW: Options with Clash Detection --- */}
                {filteredCourses.map(course => {
                  
  const clashes = courseClashStatus.get(course.course_code);
                    const hasClash = !!clashes;

                    // Do not show courses that are already selected
                    if (selectedCourses.some(sc => sc.course_code === course.course_code)) {
                  
      return null;
                    }

                    return (
                        <option 
                           
 key={course.course_code} 
                            value={course.course_code}
                            // Styling <option> is limited. Prefixing is the most reliable way.
                            style={hasClash ? { color: 
'#b91c1c', fontWeight: 'bold' } : {}}
                        >
                            {hasClash 
                                ?
`🔴 ${course.course_code} - ${course.course_name} (Clashes with: ${clashes.join(', ')})`
                                : `✅ ${course.course_code} - ${course.course_name}`
                            }
                        </option>
     
               );
})}
                {filteredCourses.length === 0 && selectedBranch && (
                  <option value="" disabled>
                    No courses available with current filters.
                  </option>
               
 )}
              </select>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleAddCourse}
                disabled={!selectedCourseCode}
             
   className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:cursor-not-allowed"
              >
                <Plus className="w-5 h-5" />
                ADD
              </button>
              <button
    
            onClick={handleReset}
                className="flex-1 bg-slate-500 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                <RotateCcw className="w-5 h-5" />
                RESET
         
     </button>
            </div>
          </div>

          {/* Selected Courses List */}
          {selectedCourses.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">
              
  Selected Courses ({selectedCourses.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {selectedCourses.map(course => (
                  <div
                    key={course.course_code}
        
            className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border-2 border-slate-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 truncate">
                
        {course.course_code}
                      </div>
                      <div className="text-sm text-slate-600 truncate">{course.course_name}</div>
                      <div className="text-sm text-slate-500 truncate">{course.instructor}</div>
                    
</div>
                    <div className="flex items-center gap-4 pl-4">
                      <span className="text-sm font-bold text-blue-600 flex-shrink-0">
                        {course.credits} cr
                      </span>
   
                   <button
                        onClick={() => handleRemoveCourse(course.course_code)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors flex-shrink-0"
                      >
     
                   <X className="w-5 h-5 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
 
             </div>
            </div>
          )}

          {/* Credit Summary */}
          <div className="mt-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                  
<span className="text-lg font-semibold">Total Credits</span>
                  <span className="text-4xl font-bold">{totalCredits.toString().padStart(2, '0')}</span>
              </div>
              <div className="mt-2 text-sm text-blue-100 text-center">
                  {totalCredits < 18 && 'Minimum credit requirement recommended (18-24)'}
                  
{totalCredits >= 18 && totalCredits <= 24 && 'Good course load!'}
                  {totalCredits > 24 && 'Heavy course load - consider reducing'}
              </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
           
   <button
                  onClick={() => setShowAvailableCourses(true)}
                  disabled={!selectedBranch}
                  className="bg-white border-2 border-blue-500 text-blue-600 font-bold py-3 px-6 rounded-xl transition-all hover:bg-blue-50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
            
      <BookOpen className="w-5 h-5" />
                  All Courses ({selectedBranch === 'ALL' ||
!selectedBranch ? 'All' : selectedBranch})
              </button>
              <button
                  onClick={() => setShowRecommendations(true)}
                  disabled={selectedCourses.length === 0}
                  className="bg-white border-2 border-blue-500 text-blue-600 font-bold py-3 px-6 rounded-xl transition-all hover:bg-blue-50 
flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  <Lightbulb className="w-5 h-5" />
                  Recommendations
              </button>
          </div>

          {/* Analyze Button (Timetable button removed) */}
  
        {selectedCourses.length > 0 && (
              <div className="mt-6">
                  <button
                      onClick={onAnalyze}
                      disabled={isAnalyzing}
           
           className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                      <Zap className="w-5 h-5" />
                      {isAnalyzing ?
'ANALYZING...' : 'ANALYZE COURSE LOAD'}
                  </button>
              </div>
          )}
        </div>

        {/* Available Courses Modal (Unchanged) */}
        {showAvailableCourses && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
  
              <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-2xl font-bold text-slate-800">
                        
    Available Courses - {selectedBranch === 'ALL' || !selectedBranch ? 'All Branches' : selectedBranch}
                        </h3>
                        <button
                            onClick={() => setShowAvailableCourses(false)}
      
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X className="w-6 h-6 text-slate-600" />
                   
     </button>
                    </div>
                    <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
                        <div className="space-y-3">
                           
 {courses.filter(c => selectedBranch === 'ALL' || !selectedBranch || c.branch === selectedBranch).map(course => (
                                <div
                                    key={course.course_code}
                   
                 className="p-4 border-2 border-slate-200 rounded-xl hover:border-blue-400 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
       
                                 <div className="flex-1">
                                            <div className="font-bold text-slate-800">{course.course_code}</div>
                    
                        <div className="text-slate-700 mt-1">{course.course_name}</div>
                                            <div className="text-sm text-slate-500 mt-2">
                           
                     Instructor: {course.instructor}
                                            </div>
                                  
      </div>
                                        <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                                            {course.credits} credits
  
                                      </span>
                                    </div>
                          
      </div>
                            ))}
                        </div>
                    </div>
                </div>
      
      </div>
        )}
        
        {/* Recommendations Modal (Unchanged) */}
        {showRecommendations && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-2xl font-bold text-slate-800">
                            Recommended Courses
                        </h3>
      
                  <button
                            onClick={() => setShowRecommendations(false)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                     
   >
                            <X className="w-6 h-6 text-slate-600" />
                        </button>
                    </div>
                    <div 
className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
                        <p className="text-slate-600 mb-4">
                            Based on your selected courses, we recommend:
                        </p>
              
          <div className="space-y-3">
                            {getRecommendedCourses().length === 0 ?
(
                                <div className="text-center text-slate-500 py-8">
                                    No recommendations available at this time.
                        
        </div>
                            ) : (
                                getRecommendedCourses().map(course => (
                            
        <div
                                        key={course.course_code}
                                        className="p-4 border-2 border-slate-200 rounded-xl hover:border-blue-400 transition-colors"
       
                             >
                                        <div className="flex items-start justify-between">
                            
                <div className="flex-1">
                                                <div className="font-bold text-slate-800">{course.course_code}</div>
                                 
               <div className="text-slate-700 mt-1">{course.course_name}</div>
                                                <div className="text-sm text-slate-500 mt-2">
                                
                    Branch: {course.branch} • Instructor: {course.instructor}
                                                </div>
                            
                </div>
                                            <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                                 
               {course.credits} credits
                                            </span>
                                        
</div>
                                    </div>
                                ))
                            )}
    
                    </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </>
  );
}

// --- 7. MAIN APP COMPONENT (Updated with new state and logic) ---

export default function App() {
    const [courses, setCourses] = useState<Course[]>([]);
const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
// --- STATE LIFTED UP ---
    const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
    const [dayTimeFilters, setDayTimeFilters] = useState<DayTimeFilter[]>([]);
// Removed `showTimetable` state
    
    const [isAnalyzing, setIsAnalyzing] = useState(false);
const [analysisResult, setAnalysisResult] = useState<{ text: string } | null>(null);
    const timetableRef = useRef<HTMLDivElement>(null);
// --- Course Data Fetch from /courses.json (MODIFIED) ---
    useEffect(() => {
        const fetchCourses = async () => {
            try {
                // Attempt to fetch courses.json from the public directory
                const response = await fetch('/courses.json'); 
              
  if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}.`);
                }
                
                const data: Course[] = await response.json();
                
  
              if (!Array.isArray(data) || data.length === 0) {
                     throw new Error("The loaded JSON is empty or not an array.");
                }
                
                // --- ⭐ FIX: De-duplication Logic ---
                // The courses.json file has duplicate entries for the same course code.
                // We will create a unique list of courses based on the 'course_code'.
                const uniqueCourseMap = new Map<string, Course>();
for (const course of data) {
                    if (!uniqueCourseMap.has(course.course_code)) {
                        uniqueCourseMap.set(course.course_code, course);
}
                }
                const uniqueCourses = Array.from(uniqueCourseMap.values());
// --- End of De-duplication ---

                setCourses(uniqueCourses);
// Use the de-duplicated list
                setError(null);
} catch (err) {
                console.error("Failed to load courses.json:", err);
// Fallback to minimal data if fetch fails, to keep the app functional
                const minimalFallback: Course[] = [
                    { "branch": "CSE", "course_name": "DATA STRUCTURES AND ALGORITHMS", "course_code": "CS201", "slot": "A1", "credits": 12, "course_type": "DC", "instructor": "A. Fallback", "instructor_email": "a.f@iitk.ac.in", "lecture_schedule": "TuTh 10:30-12:00", "tutorial_schedule": "nan", "practical_schedule": "W 14:00-16:00" },
                   
 { "branch": "PH", "course_name": "QUANTUM MECHANICS I", "course_code": "PH401", "slot": "B1", "credits": 9, "course_type": "DC", "instructor": "B. Fallback", "instructor_email": "b.f@iitk.ac.in", "lecture_schedule": "MWF 11:00-12:00", "tutorial_schedule": "nan", "practical_schedule": "nan" },
                    { "branch": "CE", "course_name": "STRUCTURAL ANALYSIS", "course_code": "CE343", "slot": "C1", "credits": 10, "course_type": "DC", "instructor": "C. Fallback", "instructor_email": "c.f@iitk.ac.in", "lecture_schedule": "MW 13:00-14:30", "tutorial_schedule": "nan", "practical_schedule": "nan" },
                ];
// Also de-duplicate the fallback
                const uniqueFallbackMap = new Map<string, Course>();
minimalFallback.forEach(c => uniqueFallbackMap.set(c.course_code, c));
                
                setCourses(Array.from(uniqueFallbackMap.values()));
                setError(`Failed to load course data from /courses.json. Using minimal fallback data. Error: ${err.message}.`);
} finally {
                setLoading(false);
}
        };

        // Load external libraries required for advanced features
        const loadScript = (src: string, globalName: string) => {
            if (typeof (window as any)[globalName] === 'undefined') {
                const script = document.createElement('script');
script.src = src;
                document.head.appendChild(script);
            }
        };
// Load html2canvas for the download feature
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas');
// Load marked for markdown to HTML conversion (LLM analysis)
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/marked/4.0.10/marked.min.js', 'marked');

        fetchCourses();
}, []);

    // --- LLM Logic (Unchanged) ---
    const handleAnalyzeCourseLoad = useCallback(async () => {
        if (selectedCourses.length === 0) return;

        setIsAnalyzing(true);
        setAnalysisResult(null);

        // 1. Prepare structured course data for the prompt
        const courseSummary = selectedCourses.map(c => ({
            code: c.course_code,
            name: 
c.course_name,
            credits: c.credits,
            lecture: c.lecture_schedule,
            tutorial: c.tutorial_schedule,
            practical: c.practical_schedule,
            instructor: c.instructor,
        }));
        
        // 2. Create the system instruction and user query
   
     const systemPrompt = `You are an expert University Academic Advisor and Time Management Specialist. Your task is to analyze a student's selected course load and provide specific, actionable advice.
The response MUST be structured using Markdown headings (e.g., ## Assessment) into three sections:
1. Overall Load Assessment (2-3 sentences on credit level and perceived difficulty).
2. Scheduling Hotspots (Identify 1-2 specific days or time blocks with heavy class schedules and suggest time-saving strategies for those days).
3. Interdisciplinary Study Strategy (Suggest a unique study or time management tip that connects two or more of the selected courses based on their content or schedule).
The response must be in Markdown format, highly encouraging, and professional.`;
const userQuery = `Analyze this student's course load and schedule:\n\n${JSON.stringify(courseSummary, null, 2)}`;
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                temperature: 0.6 
            }
        };
const executeFetch = async (attempt = 0) => {
            const MAX_RETRIES = 3;
try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
            
    });
        
                if (!response.ok) {
                    throw new Error(`API call failed with status: ${response.status}`);
}
        
                const result = await response.json();
const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
                if (generatedText) {
                    // This is a global function used for markdown to html conversion (assumes marked.js is loaded)
                    const marked = (window as any).marked ?
(window as any).marked : { parse: (md: string) => md.replace(/\n/g, '<br>') };
                    const htmlContent = marked.parse(generatedText);
                    setAnalysisResult({ text: htmlContent });
} else {
                    setAnalysisResult({ text: "Sorry, I couldn't generate the analysis. The LLM response was empty." });
}
            } catch (error) {
                console.error(`Attempt ${attempt + 1}: Gemini API Error:`, error);
if (attempt < MAX_RETRIES - 1) {
                    const delay = Math.pow(2, attempt) * 1000;
await new Promise(resolve => setTimeout(resolve, delay));
                    return executeFetch(attempt + 1);
} else {
                    setAnalysisResult({ text: `<p class="text-red-500 font-bold">An error occurred during analysis: ${error.message}. Please check your network connection.</p>` });
}
            } finally {
                 if (attempt === 0 || attempt === MAX_RETRIES - 1) {
                    setIsAnalyzing(false);
}
            }
        };
executeFetch();

    }, [selectedCourses]);

    // --- NEW: Handlers for lifted state ---

    const handleAddCourse = (course: Course) => {
        setSelectedCourses(prev => [...prev, course]);
};

    const handleRemoveCourse = (courseCode: string) => {
        setSelectedCourses(prev => prev.filter(c => c.course_code !== courseCode));
};

    const handleReset = () => {
        setSelectedCourses([]);
        setDayTimeFilters([]);
// also reset analysis
        setAnalysisResult(null);
    };
// --- NEW: Filter Handlers ---
    const handleAddFilter = (day: string, start: number, end: number) => {
        setDayTimeFilters(prev => [...prev, { id: Date.now(), day, start, end }]);
};

    const handleRemoveFilter = (id: number) => {
        setDayTimeFilters(prev => prev.filter(f => f.id !== id));
};

    const handleClearAllFilters = () => {
        setDayTimeFilters([]);
    };
const handleDownloadTimetable = () => {
        // Assuming timetableRef points to the container div that wraps the entire TimetableGrid component
        if (timetableRef.current && typeof (window as any).html2canvas !== 'undefined') {
            const element = timetableRef.current;
// Save original styles and set necessary overrides for capture
            const originalStyles = {
                overflow: element.style.overflow,
                maxWidth: element.style.maxWidth, // Critical if you have a max-width on the container
            };
element.style.overflow = 'visible';
            element.style.maxWidth = 'unset'; // Remove max-width constraint during capture

            // Find the actual content width/height including scrollable areas
            const contentWidth = element.scrollWidth;
const contentHeight = element.scrollHeight;

            (window as any).html2canvas(element, {
                backgroundColor: '#ffffff',
                scale: 2, // Use scale 2 or 3 for sharper image
                useCORS: true,
                // Capture the full scrollable area
            
    width: contentWidth,
                height: contentHeight, 
                x: 0, 
                y: 0,
                ignoreElements: (el: HTMLElement) =>
                    el.classList.contains('group-hover:block') || el.classList.contains('hidden'),
 
           })
                .then((canvas: HTMLCanvasElement) => {
                    const imgData = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = 'timetable.png';
  
                  link.href = imgData;
                    link.click();

                    // Restore original styles
                    element.style.overflow = originalStyles.overflow;
               
     element.style.maxWidth = originalStyles.maxWidth;
                })
                .catch((err: any) => {
                    console.error('Download failed:', err);
                    setError('Something went wrong while generating the timetable image.');
                    setTimeout(() => setError(null), 5000);
 
                   
                    // Ensure styles are restored even on failure
                    element.style.overflow = originalStyles.overflow;
                    element.style.maxWidth = originalStyles.maxWidth;
          
      });
        } else {
            console.error('Download failed. html2canvas not available or ref missing.');
setError('Download failed. Required library (html2canvas) not loaded.');
            setTimeout(() => setError(null), 5000);
        }
    };
const { conflictPairs } = useMemo(() => {
        // Recalculate conflicts only when selectedCourses changes
        return detectConflicts(selectedCourses);
    }, [selectedCourses]);
return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="container mx-auto px-4 py-8">
              <header className="mb-8 text-center space-y-4">
                  {/* Title */}
                  <div className="flex items-center justify-center gap-3 mb-3">
           
         <Calendar className="w-10 h-10 text-slate-700" />
                    <h1 className="text-4xl font-bold text-slate-800 font-serif">
                      IITK Course Planner
                    </h1>
                  </div>

 
                 {/* Subtitle */}
                  <p className="text-slate-600 text-lg">
                    Plan your courses, detect conflicts, and visualize your weekly schedule 🎓
                  </p>

             
     {/* --- MODIFIED HEADER --- */}
                  {/* Show controls only if courses are selected */}
                  {selectedCourses.length > 0 && (
                    <>
                      
<p className="text-slate-500 text-sm">
                        Hover over classes for details • Red borders indicate time conflicts
                      </p>

                      {/* Conflict summary */}
                 
     {conflictPairs.size > 0 && (
                        <div className="mt-3 inline-block bg-red-100 text-red-800 border border-red-400 px-4 py-2 rounded-lg shadow-sm font-medium">
                          ⚠️ {conflictPairs.size} conflict{conflictPairs.size > 1 ?
's' : ''} detected — 
                          check overlapping courses at the top of the timetable.
</div>
                      )}

                      {/* Header buttons */}
                      <div className="mt-5 flex justify-center gap-3">
                        <button
   
                       onClick={handleDownloadTimetable}
                          className="px-4 py-2 rounded-xl bg-green-500 text-white hover:bg-green-600 transition-all font-semibold shadow-md"
                        >
                   
       <Download className="w-4 h-4 inline-block mr-1" /> Download
                        </button>
                        <button
                          onClick={handleReset} // Use the main reset handler
       
                   className="px-4 py-2 rounded-xl bg-slate-500 text-white hover:bg-slate-600 transition-all font-semibold shadow-md"
                        >
                          <Trash2 className="w-4 h-4 inline-block mr-1" /> Clear All
                
        </button>
                      </div>
                    </>
                  )}
            </header>


                {loading && <div className="text-center 
text-slate-600 py-20">Loading courses...</div>}
                {error && <div className="p-4 mx-auto max-w-lg bg-red-100 border border-red-400 text-red-700 rounded-xl mb-6 text-center">{error}</div>}

                {!loading && courses.length > 0 && (
                    <div className="space-y-12">
                        
   
                     {/* Selector is ALWAYS visible */}
                        <CourseSelector
                            courses={courses}
                      
      // Pass state and handlers down
                            selectedCourses={selectedCourses}
                            onAddCourse={handleAddCourse}
                            onRemoveCourse={handleRemoveCourse}
     
                       onReset={handleReset}
                            // Pass filter state and handlers
                            dayTimeFilters={dayTimeFilters}
                
            onAddFilter={handleAddFilter}
                            onRemoveFilter={handleRemoveFilter}
                            onClearAllFilters={handleClearAllFilters}
                            // Pass analysis props
 
                           onAnalyze={handleAnalyzeCourseLoad}
                            isAnalyzing={isAnalyzing}
                        />

                     
   {/* Timetable is visible ONLY if courses are selected */}
                        {selectedCourses.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-xl p-8">
                            
    <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">My Timetable</h2>
                               <TimetableGrid 
                                    courses={selectedCourses}
                      
              gridRef={timetableRef}
                                    conflictPairs={conflictPairs}
              
                      onDownload={handleDownloadTimetable}
                                />
                            </div>
                  
      )}
                        
                    </div>
                )}
            </div>
            <footer className="text-center py-4 text-sm text-slate-500">
      
          Created by Love chourasia
            </footer>
            
            {/* Analysis Modal */}
            {analysisResult && (
                <CourseLoadAnalysisModal 
                 
   analysis={analysisResult.text}
                    onClose={() => setAnalysisResult(null)}
                />
            )}
        </div>
    );
}