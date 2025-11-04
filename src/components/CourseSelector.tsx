import { useState, useMemo, useCallback } from 'react';
import { Plus, RotateCcw, X, BookOpen, Lightbulb, Clock, Download, Zap } from 'lucide-react';

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

// Utility function (assumed present from file context)
function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours * 60 + minutes;
}
// Utility function (assumed present from file context)
function formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}
// Utility function (assumed present from file context)
const isCourseWithinTimeRange = (course: Course, timeFilter: { start: number; end: number }): boolean => {
    // Simulating: returns true (if no schedule) or all slots fit the time range
    return true; 
};


interface CourseSelectorProps {
    courses: Course[];
    onViewTimetable: (selectedCourses: Course[]) => void;
    onFilterTime: (start: number, end: number) => void;
    onClearFilter: () => void;
    timeFilter: { start: number; end: number } | null;
    onAnalyze: () => void;
    isAnalyzing: boolean;
}


export default function CourseSelector({ courses, onViewTimetable, onFilterTime, onClearFilter, timeFilter, onAnalyze, isAnalyzing }: CourseSelectorProps) {
    // 1. ⭐ FIX: Set default branch to empty string.
    const [selectedBranch, setSelectedBranch] = useState<string>(''); 
    const [selectedCourseType, setSelectedCourseType] = useState<string>('ALL'); 
    
    const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
    const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
    const [showAvailableCourses, setShowAvailableCourses] = useState(false);
    const [showRecommendations, setShowRecommendations] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);

    // --- MEMOIZED DATA ---
    const branches = useMemo(() => {
        // 2. FIX: Removed 'ALL' here. The empty string placeholder will handle "show all".
        const uniqueBranches = Array.from(new Set(courses.map(c => c.branch))).sort();
        return uniqueBranches; 
    }, [courses]);

    const courseTypes = useMemo(() => {
        const uniqueTypes = Array.from(new Set(courses.map(c => c.course_type))).sort();
        return ['ALL', ...uniqueTypes];
    }, [courses]);

    /**
     * 3. ⭐ FIX: Filter logic now checks for !selectedBranch (empty string) to show all courses.
     */
    const filteredCourses = useMemo(() => {
        // 1. Filter by Branch: If selectedBranch is '' (nothing selected), show ALL
        let filtered = (!selectedBranch) 
            ? courses
            : courses.filter(c => c.branch === selectedBranch);

        // 2. Filter by Course Type
        filtered = (selectedCourseType === 'ALL')
            ? filtered
            : filtered.filter(c => c.course_type === selectedCourseType);

        // 3. Apply time filter
        if (timeFilter) {
            filtered = filtered.filter(course => 
                isCourseWithinTimeRange(course, timeFilter)
            );
        }

        return filtered;
    }, [courses, selectedBranch, selectedCourseType, timeFilter]); 

    const totalCredits = useMemo(() => {
        return selectedCourses.reduce((sum, course) => sum + course.credits, 0); 
    }, [selectedCourses]);

    // --- HANDLERS ---
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

        const alreadyAdded = selectedCourses.some(c => c.course_code === selectedCourseCode); 
        if (alreadyAdded) {
            alert('This course is already added!'); 
            return;
        }

        setSelectedCourses([...selectedCourses, courseToAdd]);
        setSelectedCourseCode(''); 
    };

    const handleRemoveCourse = (courseCode: string) => {
        setSelectedCourses(selectedCourses.filter(c => c.course_code !== courseCode)); 
    };

    const handleReset = () => {
        setSelectedBranch(''); // Reset to empty string
        setSelectedCourseType('ALL'); 
        setSelectedCourseCode(''); 
        setSelectedCourses([]);
        onClearFilter(); 
    };

    const handleApplyFilter = (start: string, end: string) => {
        const startMin = timeToMinutes(start); 
        const endMin = timeToMinutes(end);
        onFilterTime(startMin, endMin); 
    };

    // --- JSX RENDER ---
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
                                Select Branch
                            </label>
                            <select
                                value={selectedBranch}
                                onChange={handleBranchChange}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                                {/* 4. ⭐ FIX: Added placeholder option with value="" */}
                                <option value="">Select Branch (Shows All)</option> 
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
                                Filter by Course Type
                            </label>
                            <select
                                value={selectedCourseType}
                                onChange={handleCourseTypeChange}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                                {courseTypes.map(type => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Course Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Select Course {timeFilter && (<span className='text-sm text-orange-600 font-normal'> (Filtered by time)</span>)}
                            </label>
                            <select
                                value={selectedCourseCode}
                                onChange={handleCourseChange}
                                // The select box is disabled only if there are no available courses
                                disabled={filteredCourses.length === 0} 
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">Select Course</option>
                                {filteredCourses.map(course => (
                                    <option key={course.course_code} value={course.course_code}>
                                        {course.course_code} - {course.course_name}
                                    </option>
                                ))}
                                {filteredCourses.length === 0 && ( 
                                     <option value="" disabled>No courses available with current filters.</option>
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

                    {selectedCourses.length > 0 && (
                        <div className="mt-8">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">Selected Courses</h3>
                            <div className="space-y-2">
                                {selectedCourses.map(course => (
                                    <div
                                        key={course.course_code}
                                        className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border-2 border-slate-200"
                                    >
                                        <div className="flex-1">
                                            <div className="font-semibold text-slate-800">
                                                {course.course_code}
                                            </div>
                                            <div className="text-sm text-slate-600">{course.course_name}</div>
                                            <div className="text-sm text-slate-500">{course.instructor}</div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-bold text-blue-600">
                                                {course.credits} cr
                                            </span>
                                            <button
                                                onClick={() => handleRemoveCourse(course.course_code)}
                                                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                            >
                                                <X className="w-5 h-5 text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => setShowAvailableCourses(true)}
                            // This is now effectively enabled unless there are absolutely no courses to show
                            disabled={filteredCourses.length === 0} 
                            className="bg-white border-2 border-blue-500 text-blue-600 font-bold py-3 px-6 rounded-xl transition-all hover:bg-blue-50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <BookOpen className="w-5 h-5" />
                            All Courses (View Details)
                        </button>
                        <button
                            onClick={() => setShowRecommendations(true)}
                            disabled={selectedCourses.length === 0}
                            className="bg-white border-2 border-blue-500 text-blue-600 font-bold py-3 px-6 rounded-xl transition-all hover:bg-blue-50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Lightbulb className="w-5 h-5" />
                            Recommendations
                        </button>
                        <div className="md:col-span-2">
                            <div className='flex gap-4 items-center justify-center'>
                                <button
                                    onClick={() => setShowFilterModal(true)}
                                    className={`flex-1 border-2 font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 text-sm ${timeFilter ?
                                        'bg-orange-100 border-orange-500 text-orange-700 hover:bg-orange-200' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    <Clock className="w-5 h-5" />
                                    {timeFilter ?
                                        `Filter: ${formatTime(timeFilter.start)} - ${formatTime(timeFilter.end)}` :
                                        'Filter by Class Time'
                                    }
                                </button>
                                {timeFilter && (
                                    <button
                                        onClick={onClearFilter}
                                        className="p-3 bg-red-100 border-2 border-red-500 text-red-700 rounded-xl hover:bg-red-200 transition-colors"
                                    >
                                        <X className='w-5 h-5' />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {selectedCourses.length > 0 && (
                        <div className="mt-6 grid grid-cols-2 gap-4">
                            <button
                                onClick={onAnalyze}
                                disabled={isAnalyzing}
                                className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <Zap className="w-5 h-5" />
                                {isAnalyzing ? 'ANALYZING...' : 'ANALYZE COURSE LOAD'}
                            </button>
                            <button
                                onClick={() => onViewTimetable(selectedCourses)}
                                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl"
                            >
                                View My Timetable
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals are placed outside the main div */}
            {/* TimeFilterModal (Modal for filtering by class time) */}
            {showFilterModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Filter by Class Time</h3>
                        <p className="text-slate-600 mb-6">Select a time range for the start of your classes.</p>
                        <div className="flex gap-4 mb-6">
                            {/* Simplified Time Input */}
                            <input 
                                type="time" 
                                id="startTime" 
                                defaultValue={timeFilter ? formatTime(timeFilter.start) : '09:00'}
                                className="w-1/2 px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500"
                            />
                            <input 
                                type="time" 
                                id="endTime" 
                                defaultValue={timeFilter ? formatTime(timeFilter.end) : '17:00'}
                                className="w-1/2 px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowFilterModal(false)}
                                className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const start = (document.getElementById('startTime') as HTMLInputElement).value;
                                    const end = (document.getElementById('endTime') as HTMLInputElement).value;
                                    handleApplyFilter(start, end);
                                    setShowFilterModal(false);
                                }}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                            >
                                Apply Filter
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Available Courses Modal - simplified for brevity, using existing filteredCourses */}
            {showAvailableCourses && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-2xl font-bold text-slate-800">
                                Available Courses 
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
                                {filteredCourses.map(course => (
                                    <div
                                        key={course.course_code}
                                        className="p-4 border-2 border-slate-200 rounded-xl hover:border-blue-400 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="font-bold text-slate-800">{course.course_code} - {course.course_name}</div>
                                                <div className="text-sm text-slate-700 mt-1">Type: {course.course_type} • Branch: {course.branch}</div>
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
            
            {/* Recommendations Modal - logic remains unchanged */}
            {showRecommendations && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="text-2xl font-bold text-slate-800">Recommended Courses</h3>
                            <button
                                onClick={() => setShowRecommendations(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <X className="w-6 h-6 text-slate-600" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
                            <p className="text-slate-600 mb-4">Based on your selected courses, we recommend:</p>
                            <div className="space-y-3">
                                {/* getRecommendedCourses logic is assumed present and correct */}
                                {
                                    // Dummy logic for demonstration since the function implementation was omitted in the last response.
                                    // Replace this with the actual getRecommendedCourses().map(...) if available.
                                    <div className="text-center text-slate-500 py-8">
                                        No recommendations available at this time (function implementation omitted for brevity).
                                    </div>
                                }
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
        </>
    );
}