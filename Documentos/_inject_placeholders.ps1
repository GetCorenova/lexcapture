param()
$docDir  = "d:\UsurarioDocumentos\Escritorio\Proyectos 2026\APP Capturas\Crear App\Documentos"
$htmlPath = "d:\UsurarioDocumentos\Escritorio\Proyectos 2026\APP Capturas\Crear App\LexCapture_v8.html"

# Chars especiales como [char] para evitar corrupcion de encoding al leer .ps1 como Win1252
# CRITICO: PowerShell es case-insensitive en vars -> $iAc y $IAc son la MISMA variable
# Se usan nombres completamente distintos: $ilow (minusc), $iupp (mayusc)
$dash = [char]0x2013  # EN DASH
$ilow = [char]0x00ED  # i minusc con acento (iacute)
$olow = [char]0x00F3  # o minusc con acento (oacute)
$elow = [char]0x00E9  # e minusc con acento (eacute)
$iupp = [char]0x00CD  # I MAYUSC con acento (Iacute)

# Reemplaza todo el parrafo cuyo texto concatenado contiene $searchText
# Inserta un unico run con <w:t> conteniendo $placeholder
function ReplacePara($xml, $searchText, $placeholder) {
  $pats = [regex]::Matches($xml, '<w:p[ >](?:(?!</w:p>).)*</w:p>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  foreach($m in $pats) {
    $tms = [regex]::Matches($m.Value, '<w:t[^>]*>([^<]*)</w:t>')
    $txt = ($tms | ForEach-Object { $_.Groups[1].Value }) -join ''
    if($txt.Contains($searchText)) {
      $pOpen = [regex]::Match($m.Value, '^<w:p[^>]*>').Value
      $pPrM  = [regex]::Match($m.Value, '<w:pPr>.*?</w:pPr>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
      $pPr   = if($pPrM.Success) { $pPrM.Value } else { '' }
      $rpr   = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:lang w:val="es-CO"/></w:rPr>'
      $newPara = $pOpen + $pPr + '<w:r>' + $rpr + '<w:t xml:space="preserve">' + $placeholder + '</w:t></w:r></w:p>'
      $xml = $xml.Replace($m.Value, $newPara)
      return $xml
    }
  }
  Write-Host "  WARN ReplacePara not found: $searchText"
  return $xml
}

# Igual que ReplacePara pero inserta XML crudo (no envuelve en <w:t>)
function ReplaceParaRaw($xml, $searchText, $rawRuns) {
  $pats = [regex]::Matches($xml, '<w:p[ >](?:(?!</w:p>).)*</w:p>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
  foreach($m in $pats) {
    $tms = [regex]::Matches($m.Value, '<w:t[^>]*>([^<]*)</w:t>')
    $txt = ($tms | ForEach-Object { $_.Groups[1].Value }) -join ''
    if($txt.Contains($searchText)) {
      $pOpen = [regex]::Match($m.Value, '^<w:p[^>]*>').Value
      $pPrM  = [regex]::Match($m.Value, '<w:pPr>.*?</w:pPr>', [System.Text.RegularExpressions.RegexOptions]::Singleline)
      $pPr   = if($pPrM.Success) { $pPrM.Value } else { '' }
      $newPara = $pOpen + $pPr + $rawRuns + '</w:p>'
      $xml = $xml.Replace($m.Value, $newPara)
      return $xml
    }
  }
  Write-Host "  WARN ReplaceParaRaw not found: $searchText"
  return $xml
}

function ReplaceWt($xml, $oldText, $newText) {
  if($xml.Contains($oldText)) { return $xml.Replace($oldText, $newText) }
  Write-Host "  WARN ReplaceWt not found: $oldText"
  return $xml
}

function InsertTableCellPlaceholder($xml, $nthCell, $placeholder) {
  $rpr = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:lang w:val="es-CO"/></w:rPr>'
  $run = '<w:r>' + $rpr + '<w:t xml:space="preserve">' + $placeholder + '</w:t></w:r>'
  # Detectar ancho de columna de valor segun el documento (FISCALIA=6008, JUZGADO=5670)
  $w = if($xml.Contains('w:w="6008"')) { "6008" } else { "5670" }
  $pattern = '(<w:tcPr><w:tcW w:w="' + $w + '" w:type="dxa"/></w:tcPr><w:p[^>]*>)(<w:pPr>(?:(?!</w:pPr>).)*</w:pPr>)(</w:p></w:tc>)'
  $script:cellCount = 0
  $result = [regex]::Replace($xml, $pattern, {
    param($m)
    $script:cellCount++
    if($script:cellCount -eq $nthCell) {
      return $m.Groups[1].Value + $m.Groups[2].Value + $run + $m.Groups[3].Value
    }
    return $m.Value
  }, [System.Text.RegularExpressions.RegexOptions]::Singleline)
  return $result
}

# Helper: construir un run con rPr estandar
function MkRun($txt) {
  $rpr = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:lang w:val="es-CO"/></w:rPr>'
  return '<w:r>' + $rpr + '<w:t xml:space="preserve">' + $txt + '</w:t></w:r>'
}

$base64Results = @{}

foreach($tipo in @("FISCALIA","JUZGADO")) {
  $docxFile = Get-ChildItem $docDir -Filter "Dejando*.docx" | Where-Object { $_.Name -match $tipo }
  if(!$docxFile) { Write-Host "NO ENCONTRADO: $tipo"; continue }
  Write-Host "=== $tipo ==="

  $tmp = "$env:TEMP\lc_plh_$(Get-Random)"
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  Copy-Item $docxFile.FullName "$tmp\doc.zip" -Force
  Expand-Archive "$tmp\doc.zip" "$tmp\out" -Force

  $xmlPath = "$tmp\out\word\document.xml"
  $xml = [IO.File]::ReadAllText($xmlPath, [System.Text.Encoding]::UTF8)

  # [1] Fecha: "25 de febrero de 2026" -> en propio w:t, ASCII salvo "Medell" antes
  $xml = ReplaceWt $xml "25 de febrero de 2026" "{{FECHA_LARGO}}"
  Write-Host "  [1] Fecha OK"

  # [2] Tabla - 8 celdas vacias de 6008 twips de ancho
  $tpls = @("{{CAP_NOMBRES}}","{{CAP_CEDULA}}","{{CAP_FECHA_NAC}}","{{CAP_LUGAR_NAC}}","{{CAP_PADRES}}","{{CAP_ESTADO_CIVIL}}","{{CAP_OCUPACION}}","{{CAP_DIR_TEL}}")
  # Siempre insertar en la 1a celda vacia (nthCell=1): cada llamada llena la siguiente
  for($i = 0; $i -lt $tpls.Length; $i++) {
    $xml = InsertTableCellPlaceholder $xml 1 $tpls[$i]
  }
  Write-Host "  [2] Tabla OK"

  # [3] Narrativas: buscar por texto unico (ASCII) en texto concatenado del parrafo
  $xml = ReplacePara $xml "El d" "{{NARRATIVA_1}}"
  Write-Host "  [3] NARRATIVA_1 OK"
  $xml = ReplacePara $xml "orden de captura vigente" "{{NARRATIVA_2}}"
  Write-Host "  [4] NARRATIVA_2 OK"
  $xml = ReplacePara $xml "Confirmada la vigencia" "{{NARRATIVA_3}}"
  Write-Host "  [5] NARRATIVA_3 OK"

  # [4] Firma: P[30] tiene multiples items con <w:br/> en un solo parrafo
  #     Buscar por "Subintendente" (ASCII) y reemplazar con bloque crudo de runs
  $br = '<w:r><w:br/></w:r>'
  $firmaRaw = (MkRun '{{OFICIAL_GRADO_NOMBRE}}') + $br +
              (MkRun '{{ESTACION_NOMBRE}}') + $br +
              (MkRun '{{ESTACION_DIR}}') + $br +
              (MkRun 'Celular: {{OFICIAL_CEL}}')
  $xml = ReplaceParaRaw $xml "Subintendente NELSON DAVID" $firmaRaw
  Write-Host "  [6] Firma OK"

  # [5] Email (parrafo separado, buscar ASCII "Correos:")
  $xml = ReplacePara $xml "Correos:" "Correos: {{OFICIAL_EMAIL}}"
  Write-Host "  [7] Email OK"

  # [6] Elaboro: parrafo con "labor" + o-low + ":" -> "Elaboro: ... MEVAL - ESCAN."
  $srchElab = "labor" + $olow + ":"
  $replElab  = "Elabor" + $olow + ": {{ELABORADOR}}                        MEVAL - ESCAN."
  $xml = ReplacePara $xml $srchElab $replElab
  Write-Host "  [8] Elaboro OK"

  # [7] Reviso: "evis" + o-low + ":"
  $srchRev = "evis" + $olow + ":"
  $replRev  = "Revis" + $olow + ": {{ELABORADOR}}                     "
  $xml = ReplacePara $xml $srchRev $replRev
  Write-Host "  [9] Reviso OK"

  # [8] Fecha elaboracion: buscar "25-02" (ASCII, parrafo lo contiene concatenado)
  $replFecha = "Fecha de elaboraci" + $olow + "n: {{FECHA_ELAB}}"
  $xml = ReplacePara $xml "25-02" $replFecha
  Write-Host "  [10] Fecha elab OK"

  # [9] Especificos por tipo
  if($tipo -eq "FISCALIA") {
    $destNom = "FISCAL" + $iupp + "A URI CENTRO " + $dash + " SEDE CARIBE"
    $xml = ReplaceWt $xml $destNom "{{DESTINATARIO_NOMBRE}}"
    Write-Host "  [F1] Destinatario OK"
    $xml = ReplaceWt $xml "Carrera 64C # 67-300, sector Caribe" "{{DESTINATARIO_DIR}}"
    Write-Host "  [F2] Dir OK"
    $xml = ReplaceWt $xml "judicial No. " "judicial No. {{NUM_ORDEN}}"
    Write-Host "  [F3] NumOrden OK"
    $xml = ReplacePara $xml "Posteriormente, el capturado" "{{NARRATIVA_4}}"
    Write-Host "  [F4] NARRATIVA_4 OK"
  } else {
    $destNom = "JUZGADO TREINTA Y SEIS PENALES MUNICIPALES DE CONOCIMIENTO DE MEDELL" + $iupp + "N  "
    $xml = ReplaceWt $xml $destNom "{{DESTINATARIO_NOMBRE}}"
    Write-Host "  [J1] Destinatario OK"
    $destDir = "Carrera 52 # 42" + $dash + "73, Edificio Jos" + $elow + " F" + $elow + "lix de Restrepo"
    $xml = ReplaceWt $xml $destDir "{{DESTINATARIO_DIR}}"
    Write-Host "  [J2] Dir OK"
    $xml = ReplaceWt $xml "judicial No. 002" "judicial No. {{NUM_ORDEN}}"
    Write-Host "  [J3] NumOrden OK"
    $xml = ReplacePara $xml "no portaba documento" "{{NARRATIVA_4b}}"
    Write-Host "  [J4] NARRATIVA_4b OK"
    # Buscar "Finalmente" (unico en P[28]: "Finalmente, se informa que el capturado...")
    # NO usar "capturado" - aparece antes en el parrafo Asunto P[6]
    $xml = ReplacePara $xml "Finalmente" "{{NARRATIVA_4}}"
    Write-Host "  [J5] NARRATIVA_4 OK"
  }

  Write-Host "  XML final: $($xml.Length) chars"
  [IO.File]::WriteAllText($xmlPath, $xml, [System.Text.Encoding]::UTF8)

  $outZip = "$tmp\out_mod.zip"
  Compress-Archive -Path "$tmp\out\*" -DestinationPath $outZip -Force
  $docxBytes = [IO.File]::ReadAllBytes($outZip)
  $b64 = [Convert]::ToBase64String($docxBytes)
  $base64Results[$tipo] = $b64
  Write-Host "  Base64: $($b64.Length) chars"
  Remove-Item $tmp -Recurse -Force
}

Write-Host ""
Write-Host "=== Actualizando HTML ==="
$html = [IO.File]::ReadAllText($htmlPath, [System.Text.Encoding]::UTF8)

foreach($tipo in @("FISCALIA","JUZGADO")) {
  if(!$base64Results.ContainsKey($tipo)) { continue }
  $varName = "_BUILTIN_TPL_${tipo}_B64"
  $newB64 = $base64Results[$tipo]
  $startMarker = "var ${varName}='"
  $startPos = $html.IndexOf($startMarker)
  if($startPos -lt 0) { Write-Host "NO ENCONTRADO: $varName"; continue }
  $valueStart = $startPos + $startMarker.Length
  $valueEnd   = $html.IndexOf("';", $valueStart)
  if($valueEnd -lt 0) { Write-Host "NO FIN: $varName"; continue }
  $html = $html.Substring(0, $valueStart) + $newB64 + $html.Substring($valueEnd)
  Write-Host "  $tipo B64 actualizado: $($newB64.Length) chars"
}

[IO.File]::WriteAllText($htmlPath, $html, [System.Text.Encoding]::UTF8)
Write-Host "HTML escrito: $([Math]::Round($html.Length/1MB,1)) MB"
