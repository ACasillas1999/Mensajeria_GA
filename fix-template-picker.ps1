$file = "src\components\TemplatePicker.jsx"
$content = Get-Content $file -Raw

Write-Host "Arreglando TemplatePicker.jsx..." -ForegroundColor Cyan

# 1. Modal principal
$content = $content -replace 'bg-slate-950 border border-slate-800 rounded-2xl', 'bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl'

# 2. Header del modal
$content = $content -replace 'border-b border-slate-800', 'border-b border-slate-300 dark:border-slate-800'

# 3. Título
$content = $content -replace 'text-lg font-semibold text-slate-200', 'text-lg font-semibold text-slate-900 dark:text-slate-200'

# 4. Subtítulo
$content = $content -replace 'text-sm text-slate-400', 'text-sm text-slate-600 dark:text-slate-400'

# 5. Botón cerrar
$content = $content -replace 'text-slate-400 hover:text-slate-200', 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'

# 6. Cards de plantillas
$content = $content -replace 'border border-slate-800 rounded-lg bg-slate-900/50 hover:bg-slate-800/70', 'border border-slate-300 dark:border-slate-800 rounded-lg bg-slate-100 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-800/70'

# 7. Título de plantilla
$content = $content -replace 'font-semibold text-slate-200 group-hover:text-emerald-400', 'font-semibold text-slate-900 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'

# 8. Badge de categoría
$content = $content -replace 'bg-slate-800 text-emerald-400 border border-emerald-800/50', 'bg-emerald-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-400 dark:border-emerald-800/50'

# 9. Vista previa
$content = $content -replace 'bg-slate-900/50 border border-slate-800 rounded-lg p-4', 'bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-lg p-4'

# 10. Texto de vista previa
$content = $content -replace 'text-sm text-slate-300', 'text-sm text-slate-900 dark:text-slate-300'

# 11. Inputs
$content = $content -replace 'bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-200', 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-slate-900 dark:text-slate-200'

# 12. Labels
$content = $content -replace 'text-sm font-medium text-slate-300', 'text-sm font-medium text-slate-900 dark:text-slate-300'

# 13. Footer border
$content = $content -replace 'border-t border-slate-800', 'border-t border-slate-300 dark:border-slate-800'

# 14. Botón cancelar
$content = $content -replace 'border border-slate-700 rounded bg-slate-800 hover:bg-slate-700 text-slate-300', 'border border-slate-300 dark:border-slate-700 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-300'

Set-Content $file $content -NoNewline

Write-Host "✅ TemplatePicker arreglado!" -ForegroundColor Green
Write-Host "   - Modal: Fondo blanco en modo claro" -ForegroundColor White
Write-Host "   - Cards: Fondos adaptativos" -ForegroundColor White
Write-Host "   - Inputs: Fondos adaptativos" -ForegroundColor White
Write-Host ""
Write-Host "Reinicia: npm run dev" -ForegroundColor Cyan
