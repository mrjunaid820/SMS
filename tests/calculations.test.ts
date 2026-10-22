import { describe, it, expect } from 'vitest';
import { calculateGrade, calculateAttendancePercentage, formatCurrency, formatDate } from '../src/lib/utils';
import { DEFAULT_GRADING_RULES } from '../src/config/constants';

describe('Grading and Calculations Engine', () => {
  it('correctly maps Pakistani BISE percentages to letter grades and GPAs', () => {
    // 90-100% -> A+ (GPA 4.0)
    const topGrade = calculateGrade(94.5, DEFAULT_GRADING_RULES);
    expect(topGrade.grade).toBe('A+');
    expect(topGrade.gpa).toBe(4.0);
    expect(topGrade.remarks).toBe('Outstanding');

    // 80-89.99% -> A (GPA 3.7)
    const excellent = calculateGrade(82.0, DEFAULT_GRADING_RULES);
    expect(excellent.grade).toBe('A');
    expect(excellent.gpa).toBe(3.7);

    // 70-79.99% -> B (GPA 3.0)
    const veryGood = calculateGrade(74.0, DEFAULT_GRADING_RULES);
    expect(veryGood.grade).toBe('B');

    // 60-69.99% -> C (GPA 2.5)
    const good = calculateGrade(65.0, DEFAULT_GRADING_RULES);
    expect(good.grade).toBe('C');

    // 50-59.99% -> D (GPA 2.0)
    const fair = calculateGrade(52.5, DEFAULT_GRADING_RULES);
    expect(fair.grade).toBe('D');

    // 33-49.99% -> E (GPA 1.0, Passing mark)
    const pass = calculateGrade(35.0, DEFAULT_GRADING_RULES);
    expect(pass.grade).toBe('E');
    expect(pass.remarks).toBe('Pass');

    // Below 33% -> F (Fail)
    const fail = calculateGrade(28.0, DEFAULT_GRADING_RULES);
    expect(fail.grade).toBe('F');
    expect(fail.gpa).toBe(0.0);
    expect(fail.remarks).toBe('Fail');
  });

  it('calculates attendance percentages accurately with 0-division guards', () => {
    expect(calculateAttendancePercentage(0, 0)).toBe(0);
    expect(calculateAttendancePercentage(18, 20)).toBe(90);
    expect(calculateAttendancePercentage(20, 20)).toBe(100);
    expect(calculateAttendancePercentage(14, 21)).toBe(66.7);
  });

  it('formats currency with Pakistani standard Rs. prefix and two decimal places', () => {
    expect(formatCurrency(4500)).toBe('Rs. 4,500.00');
    expect(formatCurrency(0)).toBe('Rs. 0.00');
    expect(formatCurrency(1250000.5)).toBe('Rs. 1,250,000.50');
  });

  it('formats dates consistently in readable British/Pakistani format', () => {
    expect(formatDate('2026-10-22')).toBe('22 Oct 2026');
    expect(formatDate(null)).toBe('—');
  });
});
