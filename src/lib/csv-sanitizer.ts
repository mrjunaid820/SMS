import Papa from 'papaparse';

/**
 * Sanitizes an individual cell value to protect against CSV / Excel Formula Injection (CSV Injection / DDE).
 * If a value starts with =, +, -, @, tab, or carriage return, it prefixes with an apostrophe.
 */
export function sanitizeCellValue(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.startsWith('\t') || str.startsWith('\r') || str.startsWith('\n')) {
    return `'${str}`;
  }
  const trimmed = str.trimStart();
  if (
    trimmed.startsWith('=') ||
    trimmed.startsWith('+') ||
    trimmed.startsWith('-') ||
    trimmed.startsWith('@')
  ) {
    return `'${str}`;
  }
  return str;
}

/**
 * Safely converts an array of objects to CSV with header and cell sanitization.
 */
export function exportToSafeCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; header: string }[]
): void {
  let exportData: Record<string, any>[] = [];

  if (columns && columns.length > 0) {
    exportData = data.map((row) => {
      const sanitizedRow: Record<string, any> = {};
      columns.forEach((col) => {
        sanitizedRow[col.header] = sanitizeCellValue(row[col.key]);
      });
      return sanitizedRow;
    });
  } else {
    exportData = data.map((row) => {
      const sanitizedRow: Record<string, any> = {};
      Object.keys(row).forEach((k) => {
        sanitizedRow[k] = sanitizeCellValue(row[k]);
      });
      return sanitizedRow;
    });
  }

  const csvString = Papa.unparse(exportData, {
    quotes: true,
    header: true,
  });

  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parses and validates CSV input for Student Bulk Import
 */
export interface CSVStudentRow {
  full_name: string;
  gender: string;
  date_of_birth: string;
  guardian_name: string;
  guardian_relation?: string;
  guardian_phone: string;
  guardian_cnic?: string;
  address: string;
  blood_group?: string;
  admission_date?: string;
}

export interface CSVParseResult {
  validRows: CSVStudentRow[];
  errors: { rowNumber: number; reason: string }[];
}

export function parseAndValidateStudentCSV(fileContent: string): Promise<CSVParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validRows: CSVStudentRow[] = [];
        const errors: { rowNumber: number; reason: string }[] = [];

        results.data.forEach((row, idx) => {
          const rowNum = idx + 2; // +1 for 0-index, +1 for header line
          const name = (row['Full Name'] || row['full_name'] || '').trim();
          const gender = (row['Gender'] || row['gender'] || '').trim();
          const dob = (row['Date of Birth'] || row['date_of_birth'] || '').trim();
          const guardianName = (row['Guardian Name'] || row['guardian_name'] || '').trim();
          const phone = (row['Guardian Phone'] || row['guardian_phone'] || '').trim();
          const address = (row['Address'] || row['address'] || '').trim();

          if (!name) {
            errors.push({ rowNumber: rowNum, reason: 'Missing Full Name' });
            return;
          }
          if (!gender || !['Male', 'Female', 'Other'].includes(gender)) {
            errors.push({ rowNumber: rowNum, reason: `Invalid Gender "${gender}". Must be Male, Female, or Other` });
            return;
          }
          if (!dob) {
            errors.push({ rowNumber: rowNum, reason: 'Missing Date of Birth' });
            return;
          }
          if (!guardianName) {
            errors.push({ rowNumber: rowNum, reason: 'Missing Guardian Name' });
            return;
          }
          if (!phone) {
            errors.push({ rowNumber: rowNum, reason: 'Missing Guardian Phone Number' });
            return;
          }
          if (!address) {
            errors.push({ rowNumber: rowNum, reason: 'Missing Address' });
            return;
          }

          validRows.push({
            full_name: name,
            gender: gender as 'Male' | 'Female' | 'Other',
            date_of_birth: dob,
            guardian_name: guardianName,
            guardian_relation: (row['Guardian Relation'] || row['guardian_relation'] || 'Father').trim(),
            guardian_phone: phone,
            guardian_cnic: (row['Guardian CNIC'] || row['guardian_cnic'] || '').trim(),
            address,
            blood_group: (row['Blood Group'] || row['blood_group'] || '').trim(),
            admission_date: (row['Admission Date'] || row['admission_date'] || new Date().toISOString().split('T')[0]).trim(),
          });
        });

        resolve({ validRows, errors });
      },
    });
  });
}
