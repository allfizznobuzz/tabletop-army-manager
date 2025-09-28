param()

$path = "c:\Users\John\Documents\Code\tabletop-army-manager\src\components\GameSession.js"
$t = Get-Content -Raw $path

# 1) Highlight per-column pinned unit instead of selectedUnit
$t = $t -replace '\bisSelected=\{selectedUnit\?\.id === unit\.id\}', 'isSelected={pinnedUnitId === unit.id}'
$t = $t -replace '\bisSelected=\{selectedUnit\?\.id === attachedId\}', 'isSelected={pinnedUnitId === attachedId}'

# 2) Remove isTarget prop usages on SortableUnit/AttachedUnitSortable
$t = [System.Text.RegularExpressions.Regex]::Replace(
    $t,
    '^[ \t]*isTarget=\{attackHelper\?\.targetUnitId === unit\.id\}\r?\n',
    '',
    [System.Text.RegularExpressions.RegexOptions]::Multiline
)
$t = [System.Text.RegularExpressions.Regex]::Replace(
    $t,
    '^[ \t]*isTarget=\{\s*attackHelper\?\.targetUnitId === attachedId\s*\}\r?\n',
    '',
    [System.Text.RegularExpressions.RegexOptions]::Multiline
)

# 3) Simplify onClick handlers for card clicks (unit and attached)
$replacement = @"
onClick={(u) => {
                    pinUnit?.(u);
                    setSelectedUnit(u);
                    setAttackHelper((prev) => ({
                      ...prev,
                      open: false,
                      section: null,
                      index: null,
                      modelsInRange: null,
                      targetUnitId: null,
                      intent: "idle",
                      showExpected: prev.showExpected,
                    }));
                  }}
"@
$t = [regex]::Replace($t, 'onClick=\{\(u\) => \{[\s\S]*?\n\s*\}\}(?=\s*\n\s*statusClass=)', $replacement)

# 4) Attack Helper: derive target from other pane
$t = [regex]::Replace($t, 'const selectedTarget = attackHelper\?\.targetUnitId\s*\?\s*allUnitsById\[attackHelper\.targetUnitId\]\s*:\s*null;', 'const selectedTarget = targetUnit;')

# 5) Pass pinnedUnitId into ArmyColumn A and B
$t = [regex]::Replace($t, '(columnKey="A"[\s\S]*?pinUnit=\{pinUnit\})', '$1' + "`r`n                pinnedUnitId={pinnedUnitIdA}")
$t = [regex]::Replace($t, '(columnKey="B"[\s\S]*?pinUnit=\{pinUnit\})', '$1' + "`r`n                pinnedUnitId={pinnedUnitIdB}")

Set-Content -LiteralPath $path -Value $t -Encoding UTF8
Write-Host "Selection model updates applied."
