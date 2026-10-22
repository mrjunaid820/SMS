import { describe, it, expect } from 'vitest';
import { sanitizeCellValue, parseAndValidateStudentCSV } from '../src/lib/csv-sanitizer';

describe('CSV Sanitizer & Formula Injection Protection', () => {
  it('escapes cells starting with risky calculation tokens (=, +, -, @)', () => {
    // Malicious DDE execution payloads
    expect(sanitizeCellValue('=1+1')).toBe("'=1+1");
    expect(sanitizeCellValue('=cmd|\' /C calc\'!A0')).toBe("'=cmd|' /C calc'!A0");
    expect(sanitizeCellValue('+100')).toBe("'+100");
    expect(sanitizeCellValue('-50')).toBe("'-50");
    expect(sanitizeCellValue('@SUM(1,2)')).toBe("'@SUM(1,2)");
    expect(sanitizeCellValue('\tTAB_PREFIX')).toBe("'\tTAB_PREFIX");

    // Safe regular values
    expect(sanitizeCellValue('Muhammad Hamza')).toBe('Muhammad Hamza');
    expect(sanitizeCellValue('Class 9')).toBe('Class 9');
    expect(sanitizeCellValue('ADM-2025-0001')).toBe('ADM-2025-0001');
    expect(sanitizeCellValue(null)).toBe('');
  });

  it('validates CSV student rows and flags missing required columns', async () => {
    const csvContent = `Full Name,Gender,Date of Birth,Guardian Name,Guardian Phone,Address
Muhammad Ali,Male,2010-04-12,Tariq Ali,+92 300 1234567,Gulberg Lahore
,Female,2010-05-15,Rashid Khan,+92 321 9876543,Model Town Lahore
Zainab Bibi,InvalidGender,2010-09-20,Zahid Bibi,+92 333 4567890,Faisal Town Lahore
`;

    const result = await parseAndValidateStudentCSV(csvContent);
    expect(result.validRows.length).toBe(1);
    expect(result.validRows[0].full_name).toBe('Muhammad Ali');
    expect(result.errors.length).toBe(2);
    expect(result.errors[0].reason).toContain('Missing Full Name');
    expect(result.errors[1].reason).toContain('Invalid Gender');
  });
});
