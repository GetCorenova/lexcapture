param()
$docDir = "d:\UsurarioDocumentos\Escritorio\Proyectos 2026\APP Capturas\Crear App\Documentos"
$tmpDir = "$docDir\_tmp_docx"

foreach($docx in @("Dejando a Disposicion FISCALIA.docx","Dejando a Disposicion JUZGADO.docx")) {
  # Buscar el archivo (nombre puede variar por acentos)
  $file = Get-ChildItem $docDir -Filter "Dejando*" | Where-Object { $_.Name -match "FISCAL" -or $_.Name -match "JUZGADO" } | Select-Object -First 2
}

$files = Get-ChildItem $docDir -Filter "Dejando*.docx"
Write-Output "Archivos encontrados:"
$files | ForEach-Object { Write-Output "  $($_.Name)" }
Write-Output ""

foreach($f in $files) {
  Write-Output "============================================"
  Write-Output "ARCHIVO: $($f.Name)"
  Write-Output "============================================"

  $tmp = "$docDir\_tmp_$(Get-Random)"
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null

  # Copiar con extension zip y descomprimir
  $zipPath = "$tmp\doc.zip"
  Copy-Item $f.FullName $zipPath
  Expand-Archive $zipPath $tmp -Force

  $xmlPath = "$tmp\word\document.xml"
  if(Test-Path $xmlPath) {
    $xml = [IO.File]::ReadAllText($xmlPath, [System.Text.Encoding]::UTF8)

    # Extraer texto plano removiendo tags XML
    $texto = $xml -replace '<[^>]+>', ' '
    $texto = $texto -replace '\s+', ' '
    $texto = $texto.Trim()

    # Mostrar primeros 3000 chars del texto
    $max = [Math]::Min(3000, $texto.Length)
    Write-Output "TEXTO PLANO (primeros $max chars):"
    Write-Output $texto.Substring(0, $max)
    Write-Output ""

    # Buscar placeholders tipo {{...}}
    $matches2 = [regex]::Matches($xml, '\{\{[A-Z_0-9]+\}\}')
    if($matches2.Count -gt 0) {
      Write-Output "PLACEHOLDERS {{...}} encontrados:"
      $matches2 | ForEach-Object { Write-Output "  $($_.Value)" } | Sort-Object -Unique
    } else {
      Write-Output "No se encontraron placeholders {{...}}"
    }
  } else {
    Write-Output "No se encontro word/document.xml"
  }

  Remove-Item $tmp -Recurse -Force
  Write-Output ""
}
