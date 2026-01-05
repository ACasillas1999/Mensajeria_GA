$file = "src\components\ChatPane.jsx"
$content = Get-Content $file -Raw

Write-Host "Arreglando badges de agente y mensaje 24h..." -ForegroundColor Cyan

# 1. Badge del nombre de agente (línea ~1876)
$content = $content -replace 'bg-sky-900/30 border border-sky-700/50 text-sky-300', 'bg-sky-200 dark:bg-sky-900/30 border border-sky-400 dark:border-sky-700/50 text-sky-900 dark:text-sky-300'

# 2. Contenedor del mensaje "Fuera de la ventana de 24 horas"
$content = $content -replace 'bg-amber-900/20 border-amber-700/50', 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700/50'

# 3. Icono del mensaje 24h
$content = $content -replace 'text-amber-400', 'text-amber-600 dark:text-amber-400'

Set-Content $file $content -NoNewline

Write-Host "✅ Badges y mensaje 24h arreglados!" -ForegroundColor Green
Write-Host "   - Badge agente: Azul claro en modo claro" -ForegroundColor White
Write-Host "   - Mensaje 24h: Ámbar claro en modo claro" -ForegroundColor White
Write-Host ""
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
