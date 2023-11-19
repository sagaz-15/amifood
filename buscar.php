<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $price = floatval($_POST['price']); // Precio ingresado por el usuario

    $csvFile = 'productos.csv'; 

    $results = array();
    if (($handle = fopen($csvFile, "r")) !== false) {
        while (($data = fgetcsv($handle, 1000, ";")) !== false) {
            if (count($data) === 3) {
                $productName = $data[0];
                $productPrice = floatval($data[1]);
                $storeName = $data[2];

                if ($productPrice <= $price) {
                    $results[] = "<p style='font-size: 20px; background-color:#d49c21;width: 240px;
                    padding: 20px;
                    border-radius: 10px;'>$productName a $productPrice en $storeName</p>";
                }
            }
        }
        fclose($handle);
    }

    if (count($results) > 0) {
        echo "<h2>Los productos que puedes comprar por encima de $price son:</h2>";
        echo implode( $results);
    } else {
        echo "<h2>No se encontraron productos por encima de ese precio.</h2>";
    }
} else {
    echo 'Acceso no autorizado';
}
?>

