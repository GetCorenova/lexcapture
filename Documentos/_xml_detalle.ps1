param()
$docDir = "d:\UsurarioDocumentos\Escritorio\Proyectos 2026\APP Capturas\Crear App\Documentos"

foreach($docxName in @("Dejando a Disposición FISCALIA.docx","Dejando a Disposición JUZGADO.docx")) {
  $f = Get-Item "$docDir\$docxName" -ErrorAction SilentlyContinue
  if(!$f) { continue }

  Write-Output "============================================"
  Write-Output "ARCHIVO: $($f.Name)"
  Write-Output "============================================"

  $tmp = "$docDir\_tmp_$(Get-Random)"
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  Copy-Item $f.FullName "$tmp\doc.zip"
  Expand-Archive "$tmp\doc.zip" $tmp -Force

  $xmlPath = "$tmp\word\document.xml"
  if(Test-Path $xmlPath) {
    # Guardar XML en archivo de texto para inspeccion
    $xml = [IO.File]::ReadAllText($xmlPath, [System.Text.Encoding]::UTF8)
    $outPath = "$docDir\$($f.BaseName)_XML.txt"
    [IO.File]::WriteAllText($outPath, $xml, [System.Text.Encoding]::UTF8)
    Write-Output "XML guardado en: $outPath ($(([IO.FileInfo]$outPath).Length) bytes)"
    Write-Output "Total chars en XML: $($xml.Length)"

    # Extraer todos los bloques <w:t>...</w:t> y unirlos para ver el texto limpio
    $runs = [regex]::Matches($xml, '<w:t[^>]*>([^<]*)<\/w:t>')
    $allText = ($runs | ForEach-Object { $_.Groups[1].Value }) -join ''
    Write-Output "Texto total (w:t concatenados): $(($allText.Length)) chars"
    Write-Output "Primeros 2000 chars:"
    Write-Output $allText.Substring(0, [Math]::Min(2000, $allText.Length))
  }

  Remove-Item $tmp -Recurse -Force
  Write-Output ""
}
