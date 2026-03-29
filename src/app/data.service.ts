import { Injectable, signal } from '@angular/core';
import * as XLSX from 'xlsx';

export interface Transaction {
  date: Date;
  narration: string;
  category: string;
  subCategory: string;
  withdrawal: number;
  deposit: number;
  balance: number;
  // Derived fields
  month: string;
  amount: number;
  type: 'Income' | 'Expense';
  bucket: 'Needs' | 'Wants' | 'Savings' | 'Income';
  day: number;
  weekday: string;
  isWeekend: boolean;
  yearMonth: string;
}

export interface BudgetStats {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  netFlow: number;
  needsRatio: number;
  wantsRatio: number;
  savingsRatio: number;
  actualNeeds: number;
  actualWants: number;
  actualSavings: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  transactions = signal<Transaction[]>([]);
  isLoading = signal<boolean>(false);

  parseExcel(file: File): Promise<void> {
    this.isLoading.set(true);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

          const allowedCategories = ['Income', 'Saving', 'Want', 'Ignore', 'Need'];

          // Validation Step
          try {
            rawData.forEach((row, index) => {
              const cat = String(row['Category'] || '').trim();
              if (!allowedCategories.includes(cat)) {
                throw new Error(`[Row ${index + 2}] Invalid Category: "${cat}". \nExpected one of: ${allowedCategories.join(', ')}.`);
              }
              if (!row['Date']) throw new Error(`[Row ${index + 2}] Missing "Date" column.`);
              if (isNaN(new Date(row['Date']).getTime())) throw new Error(`[Row ${index + 2}] Invalid date format in "Date" column.`);
            });
          } catch (err: any) {
            this.isLoading.set(false);
            return reject(err.message);
          }

          const processedData: Transaction[] = rawData
            .filter(row => String(row['Category'] || '').trim() !== 'Ignore')
            .map(row => {
              const withdrawal = row['Withdrawal Amt.'] || 0;
              const deposit = row['Deposit Amt.'] || 0;
              const amount = withdrawal > 0 ? withdrawal : deposit;
              const type: 'Income' | 'Expense' = withdrawal > 0 ? 'Expense' : 'Income';

              const cat = String(row['Category'] || '').trim();
              let bucket: 'Needs' | 'Wants' | 'Savings' | 'Income' = 'Wants';
              if (type === 'Income') bucket = 'Income';
              else if (cat === 'Saving') bucket = 'Savings';
              else if (cat === 'Need') bucket = 'Needs';
              else bucket = 'Wants';

              // Robust Date Parsing (Handles Excel Serial Dates)
              let date: Date;
              const rawDate = row['Date'];
              if (typeof rawDate === 'number') {
                // Excel serial date to JS Date (Local invariant)
                const excelEpoch = new Date(1899, 11, 30);
                date = new Date(excelEpoch.getTime() + rawDate * 86400000);
              } else {
                date = new Date(rawDate);
              }
              
              const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
              const monthLabel = `${months[date.getMonth()]} ${date.getFullYear()}`;

              return {
                date,
                narration: row['Narration'] || '',
                category: row['Category'] || '',
                subCategory: row['Sub Category'] || '',
                withdrawal,
                deposit,
                balance: row['Closing Balance'] || 0,
                month: monthLabel,
                amount,
                type,
                bucket,
                day: date.getDate(),
                weekday: weekdays[date.getDay()],
                isWeekend: [0, 6].includes(date.getDay()),
                yearMonth: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
              };
            }).filter(t => !isNaN(t.date.getTime()));

          this.transactions.set(processedData);
          this.isLoading.set(false);
          resolve();
        } catch (error) {
          this.isLoading.set(false);
          reject(error);
        }
      };
      reader.onerror = (error) => {
        this.isLoading.set(false);
        reject(error);
      };
      reader.readAsArrayBuffer(file);
    });
  }

  getStatsForPeriod(filteredTransactions: Transaction[]): BudgetStats {
    const totalIncome = filteredTransactions
      .filter(t => t.type === 'Income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = filteredTransactions
      .filter(t => t.type === 'Expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const actualNeeds = filteredTransactions
      .filter(t => t.bucket === 'Needs')
      .reduce((sum, t) => sum + t.amount, 0);

    const actualWants = filteredTransactions
      .filter(t => t.bucket === 'Wants')
      .reduce((sum, t) => sum + t.amount, 0);

    const actualSavings = filteredTransactions
      .filter(t => t.bucket === 'Savings')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSavings = actualSavings; // Savings bucket

    return {
      totalIncome,
      totalExpenses,
      totalSavings,
      netFlow: totalIncome - totalExpenses,
      actualNeeds,
      actualWants,
      actualSavings,
      needsRatio: totalIncome > 0 ? (actualNeeds / totalIncome) * 100 : 0,
      wantsRatio: totalIncome > 0 ? (actualWants / totalIncome) * 100 : 0,
      savingsRatio: totalIncome > 0 ? (actualSavings / totalIncome) * 100 : 0
    };
  }

  downloadTemplate() {
    const headers = [
      'Date', 'Narration', 'Category', 'Sub Category',
      'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance'
    ];
    const sampleData = [
      ['2025-04-01', 'Salary Crédit', 'Income', 'Salary', 0, 100000, 100000],
      ['2025-04-02', 'Monthly Rent', 'Need', 'Housing', 40000, 0, 60000],
      ['2025-04-05', 'Dining Out', 'Want', 'Food', 10000, 0, 50000],
      ['2025-04-10', 'Emergency Fund', 'Saving', 'Safety', 5000, 0, 45000],
      ['2025-04-15', 'Internal Transfer', 'Ignore', 'Transfer', 5000, 0, 40000]
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Spendora_Finance_Template.xlsx');
  }
}
