import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSchool } from '@/context/SchoolContext';
import {
  StudentSearchResult,
  StudentAcademicSummary,
  ClassLevel,
  Section,
  Subject,
} from '@/types/database';
import { studentSearchApi, academicStructureApi } from '@/services/api';
import { StudentDossierView } from '@/components/quick-search/StudentDossierView';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import {
  Search,
  Users,
  X,
  ChevronRight,
  AlertCircle,
  Layers,
  ShieldAlert,
} from 'lucide-react';

export const StudentQuickSearchPage: React.FC = () => {
  const { user, role } = useAuth();
  const { currentSession, settings } = useSchool();

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');

  // Dropdown Metadata
  const [classes, setClasses] = useState<ClassLevel[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Search Results
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Selected Student Dossier State
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [summary, setSummary] = useState<StudentAcademicSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Load Classes, Sections, Subjects
  useEffect(() => {
    async function loadMeta() {
      try {
        const [clsList, secList, subList] = await Promise.all([
          academicStructureApi.getClasses(),
          academicStructureApi.getSections(),
          academicStructureApi.getSubjects(),
        ]);
        setClasses(clsList);
        setSections(secList);
        setSubjects(subList);
      } catch (err: any) {
        console.error('Failed to load academic metadata', err);
      }
    }
    loadMeta();
  }, []);

  // Filter sections by selected class
  const availableSections = selectedClassId
    ? sections.filter((s) => s.class_id === selectedClassId)
    : sections;

  const currentActor = user
    ? { id: user.id, name: user.full_name, role, email: user.email }
    : undefined;

  // Execute Search
  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const data = await studentSearchApi.searchStudents(
        {
          query: searchTerm.trim() || undefined,
          classId: selectedClassId || undefined,
          sectionId: selectedSectionId || undefined,
          sessionId: currentSession?.id,
        },
        currentActor
      );
      setResults(data);
    } catch (err: any) {
      setSearchError(err.message || 'Failed to search students.');
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, selectedClassId, selectedSectionId, currentSession?.id, role, user?.id, user?.email]);

  // Initial load
  useEffect(() => {
    handleSearch();
  }, [handleSearch]);

  // Open Student Dossier
  const handleOpenDossier = async (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsLoadingSummary(true);
    setSummaryError(null);

    try {
      const data = await studentSearchApi.getStudentAcademicSummary(
        studentId,
        currentSession?.id,
        currentActor
      );
      setSummary(data);
    } catch (err: any) {
      setSummaryError(err.message || 'Unauthorized or unable to load student academic record.');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  // Refresh current dossier
  const handleRefreshSummary = async () => {
    if (!selectedStudentId) return;
    try {
      const data = await studentSearchApi.getStudentAcademicSummary(
        selectedStudentId,
        currentSession?.id,
        currentActor
      );
      setSummary(data);
    } catch (err: any) {
      setSummaryError(err.message || 'Failed to refresh student academic record.');
    }
  };

  // Clear Filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedClassId('');
    setSelectedSectionId('');
  };

  // If a student's dossier is currently open
  if (selectedStudentId) {
    if (isLoadingSummary) {
      return (
        <div className="py-24 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-navy-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Compiling Student Academic Dossier & Performance Data...
          </p>
        </div>
      );
    }

    if (summaryError || !summary) {
      return (
        <div className="p-8 max-w-xl mx-auto my-12 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-2xl shadow-sm text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Access Restricted or Record Unavailable
          </h2>
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {summaryError || 'Could not retrieve student academic details.'}
          </p>
          {role === 'teacher' && (
            <p className="text-[11px] text-slate-500">
              Teachers may only view academic records for students belonging to their assigned classes and sections.
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedStudentId(null);
              setSummary(null);
              setSummaryError(null);
            }}
          >
            Back to Student Search
          </Button>
        </div>
      );
    }

    return (
      <StudentDossierView
        summary={summary}
        settings={settings}
        currentRole={role}
        currentActor={currentActor}
        onBack={() => {
          setSelectedStudentId(null);
          setSummary(null);
        }}
        onRefresh={handleRefreshSummary}
        allSubjects={subjects}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Scope Notice */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Search className="w-6 h-6 text-brand-600" />
            Student Quick Search & Academic Performance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Search students across admissions, roll numbers, and classes to view consolidated academic dossiers, quiz marks, and performance graphs.
          </p>
        </div>

        {role === 'teacher' ? (
          <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs px-3 py-1.5 rounded-xl font-medium">
            <Layers className="w-4 h-4 text-amber-600" />
            <span>Scoped to your assigned classes & sections</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 bg-navy-50 dark:bg-navy-950/40 border border-navy-200 dark:border-navy-800 text-navy-800 dark:text-brand-300 text-xs px-3 py-1.5 rounded-xl font-medium">
            <Users className="w-4 h-4 text-navy-700 dark:text-brand-300" />
            <span>School-wide administrative search</span>
          </div>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="grid grid-cols-1 sm:grid-cols-12 gap-3"
          >
            {/* Search Input */}
            <div className="sm:col-span-5 relative">
              <Input
                type="text"
                placeholder="Search by student name, admission no (e.g. ADM-2025-0001), or roll no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              />
            </div>

            {/* Class Filter */}
            <div className="sm:col-span-3">
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedSectionId('');
                }}
                className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Filter */}
            <div className="sm:col-span-2">
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                disabled={!selectedClassId && availableSections.length > 10}
                className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 disabled:opacity-50"
              >
                <option value="">All Sections</option>
                {availableSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="sm:col-span-2 flex items-center gap-2">
              <Button
                type="submit"
                className="w-full"
                isLoading={isSearching}
              >
                Search
              </Button>
              {(searchTerm || selectedClassId || selectedSectionId) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Clear all filters"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Search Error Alert */}
      {searchError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-900">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Results Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
              Search Results
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Found {results.length} student{results.length === 1 ? '' : 's'}. Click on any student to open their detailed academic dossier.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isSearching ? (
            <div className="py-16 text-center text-slate-500 text-xs">
              <div className="w-8 h-8 border-3 border-navy-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Searching students...
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {hasSearched ? 'No matching students found.' : 'Search for a student to get started.'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {hasSearched
                  ? 'Verify spelling, admission number (e.g. ADM-2025-0001), or clear filters to see more students.'
                  : 'Enter a student name, roll number, or admission number above.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase text-[10px] text-slate-500 tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Admission No</th>
                    <th className="p-3 text-center">Roll No</th>
                    <th className="p-3">Class & Section</th>
                    <th className="p-3">Guardian Name & Contact</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {results.map((res) => {
                    const sec = res.enrollment?.section;
                    const cls = sec?.class;
                    return (
                      <tr
                        key={res.student.id}
                        onClick={() => handleOpenDossier(res.student.id)}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                      >
                        {/* Name & Initial Avatar */}
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-navy-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {res.student.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white group-hover:text-navy-900 dark:group-hover:text-brand-300 transition-colors">
                                {res.student.full_name}
                              </span>
                              <span className="block text-[10px] text-slate-400">
                                Gender: {res.student.gender}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Admission Number */}
                        <td className="p-3 font-mono font-bold text-navy-900 dark:text-brand-300">
                          {res.student.admission_no}
                        </td>

                        {/* Roll Number */}
                        <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                          {res.enrollment?.roll_no || '—'}
                        </td>

                        {/* Class & Section (Critical for duplicate name disambiguation) */}
                        <td className="p-3">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {cls?.name || 'Class Unassigned'}
                          </span>
                          {sec && (
                            <span className="text-slate-500 ml-1">
                              (Sec {sec.name})
                            </span>
                          )}
                        </td>

                        {/* Guardian */}
                        <td className="p-3">
                          <span className="font-medium text-slate-900 dark:text-slate-200">
                            {res.student.guardian_name}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {res.student.guardian_phone}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="p-3 text-center">
                          <Badge variant={res.student.is_active ? 'success' : 'danger'}>
                            {res.student.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>

                        {/* Action */}
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="group-hover:bg-navy-900 group-hover:text-white transition-colors"
                            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                          >
                            View Dossier
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
