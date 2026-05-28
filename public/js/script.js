document.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('search-form');
  if (!form) return;

  var priceInput = document.getElementById('price');
  var resultsDiv = document.getElementById('results');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var price = priceInput.value.trim();
    if (!price) return;

    resultsDiv.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Buscando productos...</div>';

    fetch('/api/products/search?max_price=' + encodeURIComponent(price))
      .then(function(r) {
        if (!r.ok) throw new Error('Error en la consulta');
        return r.json();
      })
      .then(function(products) {
        if (products.length === 0) {
          resultsDiv.innerHTML =
            '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">' +
              '<div style="font-size: 3rem; opacity: 0.5; margin-bottom: 12px;">🔍</div>' +
              '<h3 style="color: var(--text); margin-bottom: 8px;">No se encontraron productos</h3>' +
              '<p style="color: var(--text-muted);">No hay productos por debajo de <strong>$' +
                Number(price).toLocaleString('es-CO') + '</strong>. Prueba con un precio más alto.</p>' +
            '</div>';
          return;
        }

        var html = '';
        html += '<div style="grid-column: 1/-1; margin-bottom: 8px;">' +
          '<h2 style="font-family: var(--font-display); color: var(--accent); font-size: 1.3rem;">' +
            'Productos por hasta $' + Number(price).toLocaleString('es-CO') +
          '</h2>' +
          '<p style="color: var(--text-muted); font-size: 0.9rem;">' + products.length + ' resultados</p>' +
        '</div>';

        products.forEach(function(p) {
          html += '<div class="result-card">' +
            '<div class="product-name">' + esc(p.name) + '</div>' +
            '<div class="product-price">$' + Number(p.price).toLocaleString('es-CO') + '</div>' +
            '<div class="product-store">📍 ' + esc(p.store) + '</div>' +
          '</div>';
        });

        resultsDiv.innerHTML = html;
      })
      .catch(function(err) {
        resultsDiv.innerHTML =
          '<div style="grid-column: 1/-1; text-align: center; padding: 40px;">' +
            '<div style="font-size: 2rem; margin-bottom: 12px;">⚠️</div>' +
            '<h3 style="color: var(--danger); margin-bottom: 8px;">Error al buscar productos</h3>' +
            '<p style="color: var(--text-muted);">Verifica que el servidor esté funcionando.</p>' +
          '</div>';
      });
  });

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
