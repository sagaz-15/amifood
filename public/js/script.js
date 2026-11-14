document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('search-form');
  if (!form) return;

  var priceInput = document.getElementById('price');
  var resultsDiv = document.getElementById('results');
  var lastPrice = null;
  var refreshTimer = null;
  var eventSource = null;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var price = priceInput.value.trim();
    if (!price) return;
    lastPrice = price;
    search(price);
  });

  // RF04.13: al recibir un cambio de producto, se repite la ultima busqueda.
  if (window.EventSource) {
    eventSource = new EventSource('/api/v1/products/events');
    var refresh = function () {
      if (!lastPrice) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(function () { search(lastPrice); }, 500);
    };
    eventSource.addEventListener('product.created', refresh);
    eventSource.addEventListener('product.updated', refresh);
    eventSource.addEventListener('product.deleted', refresh);
  }

  function search(price) {
    resultsDiv.innerHTML = '<div class="loading-state">Buscando productos...</div>';

    fetch('/api/v1/products?maxPrice=' + encodeURIComponent(price) + '&available=true&pageSize=50&sortBy=price&sortOrder=asc')
      .then(function (r) {
        if (!r.ok) throw new Error('Error en la consulta');
        return r.json();
      })
      .then(function (payload) {
        var products = payload.data || [];
        if (products.length === 0) {
          resultsDiv.innerHTML =
            '<div class="empty-state" style="grid-column: 1/-1;">' +
              '<div class="empty-icon">🔍</div>' +
              '<h3>No se encontraron productos</h3>' +
              '<p style="color: var(--text-muted);">No hay productos disponibles por debajo de <strong>$' +
                Number(price).toLocaleString('es-CO') + '</strong>. Prueba con un precio mas alto.</p>' +
            '</div>';
          return;
        }

        var html = '<div style="grid-column: 1/-1; margin-bottom: 8px;">' +
          '<h2 style="font-family: var(--font-display); color: var(--accent); font-size: 1.3rem;">' +
            'Productos por hasta $' + Number(price).toLocaleString('es-CO') +
          '</h2>' +
          '<p style="color: var(--text-muted); font-size: 0.9rem;">' + payload.meta.total + ' resultados</p>' +
        '</div>';

        products.forEach(function (p) {
          var availability = p.isAvailable
            ? '<span class="badge badge-available">Disponible</span>'
            : '<span class="badge badge-unavailable">Agotado</span>';
          html += '<div class="result-card">' +
            '<div class="product-name">' + esc(p.name) + ' ' + availability + '</div>' +
            '<div class="product-price">$' + Number(p.price).toLocaleString('es-CO') + '</div>' +
            '<div class="product-store">📍 ' + esc(p.storeName || 'Local AmiFood') + '</div>' +
            (p.description ? '<div class="product-description">' + esc(p.description) + '</div>' : '') +
            (p.rating && p.rating.average
              ? '<div class="product-store">★ ' + p.rating.average + ' (' + p.rating.count + ')</div>'
              : '') +
          '</div>';
        });

        resultsDiv.innerHTML = html;
      })
      .catch(function () {
        resultsDiv.innerHTML =
          '<div class="empty-state" style="grid-column: 1/-1;">' +
            '<div class="empty-icon">⚠️</div>' +
            '<h3 style="color: var(--danger);">Error al buscar productos</h3>' +
            '<p style="color: var(--text-muted);">Verifica que el servidor este funcionando.</p>' +
          '</div>';
      });
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
