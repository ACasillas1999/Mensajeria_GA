$file = "src\components\ChatPane.jsx"
$content = Get-Content $file -Raw

Write-Host "Arreglando burbujas de comentarios internos..." -ForegroundColor Cyan

# Fondo de la burbuja
$content = $content -replace 'bg-amber-950/30 border border-amber-800/40', 'bg-amber-100 dark:bg-amber-950/30 border border-amber-400 dark:border-amber-800/40'

# Título del comentario
$content = $content -replace 'text-xs font-semibold text-amber-300', 'text-xs font-semibold text-amber-900 dark:text-amber-300'

# Texto del comentario
$content = $content -replace 'text-sm text-amber-100/90', 'text-sm text-amber-900 dark:text-amber-100/90'

# Timestamp
$content = $content -replace 'text-\[10px\] text-amber-600/60', 'text-[10px] text-amber-700 dark:text-amber-600/60'

Set-Content $file $content -NoNewline

Write-Host "✅ Burbujas de comentarios arregladas!" -ForegroundColor Green
Write-Host "   Modo claro: Fondo ámbar claro, texto oscuro" -ForegroundColor White
Write-Host "   Modo oscuro: Sin cambios" -ForegroundColor White
Write-Host ""
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
