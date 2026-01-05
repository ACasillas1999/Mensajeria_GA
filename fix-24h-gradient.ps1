$file = "src\components\ChatPane.jsx"
$content = Get-Content $file -Raw

Write-Host "Arreglando mensaje 24h completo..." -ForegroundColor Cyan

# 1. Gradiente del contenedor principal
$content = $content -replace 'bg-gradient-to-br from-amber-950/40 to-red-950/30 border-b border-amber-800/30', 'bg-gradient-to-br from-amber-100 dark:from-amber-950/40 to-orange-100 dark:to-red-950/30 border-b border-amber-300 dark:border-amber-800/30'

# 2. Icono del candado
$content = $content -replace 'bg-amber-900/50', 'bg-amber-200 dark:bg-amber-900/50'

Set-Content $file $content -NoNewline

Write-Host "✅ Mensaje 24h completamente arreglado!" -ForegroundColor Green
Write-Host "   - Gradiente claro en modo claro" -ForegroundColor White
Write-Host "   - Icono visible" -ForegroundColor White
Write-Host ""
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
