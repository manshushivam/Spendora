import { Component, computed, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService, Transaction, BudgetStats } from '../../data.service';
import ApexCharts from 'apexcharts';
import {
  LucideAngularModule,
  Upload,
  TrendingUp,
  TrendingDown,
  Wallet,
  ShieldCheck,
  ArrowUpRight,
  AlertCircle,
  Filter,
  Search,
  Download,
  Check
} from 'lucide-angular';

export interface BudgetStrategy {
  id: string;
  name: string;
  description: string;
  needs: number;
  wants: number;
  savings: number;
}

const BUDGET_STRATEGIES: BudgetStrategy[] = [
  { id: '50-30-20', name: 'Standard (50/30/20)', description: 'Balanced approach for most people.', needs: 50, wants: 30, savings: 20 },
  { id: '60-20-20', name: 'Professional (60/20/20)', description: 'Best for high rent/fixed costs.', needs: 60, wants: 20, savings: 20 },
  { id: '70-20-10', name: 'Survival (70/20/10)', description: 'For high responsibility/low income phases.', needs: 70, wants: 20, savings: 10 },
  { id: '60-30-10', name: 'Starter (60/30/10)', description: 'Softer discipline for beginners.', needs: 60, wants: 30, savings: 10 },
  { id: '40-30-30', name: 'Aggressive (40/30/30)', description: 'For fast wealth building/low fixed costs.', needs: 40, wants: 30, savings: 30 },
];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent {
  private dataService = inject(DataService);

  // State
  selectedMonths = signal<string[]>(['All']);
  selectedCategories = signal<string[]>(['All']);

  strategies = BUDGET_STRATEGIES;
  selectedStrategy = signal<BudgetStrategy>(
    BUDGET_STRATEGIES.find(s => s.id === localStorage.getItem('spendora_strategy')) || BUDGET_STRATEGIES[0]
  );

  // Icons
  icons = {
    Upload, TrendingUp, TrendingDown, Wallet, ShieldCheck, ArrowUpRight, AlertCircle, Filter, Search, Download, Check
  };

  // Derived Data
  transactions = this.dataService.transactions;
  isLoading = this.dataService.isLoading;

  availableMonths = computed(() => {
    const months = new Set(this.transactions().map(t => t.month));
    return ['All', ...Array.from(months)];
  });

  availableCategories = computed(() => {
    const cats = new Set(this.transactions().map(t => t.category));
    return ['All', ...Array.from(cats)];
  });

  chronologicalMonths = computed(() => {
    const months = new Set(this.transactions().map(t => t.month));
    const sorted = Array.from(months).sort((a,b) => {
      const d1 = new Date(a);
      const d2 = new Date(b);
      return d1.getTime() - d2.getTime();
    });
    return sorted;
  });

  latestMonthStats = computed(() => {
    const months = this.chronologicalMonths();
    if (months.length === 0) return null;
    const latest = months[months.length - 1];
    const trans = this.transactions().filter(t => t.month === latest);
    return {
      month: latest,
      stats: this.dataService.getStatsForPeriod(trans)
    };
  });

  previousMonthStats = computed(() => {
    const months = this.chronologicalMonths();
    if (months.length < 2) return null;
    const prev = months[months.length - 2];
    const trans = this.transactions().filter(t => t.month === prev);
    return {
      month: prev,
      stats: this.dataService.getStatsForPeriod(trans)
    };
  });

  growthMetrics = computed(() => {
    const latest = this.latestMonthStats();
    const prev = this.previousMonthStats();
    if (!latest || !prev) return null;

    const calcDelta = (curr: number, p: number) => {
      if (p === 0) return curr > 0 ? 100 : 0;
      return ((curr - p) / p) * 100;
    };

    return {
      income: {
        delta: calcDelta(latest.stats.totalIncome, prev.stats.totalIncome),
        isFavorable: latest.stats.totalIncome >= prev.stats.totalIncome
      },
      needs: {
        delta: calcDelta(latest.stats.actualNeeds, prev.stats.actualNeeds),
        isFavorable: latest.stats.actualNeeds <= prev.stats.actualNeeds
      },
      wants: {
        delta: calcDelta(latest.stats.actualWants, prev.stats.actualWants),
        isFavorable: latest.stats.actualWants <= prev.stats.actualWants
      },
      savings: {
        delta: calcDelta(latest.stats.actualSavings, prev.stats.actualSavings),
        isFavorable: latest.stats.actualSavings >= prev.stats.actualSavings
      }
    };
  });

  filteredTransactions = computed(() => {
    return this.transactions()
      .filter(t => {
        const monthMatch = this.selectedMonths().includes('All') || this.selectedMonths().includes(t.month);
        const catMatch = this.selectedCategories().includes('All') || this.selectedCategories().includes(t.category);
        return monthMatch && catMatch;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  });

  stats = computed<BudgetStats>(() => {
    return this.dataService.getStatsForPeriod(this.filteredTransactions());
  });

  // Chart Options
  budgetChartOptions: any = {
    series: [],
    chart: { type: 'bar', height: 280, toolbar: { show: false } },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '60%',
        borderRadius: 4
      }
    },
    colors: ['#3b82f6'], // Actual color
    stroke: {
      width: 2,
      colors: ['#3b82f6'] // Actual border
    },
    fill: {
      opacity: 0.6, // Transparent front
      type: 'solid'
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: ['Needs', 'Wants', 'Savings'],
      axisBorder: { show: false }
    },
    yaxis: {
      max: 100,
      labels: {
        formatter: (val: number) => val + '%'
      }
    },
    legend: { show: true, position: 'top' },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val: number) => val + '%'
      }
    }
  };

  trendChartOptions: any = {
    series: [],
    chart: { type: 'area', height: 300, toolbar: { show: false }, zoom: { enabled: false } },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: { categories: [] },
    yaxis: {
      labels: {
        formatter: (val: number) => Math.round(val).toLocaleString()
      }
    },
    tooltip: { x: { format: 'dd MMM' } },
    colors: ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'] // Income, Need, Want, Saving
  };

  performanceChartOptions: any = {
    series: [],
    chart: { type: 'line', height: 300, toolbar: { show: false }, zoom: { enabled: false } },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3, dashArray: [0, 0, 0] },
    xaxis: { categories: [] },
    yaxis: {
      min: 0,
      max: 100,
      labels: {
        formatter: (val: number) => Math.round(val) + '%'
      }
    },
    colors: ['#ef4444', '#f59e0b', '#3b82f6'], // Need, Want, Saving
    annotations: {
      yaxis: [] // Dynamic goals
    },
    legend: { position: 'top' }
  };

  categoryChartOptions: any = {
    series: [],
    chart: { type: 'donut', height: 300 },
    labels: [],
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
    legend: { position: 'bottom' }
  };

  // Computed Chart Data
  budgetSeries = computed(() => {
    const s = this.stats();
    const strat = this.selectedStrategy();
    return [
      {
        name: 'Actual Spending',
        data: [
          {
            x: 'Needs',
            y: Math.round(s.needsRatio),
            goals: [{ name: `${strat.needs}% Target`, value: strat.needs, strokeHeight: 5, strokeColor: '#94a3b8' }]
          },
          {
            x: 'Wants',
            y: Math.round(s.wantsRatio),
            goals: [{ name: `${strat.wants}% Target`, value: strat.wants, strokeHeight: 5, strokeColor: '#94a3b8' }]
          },
          {
            x: 'Savings',
            y: Math.round(s.savingsRatio),
            goals: [{ name: `${strat.savings}% Target`, value: strat.savings, strokeHeight: 5, strokeColor: '#94a3b8' }]
          }
        ]
      }
    ];
  });

  categorySeries = computed(() => {
    const transactions = this.filteredTransactions().filter(t => t.type === 'Expense');
    const catMap = new Map<string, number>();
    transactions.forEach(t => {
      catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount);
    });
    const sorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return {
      series: sorted.map(i => i[1]),
      labels: sorted.map(i => i[0]),
      legend: this.categoryChartOptions.legend
    };
  });

  trendData = computed(() => {
    const transactions = this.filteredTransactions();
    const monthMap = new Map<string, { income: number, needs: number, wants: number, savings: number }>();

    // Sort transactions by date for trend
    const sorted = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

    sorted.forEach(t => {
      const m = t.month;
      if (!monthMap.has(m)) monthMap.set(m, { income: 0, needs: 0, wants: 0, savings: 0 });
      const stats = monthMap.get(m)!;
      if (t.type === 'Income') stats.income += t.amount;
      else {
        if (t.bucket === 'Needs') stats.needs += t.amount;
        else if (t.bucket === 'Wants') stats.wants += t.amount;
        else if (t.bucket === 'Savings') stats.savings += t.amount;
      }
    });

    const labels = Array.from(monthMap.keys());
    return {
      labels,
      income: labels.map(l => monthMap.get(l)!.income),
      needs: labels.map(l => monthMap.get(l)!.needs),
      wants: labels.map(l => monthMap.get(l)!.wants),
      savings: labels.map(l => monthMap.get(l)!.savings)
    };
  });

  performanceData = computed(() => {
    const data = this.trendData();
    const strat = this.selectedStrategy();

    // Convert absolute values to percentages of income for each month
    return {
      labels: data.labels,
      needsPerc: data.income.map((inc, i) => inc > 0 ? (data.needs[i] / inc) * 100 : 0),
      wantsPerc: data.income.map((inc, i) => inc > 0 ? (data.wants[i] / inc) * 100 : 0),
      savingsPerc: data.income.map((inc, i) => inc > 0 ? (data.savings[i] / inc) * 100 : 0)
    };
  });

  likelyStrategy = computed(() => {
    const s = this.stats();
    if (s.totalIncome === 0) return null;

    let bestMatch = BUDGET_STRATEGIES[0];
    let minError = Infinity;

    BUDGET_STRATEGIES.forEach(strat => {
      // Statistical Least Squared Error to find the closest match
      const error =
        Math.pow(s.needsRatio - strat.needs, 2) +
        Math.pow(s.wantsRatio - strat.wants, 2) +
        Math.pow(s.savingsRatio - strat.savings, 2);

      if (error < minError) {
        minError = error;
        bestMatch = strat;
      }
    });

    return bestMatch;
  });

  private budgetChart?: ApexCharts;
  private trendChart?: ApexCharts;
  private performanceChart?: ApexCharts;
  private categoryChart?: ApexCharts;

  private initCharts() {
    this.renderBudgetChart();
    this.renderTrendChart();
    this.renderPerformanceChart();
    this.renderCategoryChart();
  }

  private renderBudgetChart() {
    const el = document.querySelector('#budget-chart') as HTMLElement;
    if (!el) return;
    if (this.budgetChart) this.budgetChart.destroy();

    this.budgetChart = new ApexCharts(el, {
      ...this.budgetChartOptions,
      series: this.budgetSeries()
    });
    this.budgetChart.render();
  }

  private renderTrendChart() {
    const el = document.querySelector('#trend-chart') as HTMLElement;
    if (!el) return;
    if (this.trendChart) this.trendChart.destroy();

    const data = this.trendData();
    this.trendChart = new ApexCharts(el, {
      ...this.trendChartOptions,
      series: [
        { name: 'Income', data: data.income },
        { name: 'Need', data: data.needs },
        { name: 'Want', data: data.wants },
        { name: 'Saving', data: data.savings }
      ],
      xaxis: { categories: data.labels }
    });
    this.trendChart.render();
  }

  private renderPerformanceChart() {
    const el = document.querySelector('#performance-chart') as HTMLElement;
    if (!el) return;
    if (this.performanceChart) this.performanceChart.destroy();

    const data = this.performanceData();
    const strat = this.selectedStrategy();

    this.performanceChart = new ApexCharts(el, {
      ...this.performanceChartOptions,
      series: [
        { name: 'Need (%)', data: data.needsPerc },
        { name: 'Want (%)', data: data.wantsPerc },
        { name: 'Saving (%)', data: data.savingsPerc }
      ],
      annotations: {
        yaxis: [
          { y: strat.needs, borderColor: '#ef4444', label: { text: `Target Need (${strat.needs}%)`, style: { color: '#fff', background: '#ef4444' } } },
          { y: strat.wants, borderColor: '#f59e0b', label: { text: `Target Want (${strat.wants}%)`, style: { color: '#fff', background: '#f59e0b' } } },
          { y: strat.savings, borderColor: '#3b82f6', label: { text: `Target Saving (${strat.savings}%)`, style: { color: '#fff', background: '#3b82f6' } } }
        ]
      },
      xaxis: { categories: data.labels }
    });
    this.performanceChart.render();
  }

  private renderCategoryChart() {
    const el = document.querySelector('#category-chart') as HTMLElement;
    if (!el) return;
    if (this.categoryChart) this.categoryChart.destroy();

    const data = this.categorySeries();
    this.categoryChart = new ApexCharts(el, {
      ...this.categoryChartOptions,
      series: data.series,
      labels: data.labels
    });
    this.categoryChart.render();
  }

  // Update effect to refresh charts
  private chartEffect = effect(() => {
    // Access signals to trigger effect
    this.stats();
    this.filteredTransactions();
    this.selectedStrategy();

    // Use timeout to ensure DOM is ready
    setTimeout(() => this.initCharts(), 0);
  });

  onFileUpload(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.dataService.parseExcel(file).catch(err => {
        console.error('Error parsing file:', err);
        alert('Failed to parse Excel file. Please ensure it matches the required format.');
      });
    }
  }

  toggleMonth(month: string) {
    const current = this.selectedMonths();
    if (month === 'All') {
      this.selectedMonths.set(['All']);
    } else {
      let next = current.filter(m => m !== 'All');
      if (next.includes(month)) {
        next = next.filter(m => m !== month);
      } else {
        next.push(month);
      }
      if (next.length === 0) next = ['All'];
      this.selectedMonths.set(next);
    }
  }

  setStrategy(strategy: BudgetStrategy) {
    this.selectedStrategy.set(strategy);
    localStorage.setItem('spendora_strategy', strategy.id);
  }

  toggleCategory(cat: string) {
    const current = this.selectedCategories();
    if (cat === 'All') {
      this.selectedCategories.set(['All']);
    } else {
      let next = current.filter(c => c !== 'All');
      if (next.includes(cat)) {
        next = next.filter(c => c !== cat);
      } else {
        next.push(cat);
      }
      if (next.length === 0) next = ['All'];
      this.selectedCategories.set(next);
    }
  }

  onSearch(event: any) {
    // Search removed as per user request
  }

  downloadTemplate() {
    this.dataService.downloadTemplate();
  }

  formatCurrency(val: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  }
}
