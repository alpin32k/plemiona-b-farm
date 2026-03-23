// ==UserScript==
// @name         Plemiona - Auto Budowanie Ekonomii
// @version      0.0.3
// @description  Automatyczne kolejkowanie Tartaku, Cegielni i Huty na stronie ratusza
// @author       Skrypt Plemiona
// @match        https://pl*.plemiona.pl/game.php*screen=main*
// @match        https://*.plemiona.pl/game.php*screen=main*
// @match        http://pl*.plemiona.pl/game.php*screen=main*
// @match        http://*.plemiona.pl/game.php*screen=main*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const DEBUG = true;
    const STORAGE_KEY = 'alpine-build-economy-gui';

    const TARGET_BUILDINGS = ['wood', 'stone', 'iron'];
    const BUILDING_NAMES = { wood: 'Tartak', stone: 'Cegielnia', iron: 'Huta żelaza' };

    const DEFAULT_LAYOUT = {
        targetLevel: 25,
        autoBuild: false,
        autoRefreshMs: { min: 60000, max: 120000 },
        priorytet: 'najnizszy',
        budujZagrodaGdyZaMala: false,
        budujSpichlerzGdyZaMaly: true,
        pokazKomunikat: true
    };

    const AUX_BUILDINGS = { farm: 'Zagroda', storage: 'Spichlerz' };

    function getLayoutConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) };
        } catch (_) {}
        return { ...DEFAULT_LAYOUT };
    }

    function saveLayoutConfig(layout) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
        } catch (e) { log('Błąd zapisu: ' + e.message); }
    }

    function log(msg) {
        console.log('[Build Economy]', msg);
    }

    function pokazKomunikat(text, typ = 'info') {
        if (!getLayoutConfig().pokazKomunikat) return;
        if (typeof UI !== 'undefined' && UI.InfoMessage) {
            UI.InfoMessage(text, 3000, typ);
        } else {
            log(text);
        }
    }

    function pobierzSurowce() {
        const wood = parseInt(document.getElementById('wood')?.textContent?.replace(/\s/g, '') || '0', 10) || 0;
        const stone = parseInt(document.getElementById('stone')?.textContent?.replace(/\s/g, '') || '0', 10) || 0;
        const iron = parseInt(document.getElementById('iron')?.textContent?.replace(/\s/g, '') || '0', 10) || 0;
        const storage = parseInt(document.getElementById('storage')?.textContent?.replace(/\s/g, '') || '0', 10) || 0;
        return { wood, stone, iron, storage };
    }

    function pobierzDaneBudynkow() {
        const wyniki = [];
        for (const bid of TARGET_BUILDINGS) {
            const row = document.getElementById('main_buildrow_' + bid);
            if (!row) continue;

            const levelMatch = (row.querySelector('span[style*="font-size"]')?.textContent || '').match(/(\d+)/);
            const level = levelMatch ? parseInt(levelMatch[1], 10) : 0;

            const costWood = parseInt(row.querySelector('.cost_wood')?.dataset?.cost || '0', 10) || 0;
            const costStone = parseInt(row.querySelector('.cost_stone')?.dataset?.cost || '0', 10) || 0;
            const costIron = parseInt(row.querySelector('.cost_iron')?.dataset?.cost || '0', 10) || 0;

            const buildOptions = row.querySelector('.build_options');
            let buildLink = null;
            let canBuild = false;
            let reason = '';

            if (buildOptions) {
                const btns = buildOptions.querySelectorAll('a.btn-build[data-level-next]');
                for (const b of btns) {
                    if (b.style.display !== 'none' && b.offsetParent !== null) {
                        buildLink = b;
                        break;
                    }
                }
                const inactive = buildOptions.querySelector('.inactive');
                if (inactive) {
                    const txt = (inactive.textContent || '').trim();
                    const low = txt.toLowerCase();
                    if (txt.includes('Surowce dostępne') || low.includes('surowce dostępne')) reason = 'surowce';
                    else if (low.includes('spichlerz')) reason = 'spichlerz';
                    else if (low.includes('zagroda')) reason = 'zagroda';
                    else reason = txt || 'blokada';
                }
                if (buildLink && !buildLink.style.display) canBuild = true;
            }

            const maxed = row.querySelector('.inactive.center')?.textContent?.includes('całkowicie');
            wyniki.push({
                id: bid,
                name: BUILDING_NAMES[bid],
                level,
                costWood, costStone, costIron,
                buildLink,
                canBuild,
                reason,
                maxed
            });
        }
        return wyniki;
    }

    function pobierzDaneBudynku(bid) {
        const row = document.getElementById('main_buildrow_' + bid);
        if (!row) return null;

        const levelMatch = (row.querySelector('span[style*="font-size"]')?.textContent || '').match(/(\d+)/);
        const level = levelMatch ? parseInt(levelMatch[1], 10) : 0;

        const buildOptions = row.querySelector('.build_options');
        let buildLink = null;
        let canBuild = false;

        if (buildOptions) {
            const btns = buildOptions.querySelectorAll('a.btn-build[data-level-next]');
            for (const b of btns) {
                if (b.style.display !== 'none' && b.offsetParent !== null) {
                    buildLink = b;
                    canBuild = true;
                    break;
                }
            }
        }

        const maxed = row.querySelector('.inactive.center')?.textContent?.includes('całkowicie');
        return {
            id: bid,
            name: AUX_BUILDINGS[bid] || BUILDING_NAMES[bid],
            level,
            buildLink,
            canBuild,
            maxed
        };
    }

    function czyCosBuduje() {
        const queue = document.getElementById('buildqueue');
        if (queue && queue.querySelector('tr[class*="buildorder"]')) return true;
        const selectors = [
            '.buildingList .building',
            '#build_queue .building',
            '.build_queue li',
            '.constructionList .building',
            '.nowrap.building'
        ];
        for (const sel of selectors) {
            try {
                const items = document.querySelectorAll(sel);
                if (items.length > 0) return true;
            } catch (_) {}
        }
        return false;
    }

    /** Sprawdza czy budynek jest już w kolejce budowy (#buildqueue) – także tartak/cegielnia/huta */
    function czyBudowacWKolejce(bid) {
        const queueMap = {
            storage: 'buildorder_storage',
            farm: 'buildorder_farm',
            wood: 'buildorder_wood',
            stone: 'buildorder_stone',
            iron: 'buildorder_iron'
        };
        const cls = queueMap[bid];
        if (!cls) return false;
        const queue = document.getElementById('buildqueue');
        if (!queue) return false;
        return !!queue.querySelector('tr.' + cls);
    }

    function wybierzBudynekDoBudowy(dane, surowce, cfg) {
        const blokadaZagroda = dane.some(d => d.reason === 'zagroda');
        const blokadaSpichlerz = dane.some(d => d.reason === 'spichlerz');

        if (blokadaZagroda && cfg.budujZagrodaGdyZaMala && !czyBudowacWKolejce('farm')) {
            const farm = pobierzDaneBudynku('farm');
            if (farm && farm.canBuild && !farm.maxed) return farm;
        }
        if (blokadaSpichlerz && cfg.budujSpichlerzGdyZaMaly && !czyBudowacWKolejce('storage')) {
            const storage = pobierzDaneBudynku('storage');
            if (storage && storage.canBuild && !storage.maxed) return storage;
        }

        const target = cfg.targetLevel || 25;
        const dostepne = dane.filter(
            d => d.canBuild && !d.maxed && d.level < target && !czyBudowacWKolejce(d.id)
        );
        if (dostepne.length === 0) return null;
        if (dostepne.length === 1) return dostepne[0];

        if ((cfg.priorytet || 'najnizszy') === 'najnizszy') {
            dostepne.sort((a, b) => a.level - b.level);
            return dostepne[0];
        }
        dostepne.sort((a, b) => a.level - b.level);
        return dostepne[0];
    }

    /** Zwraca plan budowy: lista budynków w kolejności (następny, potem kolejne) */
    function pobierzPlanBudowy(cfg, wybrany, maxItems = 15) {
        const plan = [];
        const target = cfg.targetLevel || 25;
        const dane = pobierzDaneBudynkow();
        const blokadaZagroda = dane.some(d => d.reason === 'zagroda');
        const blokadaSpichlerz = dane.some(d => d.reason === 'spichlerz');

        /** Pomocnicze: pokaż w planie zawsze gdy blokada (nie wymagaj canBuild – wtedy widać „brak surowców”) */
        const addAux = (bid, label, blokada, opcjaWlaczona) => {
            if (!blokada) return;
            const b = pobierzDaneBudynku(bid);
            if (!b || b.maxed) return;
            if (czyBudowacWKolejce(bid)) {
                plan.push({
                    name: label,
                    level: b.level,
                    next: b.level + 1,
                    id: bid,
                    canBuild: false,
                    note: 'już w kolejce budowy'
                });
                return;
            }
            const sufix = !opcjaWlaczona ? ' (włącz opcję auto-budowy)' : '';
            const brakSurowcow = !b.canBuild ? ' – brak surowców' : '';
            plan.push({
                name: label,
                level: b.level,
                next: b.level + 1,
                id: bid,
                canBuild: b.canBuild && opcjaWlaczona,
                note: (sufix + brakSurowcow).trim() || undefined
            });
        };

        addAux('farm', 'Zagroda', blokadaZagroda, cfg.budujZagrodaGdyZaMala);
        addAux('storage', 'Spichlerz', blokadaSpichlerz, cfg.budujSpichlerzGdyZaMaly);

        const eko = dane
            .filter(d => !d.maxed && d.level < target)
            .sort((a, b) => a.level - b.level);
        for (const d of eko) {
            const nextLvl = d.level + 1;
            if (czyBudowacWKolejce(d.id)) {
                plan.push({
                    name: d.name,
                    level: d.level,
                    next: nextLvl,
                    id: d.id,
                    canBuild: false,
                    note: 'już w kolejce budowy'
                });
            } else {
                plan.push({ name: d.name, level: d.level, next: nextLvl, id: d.id, canBuild: d.canBuild });
            }
        }

        const result = plan.slice(0, maxItems);
        if (wybrany) {
            const idx = result.findIndex(p => p.id === wybrany.id && p.level === wybrany.level);
            if (idx >= 0) result[idx].isNext = true;
        }
        return result;
    }

    function wykonajBudowe() {
        const cfg = getLayoutConfig();
        if (!cfg.autoBuild) return;

        if (czyCosBuduje()) {
            if (DEBUG) log('Kolejka budowy zajęta – pomijam');
            if (cfg.autoRefreshMs?.max > 0 && !document.getElementById('be-gui-countdown')?.textContent) {
                const ms = zaplanujOdswiezenie();
                if (ms) pokazCountdown(ms);
            }
            return;
        }

        const surowce = pobierzSurowce();
        const dane = pobierzDaneBudynkow();
        const wybrany = wybierzBudynekDoBudowy(dane, surowce, cfg);

        if (!wybrany) {
            if (cfg.autoRefreshMs?.max > 0 && !document.getElementById('be-gui-countdown')?.textContent) {
                const ms = zaplanujOdswiezenie();
                if (ms) pokazCountdown(ms);
            }
            return;
        }

        try {
            wybrany.buildLink.click();
            pokazKomunikat('Rozpoczęto budowę: ' + wybrany.name + ' poziom ' + (wybrany.level + 1));
            log('Kliknięto budowę: ' + wybrany.name + ' → poziom ' + (wybrany.level + 1));
        } catch (e) {
            log('Błąd przy budowaniu: ' + e.message);
        }
    }

    let odswiezZaplanowane = false;

    function zaplanujOdswiezenie() {
        if (odswiezZaplanowane) return 0;
        const cfg = getLayoutConfig();
        if (!cfg.autoRefreshMs?.max) return 0;
        const minMs = cfg.autoRefreshMs.min || 60000;
        const maxMs = cfg.autoRefreshMs.max || 120000;
        const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
        odswiezZaplanowane = true;
        log('Odświeżenie za ' + Math.round(ms / 1000) + ' s');
        setTimeout(() => location.reload(), ms);
        return ms;
    }

    let countdownIntervalId = null;

    function pokazCountdown(ms) {
        const el = document.getElementById('be-gui-countdown');
        if (!el) return;
        if (countdownIntervalId) clearInterval(countdownIntervalId);
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

    function pokazGUI() {
        if (document.getElementById('be-economy-gui')) return;

        const panel = document.createElement('div');
        panel.id = 'be-economy-gui';
        panel.innerHTML = `
            <div class="be-gui-header">
                <span>🏗️ AutoEKONOMIA</span>
                <div class="be-gui-header-right">
                    <span class="be-gui-countdown" id="be-gui-countdown" title="Odświeżenie strony"></span>
                    <button type="button" class="be-gui-toggle" title="Zwiń/Rozwiń">−</button>
                </div>
            </div>
            <div class="be-gui-body">
                <div class="be-gui-status" id="be-gui-status">Ładowanie...</div>
                <div class="be-gui-plan-wrap">
                    <div class="be-gui-plan-title">📋 Plan budowy</div>
                    <div class="be-gui-plan" id="be-gui-plan"></div>
                </div>
                <div class="be-gui-budynki" id="be-gui-budynki"></div>
                <div class="be-gui-surowce" id="be-gui-surowce"></div>
                <button type="button" class="be-gui-build" id="be-gui-build">▶ Buduj teraz</button>
                <div class="be-gui-config-mini">
                    <label class="be-gui-check"><input type="checkbox" id="be-gui-autobuild"> Auto-buduj</label>
                    <label class="be-gui-check"><input type="checkbox" id="be-gui-autorefresh"> Auto-odśwież</label>
                </div>
                <details class="be-gui-info">
                    <summary>⚙️ Konfiguracja</summary>
                    <div class="be-gui-config-content" id="be-gui-config-content"></div>
                </details>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #be-economy-gui {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 99999;
                width: 300px;
                background: linear-gradient(180deg, #3d2c1e 0%, #2a1f16 100%);
                border: 2px solid #8b6914;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
                font-family: 'Trebuchet MS', Arial, sans-serif;
                color: #e8d5b5;
                overflow: hidden;
            }
            #be-economy-gui.be-gui-collapsed .be-gui-body { display: none; }
            #be-economy-gui.be-gui-collapsed { width: auto; }
            #be-economy-gui.be-gui-collapsed .be-gui-toggle { transform: rotate(-90deg); }
            .be-gui-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: rgba(0,0,0,0.3);
                cursor: move;
                user-select: none;
            }
            .be-gui-header span:first-child { font-weight: bold; font-size: 15px; }
            .be-gui-header-right { display: flex; align-items: center; gap: 8px; }
            .be-gui-countdown {
                font-size: 13px !important;
                color: #8b6914;
                padding: 2px 6px;
                border-radius: 4px;
                background: rgba(139,105,20,0.2);
            }
            .be-gui-countdown:empty { display: none !important; }
            .be-gui-toggle {
                background: transparent;
                border: 1px solid #8b6914;
                color: #e8d5b5;
                width: 24px; height: 24px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
                padding: 0;
            }
            .be-gui-toggle:hover { background: rgba(139,105,20,0.3); }
            .be-gui-body {
                padding: 14px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .be-gui-status { font-size: 13px; color: #c4a35a; min-height: 18px; }
            .be-gui-plan-wrap {
                font-size: 11px;
                padding: 6px 8px;
                background: rgba(0,0,0,0.25);
                border-radius: 4px;
                border-left: 3px solid rgba(139,105,20,0.6);
            }
            .be-gui-plan-title { font-weight: bold; color: #c4a35a; margin-bottom: 4px; font-size: 11px; }
            .be-gui-plan { display: flex; flex-direction: column; gap: 2px; max-height: 120px; overflow-y: auto; }
            .be-gui-plan .be-plan-row {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 2px 4px;
                border-radius: 2px;
                font-size: 11px;
            }
            .be-gui-plan .be-plan-row.be-plan-next {
                background: rgba(107,156,46,0.3);
                color: #9fdc6b;
                font-weight: bold;
            }
            .be-gui-plan .be-plan-row.be-plan-blocked { color: #a08060; opacity: 0.85; }
            .be-gui-plan .be-plan-nr { min-width: 18px; color: #8b6914; }
            .be-gui-budynki {
                font-size: 12px;
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 8px;
                background: rgba(0,0,0,0.2);
                border-radius: 4px;
                border-left: 3px solid rgba(139,105,20,0.5);
            }
            .be-gui-budynki .be-row { display: flex; justify-content: space-between; align-items: center; }
            .be-gui-budynki .be-ok { color: #6b9c2e; }
            .be-gui-budynki .be-brak { color: #c44; }
            .be-gui-budynki .be-max { color: #888; }
            .be-gui-surowce {
                font-size: 11px;
                color: #b8a070;
                padding: 4px 8px;
            }
            .be-gui-build {
                padding: 10px 20px;
                width: 100%;
                background: linear-gradient(180deg, #4a7c23 0%, #2e5a14 100%);
                border: 2px solid #6b9c2e;
                color: #fff;
                font-weight: bold;
                font-size: 14px;
                border-radius: 6px;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            }
            .be-gui-build:hover:not(:disabled) {
                background: linear-gradient(180deg, #5a8c33 0%, #3e6a24 100%);
                transform: translateY(-1px);
            }
            .be-gui-build:disabled { opacity: 0.6; cursor: not-allowed; }
            .be-gui-config-mini {
                display: flex;
                gap: 16px;
                font-size: 12px;
            }
            .be-gui-check { cursor: pointer; display: flex; align-items: center; gap: 6px; }
            .be-gui-check input { cursor: pointer; }
            .be-gui-info { font-size: 11px; color: #b8a070; }
            .be-gui-info summary { cursor: pointer; font-weight: bold; }
            .be-gui-config-content { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
            .be-gui-config-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
            .be-gui-input-num { width: 60px; padding: 3px 6px; background: #2a1f16; border: 1px solid #8b6914; color: #e8d5b5; border-radius: 4px; }
            .be-gui-zapisz {
                padding: 6px 12px;
                background: linear-gradient(180deg, #4a7c23 0%, #2e5a14 100%);
                border: 1px solid #6b9c2e;
                color: #e8d5b5;
                font-size: 11px;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 4px;
            }
            .be-gui-zapisz:hover { background: linear-gradient(180deg, #5a8c33 0%, #3e6a24 100%); }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        const layout = getLayoutConfig();
        document.getElementById('be-gui-autobuild').checked = layout.autoBuild;
        document.getElementById('be-gui-autorefresh').checked = !!layout.autoRefreshMs?.max;

        const configContent = document.getElementById('be-gui-config-content');
        configContent.innerHTML = `
            <div class="be-gui-config-row">
                <span>Cel poziomów:</span>
                <input type="number" id="be-gui-target" min="1" max="30" value="${layout.targetLevel || 25}" class="be-gui-input-num">
            </div>
            <div class="be-gui-config-row">
                <span>Priorytet:</span>
                <select id="be-gui-priorytet" style="background:#2a1f16;border:1px solid #8b6914;color:#e8d5b5;border-radius:4px;padding:3px;">
                    <option value="najnizszy" ${(layout.priorytet || 'najnizszy') === 'najnizszy' ? 'selected' : ''}>Najniższy poziom</option>
                </select>
            </div>
            <div class="be-gui-config-row">
                <span>Auto-odśw. min (s):</span>
                <input type="number" id="be-gui-refresh-min" min="30" value="${Math.round((layout.autoRefreshMs?.min || 60000) / 1000)}" class="be-gui-input-num">
            </div>
            <div class="be-gui-config-row">
                <span>Auto-odśw. max (s):</span>
                <input type="number" id="be-gui-refresh-max" min="60" value="${Math.round((layout.autoRefreshMs?.max || 120000) / 1000)}" class="be-gui-input-num">
            </div>
            <label class="be-gui-check" title="Buduj Zagrodę gdy blokuje ekonomię (np. Huta)"><input type="checkbox" id="be-gui-zagroda" ${layout.budujZagrodaGdyZaMala ? 'checked' : ''}> Buduj Zagrodę gdy za mała</label>
            <label class="be-gui-check" title="Buduj Spichlerz gdy blokuje ekonomię"><input type="checkbox" id="be-gui-spichlerz" ${layout.budujSpichlerzGdyZaMaly ? 'checked' : ''}> Buduj Spichlerz gdy za mały</label>
            <label class="be-gui-check"><input type="checkbox" id="be-gui-pokaz" ${layout.pokazKomunikat ? 'checked' : ''}> Pokaż komunikaty</label>
            <button type="button" class="be-gui-zapisz" id="be-gui-save">💾 Zapisz</button>
        `;

        function odswiezStatus() {
            const statusEl = document.getElementById('be-gui-status');
            const budynkiEl = document.getElementById('be-gui-budynki');
            const surowceEl = document.getElementById('be-gui-surowce');
            const planEl = document.getElementById('be-gui-plan');
            if (!statusEl) return;

            const surowce = pobierzSurowce();
            const dane = pobierzDaneBudynkow();
            const cfg = getLayoutConfig();
            const target = cfg.targetLevel || 25;
            const buduje = czyCosBuduje();
            const next = wybierzBudynekDoBudowy(dane, surowce, cfg);

            let status = buduje ? 'Kolejka budowy zajęta' : '';
            if (!buduje && next) status = 'Następnie: ' + next.name + ' → ' + (next.level + 1);
            else if (!buduje && !next && dane.length > 0) {
                const allMaxed = dane.every(d => d.maxed || d.level >= target);
                status = allMaxed ? `✓ Ekonomia ${target}/${target}/${target} osiągnięta!` : 'Brak surowców / blokada';
            }
            statusEl.textContent = status || 'Sprawdzam...';

            if (planEl) {
                const plan = pobierzPlanBudowy(cfg, buduje ? null : next);
                if (plan.length === 0) {
                    planEl.innerHTML = '<div class="be-plan-row" style="color:#888">Brak planu (cel osiągnięty?)</div>';
                } else {
                    planEl.innerHTML = plan.map((p, i) => {
                        const nr = i + 1;
                        const blocked = p.canBuild === false && !p.isNext;
                        const rowCls = 'be-plan-row' + (p.isNext ? ' be-plan-next' : '') + (blocked ? ' be-plan-blocked' : '');
                        const extra = p.note ? ` ${p.note}` : '';
                        const str = `${p.name} ${p.level}→${p.next}${extra}` + (p.isNext ? ' ← teraz' : '');
                        return `<div class="${rowCls}"><span class="be-plan-nr">${nr}.</span>${str}</div>`;
                    }).join('');
                }
            }

            if (budynkiEl) {
                let html = '';
                for (const d of dane) {
                    const cls = d.maxed || d.level >= target ? 'be-max' : d.canBuild ? 'be-ok' : 'be-brak';
                    const info = d.reason ? ` (${d.reason})` : '';
                    html += `<div class="be-row ${cls}">${d.name}: ${d.level}${info}</div>`;
                }
                budynkiEl.innerHTML = html || '<div style="color:#888">Brak tabeli budynków</div>';
            }

            if (surowceEl) {
                surowceEl.textContent = `📦 ${surowce.wood} / ${surowce.stone} / ${surowce.iron}  |  Pojemność: ${surowce.storage}`;
            }
        }

        odswiezStatus();
        const odswiezInterval = setInterval(() => {
            if (!document.getElementById('be-gui-status')) {
                clearInterval(odswiezInterval);
                return;
            }
            odswiezStatus();
            if (getLayoutConfig().autoBuild) wykonajBudowe();
        }, 2000);

        panel.querySelector('.be-gui-toggle').onclick = () => panel.classList.toggle('be-gui-collapsed');

        document.getElementById('be-gui-build').onclick = () => {
            const cfg = getLayoutConfig();
            const prev = cfg.autoBuild;
            cfg.autoBuild = true;
            saveLayoutConfig(cfg);
            wykonajBudowe();
            cfg.autoBuild = prev;
            saveLayoutConfig(cfg);
            odswiezStatus();
        };

        document.getElementById('be-gui-autobuild').onchange = () => {
            const l = getLayoutConfig();
            l.autoBuild = document.getElementById('be-gui-autobuild').checked;
            saveLayoutConfig(l);
            if (l.autoBuild) wykonajBudowe();
        };

        document.getElementById('be-gui-autorefresh').onchange = () => {
            const l = getLayoutConfig();
            if (document.getElementById('be-gui-autorefresh').checked) {
                l.autoRefreshMs = l.autoRefreshMs || {};
                l.autoRefreshMs.min = l.autoRefreshMs.min || 60000;
                l.autoRefreshMs.max = l.autoRefreshMs.max || 120000;
            } else {
                l.autoRefreshMs = { min: 0, max: 0 };
            }
            saveLayoutConfig(l);
        };

        document.getElementById('be-gui-save').onclick = () => {
            const l = getLayoutConfig();
            l.targetLevel = parseInt(document.getElementById('be-gui-target')?.value || '25', 10) || 25;
            l.priorytet = document.getElementById('be-gui-priorytet')?.value || 'najnizszy';
            const minS = parseInt(document.getElementById('be-gui-refresh-min')?.value || '60', 10) || 60;
            const maxS = parseInt(document.getElementById('be-gui-refresh-max')?.value || '120', 10) || 120;
            l.autoRefreshMs = { min: minS * 1000, max: maxS * 1000 };
            l.budujZagrodaGdyZaMala = document.getElementById('be-gui-zagroda')?.checked === true;
            l.budujSpichlerzGdyZaMaly = document.getElementById('be-gui-spichlerz')?.checked === true;
            l.pokazKomunikat = document.getElementById('be-gui-pokaz')?.checked !== false;
            saveLayoutConfig(l);
            pokazKomunikat('Konfiguracja zapisana.');
        };

        let isDragging = false, startX, startY, startLeft, startTop;
        panel.querySelector('.be-gui-header').addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('be-gui-toggle')) return;
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

        if (layout.autoBuild) {
            setTimeout(() => {
                wykonajBudowe();
            }, 1500);
        }
    }

    function init() {
        const buildingWrapper = document.getElementById('building_wrapper') || document.getElementById('buildings');
        const mainRow = document.getElementById('main_buildrow_wood');
        if (!mainRow && !buildingWrapper) {
            const check = setInterval(() => {
                if (document.getElementById('main_buildrow_wood') || document.getElementById('building_wrapper')) {
                    clearInterval(check);
                    pokazGUI();
                }
            }, 500);
            setTimeout(() => {
                clearInterval(check);
                if (!document.getElementById('be-economy-gui')) pokazGUI();
            }, 8000);
        } else {
            pokazGUI();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
