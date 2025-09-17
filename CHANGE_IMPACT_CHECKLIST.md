# Change Impact Analysis Checklist

## Pre-Change Analysis (MANDATORY)

### 1. Scope Assessment
- [ ] **What files will be modified?** List all files that will change
- [ ] **What functionality is affected?** Identify all features that could be impacted
- [ ] **Are there dependencies?** Check what other modules import/use the changing code
- [ ] **UI impact?** Will any user interface elements change behavior?

### 2. Risk Assessment
- [ ] **Core module changes?** (army_document, army_loader, combat_mechanics, etc.)
- [ ] **Data structure changes?** Could break existing army files or saved data
- [ ] **API/method signature changes?** Could break calling code
- [ ] **Import path changes?** Could break test files or other modules

### 3. Test Impact Analysis
- [ ] **Which tests cover this code?** Run: `grep -r "function_name" tests/`
- [ ] **Are test expectations still valid?** Review test assertions
- [ ] **New tests needed?** For new functionality or edge cases

## Pre-Change Verification (MANDATORY)

### 1. Establish Baseline
```bash
# Run this EXACT command before any changes
pytest tests/smoke/ tests/integration/ tests/unit/ -v
```
- [ ] **All 24 core tests passing?** Must be 100% green before proceeding
- [ ] **Application starts cleanly?** Manual verification required

### 2. Document Current State
- [ ] **Screenshot current UI** (if UI changes planned)
- [ ] **Note current behavior** (if behavior changes planned)
- [ ] **Record test output** (save baseline results)

## Making Changes

### 1. Incremental Approach
- [ ] **Make smallest possible change first**
- [ ] **Test immediately after each change**
- [ ] **Commit working state before next change**

### 2. During Development
- [ ] **Run affected tests frequently:** `pytest tests/path/to/affected/ -v`
- [ ] **Manual smoke test after each change**
- [ ] **Check for import errors:** Look for red underlines in IDE

## Post-Change Verification (MANDATORY)

### 1. Full Test Suite
```bash
# Run this EXACT command after changes
pytest tests/smoke/ tests/integration/ tests/unit/ -v
```
- [ ] **All 24 core tests still passing?** Any failures = STOP and fix
- [ ] **No new test failures?** Compare to baseline results
- [ ] **Performance still acceptable?** Tests should complete in <2 seconds

### 2. Manual Verification
- [ ] **Application starts without errors**
- [ ] **Can load sample army files** (sample-army-BA.json, sample-army-WE.json)
- [ ] **Basic combat calculation works**
- [ ] **UI elements respond correctly**

### 3. Regression Check
- [ ] **Old functionality still works?** Test previously working features
- [ ] **No unintended side effects?** Check areas not directly modified
- [ ] **Error handling still robust?** Test with invalid inputs

## Rollback Criteria (IMMEDIATE ACTION REQUIRED)

### Stop and Rollback if ANY of these occur:
- ❌ **Core tests fail** that were previously passing
- ❌ **Application won't start** or crashes on startup
- ❌ **Import errors** in any module
- ❌ **Data corruption** or army files won't load
- ❌ **UI becomes unresponsive** or shows errors

### Rollback Process:
1. **Revert changes immediately:** `git checkout -- .` or manual undo
2. **Verify stability restored:** Run full test suite
3. **Document what went wrong:** Add to STABILITY_BASELINE.md
4. **Analyze root cause** before attempting again

## Change Documentation

### After Successful Change:
- [ ] **Update STABILITY_BASELINE.md** with new stable state
- [ ] **Document any new test requirements**
- [ ] **Note any breaking changes** for future reference
- [ ] **Update this checklist** if new risks discovered

## Emergency Contacts
- **Stable baseline command:** `pytest tests/smoke/ tests/integration/ tests/unit/ -v`
- **Quick smoke test:** Start app + load sample-army-BA.json + verify UI
- **Rollback command:** Revert all changes and re-run baseline tests
