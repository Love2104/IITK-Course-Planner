import { useState, useMemo } from 'react';
import { Plus, RotateCcw, X, BookOpen, Lightbulb } from 'lucide-react';

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

interface CourseSelectorProps {
  courses: Course[];
  onViewTimetable: (selectedCourses: Course[]) => void;
}

export default function CourseSelector({ courses, onViewTimetable }: CourseSelectorProps) {
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('');
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
  const [showAvailableCourses, setShowAvailableCourses] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);

  const branches = useMemo(() => {
    const uniqueBranches = Array.from(new Set(courses.map(c => c.branch))).sort();
    return uniqueBranches;
  }, [courses]);

  const filteredCourses = useMemo(() => {
    if (!selectedBranch) return [];
    return courses.filter(c => c.branch === selectedBranch);
  }, [courses, selectedBranch]);

  const totalCredits = useMemo(() => {
    return selectedCourses.reduce((sum, course) => sum + course.credits, 0);
  }, [selectedCourses]);

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBranch(e.target.value);
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
    setSelectedBranch('');
    setSelectedCourseCode('');
    setSelectedCourses([]);
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

    return courses.filter(course => {
      if (selectedCourses.some(sc => sc.course_code === course.course_code)) return false;

      const courseName = course.course_name.toLowerCase();
      return Array.from(keywords).some(keyword => courseName.includes(keyword));
    }).slice(0, 10);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-3xl font-bold text-slate-800 mb-8 text-center">
          Enter courses taken
        </h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select Branch
            </label>
            <select
              value={selectedBranch}
              onChange={handleBranchChange}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">Select Branch</option>
              {branches.map(branch => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select Course
            </label>
            <select
              value={selectedCourseCode}
              onChange={handleCourseChange}
              disabled={!selectedBranch}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Select Course</option>
              {filteredCourses.map(course => (
                <option key={course.course_code} value={course.course_code}>
                  {course.course_code} - {course.course_name}
                </option>
              ))}
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
                    {/* Display Instructor */}
                    <div className="text-sm text-slate-500">{course.instructor}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-blue-600">
                      {course.credits} credits
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
          <div className="mt-4 h-3 bg-white bg-opacity-30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${Math.min((totalCredits / 60) * 100, 100)}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-blue-100 text-center">
            {totalCredits < 18 && 'Add more courses to reach minimum credit requirement'}
            {totalCredits >= 18 && totalCredits <= 24 && 'Good course load!'}
            {totalCredits > 24 && 'Heavy course load - consider reducing'}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setShowAvailableCourses(true)}
            disabled={!selectedBranch}
            className="bg-white border-2 border-blue-500 text-blue-600 font-bold py-3 px-6 rounded-xl transition-all hover:bg-blue-50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <BookOpen className="w-5 h-5" />
            Check Available Courses
          </button>
          <button
            onClick={() => setShowRecommendations(true)}
            disabled={selectedCourses.length === 0}
            className="bg-white border-2 border-blue-500 text-blue-600 font-bold py-3 px-6 rounded-xl transition-all hover:bg-blue-50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lightbulb className="w-5 h-5" />
            Topic Based Recommendation
          </button>
        </div>

        {selectedCourses.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => onViewTimetable(selectedCourses)}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl"
            >
              View My Timetable
            </button>
          </div>
        )}
      </div>

      {showAvailableCourses && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-800">
                Available Courses - {selectedBranch}
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
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
              <p className="text-slate-600 mb-4">
                Based on your selected courses, we recommend:
              </p>
              <div className="space-y-3">
                {getRecommendedCourses().length === 0 ? (
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
  );
}
