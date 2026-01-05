$file = "src\components\ChatPane.jsx"
$content = Get-Content $file -Raw

Write-Host "Agregando padding al header del chat..." -ForegroundColor Cyan

# Buscar el header principal con los botones y agregar pt-3
$content = $content -replace '(\{/\* Header con info del cliente, botones, etc\. \*/\}[\r\n\s]+<div className="flex items-center gap-2 px-4 )py-2( border-b)', '$1pt-3 pb-2$2'

Set-Content $file $content -NoNewline

Write-Host "✅ Padding agregado al header!" -ForegroundColor Green
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
