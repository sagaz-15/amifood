document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('search-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const price = document.getElementById('price').value;
        fetch('buscar.php', {
            method: 'POST',
            body: new URLSearchParams({ price: price }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
        .then(response => response.text())
        .then(data => {
            document.getElementById('results').innerHTML = data;
        });
    });
});

