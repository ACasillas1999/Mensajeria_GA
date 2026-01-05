$file = "src\components\ConversationTraceView.jsx"
$content = Get-Content $file -Raw

Write-Host "Arreglando modal de Trazabilidad..." -ForegroundColor Cyan

# 1. Modal principal
$content = $content -replace 'bg-slate-900 border border-slate-700 rounded-xl', 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl'

# 2. Header gradiente
$content = $content -replace 'bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-b border-slate-700', 'bg-gradient-to-r from-purple-200 dark:from-purple-900/40 to-blue-200 dark:to-blue-900/40 border-b border-purple-300 dark:border-slate-700'

# 3. Títulos
$content = $content -replace 'text-xl font-bold text-slate-100', 'text-xl font-bold text-slate-900 dark:text-slate-100'
$content = $content -replace 'text-lg font-semibold text-slate-200', 'text-lg font-semibold text-slate-900 dark:text-slate-200'
$content = $content -replace 'font-semibold text-slate-300', 'font-semibold text-slate-900 dark:text-slate-300'

# 4. Texto
$content = $content -replace 'text-sm text-slate-300', 'text-sm text-slate-700 dark:text-slate-300'
$content = $content -replace 'text-slate-400', 'text-slate-600 dark:text-slate-400'
$content = $content -replace 'text-slate-200', 'text-slate-900 dark:text-slate-200'

# 5. Tabs
$content = $content -replace 'bg-slate-900/50', 'bg-slate-100 dark:bg-slate-900/50'

# 6. Cards y contenedores
$content = $content -replace 'bg-slate-800/50 border border-slate-700', 'bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700'
$content = $content -replace 'bg-slate-800/30 border border-slate-700', 'bg-slate-100 dark:bg-slate-800/30 border border-slate-300 dark:border-slate-700'

# 7. Timeline line
$content = $content -replace 'bg-slate-700', 'bg-slate-300 dark:bg-slate-700'

# 8. Timeline icons
$content = $content -replace 'border-2 bg-slate-900 z-10', 'border-2 bg-white dark:bg-slate-900 z-10'

# 9. Botones
$content = $content -replace 'bg-slate-800 hover:bg-slate-700 text-slate-200', 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200'

# 10. Progress bars
$content = $content -replace 'bg-slate-900 rounded-full', 'bg-slate-200 dark:bg-slate-900 rounded-full'

Set-Content $file $content -NoNewline

Write-Host "✅ Modal de Trazabilidad arreglado!" -ForegroundColor Green
Write-Host "   - Modal: Fondo blanco en modo claro" -ForegroundColor White
Write-Host "   - Header: Gradiente claro" -ForegroundColor White
Write-Host "   - Cards: Fondos adaptativos" -ForegroundColor White
Write-Host "   - Timeline: Visible en ambos modos" -ForegroundColor White
Write-Host ""
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
