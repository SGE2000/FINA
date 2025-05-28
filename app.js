/* =========================================================================
   Personal Expense Tracker
   Author: ChatGPT
   ========================================================================*/

/* === Constants === */
const STORAGE_KEY = 'expenseTrackerData';
const DEFAULT_CATEGORIES = [
  'food',
  'transport',
  'entertainment',
  'home',
  'health',
  'education',
  'other',
];

/* === Helper functions === */
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => scope.querySelectorAll(selector);

/* === Models === */
class Transaction {
  constructor({ id, type, amount, description, category, date }) {
    this.id = id ?? crypto.randomUUID();
    this.type = type; // 'income' | 'expense'
    this.amount = Number(amount);
    this.description = description;
    this.category = category;
    this.date = new Date(date);
  }
}

class Budget {
  constructor(category, limit = 0) {
    this.category = category;
    this.limit = limit;
  }
}

/* === Storage === */
class Storage {
  static load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { transactions: [], budgets: [] };
    const data = JSON.parse(raw);
    data.transactions = data.transactions.map((t) => new Transaction(t));
    return data;
  }

  static save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  static clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/* === State === */
const state = {
  transactions: [],
  budgets: [],
};

/* === UI === */
class UI {
  static init() {
    // Populate year
    $('#year').textContent = new Date().getFullYear();

    // Theme toggle
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) document.documentElement.setAttribute('data-theme', storedTheme);
    $('#theme-toggle').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', current);
      localStorage.setItem('theme', current);
    });

    // Load data
    const data = Storage.load();
    state.transactions = data.transactions;
    state.budgets = data.budgets;

    // Render
    UI.renderTransactions();
    UI.renderSummary();
    UI.renderCharts();

    // Event listeners
    UI.bindEvents();
  }

  static bindEvents() {
    // Add transaction
    $('#transaction-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const transaction = new Transaction({
        type: formData.get('type'),
        amount: formData.get('amount'),
        description: formData.get('description'),
        category: formData.get('category'),
        date: formData.get('date'),
      });
      state.transactions.push(transaction);
      Storage.save(state);
      e.target.reset();
      UI.renderTransactions();
      UI.renderSummary();
      UI.renderCharts();
    });

    // Filters
    $('#filter-form').addEventListener('submit', (e) => {
      e.preventDefault();
      UI.renderTransactions();
    });

    // Export
    $('#export-btn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `expense-tracker-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });

    // Import
    $('#import-btn').addEventListener('click', () => $('#import-input').click());
    $('#import-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        state.transactions = data.transactions.map((t) => new Transaction(t));
        state.budgets = data.budgets ?? [];
        Storage.save(state);
        UI.renderTransactions();
        UI.renderSummary();
        UI.renderCharts();
      } catch (err) {
        alert('Invalid file');
      } finally {
        e.target.value = '';
      }
    });

    // Clear all
    $('#clear-btn').addEventListener('click', () => {
      if (confirm('Are you sure you want to delete all data?')) {
        Storage.clear();
        state.transactions = [];
        state.budgets = [];
        UI.renderTransactions();
        UI.renderSummary();
        UI.renderCharts();
      }
    });
  }

  /* === Renderers === */
  static renderTransactions() {
    const list = $('#transaction-list');
    list.innerHTML = '';

    const periodFilter = $('#filter-period').value;
    const categoryFilter = $('#filter-category').value;

    const filtered = state.transactions.filter((t) => {
      let periodMatch = true;
      const today = new Date();
      switch (periodFilter) {
        case 'today':
          periodMatch =
            t.date.toDateString() === today.toDateString();
          break;
        case 'week': {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          periodMatch = t.date >= startOfWeek;
          break;
        }
        case 'month':
          periodMatch =
            t.date.getMonth() === today.getMonth() &&
            t.date.getFullYear() === today.getFullYear();
          break;
        default:
          periodMatch = true;
      }

      const categoryMatch = categoryFilter === 'all' ? true : t.category === categoryFilter;

      return periodMatch && categoryMatch;
    });

    filtered
      .sort((a, b) => b.date - a.date)
      .forEach((t) => {
        const li = document.createElement('li');
        li.className = `transaction-item ${t.type}`;
        li.innerHTML = `
          <div class="info">
            <strong>${t.description}</strong><br />
            <small>${t.category} | ${t.date.toLocaleDateString()}</small>
          </div>
          <div class="amount">${t.type === 'expense' ? '-' : '+'}${t.amount.toFixed(2)}</div>
        `;
        list.appendChild(li);
      });
  }

  static renderSummary() {
    const cards = $('#summary-cards');
    cards.innerHTML = '';

    const totalIncome = state.transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = state.transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;

    const summaryData = [
      { label: 'Income', value: totalIncome.toFixed(2) },
      { label: 'Expenses', value: totalExpense.toFixed(2) },
      { label: 'Balance', value: balance.toFixed(2) },
    ];

    summaryData.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'summary-card';
      card.innerHTML = `<h3>${item.label}</h3><p>${item.value}</p>`;
      cards.appendChild(card);
    });
  }

  static renderCharts() {
    /* Simple pie and bar charts using Canvas API (no external libs) */
    drawPieChart(
      $('#pie-chart'),
      getCategoryTotals(state.transactions.filter((t) => t.type === 'expense'))
    );
    drawBarChart(
      $('#bar-chart'),
      ['Income', 'Expense'],
      [
        state.transactions
          .filter((t) => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0),
        state.transactions
          .filter((t) => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0),
      ]
    );
  }
}

/* === Chart Helpers === */
function getRandomColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
}

/**
 * Draws a simple pie chart.
 * @param {HTMLCanvasElement} canvas
 * @param {Record<string, number>} data
 */
function drawPieChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const total = Object.values(data).reduce((sum, v) => sum + v, 0);
  let start = 0;
  const radius = Math.min(canvas.width, canvas.height) / 2 - 10;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  Object.entries(data).forEach(([label, value]) => {
    const slice = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, canvas.height / 2);
    ctx.arc(canvas.width / 2, canvas.height / 2, radius, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = getRandomColor();
    ctx.fill();
    start += slice;
  });
}

/**
 * Draws a simple bar chart.
 * @param {HTMLCanvasElement} canvas
 * @param {string[]} labels
 * @param {number[]} values
 */
function drawBarChart(canvas, labels, values) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const maxValue = Math.max(...values);
  const barWidth = canvas.width / labels.length / 1.5;
  labels.forEach((label, i) => {
    const barHeight = (values[i] / maxValue) * (canvas.height - 30);
    const x = i * canvas.width / labels.length + (canvas.width / labels.length - barWidth) / 2;
    const y = canvas.height - barHeight;
    ctx.fillStyle = getRandomColor();
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = 'currentColor';
    ctx.textAlign = 'center';
    ctx.font = 'bold 12px Inter';
    ctx.fillText(label, x + barWidth / 2, canvas.height - 5);
  });
}

/* === Utilities === */
function getCategoryTotals(transactions) {
  return transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});
}

/* === Initialize === */
document.addEventListener('DOMContentLoaded', UI.init);