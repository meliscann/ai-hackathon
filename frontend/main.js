const API_BASE = "http://localhost:8000";

// ── Global state ──────────────────────────────────────────────────────────────
let map;
let lineChart, donutChart;
let sessionId = "session-" + Math.random().toString(36).substr(2, 9);
let globalOrders = [];
let globalProducts = [];

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initWebSocket();
  await Promise.all([
    fetchDashboard(),
    fetchForecast(),
    fetchInventory(),
    fetchOrders(),
    fetchCustomers(),
    initChartsAndMap(),
  ]);
  proactiveGreeting();
  initOrderFilters();
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
function initWebSocket() {
  const ws = new WebSocket("ws://localhost:8000/ws");
  const dot   = document.getElementById("ws-dot");
  const label = document.getElementById("ws-label");

  ws.onopen = () => {
    dot.className   = "w-2 h-2 rounded-full bg-emerald-400";
    label.textContent = "Canlı";
  };
  ws.onclose = () => {
    dot.className   = "w-2 h-2 rounded-full bg-slate-400";
    label.textContent = "Bağlantı kesildi";
    // yeniden bağlanmayı dene
    setTimeout(initWebSocket, 5000);
  };
  ws.onerror = () => {
    dot.className = "w-2 h-2 rounded-full bg-red-400";
  };
  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    handleWsMessage(msg);
  };
}

function handleWsMessage(msg) {
  if (msg.type === "order_update") {
    showToast(msg.message, "info");
    // Tablodaki ilgili satırı anlık güncelle
    updateOrderRowStatus(msg.order_id, msg.status);
    fetchDashboard();
  } else if (msg.type === "low_stock") {
    showToast(msg.message, "warning");
    fetchInventory();
    fetchDashboard();
  } else if (msg.type === "product_added") {
    showToast(msg.message, "success");
    fetchInventory();
    fetchDashboard();
  } else if (msg.type === "product_deleted") {
    fetchInventory();
    fetchDashboard();
  }
}

// ── Toast sistemi ─────────────────────────────────────────────────────────────
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const colors = {
    info:    "bg-blue-600",
    success: "bg-emerald-600",
    warning: "bg-amber-500",
    error:   "bg-red-600",
  };
  const icons = {
    info:    "ph-info",
    success: "ph-check-circle",
    warning: "ph-warning",
    error:   "ph-x-circle",
  };

  const toast = document.createElement("div");
  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium max-w-sm ${colors[type]} translate-x-full opacity-0 transition-all duration-300`;
  toast.innerHTML = `<i class="ph ${icons[type]} text-lg shrink-0"></i><span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove("translate-x-full", "opacity-0");
  });

  setTimeout(() => {
    toast.classList.add("translate-x-full", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── Proaktif AI Selamlama ─────────────────────────────────────────────────────
async function proactiveGreeting() {
  appendMessage("assistant", "Merhaba! Ben KOBİ Pilot Asistanınız. Operasyon durumunuzu kontrol ediyorum...");
  const loadingId = appendMessage("assistant", "Analiz yapılıyor...");
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Günlük özet ve varsa kritik uyarıları kısaca paylaş. 3-4 cümleyi geçme.",
        session_id: sessionId,
      }),
    });
    const data = await res.json();
    updateMessage(loadingId, data.response);
    // Eğer kritik stok varsa stok paneline yönlendirme öner
    if (data.response.includes("kritik") || data.response.includes("Kritik")) {
      offerNavigation("inventory", "Stok panelini görmek ister misiniz?");
    }
  } catch {
    updateMessage(loadingId, "Sunucuya bağlanılamadı. Backend'in çalıştığından emin olun.");
  }
}

function offerNavigation(view, text) {
  const container = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = "flex gap-2 mt-1";
  div.innerHTML = `
    <button onclick="switchView('${view}'); this.closest('.flex').remove()"
      class="text-xs px-3 py-1.5 bg-turquoise-500 text-white rounded-lg hover:bg-turquoise-600 transition-colors">
      ${text}
    </button>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ── Navigation ────────────────────────────────────────────────────────────────
window.switchView = function (viewId) {
  document.querySelectorAll(".page-view").forEach((el) => {
    el.classList.add("hidden");
    el.classList.remove("block");
  });
  document.getElementById("view-" + viewId).classList.remove("hidden");
  document.getElementById("view-" + viewId).classList.add("block");

  document.querySelectorAll(".nav-link").forEach((el) => {
    el.classList.remove("bg-turquoise-600/20", "text-turquoise-500");
    el.classList.add("hover:bg-slate-800", "hover:text-white");
  });
  const activeNav = document.getElementById("nav-" + viewId);
  activeNav.classList.add("bg-turquoise-600/20", "text-turquoise-500");
  activeNav.classList.remove("hover:bg-slate-800", "hover:text-white");

  const titles = {
    dashboard: "Genel Bakış",
    orders:    "Sipariş Yönetimi",
    inventory: "Stok Yönetimi",
    customers: "Müşteri Segmentasyonu",
  };
  document.getElementById("topbar-title").innerText = titles[viewId] || viewId;
};

window.toggleSidebar = function () {
  document.getElementById("sidebar").classList.toggle("-ml-64");
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function fetchDashboard() {
  try {
    const res  = await fetch(`${API_BASE}/dashboard`);
    const data = await res.json();
    document.getElementById("metric-orders").innerText  = data.today_orders;
    document.getElementById("metric-revenue").innerText = `₺${data.today_revenue}`;
    document.getElementById("metric-pending").innerText = data.pending_orders;
    document.getElementById("metric-stock").innerText   = data.low_stock_count;
  } catch (e) {
    console.error("Dashboard:", e);
  }
}

async function fetchForecast() {
  try {
    const res  = await fetch(`${API_BASE}/forecast`);
    const data = await res.json();
    document.getElementById("forecast-msg").innerText    = data.forecast_message;
    document.getElementById("forecast-val").innerText    = data.forecast_orders;
    document.getElementById("forecast-growth").innerText = "+" + data.growth;
  } catch (e) {
    console.error("Forecast:", e);
  }
}

// ── Inventory ─────────────────────────────────────────────────────────────────
async function fetchInventory() {
  try {
    const res  = await fetch(`${API_BASE}/products`);
    globalProducts = await res.json();
    renderInventory(globalProducts);
  } catch (e) {
    console.error("Inventory:", e);
  }
}

function renderInventory(products) {
  const tbody = document.getElementById("inventory-tbody");
  tbody.innerHTML = "";
  document.getElementById("inventory-total-label").textContent = `${products.length} ürün`;

  products.forEach((item) => {
    const tr = document.createElement("tr");
    tr.className   = "hover:bg-slate-50 transition-colors";
    const isCritical = item.low;
    const pct = Math.min(100, Math.round((item.stock / (item.min_stock * 2 || 1)) * 100));
    const barColor = isCritical ? "bg-red-500" : "bg-emerald-500";

    tr.innerHTML = `
      <td class="px-6 py-4 font-medium text-slate-800">${item.name}</td>
      <td class="px-6 py-4 text-slate-500">${item.category}</td>
      <td class="px-6 py-4">
        <div class="flex items-center gap-2">
          <span class="font-semibold ${isCritical ? "text-red-600" : "text-slate-700"}">${item.stock} ${item.unit}</span>
          <span class="text-xs text-slate-400">/ Min: ${item.min_stock}</span>
        </div>
        <div class="mt-1 w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div class="${barColor} h-full rounded-full" style="width:${pct}%"></div>
        </div>
      </td>
      <td class="px-6 py-4 text-slate-600">₺${item.price}</td>
      <td class="px-6 py-4">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isCritical ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}">
          ${isCritical ? "Kritik" : "Normal"}
        </span>
      </td>
      <td class="px-6 py-4 text-right flex justify-end gap-2">
        <button onclick="openStockModal(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.stock})"
          class="text-xs bg-white border border-gray-200 shadow-sm hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center">
          <i class="ph ph-pencil text-turquoise-500 mr-1.5"></i> Stok
        </button>
        ${isCritical ? `
        <button onclick="openEmailModal('${item.name.replace(/'/g, "\\'")}')"
          class="text-xs bg-white border border-gray-200 shadow-sm hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center">
          <i class="ph ph-envelope-simple text-turquoise-500 mr-1.5"></i> E-posta
        </button>` : ""}
        <button onclick="deleteProduct(${item.id}, '${item.name.replace(/'/g, "\\'")}')"
          class="text-xs bg-white border border-gray-200 shadow-sm hover:bg-red-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center">
          <i class="ph ph-trash text-red-500 mr-1.5"></i> Sil
        </button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ── Orders ─────────────────────────────────────────────────────────────────────
async function fetchOrders() {
  try {
    const res   = await fetch(`${API_BASE}/orders?limit=100`);
    globalOrders = await res.json();
    renderOrders(globalOrders);
  } catch (e) {
    console.error("Orders:", e);
  }
}

function renderOrders(orders) {
  const tbody = document.getElementById("orders-tbody");
  tbody.innerHTML = "";
  document.getElementById("order-count-label").textContent = `${orders.length} sipariş`;

  const statusColors = {
    "beklemede":    "bg-orange-100 text-orange-800",
    "hazırlanıyor": "bg-blue-100 text-blue-800",
    "kargoda":      "bg-violet-100 text-violet-800",
    "teslim edildi":"bg-emerald-100 text-emerald-800",
    "iptal":        "bg-red-100 text-red-800",
  };
  const statuses = ["beklemede", "hazırlanıyor", "kargoda", "teslim edildi", "iptal"];

  orders.forEach((order) => {
    const tr = document.createElement("tr");
    tr.id        = `order-row-${order.id}`;
    tr.className = "hover:bg-slate-50 transition-colors";

    const colorClass = statusColors[order.status] || "bg-gray-100 text-gray-800";
    const options = statuses
      .map((s) => `<option value="${s}" ${s === order.status ? "selected" : ""}>${s}</option>`)
      .join("");

    tr.innerHTML = `
      <td class="px-6 py-4 font-medium text-slate-800">#${order.id}</td>
      <td class="px-6 py-4">${order.customer}</td>
      <td class="px-6 py-4">${order.product} <span class="text-xs text-slate-400">x${order.quantity}</span></td>
      <td class="px-6 py-4 font-semibold">₺${order.total}</td>
      <td class="px-6 py-4">
        <span class="order-status-badge-${order.id} inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}">
          ${order.status}
        </span>
      </td>
      <td class="px-6 py-4 text-right">
        <select onchange="changeOrderStatus(${order.id}, this.value)"
          class="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-turquoise-500 cursor-pointer">
          ${options}
        </select>
      </td>`;
    tbody.appendChild(tr);
  });
}

function updateOrderRowStatus(orderId, newStatus) {
  const badge = document.querySelector(`.order-status-badge-${orderId}`);
  if (!badge) return;
  const colors = {
    "beklemede":    "bg-orange-100 text-orange-800",
    "hazırlanıyor": "bg-blue-100 text-blue-800",
    "kargoda":      "bg-violet-100 text-violet-800",
    "teslim edildi":"bg-emerald-100 text-emerald-800",
    "iptal":        "bg-red-100 text-red-800",
  };
  badge.className = `order-status-badge-${orderId} inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[newStatus] || "bg-gray-100 text-gray-800"}`;
  badge.textContent = newStatus;
}

window.changeOrderStatus = async function (orderId, newStatus) {
  try {
    await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    // WebSocket mesajı zaten badge'i güncelleyecek; fallback olarak local update
    updateOrderRowStatus(orderId, newStatus);
  } catch (e) {
    showToast("Durum güncellenemedi", "error");
  }
};

// ── Order Filters ─────────────────────────────────────────────────────────────
function initOrderFilters() {
  const searchInput  = document.getElementById("order-search");
  const statusSelect = document.getElementById("order-status-filter");

  const applyFilter = () => {
    const q      = searchInput.value.toLowerCase();
    const status = statusSelect.value;
    const filtered = globalOrders.filter((o) => {
      const matchText = !q || o.customer.toLowerCase().includes(q) || o.product.toLowerCase().includes(q);
      const matchStatus = !status || o.status === status;
      return matchText && matchStatus;
    });
    renderOrders(filtered);
  };

  searchInput.addEventListener("input", applyFilter);
  statusSelect.addEventListener("change", applyFilter);
}

// ── Customers ─────────────────────────────────────────────────────────────────
async function fetchCustomers() {
  try {
    const res  = await fetch(`${API_BASE}/customers`);
    const data = await res.json();
    renderCustomers(data);
  } catch (e) {
    console.error("Customers:", e);
  }
}

function renderCustomers(customers) {
  const segCounts = { VIP: 0, Sadık: 0, Yeni: 0 };
  customers.forEach((c) => { if (segCounts[c.segment] !== undefined) segCounts[c.segment]++; });
  document.getElementById("seg-vip").textContent   = segCounts.VIP;
  document.getElementById("seg-loyal").textContent = segCounts.Sadık;
  document.getElementById("seg-new").textContent   = segCounts.Yeni;

  const segColors = {
    VIP:   "bg-amber-100 text-amber-800",
    Sadık: "bg-turquoise-100 text-turquoise-800",
    Yeni:  "bg-blue-100 text-blue-800",
  };

  const tbody = document.getElementById("customers-tbody");
  tbody.innerHTML = "";
  customers.forEach((c) => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition-colors";
    const lastDate = c.last_order ? c.last_order.split(" ")[0] : "-";
    tr.innerHTML = `
      <td class="px-6 py-4 font-medium text-slate-800">${c.name}</td>
      <td class="px-6 py-4 text-slate-500">${c.phone}</td>
      <td class="px-6 py-4">${c.order_count}</td>
      <td class="px-6 py-4 font-semibold">₺${c.total_spent}</td>
      <td class="px-6 py-4 text-slate-500">${lastDate}</td>
      <td class="px-6 py-4">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${segColors[c.segment] || "bg-gray-100 text-gray-800"}">
          ${c.segment === "VIP" ? "👑 " : ""}${c.segment}
        </span>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ── Charts & Map ──────────────────────────────────────────────────────────────
async function initChartsAndMap() {
  try {
    const analyticsRes = await fetch(`${API_BASE}/analytics`);
    const analytics    = await analyticsRes.json();

    // Line Chart
    const ctxLine  = document.getElementById("lineChart").getContext("2d");
    const labels   = analytics.daily_traffic.map((d) => d.date.split("-").slice(1).join("/"));
    const dataPoints = analytics.daily_traffic.map((d) => d.orders);

    lineChart = new Chart(ctxLine, {
      type: "line",
      data: {
        labels,
        datasets: [{ label: "Siparişler", data: dataPoints, borderColor: "#0d9488", backgroundColor: "rgba(13,148,136,0.1)", fill: true, tension: 0.4, borderWidth: 2 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, grid: { borderDash: [2, 4], color: "#f1f5f9" } }, x: { grid: { display: false } } },
      },
    });

    // Donut Chart
    const ctxDonut    = document.getElementById("donutChart").getContext("2d");
    const donutLabels = Object.keys(analytics.status_distribution);
    const donutData   = Object.values(analytics.status_distribution);

    donutChart = new Chart(ctxDonut, {
      type: "doughnut",
      data: {
        labels: donutLabels,
        datasets: [{ data: donutData, backgroundColor: ["#0d9488", "#f97316", "#3b82f6", "#10b981", "#ef4444"], borderWidth: 0 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, cutout: "70%",
        plugins: { legend: { position: "right", labels: { usePointStyle: true, boxWidth: 8 } } },
      },
    });

    // Map
    map = L.map("map").setView([39.0, 35.0], 5);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    }).addTo(map);

    globalOrders.forEach((order) => {
      if (order.lat && order.lng) {
        const color = order.status === "beklemede" ? "#f97316" : order.status === "teslim edildi" ? "#10b981" : "#3b82f6";
        const circle = L.circleMarker([order.lat, order.lng], { radius: 6, fillColor: color, color: "#fff", weight: 1, opacity: 1, fillOpacity: 0.8 }).addTo(map);
        circle.bindPopup(`<div class="font-sans"><strong class="text-slate-800">Sipariş #${order.id}</strong><br><span class="text-sm text-slate-500">${order.product}</span><br><span class="text-xs uppercase font-bold" style="color:${color}">${order.status}</span></div>`);
      }
    });
  } catch (e) {
    console.error("Charts/Map:", e);
  }
}

// ── Chat ──────────────────────────────────────────────────────────────────────
window.handleChatSubmit = async function (e) {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = "";
  appendMessage("user", msg);

  const loadingId = appendMessage("assistant", "Düşünüyor...");
  try {
    const res  = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, session_id: sessionId }),
    });
    const data = await res.json();
    updateMessage(loadingId, data.response);
    handleChatAction(data.response);
  } catch {
    updateMessage(loadingId, "Bağlantı hatası oluştu.");
  }
};

// Chat-to-action köprüsü: yanıta göre ilgili paneli aç veya öneri sun
function handleChatAction(response) {
  const lower = response.toLowerCase();

  // Kritik stok + belirli ürün adından e-posta önerisi
  if ((lower.includes("kritik") || lower.includes("stok")) && lower.includes("tedarikçi")) {
    const product = globalProducts.find((p) => lower.includes(p.name.toLowerCase()));
    if (product) {
      offerNavigation("inventory", `${product.name} için tedarikçi e-postası oluşturayım mı?`);
      // Buton tıklandığında modal açılsın
      const container = document.getElementById("chat-messages");
      const lastChild  = container.lastChild;
      if (lastChild) {
        const btn = lastChild.querySelector("button");
        if (btn) {
          const originalClick = btn.onclick;
          btn.onclick = () => { originalClick && originalClick(); openEmailModal(product.name); };
        }
      }
    }
  }

  if (lower.includes("kritik") && lower.includes("stok")) {
    switchView("inventory");
  } else if (lower.includes("sipariş")) {
    // stok yanıtı değilse siparişlere git
    if (!lower.includes("stok")) switchView("orders");
  } else if (lower.includes("müşteri")) {
    switchView("customers");
  }
}

function appendMessage(role, text) {
  const msgId     = "msg-" + Date.now() + Math.random();
  const container = document.getElementById("chat-messages");
  const div       = document.createElement("div");
  div.id          = msgId;
  div.className   = `chat-message ${role === "user" ? "chat-user" : "chat-assistant"} text-sm`;
  div.innerText   = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return msgId;
}

function updateMessage(id, text) {
  const div = document.getElementById(id);
  if (div) {
    div.innerText = text;
    document.getElementById("chat-messages").scrollTop = 9999;
  }
}

// ── Modals ────────────────────────────────────────────────────────────────────
function openModal(id) {
  const modal   = document.getElementById(id);
  const content = document.getElementById(id + "-content");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    modal.classList.remove("opacity-0");
    content.classList.remove("scale-95");
  });
}

window.closeModal = function (id) {
  const modal   = document.getElementById(id);
  const content = document.getElementById(id + "-content");
  modal.classList.add("opacity-0");
  content.classList.add("scale-95");
  setTimeout(() => modal.classList.add("hidden"), 300);
};

// ── Email Modal ───────────────────────────────────────────────────────────────
window.openEmailModal = async function (productName) {
  const loading  = document.getElementById("email-loading");
  const textarea = document.getElementById("email-textarea");
  const btnCopy  = document.getElementById("btn-copy");

  loading.innerHTML = `<i class="ph ph-spinner animate-spin text-4xl text-turquoise-500 mx-auto"></i><p class="text-slate-500 mt-3 text-sm">Gemini yapay zekası taslağı oluşturuyor...</p>`;
  loading.classList.remove("hidden");
  textarea.classList.add("hidden");
  btnCopy.classList.add("hidden");
  textarea.value = "";
  openModal("email-modal");

  try {
    const res  = await fetch(`${API_BASE}/generate-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_name: productName, quantity: 50 }),
    });
    const data = await res.json();
    textarea.value = data.action_text;
    loading.classList.add("hidden");
    textarea.classList.remove("hidden");
    btnCopy.classList.remove("hidden");
  } catch {
    loading.innerHTML = `<p class="text-red-500 py-4">Hata: E-posta taslağı oluşturulamadı.</p>`;
  }
};

window.copyEmail = function () {
  const textarea = document.getElementById("email-textarea");
  textarea.select();
  document.execCommand("copy");
  const btn = document.getElementById("btn-copy");
  const orig = btn.innerHTML;
  btn.innerHTML = `<i class="ph ph-check mr-2"></i> Kopyalandı`;
  btn.classList.replace("bg-turquoise-500", "bg-emerald-500");
  setTimeout(() => { btn.innerHTML = orig; btn.classList.replace("bg-emerald-500", "bg-turquoise-500"); }, 2000);
};

// ── Ürün Ekle Modal ───────────────────────────────────────────────────────────
window.openAddProductModal = function () {
  document.getElementById("product-modal-title").textContent  = "Yeni Ürün Ekle";
  document.getElementById("product-submit-label").textContent = "Ürün Ekle";
  document.getElementById("product-edit-id").value = "";
  document.getElementById("product-form").reset();
  openModal("product-modal");
};

window.handleProductSubmit = async function (e) {
  e.preventDefault();
  const payload = {
    name:      document.getElementById("p-name").value,
    category:  document.getElementById("p-category").value,
    unit:      document.getElementById("p-unit").value,
    price:     parseFloat(document.getElementById("p-price").value),
    stock:     parseInt(document.getElementById("p-stock").value),
    min_stock: parseInt(document.getElementById("p-min-stock").value),
  };

  try {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error();
    closeModal("product-modal");
    showToast(`"${payload.name}" eklendi`, "success");
    await fetchInventory();
    await fetchDashboard();
  } catch {
    showToast("Ürün eklenemedi", "error");
  }
};

// ── Ürün Sil ─────────────────────────────────────────────────────────────────
window.deleteProduct = async function (productId, productName) {
  if (!confirm(`"${productName}" ürününü silmek istediğinizden emin misiniz?`)) return;
  try {
    const res = await fetch(`${API_BASE}/products/${productId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || "Ürün silinemedi", "error");
      return;
    }
    showToast(`"${productName}" silindi`, "success");
    await fetchInventory();
    await fetchDashboard();
  } catch {
    showToast("Ürün silinemedi", "error");
  }
};

// ── Stok Güncelle Modal ───────────────────────────────────────────────────────
window.openStockModal = function (productId, productName, currentStock) {
  document.getElementById("stock-product-id").value          = productId;
  document.getElementById("stock-product-name").textContent  = productName;
  document.getElementById("stock-amount").value              = currentStock;
  openModal("stock-modal");
};

window.handleStockSubmit = async function (e) {
  e.preventDefault();
  const productId = document.getElementById("stock-product-id").value;
  const stock     = parseInt(document.getElementById("stock-amount").value);

  try {
    const res = await fetch(`${API_BASE}/products/${productId}/stock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stock }),
    });
    if (!res.ok) throw new Error();
    closeModal("stock-modal");
    showToast("Stok güncellendi", "success");
    await fetchInventory();
    await fetchDashboard();
  } catch {
    showToast("Stok güncellenemedi", "error");
  }
};
