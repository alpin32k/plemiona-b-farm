// ==UserScript==
// @name         Plemiona - Atak B Asystent Farmera
// @version      1.10
// @description  Automatyczne klikanie przycisków Atak B w Asystencie Farmera
// @author       Skrypt Plemiona
// @match        https://pl*.plemiona.pl/game.php*screen=am_farm*
// @match        https://*.plemiona.pl/game.php*screen=am_farm*
// @match        http://pl*.plemiona.pl/game.php*screen=am_farm*
// @match        http://*.plemiona.pl/game.php*screen=am_farm*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'alpine-farmer-gui';
    const DEFAULT_LAYOUT = {
        minJednostek: { spear: 0, sword: 0, axe: 0, archer: 0, spy: 1, light: 1, marcher: 0, heavy: 0, knight: 0 },
        maxMur: 0,
        minSurowiec: { wlaczony: false, wood: 1000, clay: 0, iron: 0 },
        autoStart: false,
        autoRefreshWlaczony: true,
        autoRefreshMs: { brakJednostek: { min: 60000, max: 300000 }, poAtaku: { min: 30000, max: 160000 } },
        klikOpóznienie: 400,
        pokazKomunikat: true
    };

    const UNIT_IDS = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'knight'];

    function pobierzMinJednostekZeStrony() {
        const iconB = document.querySelector('.farm_icon_b, a.farm_icon_b');
        if (!iconB) return null;
        const iconRow = iconB.closest('tr');
        if (!iconRow) return null;
        const inputRow = iconRow.nextElementSibling;
        if (!inputRow) return null;
        let templateId = null;
        const hiddenId = inputRow.querySelector('input[name^="template["]');
        if (hiddenId) templateId = hiddenId.value || (hiddenId.name.match(/\[(\d+)\]/) || [])[1];
        if (!templateId) {
            const anyUnit = inputRow.querySelector('input[name^="spear["], input[name^="sword["]');
            if (anyUnit && anyUnit.name) templateId = (anyUnit.name.match(/\[(\d+)\]/) || [])[1];
        }
        if (!templateId) return null;
        const minJednostek = {};
        let hasAny = false;
        for (const unitId of UNIT_IDS) {
            const el = inputRow.querySelector(`input[name="${unitId}[${templateId}]"]`);
            const val = el ? (parseInt(el.value || '0', 10) || 0) : 0;
            minJednostek[unitId] = val;
            if (val > 0) hasAny = true;
        }
        return hasAny ? minJednostek : null;
    }

    function pobierzDaneZeStrony() {
        const dane = {};
        const minJedn = pobierzMinJednostekZeStrony();
        if (minJedn) dane.minJednostek = minJedn;
        return dane;
    }

    function getLayoutConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                return {
                    ...DEFAULT_LAYOUT,
                    ...saved,
                    minJednostek: { ...DEFAULT_LAYOUT.minJednostek, ...(saved.minJednostek || {}) },
                    autoRefreshMs: { ...DEFAULT_LAYOUT.autoRefreshMs, ...(saved.autoRefreshMs || {}) },
                    minSurowiec: { ...DEFAULT_LAYOUT.minSurowiec, ...(saved.minSurowiec || {}) }
                };
            }
            const zStrony = pobierzDaneZeStrony();
            return {
                ...DEFAULT_LAYOUT,
                ...zStrony,
                minJednostek: { ...DEFAULT_LAYOUT.minJednostek, ...(zStrony.minJednostek || {}) }
            };
        } catch {
            const zStrony = pobierzDaneZeStrony();
            return {
                ...DEFAULT_LAYOUT,
                ...zStrony,
                minJednostek: { ...DEFAULT_LAYOUT.minJednostek, ...(zStrony.minJednostek || {}) }
            };
        }
    }

    function saveLayoutConfig(layout) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
        } catch (e) { log('Błąd zapisu do localStorage: ' + e.message); }
    }

    function getRuntimeConfig(key) {
        const layout = getLayoutConfig();
        return layout[key];
    }

    function setRuntimeConfig(key, value) {
        const layout = getLayoutConfig();
        if (key === 'minJednostek' && typeof value === 'object') {
            layout.minJednostek = { ...layout.minJednostek, ...value };
        } else {
            layout[key] = value;
        }
        saveLayoutConfig(layout);
    }

    function log(msg) {
        console.log('[Atak B Farmer]', msg);
    }

    function pokazKomunikat(text, typ = 'info') {
        if (!getRuntimeConfig('pokazKomunikat')) return;
        // Plemiona ma UI.InfoMessage jeśli istnieje
        if (typeof UI !== 'undefined' && UI.InfoMessage) {
            UI.InfoMessage(text, 3000, typ);
        } else {
            log(text);
        }
    }

    function sprawdzMur(rowIndex, maxLvl) {
        if (maxLvl <= 0) return true;
        const rows = document.querySelectorAll('#plunder_list tr:not(:first-child)');
        const row = rows[rowIndex];
        if (!row) return true;
        const cells = row.querySelectorAll('td');
        const murCell = cells[6];
        if (!murCell) return true;
        const murLvl = parseInt(murCell.textContent.trim(), 10);
        return isNaN(murLvl) || murLvl < maxLvl;
    }

    function pobierzSurowceZRzedu(row) {
        const cells = row.querySelectorAll('td');
        const resCell = cells[5];
        if (!resCell) return { wood: 0, clay: 0, iron: 0 };
        const nowraps = resCell.querySelectorAll('.nowrap');
        const res = (i) => parseInt(nowraps[i]?.querySelector('.res')?.textContent || '0', 10) || 0;
        return { wood: res(0), clay: res(1), iron: res(2) };
    }

    function sprawdzMinSurowiec(btnOrRow, cfg) {
        if (!cfg?.wlaczony) return true;
        const row = btnOrRow?.closest ? btnOrRow.closest('tr') : btnOrRow;
        if (!row) return true;
        const surowce = pobierzSurowceZRzedu(row);
        for (const typ of ['wood', 'clay', 'iron']) {
            const minVal = cfg[typ] || 0;
            if (minVal <= 0) continue;
            if ((surowce[typ] || 0) < minVal) return false;
        }
        return true;
    }

    function pobierzLiczbyJednostek() {
        const jednostki = {};
        const unitsHome = document.getElementById('units_home');
        for (const unitId of UNIT_IDS) {
            let count = 0;
            if (unitsHome) {
                const el = unitsHome.querySelector(`#${unitId}, .unit-item-${unitId}`);
                if (el) {
                    count = parseInt(el.dataset?.unitCount ?? el.textContent ?? '0', 10) || 0;
                }
            } else {
                const fallback = document.getElementById(unitId) || document.querySelector(`input[name="${unitId}"]`);
                if (fallback && !fallback.closest('#am-farmer-gui')) {
                    count = parseInt(fallback.dataset?.unitCount ?? fallback.value ?? fallback.textContent ?? '0', 10) || 0;
                }
            }
            jednostki[unitId] = count;
        }
        return jednostki;
    }

    function aktualizujSzablonB(minJednostek) {
        if (!minJednostek || typeof minJednostek !== 'object') return 0;
        const iconB = document.querySelector('.farm_icon_b, a.farm_icon_b');
        if (!iconB) return 0;
        const iconRow = iconB.closest('tr');
        if (!iconRow) return 0;
        const inputRow = iconRow.nextElementSibling;
        if (!inputRow) return 0;
        let templateId = null;
        const hiddenId = inputRow.querySelector('input[name^="template["]');
        if (hiddenId) templateId = hiddenId.value || (hiddenId.name.match(/\[(\d+)\]/) || [])[1];
        if (!templateId) {
            const anyUnit = inputRow.querySelector(`input[name^="spear["], input[name^="sword["]`);
            if (anyUnit && anyUnit.name) templateId = (anyUnit.name.match(/\[(\d+)\]/) || [])[1];
        }
        if (!templateId) return 0;
        let zaktualizowane = 0;
        for (const unitId of UNIT_IDS) {
            const val = minJednostek[unitId];
            if (val == null || val < 0) continue;
            const v = String(Math.max(0, val));
            const el = inputRow.querySelector(`input[name="${unitId}[${templateId}]"]`);
            if (el && el.value !== v) {
                el.value = v;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                zaktualizowane++;
            }
        }
        if (zaktualizowane > 0) {
            log('Szablon B zaktualizowany (' + zaktualizowane + ' pól, template ' + templateId + ')');
            const zapiszBtn = inputRow.closest('form')?.querySelector('input[type="submit"][value="Zapisz"], button[type="submit"]');
            if (zapiszBtn) {
                zapiszBtn.click();
                log('Kliknięto Zapisz – wysłano formularz');
            }
        }
        return zaktualizowane;
    }

    function ileKompozycjiMogeWyslac() {
        const min = getRuntimeConfig('minJednostek');
        const dostepne = pobierzLiczbyJednostek();
        let maxKompozycji = Infinity;
        let maWymagania = false;
        for (const [unitId, naAtak] of Object.entries(min)) {
            if (naAtak <= 0) continue;
            maWymagania = true;
            const mam = dostepne[unitId] || 0;
            const ile = Math.floor(mam / naAtak);
            if (ile < maxKompozycji) maxKompozycji = ile;
        }
        return maWymagania ? maxKompozycji : Infinity;
    }

    let countdownIntervalId = null;

    function pokazCountdown(ms, typ) {
        const el = document.getElementById('am-gui-countdown');
        if (!el) return;
        if (countdownIntervalId) clearInterval(countdownIntervalId);
        const typLabel = typ === 'poAtaku' ? 'Po ataku' : 'Brak jednostek';
        el.title = 'Odświeżenie: ' + typLabel;
        el.textContent = 'Odśw. za ' + Math.ceil(ms / 1000) + 's';
        el.style.display = '';
        const endTime = Date.now() + ms;
        countdownIntervalId = setInterval(() => {
            const remaining = Math.max(0, endTime - Date.now());
            if (remaining <= 0) {
                clearInterval(countdownIntervalId);
                countdownIntervalId = null;
                el.textContent = '';
                el.style.display = 'none';
                return;
            }
            el.textContent = 'Odśw. za ' + Math.ceil(remaining / 1000) + 's';
        }, 500);
    }

    function losowyCzasMs(ref) {
        if (!ref || typeof ref.min !== 'number' || typeof ref.max !== 'number') return 60000;
        return Math.floor(Math.random() * (ref.max - ref.min + 1)) + ref.min;
    }

    function czyRefreshWlaczony() {
        if (getRuntimeConfig('autoRefreshWlaczony') === false) return false;
        const cfg = getRuntimeConfig('autoRefreshMs');
        if (!cfg || typeof cfg !== 'object') return false;
        const brak = cfg.brakJednostek, poAt = cfg.poAtaku;
        return (brak && brak.max > 0) || (poAt && poAt.max > 0);
    }

    function zaplanujRefresh(fromAutoStart, typ) {
        if (!fromAutoStart || getRuntimeConfig('autoRefreshWlaczony') === false) return 0;
        const cfg = getRuntimeConfig('autoRefreshMs');
        if (!cfg || typeof cfg !== 'object') return 0;
        const ref = typ === 'poAtaku' ? cfg.poAtaku : cfg.brakJednostek;
        if (!ref || ref.max <= 0) return 0;
        const ms = losowyCzasMs(ref);
        log('Zaplanowano odświeżenie strony za ' + Math.round(ms / 1000) + ' s (' + (typ === 'poAtaku' ? 'po ataku' : 'brak jednostek') + ')');
        setTimeout(() => {
            log('Odświeżanie strony...');
            location.reload();
        }, ms);
        pokazCountdown(ms, typ);
        return ms;
    }

    function startujKlikanie(fromAutoStart = false) {
        const przyciskiB = document.querySelectorAll('#plunder_list a.farm_icon_b');
        if (przyciskiB.length === 0) {
            const ms = zaplanujRefresh(fromAutoStart, 'brakJednostek');
            const refreshMsg = ms > 0 ? ' Odświeżenie za ' + Math.round(ms / 1000) + ' s...' : '';
            pokazKomunikat('Brak przycisków Atak B.' + refreshMsg, 'error');
            log('Nie znaleziono przycisków a.farm_icon_b');
            return;
        }

        const nazwyJednostek = { spear: 'Pikinier', sword: 'Miecznik', axe: 'Topornik', archer: 'Łucznik', spy: 'Zwiadowca', light: 'Lekki kawalerzysta', marcher: 'Łucznik na koniu', heavy: 'Ciężki kawalerzysta', knight: 'Rycerz' };

        // Ile kompozycji mogę wysłać (minJednostek = skład 1 ataku)
        let maxKompozycji = ileKompozycjiMogeWyslac();
        if (maxKompozycji <= 0) {
            const min = getRuntimeConfig('minJednostek');
            for (const [unitId, naAtak] of Object.entries(min)) {
                if (naAtak <= 0) continue;
                const dostepne = pobierzLiczbyJednostek();
                const mam = dostepne[unitId] || 0;
                if (mam < naAtak) {
                    const nazwa = nazwyJednostek[unitId] || unitId;
                    const ms = zaplanujRefresh(fromAutoStart, 'brakJednostek');
                    const refreshMsg = ms > 0 ? ` Odświeżenie za ${Math.round(ms / 1000)} s...` : '';
                    pokazKomunikat(`Za mało ${nazwa}. Na atak: ${naAtak}, masz: ${mam}.${refreshMsg}`, 'error');
                    return;
                }
            }
        }

        // Zbierz przyciski (mur + minSurowiec + limit kompozycji)
        const maxMurVal = getRuntimeConfig('maxMur');
        const minSurowiecCfg = getRuntimeConfig('minSurowiec');
        const doKlikniecia = [];
        for (let i = 0; i < przyciskiB.length && doKlikniecia.length < maxKompozycji; i++) {
            const btn = przyciskiB[i];
            if (maxMurVal > 0 && !sprawdzMur(i, maxMurVal)) continue;
            if (!sprawdzMinSurowiec(btn, minSurowiecCfg)) continue;
            doKlikniecia.push(btn);
        }

        doKlikniecia.forEach((btn, i) => {
            setTimeout(() => {
                const jeszczeMoge = ileKompozycjiMogeWyslac();
                if (jeszczeMoge <= 0) {
                    log('Brak jednostek – przerwano wysyłanie');
                    return;
                }
                try {
                    btn.click();
                    log('Kliknięto atak B #' + (i + 1) + '/' + doKlikniecia.length + ' (dostępnych kompozycji: ' + jeszczeMoge + ')');
                } catch (e) {
                    log('Błąd przy klikaniu: ' + e.message);
                }
            }, i * getRuntimeConfig('klikOpóznienie'));
        });

        const msg = maxKompozycji === Infinity
            ? 'Wysyłanie ' + doKlikniecia.length + ' ataków B...'
            : 'Wysyłanie ' + doKlikniecia.length + ' ataków B (max ' + maxKompozycji + ' kompozycji)';
        pokazKomunikat(msg);
        log('Zaplanowano ' + doKlikniecia.length + ' kliknięć');

        // Auto-refresh po wysłaniu (tylko gdy autoStart)
        if (fromAutoStart && getRuntimeConfig('autoRefreshWlaczony') !== false) {
            const cfg = getRuntimeConfig('autoRefreshMs');
            const ref = cfg && typeof cfg === 'object' ? cfg.poAtaku : null;
            if (ref && ref.max > 0) {
                const ms = losowyCzasMs(ref);
                const czasKlikania = doKlikniecia.length * getRuntimeConfig('klikOpóznienie');
                const totalMs = czasKlikania + ms;
                log('Odświeżenie po ataku za ' + Math.round(totalMs / 1000) + ' s');
                setTimeout(() => {
                    log('Odświeżanie strony po wysłaniu ataków...');
                    location.reload();
                }, totalMs);
                pokazCountdown(totalMs, 'poAtaku');
            }
        }
    }

    function pokazGUI() {
        if (document.getElementById('am-farmer-gui')) return;

        const panel = document.createElement('div');
        panel.id = 'am-farmer-gui';
        panel.innerHTML = `
            <div class="am-gui-header">
                <span>⚔️ Atak B Farmer</span>
                <div class="am-gui-header-right">
                    <span class="am-gui-countdown" id="am-gui-countdown" title=""></span>
                    <button type="button" class="am-gui-toggle" title="Zwiń/Rozwiń">−</button>
                </div>
            </div>
            <div class="am-gui-body">
                <div class="am-gui-tabs" id="am-gui-tabs"></div>
                <div class="am-gui-tab-panels" id="am-gui-tab-panels">
                    <div class="am-gui-tab-panel" id="am-gui-panel-main">
                        <div class="am-gui-status" id="am-gui-status">Ładowanie...</div>
                        <div class="am-gui-jednostki" id="am-gui-jednostki"></div>
                        <button type="button" class="am-gui-start" id="am-gui-start">▶ START</button>
                    </div>
                    <div class="am-gui-tab-panel am-gui-hidden" id="am-gui-panel-config"></div>
                </div>
                <details class="am-gui-info">
                    <summary>ℹ️ Jak zaakceptować bota?</summary>
                    <div class="am-gui-info-content">
                        <p><strong>Gdy pojawi się sprawdzenie bota (captcha):</strong></p>
                        <ol>
                            <li>Zatrzymaj skrypt – nie klikaj START</li>
                            <li>Rozwiąż captcha w oknie gry (zaznacz „Nie jestem robotem” lub rozwiąż zadanie)</li>
                            <li>Kliknij przycisk potwierdzający (np. „Potwierdź”, „Wyślij”)</li>
                            <li>Odśwież stronę (F5) po pomyślnym rozwiązaniu</li>
                            <li>Poczekaj aż strona się załaduje, potem uruchom skrypt</li>
                        </ol>
                        <p class="am-gui-info-note">⚠️ Skrypt nie zadziała dopóki sprawdzenie bota nie zostanie zaakceptowane.</p>
                    </div>
                </details>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #am-farmer-gui {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 99999;
                width: 260px;
                background: linear-gradient(180deg, #3d2c1e 0%, #2a1f16 100%);
                border: 2px solid #8b6914;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
                font-family: 'Trebuchet MS', Arial, sans-serif;
                color: #e8d5b5;
                overflow: hidden;
            }
            #am-farmer-gui.am-gui-collapsed .am-gui-body { display: none; }
            #am-farmer-gui.am-gui-collapsed { width: auto; }
            #am-farmer-gui.am-gui-collapsed .am-gui-toggle { transform: rotate(-90deg); }
            .am-gui-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: rgba(0,0,0,0.3);
                cursor: move;
                user-select: none;
            }
            .am-gui-header span:first-child { font-weight: bold; font-size: 14px; }
            .am-gui-header-right {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .am-gui-countdown {
                font-size: 11px;
                color: #8b6914;
                font-weight: normal;
                padding: 2px 6px;
                border-radius: 4px;
                background: rgba(139,105,20,0.2);
                cursor: help;
            }
            .am-gui-countdown:empty { display: none !important; }
            .am-gui-toggle {
                background: transparent;
                border: 1px solid #8b6914;
                color: #e8d5b5;
                width: 24px;
                height: 24px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
                padding: 0;
                transition: transform 0.2s;
            }
            .am-gui-toggle:hover { background: rgba(139,105,20,0.3); }
            .am-gui-body {
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .am-gui-tab-panels { display: flex; flex-direction: column; gap: 12px; }
            .am-gui-panel-main { display: flex; flex-direction: column; gap: 12px; }
            .am-gui-status {
                font-size: 12px;
                color: #c4a35a;
                min-height: 18px;
                margin-bottom: 2px;
            }
            .am-gui-jednostki {
                font-size: 11px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                line-height: 1.4;
            }
            .am-gui-unit-ok { color: #6b9c2e; }
            .am-gui-unit-brak { color: #c44; }
            .am-gui-check {
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .am-gui-check input { cursor: pointer; }
            .am-gui-start {
                padding: 10px 20px;
                background: linear-gradient(180deg, #4a7c23 0%, #2e5a14 100%);
                border: 2px solid #6b9c2e;
                color: #fff;
                font-weight: bold;
                font-size: 14px;
                border-radius: 6px;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                transition: all 0.2s;
            }
            .am-gui-start:hover:not(:disabled) {
                background: linear-gradient(180deg, #5a8c33 0%, #3e6a24 100%);
                transform: translateY(-1px);
            }
            .am-gui-start:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            .am-gui-info {
                font-size: 11px;
                color: #b8a070;
                border-top: 1px solid rgba(139,105,20,0.4);
                padding-top: 10px;
                margin-top: 8px;
            }
            .am-gui-info summary {
                cursor: pointer;
                font-weight: bold;
                user-select: none;
            }
            .am-gui-info summary:hover { color: #e8d5b5; }
            .am-gui-info-content {
                margin-top: 8px;
                line-height: 1.5;
            }
            .am-gui-info-content p { margin: 6px 0 4px; }
            .am-gui-info-content ol {
                margin: 4px 0 8px;
                padding-left: 18px;
            }
            .am-gui-info-content li { margin: 2px 0; }
            .am-gui-info-note {
                font-size: 10px;
                color: #c4a35a;
                margin-top: 8px !important;
            }
            .am-gui-tabs { display: none; gap: 6px; margin-bottom: 10px; }
            .am-gui-tabs.visible { display: flex; }
            .am-gui-tab {
                flex: 1; padding: 6px 8px; font-size: 11px;
                background: rgba(0,0,0,0.3); border: 1px solid #8b6914;
                color: #e8d5b5; cursor: pointer; border-radius: 4px;
            }
            .am-gui-tab:hover { background: rgba(139,105,20,0.3); }
            .am-gui-tab.active { background: rgba(139,105,20,0.5); font-weight: bold; }
            .am-gui-tab-panel.am-gui-hidden { display: none !important; }
            #am-gui-panel-config {
                max-height: 400px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding-right: 2px;
            }
            #am-gui-panel-config::-webkit-scrollbar { width: 6px; }
            #am-gui-panel-config::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 3px; }
            #am-gui-panel-config::-webkit-scrollbar-thumb { background: rgba(139,105,20,0.5); border-radius: 3px; }
            .am-gui-config-section {
                font-size: 11px;
                padding: 10px 0;
                border-bottom: 1px solid rgba(139,105,20,0.25);
            }
            .am-gui-config-section:last-of-type { border-bottom: none; }
            .am-gui-config-section strong { display: block; margin: 8px 0 4px; color: #c4a35a; font-size: 11px; }
            .am-gui-config-section strong:first-child { margin-top: 0; }
            .am-gui-config-section .am-gui-config-row { margin: 6px 0; }
            .am-gui-config-section .am-gui-check { margin: 8px 0; }
            .am-gui-config-section .am-gui-check:first-child { margin-top: 0; }
            .am-gui-config-details {
                font-size: 11px;
                border: 1px solid rgba(139,105,20,0.35);
                border-radius: 6px;
                padding: 0;
                margin: 4px 0;
            }
            .am-gui-config-details summary {
                padding: 8px 10px;
                cursor: pointer;
                color: #c4a35a;
                font-weight: bold;
                list-style: none;
                user-select: none;
            }
            .am-gui-config-details summary::-webkit-details-marker { display: none; }
            .am-gui-config-details summary::after { content: " ▾"; font-size: 10px; opacity: 0.7; }
            .am-gui-config-details[open] summary::after { content: " ▴"; }
            .am-gui-config-details summary:hover { color: #e8d5b5; background: rgba(139,105,20,0.15); }
            .am-gui-config-details-inner {
                padding: 8px 10px 10px;
                border-top: 1px solid rgba(139,105,20,0.25);
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .am-gui-config-details-inner strong { margin: 6px 0 2px; font-size: 10px; }
            .am-gui-config-row {
                display: flex; justify-content: space-between; align-items: center;
                margin: 4px 0; font-size: 11px; gap: 8px;
            }
            .am-gui-input-num { width: 68px; padding: 4px 6px; background: #2a1f16; border: 1px solid #8b6914; color: #e8d5b5; border-radius: 4px; flex-shrink: 0; }
            .am-gui-config-row select { min-width: 90px; }
            .am-gui-zapisz {
                margin-top: 6px;
                padding: 8px 14px;
                background: linear-gradient(180deg, #4a5a2e 0%, #3a4a1e 100%);
                border: 1px solid #8b6914;
                color: #e8d5b5;
                font-size: 12px;
                border-radius: 6px;
                cursor: pointer;
                align-self: flex-start;
            }
            .am-gui-zapisz:hover { background: linear-gradient(180deg, #5a6a3e 0%, #4a5a2e 100%); }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        const nazwyJednostek = { spear: 'Pikinier', sword: 'Miecznik', axe: 'Topornik', archer: 'Łucznik', spy: 'Zwiadowca', light: 'Lekka Kawaleria', marcher: 'Łucznik na koniu', heavy: 'Ciężki Kawalerzysta', knight: 'Rycerz' };

        // Aktualizacja statusu - zgodnie z wzorcem minJednostek
        function odswiezStatus() {
            const statusEl = document.getElementById('am-gui-status');
            const jednostkiEl = document.getElementById('am-gui-jednostki');
            if (!statusEl) return;
            const przyciski = document.querySelectorAll('#plunder_list a.farm_icon_b');
            const kompozycje = ileKompozycjiMogeWyslac();
            const dostepnych = kompozycje === Infinity
                ? przyciski.length
                : Math.min(przyciski.length, kompozycje);
            if (przyciski.length === 0) {
                statusEl.textContent = 'Brak ataków B na tej stronie';
            } else if (kompozycje < przyciski.length) {
                statusEl.textContent = `Dostępnych ataków B: ${dostepnych}/${przyciski.length}`;
            } else {
                statusEl.textContent = `Dostępnych ataków B: ${dostepnych}`;
            }
            // Lista jednostek: nazwa: kompozycji (mam/naAtak)
            if (jednostkiEl) {
                const min = getRuntimeConfig('minJednostek');
                const dostepne = pobierzLiczbyJednostek();
                let html = '';
                for (const [unitId, naAtak] of Object.entries(min)) {
                    if (naAtak <= 0) continue;
                    const mam = dostepne[unitId] || 0;
                    const ileKompozycji = Math.floor(mam / naAtak);
                    const nazwa = nazwyJednostek[unitId] || unitId;
                    const cls = ileKompozycji > 0 ? 'am-gui-unit-ok' : 'am-gui-unit-brak';
                    html += `<div class="${cls}">${nazwa}: ${ileKompozycji} (${mam}/${naAtak})</div>`;
                }
                jednostkiEl.innerHTML = html || '<div style="color:#888">Brak wymaganych jednostek w configu</div>';
            }
        }
        odswiezStatus();
        setInterval(odswiezStatus, 1000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') odswiezStatus(); });
        const obsTarget = document.getElementById('units_home') || document.getElementById('plunder_list');
        if (obsTarget) {
            try {
                let debounce = 0;
                const mo = new MutationObserver(() => {
                    clearTimeout(debounce);
                    debounce = setTimeout(odswiezStatus, 150);
                });
                mo.observe(obsTarget, { childList: true, subtree: true, characterData: true });
            } catch (_) {}
        }

        // Toggle collapse
        panel.querySelector('.am-gui-toggle').onclick = () => {
            panel.classList.toggle('am-gui-collapsed');
        };

        // Tabs + config panel – zawsze widoczne
        const tabsEl = document.getElementById('am-gui-tabs');
        const panelMain = document.getElementById('am-gui-panel-main');
        const panelConfig = document.getElementById('am-gui-panel-config');
        const layout = getLayoutConfig();
            const unitIds = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'knight'];
            const unitNames = { spear: 'Pikinier', sword: 'Miecznik', axe: 'Topornik', archer: 'Łucznik', spy: 'Zwiadowca', light: 'Lekka Kawaleria', marcher: 'Łucznik na koniu', heavy: 'Ciężki Kawalerzysta', knight: 'Rycerz' };
            const arMs = layout.autoRefreshMs || {};
            const arBra = arMs.brakJednostek || {};
            const arPo = arMs.poAtaku || {};

            tabsEl.innerHTML = '<button type="button" class="am-gui-tab active" data-tab="main">Główny</button><button type="button" class="am-gui-tab" data-tab="config">⚙️ Konfiguracja</button>';
            tabsEl.classList.add('visible');

            panelConfig.innerHTML = `
                <div class="am-gui-config-section">
                    <label class="am-gui-check"><input type="checkbox" id="am-gui-autostart" ${layout.autoStart ? 'checked' : ''}> Auto-start przy załadowaniu</label>
                    <label class="am-gui-check"><input type="checkbox" id="am-gui-autorefresh" ${layout.autoRefreshWlaczony !== false ? 'checked' : ''}> Auto-refresh (losowo)</label>
                </div>
                <div class="am-gui-config-section">
                    <label class="am-gui-config-row"><span>Max mur (0=wył.):</span><input type="number" id="am-gui-maxmur" min="0" value="${layout.maxMur || 0}" class="am-gui-input-num"></label>
                    <label class="am-gui-config-row"><span>Opóźnienie klik (ms):</span><input type="number" id="am-gui-klik" min="100" value="${layout.klikOpóznienie || 400}" class="am-gui-input-num"></label>
                    <label class="am-gui-check"><input type="checkbox" id="am-gui-pokaz" ${layout.pokazKomunikat ? 'checked' : ''}> Pokaż komunikaty</label>
                </div>
                <details class="am-gui-config-details" open>
                    <summary>⚔️ Jednostki na atak</summary>
                    <div class="am-gui-config-details-inner">
                        ${unitIds.map(u => `<label class="am-gui-config-row"><span>${unitNames[u] || u}:</span><input type="number" id="am-gui-min-${u}" min="0" value="${layout.minJednostek[u] || 0}" class="am-gui-input-num"></label>`).join('')}
                    </div>
                </details>
                <details class="am-gui-config-details">
                    <summary>🔄 Auto-refresh – zakresy (ms)</summary>
                    <div class="am-gui-config-details-inner">
                        <strong>Brak jednostek</strong>
                        <label class="am-gui-config-row"><span>Min:</span><input type="number" id="am-gui-ar-brak-min" min="0" value="${arBra.min || 60000}" class="am-gui-input-num"></label>
                        <label class="am-gui-config-row"><span>Max:</span><input type="number" id="am-gui-ar-brak-max" min="0" value="${arBra.max || 300000}" class="am-gui-input-num"></label>
                        <strong>Po ataku</strong>
                        <label class="am-gui-config-row"><span>Min:</span><input type="number" id="am-gui-ar-po-min" min="0" value="${arPo.min || 30000}" class="am-gui-input-num"></label>
                        <label class="am-gui-config-row"><span>Max:</span><input type="number" id="am-gui-ar-po-max" min="0" value="${arPo.max || 160000}" class="am-gui-input-num"></label>
                    </div>
                </details>
                <details class="am-gui-config-details">
                    <summary>📦 Min. surowiec (filtr wiosek)</summary>
                    <div class="am-gui-config-details-inner">
                        <label class="am-gui-check"><input type="checkbox" id="am-gui-minsurowiec-wlacz" ${(layout.minSurowiec?.wlaczony) ? 'checked' : ''}> Włącz filtr</label>
                        <label class="am-gui-config-row"><span>Drewno:</span><input type="number" id="am-gui-minsurowiec-wood" min="0" value="${layout.minSurowiec?.wood ?? 1000}" class="am-gui-input-num"></label>
                        <label class="am-gui-config-row"><span>Glina:</span><input type="number" id="am-gui-minsurowiec-clay" min="0" value="${layout.minSurowiec?.clay ?? 0}" class="am-gui-input-num"></label>
                        <label class="am-gui-config-row"><span>Żelazo:</span><input type="number" id="am-gui-minsurowiec-iron" min="0" value="${layout.minSurowiec?.iron ?? 0}" class="am-gui-input-num"></label>
                    </div>
                </details>
                <button type="button" class="am-gui-zapisz" id="am-gui-zapisz">💾 Zapisz i zastosuj do szablonu B</button>
            `;

            tabsEl.querySelectorAll('.am-gui-tab').forEach(btn => {
                btn.onclick = () => {
                    tabsEl.querySelectorAll('.am-gui-tab').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    const tab = btn.dataset.tab;
                    panelMain.classList.toggle('am-gui-hidden', tab !== 'main');
                    panelConfig.classList.toggle('am-gui-hidden', tab !== 'config');
                    if (tab === 'main') odswiezStatus();
                };
            });

            function zapiszZConfigu(pokazMsg = false) {
                const l = { minJednostek: {}, maxMur: 0, minSurowiec: { wlaczony: false, wood: 1000, clay: 0, iron: 0 }, klikOpóznienie: 400, autoRefreshMs: {}, pokazKomunikat: true, autoStart: false, autoRefreshWlaczony: true };
                l.autoStart = document.getElementById('am-gui-autostart')?.checked === true;
                l.autoRefreshWlaczony = document.getElementById('am-gui-autorefresh')?.checked !== false;
                unitIds.forEach(u => { l.minJednostek[u] = parseInt(document.getElementById('am-gui-min-' + u)?.value || '0', 10) || 0; });
                l.maxMur = parseInt(document.getElementById('am-gui-maxmur')?.value || '0', 10) || 0;
                l.minSurowiec = {
                    wlaczony: document.getElementById('am-gui-minsurowiec-wlacz')?.checked === true,
                    wood: parseInt(document.getElementById('am-gui-minsurowiec-wood')?.value || '1000', 10) || 0,
                    clay: parseInt(document.getElementById('am-gui-minsurowiec-clay')?.value || '0', 10) || 0,
                    iron: parseInt(document.getElementById('am-gui-minsurowiec-iron')?.value || '0', 10) || 0
                };
                l.klikOpóznienie = Math.max(100, parseInt(document.getElementById('am-gui-klik')?.value || '400', 10)) || 400;
                l.autoRefreshMs = {
                    brakJednostek: { min: parseInt(document.getElementById('am-gui-ar-brak-min')?.value || '60000', 10) || 60000, max: parseInt(document.getElementById('am-gui-ar-brak-max')?.value || '300000', 10) || 300000 },
                    poAtaku: { min: parseInt(document.getElementById('am-gui-ar-po-min')?.value || '30000', 10) || 30000, max: parseInt(document.getElementById('am-gui-ar-po-max')?.value || '160000', 10) || 160000 }
                };
                l.pokazKomunikat = document.getElementById('am-gui-pokaz')?.checked !== false;
                saveLayoutConfig({ ...getLayoutConfig(), ...l });
                const n = aktualizujSzablonB(l.minJednostek);
                if (pokazMsg && n > 0) pokazKomunikat('Konfiguracja zapisana. Szablon B zaktualizowany (' + n + ' pól).');
            }
            const zapiszBtn = document.getElementById('am-gui-zapisz');
            if (zapiszBtn) zapiszBtn.onclick = () => zapiszZConfigu(true);
            panelConfig.querySelectorAll('input, select').forEach(inp => {
                inp.addEventListener('change', zapiszZConfigu);
                if (inp.tagName === 'INPUT') inp.addEventListener('blur', zapiszZConfigu);
            });

        // Start button
        const startBtn = document.getElementById('am-gui-start');
        startBtn.onclick = () => {
            startBtn.disabled = true;
            startujKlikanie();
            setTimeout(() => { startBtn.disabled = false; odswiezStatus(); }, 5000);
        };

        // Przeciąganie panelu
        let isDragging = false, startX, startY, startLeft, startTop;
        const header = panel.querySelector('.am-gui-header');
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('am-gui-toggle')) return;
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            panel.style.left = startLeft + 'px';
            panel.style.top = startTop + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panel.style.left = (startLeft + e.clientX - startX) + 'px';
            panel.style.top = (startTop + e.clientY - startY) + 'px';
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
    }

    function init() {
        if (!document.URL.includes('screen=am_farm')) {
            log('Ten skrypt działa tylko na stronie Asystenta Farmera (am_farm)');
            return;
        }

        // Bot protect / captcha
        if (document.body.dataset && document.body.dataset.botProtect !== undefined) {
            alert('UWAGA: Wykryto Captcha! Rozwiąż ją przed użyciem skryptu.');
            return;
        }

        if (document.querySelector('#bot_check')) {
            alert('UWAGA: Wykryto sprawdzenie bota. Rozwiąż je przed użyciem skryptu.');
            return;
        }

        // Poczekaj aż tabela się załaduje
        let guiPokazane = false;
        const checkReady = setInterval(() => {
            if (guiPokazane) return;
            const plunderList = document.getElementById('plunder_list');
            const gotowe = plunderList && (plunderList.querySelector('a.farm_icon_b') || plunderList.querySelector('tr'));
            if (gotowe) {
                guiPokazane = true;
                clearInterval(checkReady);
                pokazGUI();
                setTimeout(() => aktualizujSzablonB(getRuntimeConfig('minJednostek')), 500);
                if (getRuntimeConfig('autoStart')) {
                    if (plunderList.querySelector('a.farm_icon_b')) {
                        setTimeout(() => startujKlikanie(true), 1000);
                    } else if (czyRefreshWlaczony()) {
                        const cfg = getRuntimeConfig('autoRefreshMs');
                        const ref = cfg && cfg.brakJednostek ? cfg.brakJednostek : null;
                        const ms = ref && ref.max > 0 ? losowyCzasMs(ref) : 60000;
                        pokazKomunikat('Brak ataków B. Odświeżenie za ' + Math.round(ms / 1000) + ' s...', 'error');
                        setTimeout(() => location.reload(), ms);
                        pokazCountdown(ms, 'brakJednostek');
                    }
                } else if (!getRuntimeConfig('autoStart')) {
                    pokazKomunikat('Skrypt gotowy. Użyj przycisku START.');
                }
            }
        }, 500);

        // Timeout - po 10s pokaż GUI anyway
        setTimeout(() => {
            if (!guiPokazane) {
                guiPokazane = true;
                clearInterval(checkReady);
                pokazGUI();
            }
        }, 10000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
