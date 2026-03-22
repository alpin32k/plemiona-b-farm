// ==UserScript==
// @name         Plemiona - Atak B Asystent Farmera
// @version      1.5
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

    // === KONFIGURACJA ===
    const CONFIG = {
        // Opóźnienie między kliknięciami (ms) - unika wykrycia jako bot
        klikOpóznienie: 400,
        // Skład JEDNEJ kompozycji ataku (ile jednostek na 1 atak) - 0 = nieużywane
        // Na tej podstawie liczona jest max. liczba ataków do wysłania
        // Jednostki: spear, sword, axe, archer, spy, light, marcher, heavy, knight
        minJednostek: {
            spear: 0,    // Pikinier
            sword: 0,    // Miecznik
            axe: 0,      // Topornik
            archer: 0,   // Łucznik
            spy: 1,      // Zwiadowca
            light: 1,    // Lekki kawalerzysta
            marcher: 0,  // Łucznik na koniu
            heavy: 0,    // Ciężki kawalerzysta
            knight: 0    // Rycerz
        },
        // Maksymalny poziom muru - pominij wioski z wyższym murem (0 = wyłączone)
        maxMur: 0,
        // Automatycznie uruchom przy załadowaniu strony
        autoStart: false,
        // Auto-refresh strony gdy autoStart - losowy czas w zakresie (ms)
        autoRefreshWlaczony: true,
        autoRefreshMs: { 
            brakJednostek: { min: 60000, max: 300000 },  // 1-5 min gdy brak jednostek
            poAtaku: { min: 30000, max: 160000 }        // 0.5-2.7 min po wysłaniu
        },
        // Pokaż komunikat o uruchomieniu
        pokazKomunikat: true
    };

    function log(msg) {
        console.log('[Atak B Farmer]', msg);
    }

    function pokazKomunikat(text, typ = 'info') {
        if (!CONFIG.pokazKomunikat) return;
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

    function pobierzLiczbyJednostek() {
        const jednostki = {};
        const unitIds = ['spear', 'sword', 'axe', 'archer', 'spy', 'light', 'marcher', 'heavy', 'knight'];
        for (const unitId of unitIds) {
            const el = document.getElementById(unitId)
                || document.querySelector(`input[name="${unitId}"], input[id="unit_input_${unitId}"]`);
            jednostki[unitId] = el ? parseInt(el.value || el.textContent || '0', 10) : 0;
        }
        return jednostki;
    }

    function ileKompozycjiMogeWyslac() {
        const min = CONFIG.minJednostek;
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
        if (CONFIG.autoRefreshWlaczony === false) return false;
        const cfg = CONFIG.autoRefreshMs;
        if (!cfg || typeof cfg !== 'object') return false;
        const brak = cfg.brakJednostek, poAt = cfg.poAtaku;
        return (brak && brak.max > 0) || (poAt && poAt.max > 0);
    }

    function zaplanujRefresh(fromAutoStart, typ) {
        if (!fromAutoStart || CONFIG.autoRefreshWlaczony === false) return 0;
        const cfg = CONFIG.autoRefreshMs;
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
            const min = CONFIG.minJednostek;
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

        // Zbierz przyciski (mur + limit kompozycji)
        const doKlikniecia = [];
        for (let i = 0; i < przyciskiB.length && doKlikniecia.length < maxKompozycji; i++) {
            if (CONFIG.maxMur > 0 && !sprawdzMur(i, CONFIG.maxMur)) continue;
            doKlikniecia.push(przyciskiB[i]);
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
            }, i * CONFIG.klikOpóznienie);
        });

        const msg = maxKompozycji === Infinity
            ? 'Wysyłanie ' + doKlikniecia.length + ' ataków B...'
            : 'Wysyłanie ' + doKlikniecia.length + ' ataków B (max ' + maxKompozycji + ' kompozycji)';
        pokazKomunikat(msg);
        log('Zaplanowano ' + doKlikniecia.length + ' kliknięć');

        // Auto-refresh po wysłaniu (tylko gdy autoStart)
        if (fromAutoStart && CONFIG.autoRefreshWlaczony !== false) {
            const cfg = CONFIG.autoRefreshMs;
            const ref = cfg && typeof cfg === 'object' ? cfg.poAtaku : null;
            if (ref && ref.max > 0) {
                const ms = losowyCzasMs(ref);
                const czasKlikania = doKlikniecia.length * CONFIG.klikOpóznienie;
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
                <div class="am-gui-status" id="am-gui-status">Ładowanie...</div>
                <div class="am-gui-jednostki" id="am-gui-jednostki"></div>
                <label class="am-gui-check">
                    <input type="checkbox" id="am-gui-autostart" ${CONFIG.autoStart ? 'checked' : ''}>
                    Auto-start przy załadowaniu
                </label>
                <label class="am-gui-check" id="am-gui-autorefresh-label">
                    <input type="checkbox" id="am-gui-autorefresh" ${czyRefreshWlaczony() ? 'checked' : ''}>
                    Auto-refresh (losowo: brak jed. / po ataku)
                </label>
                <button type="button" class="am-gui-start" id="am-gui-start">▶ START</button>
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
                padding: 12px;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .am-gui-status {
                font-size: 12px;
                color: #c4a35a;
                min-height: 18px;
            }
            .am-gui-jednostki {
                font-size: 11px;
                display: flex;
                flex-direction: column;
                gap: 2px;
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
                border-top: 1px solid rgba(139,105,20,0.5);
                padding-top: 8px;
                margin-top: 4px;
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
                statusEl.textContent = `Dostępnych ataków B: ${dostepnych} (z ${przyciski.length} – limit jednostek)`;
            } else {
                statusEl.textContent = `Dostępnych ataków B: ${dostepnych}`;
            }
            // Lista jednostek: nazwa: kompozycji (mam/naAtak)
            if (jednostkiEl) {
                const min = CONFIG.minJednostek;
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
        setInterval(odswiezStatus, 2000);

        // Toggle collapse
        panel.querySelector('.am-gui-toggle').onclick = () => {
            panel.classList.toggle('am-gui-collapsed');
        };

        // Auto-start checkbox
        const autostartChk = document.getElementById('am-gui-autostart');
        autostartChk.onchange = () => CONFIG.autoStart = autostartChk.checked;

        // Auto-refresh checkbox
        const autorefreshChk = document.getElementById('am-gui-autorefresh');
        if (autorefreshChk) autorefreshChk.onchange = () => {
            CONFIG.autoRefreshWlaczony = autorefreshChk.checked;
        };

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
                if (CONFIG.autoStart) {
                    if (plunderList.querySelector('a.farm_icon_b')) {
                        setTimeout(() => startujKlikanie(true), 1000);
                    } else if (czyRefreshWlaczony()) {
                        const cfg = CONFIG.autoRefreshMs;
                        const ref = cfg && cfg.brakJednostek ? cfg.brakJednostek : null;
                        const ms = ref && ref.max > 0 ? losowyCzasMs(ref) : 60000;
                        pokazKomunikat('Brak ataków B. Odświeżenie za ' + Math.round(ms / 1000) + ' s...', 'error');
                        setTimeout(() => location.reload(), ms);
                        pokazCountdown(ms, 'brakJednostek');
                    }
                } else if (!CONFIG.autoStart) {
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
