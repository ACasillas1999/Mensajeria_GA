$file = "src\components\ChatPane.jsx"
$content = Get-Content $file -Raw

Write-Host "Arreglando comentarios internos en el chat..." -ForegroundColor Cyan

# Comentario interno en el flujo del chat (burbuja amarilla)
# Cambiar de amarillo a un color más visible
$content = $content -replace 'bg-yellow-900/20 border-yellow-700', 'bg-amber-100 dark:bg-yellow-900/20 border-amber-400 dark:border-yellow-700'

# Texto del comentario interno
$content = $content -replace 'text-yellow-300', 'text-amber-900 dark:text-yellow-300'

Set-Content $file $content -NoNewline

Write-Host "✅ Comentarios internos en chat arreglados!" -ForegroundColor Green
Write-Host "   - Fondo: Ámbar claro en modo claro" -ForegroundColor White
Write-Host "   - Texto: Ámbar oscuro en modo claro" -ForegroundColor White
Write-Host ""
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
