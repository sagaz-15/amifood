document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('search-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const price = document.getElementById('price').value;
        const resultsDiv = document.getElementById('results');

        resultsDiv.innerHTML = '<p style="font-size: 1.5em; color: #c6cbce;">Buscando productos...</p>';

        fetch('/api/products/search?max_price=' + encodeURIComponent(price))
            .then(response => {
                if (!response.ok) throw new Error('Error en la consulta');
                return response.json();
            })
            .then(products => {
                if (products.length === 0) {
                    resultsDiv.innerHTML = '<h2 style="color: #c6cbce;">No se encontraron productos por debajo de $' + price + '.</h2>' +
                        '<p style="color: #7a7c7e; font-size: 1.3em;">Prueba con un precio más alto.</p>';
                    return;
                }

                let html = '<h2 style="color: #d49c21;">Productos que puedes comprar por hasta $' +
                    parseInt(price).toLocaleString('es-CO') + ':</h2>';

                html += '<div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 20px;">';

                products.forEach(function(p) {
                    html += '<div style="background-color: #d49c21; width: 240px; padding: 15px; ' +
                        'border-radius: 10px; text-align: center; font-size: 1.5em;">' +
                        '<strong>' + p.name + '</strong><br>' +
                        '<span style="color: #0d3753;">$' + parseInt(p.price).toLocaleString('es-CO') + '</span><br>' +
                        '<span style="color: #283847; font-size: 0.8em;">' + p.store + '</span>' +
                        '</div>';
                });

                html += '</div>';
                resultsDiv.innerHTML = html;
            })
            .catch(function(err) {
                resultsDiv.innerHTML = '<h2 style="color: #e74c3c;">Error al buscar productos. Verifica que el servidor esté funcionando.</h2>' +
                    '<p style="color: #7a7c7e;">' + err.message + '</p>';
            });
    });
});

