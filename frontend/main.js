const API_BASE = "http://localhost:8000";

// --- Global Variables ---
let map;
let markers = [];
let lineChart, donutChart;
let sessionId = "session-" + Math.random().toString(36).substr(2, 9);

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([
    fetchDashboard(),
    fetchForecast(),
    fetchInventory(),
    fetchOrders(),
    initChartsAndMap()
  ]);
});

// --- Navigation ---
window.switchView = function(viewId) {
  // Hide all views
  document.querySelectorAll('.page-view').forEach(el => {
    el.classList.add('hidden');
    el.classList.remove('block');
  });
  
  // Show target view
  document.getElementById('view-' + viewId).classList.remove('hidden');
  document.getElementById('view-' + viewId).classList.add('block');
  
  // Update Nav styling
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.remove('bg-turquoise-600/20', 'text-turquoise-500');
    el.classList.add('hover:bg-slate-800', 'hover:text-white');
  });
  
  const activeNav = document.getElementById('nav-' + viewId);
  activeNav.classList.add('bg-turquoise-600/20', 'text-turquoise-500');
  activeNav.classList.remove('hover:bg-slate-800', 'hover:text-white');
  
  // Update Topbar Title
  const titles = {
    'dashboard': 'Genel Bakış',
    'orders': 'Sipariş Yönetimi',
    'inventory': 'Stok Yönetimi'
  };
  document.getElementById('topbar-title').innerText = titles[viewId];
};

window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('-ml-64');
};

// --- API Calls ---
async function fetchDashboard() {
  try {
    const res = await fetch(`${API_BASE}/dashboard`);
    const data = await res.json();
    
    document.getElementById("metric-orders").innerText = data.today_orders;
    document.getElementById("metric-revenue").innerText = `₺${data.today_revenue}`;
    document.getElementById("metric-pending").innerText = data.pending_orders;
    document.getElementById("metric-stock").innerText = data.low_stock_count;
  } catch (error) {
    console.error("Dashboard error:", error);
  }
}

async function fetchForecast() {
  try {
    const res = await fetch(`${API_BASE}/forecast`);
    const data = await res.json();
    
    document.getElementById("forecast-msg").innerText = data.forecast_message;
    document.getElementById("forecast-val").innerText = data.forecast_orders;
    document.getElementById("forecast-growth").innerText = "+" + data.growth;
  } catch (error) {
    console.error("Forecast error:", error);
  }
}

async function fetchInventory() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    const data = await res.json();
    
    const tbody = document.getElementById("inventory-tbody");
    tbody.innerHTML = "";
    
    const lowStockItems = data.filter(item => item.low);
    
    if (lowStockItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-slate-400">Kritik stokta ürün bulunmuyor.</td></tr>`;
      return;
    }
    
    lowStockItems.forEach(item => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50 transition-colors";
      tr.innerHTML = `
        <td class="px-6 py-4 font-medium text-slate-800">${item.name}</td>
        <td class="px-6 py-4">${item.category}</td>
        <td class="px-6 py-4">
          <span class="font-semibold ${item.stock <= item.min_stock / 2 ? 'text-red-600' : 'text-orange-500'}">${item.stock} ${item.unit}</span>
          <span class="text-xs text-slate-400 ml-1">/ Min: ${item.min_stock}</span>
        </td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            Kritik
          </span>
        </td>
        <td class="px-6 py-4 text-right">
          <button onclick="openEmailModal('${item.name}')" class="text-xs bg-white border border-gray-200 shadow-sm hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors flex items-center inline-flex">
            <i class="ph ph-envelope-simple text-turquoise-500 mr-1.5"></i> Tedarikçi Email
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Inventory error:", error);
  }
}

let globalOrders = [];
async function fetchOrders() {
  try {
    const res = await fetch(`${API_BASE}/orders?limit=100`);
    globalOrders = await res.json();
    
    const tbody = document.getElementById("orders-tbody");
    tbody.innerHTML = "";
    
    globalOrders.forEach(order => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-slate-50 transition-colors";
      
      let statusColor = "bg-blue-100 text-blue-800";
      if (order.status === "beklemede") statusColor = "bg-orange-100 text-orange-800";
      if (order.status === "teslim edildi") statusColor = "bg-emerald-100 text-emerald-800";
      
      tr.innerHTML = `
        <td class="px-6 py-4 font-medium text-slate-800">#${order.id}</td>
        <td class="px-6 py-4">${order.customer}</td>
        <td class="px-6 py-4">${order.product} <span class="text-xs text-slate-400">x${order.quantity}</span></td>
        <td class="px-6 py-4 font-semibold">₺${order.total}</td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor} uppercase">
            ${order.status}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Orders error:", error);
  }
}

async function initChartsAndMap() {
  try {
    // Analytics for Charts
    const analyticsRes = await fetch(`${API_BASE}/analytics`);
    const analytics = await analyticsRes.json();
    
    // Line Chart
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    const labels = analytics.daily_traffic.map(d => d.date.split('-').slice(1).join('/'));
    const dataPoints = analytics.daily_traffic.map(d => d.orders);
    
    lineChart = new Chart(ctxLine, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Siparişler',
          data: dataPoints,
          borderColor: '#0d9488',
          backgroundColor: 'rgba(13, 148, 136, 0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { borderDash: [2, 4], color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });

    // Donut Chart
    const ctxDonut = document.getElementById('donutChart').getContext('2d');
    const donutLabels = Object.keys(analytics.status_distribution);
    const donutData = Object.values(analytics.status_distribution);
    
    donutChart = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: donutLabels,
        datasets: [{
          data: donutData,
          backgroundColor: ['#0d9488', '#f97316', '#3b82f6', '#10b981'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } }
        }
      }
    });

    // Map (Leaflet)
    const mapCenter = [39.0, 35.0]; // Turkey center roughly
    map = L.map('map').setView(mapCenter, 5);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    // Put orders on map (using the globally fetched orders)
    globalOrders.forEach(order => {
      if (order.lat && order.lng) {
        let color = "#3b82f6"; // blue default
        if (order.status === "beklemede") color = "#f97316"; // orange
        if (order.status === "teslim edildi") color = "#10b981"; // green
        
        const circle = L.circleMarker([order.lat, order.lng], {
          radius: 6,
          fillColor: color,
          color: "#fff",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(map);
        
        circle.bindPopup(`
          <div class="font-sans">
            <strong class="text-slate-800">Sipariş #${order.id}</strong><br>
            <span class="text-sm text-slate-500">${order.product}</span><br>
            <span class="text-xs uppercase font-bold" style="color: ${color}">${order.status}</span>
          </div>
        `);
      }
    });

  } catch (error) {
    console.error("Charts/Map init error:", error);
  }
}

// --- Chat Widget ---
window.handleChatSubmit = async function(e) {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();
  if (!msg) return;
  
  input.value = "";
  appendMessage("user", msg);
  
  const loadingId = appendMessage("assistant", "Düşünüyor...");
  
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, session_id: sessionId })
    });
    const data = await res.json();
    
    updateMessage(loadingId, data.response);
    
    // Simple UI triggers based on response
    if (data.response.toLowerCase().includes("stok") && data.response.toLowerCase().includes("kritik")) {
      switchView('inventory');
    } else if (data.response.toLowerCase().includes("sipariş")) {
      switchView('orders');
    }
  } catch (error) {
    updateMessage(loadingId, "Bağlantı hatası oluştu.");
  }
};

function appendMessage(role, text) {
  const msgId = "msg-" + Date.now();
  const container = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.id = msgId;
  div.className = `chat-message ${role === 'user' ? 'chat-user' : 'chat-assistant'}`;
  div.innerText = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return msgId;
}

function updateMessage(id, text) {
  const div = document.getElementById(id);
  if (div) {
    div.innerText = text;
    const container = document.getElementById("chat-messages");
    container.scrollTop = container.scrollHeight;
  }
}

// --- Modal & Email ---
window.openEmailModal = async function(productName) {
  const modal = document.getElementById("email-modal");
  const content = document.getElementById("email-modal-content");
  const loading = document.getElementById("email-loading");
  const textarea = document.getElementById("email-textarea");
  const btnCopy = document.getElementById("btn-copy");
  
  modal.classList.remove("hidden");
  setTimeout(() => { modal.classList.remove("opacity-0"); content.classList.remove("scale-95"); }, 10);
  
  loading.classList.remove("hidden");
  textarea.classList.add("hidden");
  btnCopy.classList.add("hidden");
  textarea.value = "";
  
  try {
    const res = await fetch(`${API_BASE}/generate-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_name: productName, quantity: 50 })
    });
    const data = await res.json();
    
    textarea.value = data.action_text;
    
    loading.classList.add("hidden");
    textarea.classList.remove("hidden");
    btnCopy.classList.remove("hidden");
  } catch (error) {
    loading.innerHTML = `<p class="text-red-500 py-4">Hata: Email taslağı oluşturulamadı.</p>`;
  }
};

window.closeModal = function() {
  const modal = document.getElementById("email-modal");
  const content = document.getElementById("email-modal-content");
  modal.classList.add("opacity-0");
  content.classList.add("scale-95");
  setTimeout(() => { modal.classList.add("hidden"); }, 300);
};

window.copyEmail = function() {
  const textarea = document.getElementById("email-textarea");
  textarea.select();
  document.execCommand("copy");
  const btn = document.getElementById("btn-copy");
  const originalHtml = btn.innerHTML;
  btn.innerHTML = `<i class="ph ph-check mr-2"></i> Kopyalandı`;
  btn.classList.replace("bg-turquoise-500", "bg-emerald-500");
  setTimeout(() => {
    btn.innerHTML = originalHtml;
    btn.classList.replace("bg-emerald-500", "bg-turquoise-500");
  }, 2000);
};
