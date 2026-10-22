import React, { useState, useEffect } from 'react';
import { SchoolSettings, GradeRule } from '@/types/database';
import { settingsApi } from '@/services/api';
import { useSchool } from '@/context/SchoolContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import { Sliders, Save, School, Award, Check } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { settings, sessions, refreshSettings } = useSchool();

  const [formData, setFormData] = useState<SchoolSettings>(settings);
  const [gradingRules, setGradingRules] = useState<GradeRule[]>(settings.grading_rules || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  useEffect(() => {
    setFormData(settings);
    setGradingRules(settings.grading_rules || []);
  }, [settings]);

  const handleGradeRuleChange = (index: number, field: keyof GradeRule, val: any) => {
    const updated = [...gradingRules];
    updated[index] = { ...updated[index], [field]: val };
    setGradingRules(updated);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await settingsApi.updateSettings(
        {
          ...formData,
          grading_rules: gradingRules,
        },
        { id: user?.id, name: user?.full_name }
      );
      await refreshSettings();
      setIsSavedSuccess(true);
      setTimeout(() => setIsSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveAll} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Institutional Settings & Configuration
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            School identity, official registration, examination grading scale and active session
          </p>
        </div>

        <Button
          size="sm"
          type="submit"
          isLoading={isSaving}
          leftIcon={isSavedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
        >
          {isSavedSuccess ? 'Saved Successfully' : 'Save All Settings'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* School Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <School className="w-4 h-4 text-navy-800 dark:text-brand-400" />
              <CardTitle>School Identity & Affiliation</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Official School Name"
              required
              value={formData.school_name}
              onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Registration Number"
                value={formData.registration_number || ''}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
              />
              <Input
                label="Currency Symbol"
                required
                value={formData.currency_symbol}
                onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
              />
            </div>

            <Input
              label="Board Affiliation"
              value={formData.affiliation || ''}
              onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })}
            />

            <Input
              label="Headmaster / Principal Name"
              value={formData.principal_name || ''}
              onChange={(e) => setFormData({ ...formData, principal_name: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Official Phone"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <Input
                label="Official Email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <Input
              label="Campus Postal Address"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </CardContent>
        </Card>

        {/* Configurable BISE Grading Scale Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <CardTitle>BISE Examination Grading System</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">
              Configure boundary percentages, GPA weights and official remarks.
            </p>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-2">Grade</th>
                    <th className="p-2">Min %</th>
                    <th className="p-2">Max %</th>
                    <th className="p-2">GPA</th>
                    <th className="p-2">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {gradingRules.map((rule, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold font-mono text-navy-950 dark:text-brand-300">
                        {rule.grade}
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={rule.min_percentage}
                          onChange={(e) =>
                            handleGradeRuleChange(idx, 'min_percentage', Number(e.target.value))
                          }
                          className="w-14 px-1.5 py-0.5 border border-slate-300 dark:border-slate-700 rounded text-center font-mono text-xs dark:bg-slate-800"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={rule.max_percentage}
                          onChange={(e) =>
                            handleGradeRuleChange(idx, 'max_percentage', Number(e.target.value))
                          }
                          className="w-14 px-1.5 py-0.5 border border-slate-300 dark:border-slate-700 rounded text-center font-mono text-xs dark:bg-slate-800"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.1"
                          value={rule.gpa}
                          onChange={(e) =>
                            handleGradeRuleChange(idx, 'gpa', Number(e.target.value))
                          }
                          className="w-14 px-1.5 py-0.5 border border-slate-300 dark:border-slate-700 rounded text-center font-mono text-xs dark:bg-slate-800"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={rule.remarks}
                          onChange={(e) =>
                            handleGradeRuleChange(idx, 'remarks', e.target.value)
                          }
                          className="w-full px-2 py-0.5 border border-slate-300 dark:border-slate-700 rounded text-xs dark:bg-slate-800"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
};
