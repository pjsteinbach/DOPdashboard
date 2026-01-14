const partidosInfo = {};
const partidos = [];

const _findKeyIgnoreCase = (obj, keyLower) => {
    if (!obj) return undefined;
    return Object.keys(obj).find(k => k.toLowerCase() === keyLower);
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('./asset/data/partidos.csv');
        if (!res.ok) throw new Error(`Error fetching partidos.csv: ${res.status}`);
        const text = await res.text();

        const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim() !== '');
        if (lines.length === 0) return;

        const splitter = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
        const strip = s => s.trim().replace(/^"(.*)"$/s, (_, g) => g.replace(/""/g, '"'));
        const headers = lines[0].split(splitter).map(h => strip(h));

        const partidoIdx = headers.findIndex(h => h.toLowerCase() === 'partido');

        lines.slice(1).forEach(line => {
            const cols = line.split(splitter).map(c => strip(c));
            const obj = {};
            headers.forEach((h, i) => obj[h] = cols[i] === undefined ? '' : cols[i]);

            const name = (partidoIdx !== -1 ? (cols[partidoIdx] ?? '') : (cols[0] ?? '')).toString().trim();
            if (!name) return;

            partidosInfo[name] = obj;
            // evitar duplicados
            if (!partidos.includes(name)) partidos.push(name);

            // programar inserción de la opción por defecto una vez (se ejecutará
            // después de que todos los listeners de DOMContentLoaded hayan terminado)
            if (!partidos._defaultScheduled) {
                partidos._defaultScheduled = true;
                Promise.resolve().then(() => {
                    const select = document.getElementById('municipioSelect');
                    if (!select) return;
                    // si ya existe una opción con value '' no duplicar
                    const hasEmpty = Array.from(select.options).some(o => o.value === '');
                    if (!hasEmpty) {
                        const opt = document.createElement('option');
                        opt.value = '';
                        opt.textContent = 'Seleccione un partido';
                        opt.selected = true;
                        select.insertBefore(opt, select.firstChild);
                    } else {
                        // asegurar que la opción vacía esté primera y seleccionada
                        const firstEmpty = Array.from(select.options).find(o => o.value === '');
                        if (firstEmpty) {
                            select.insertBefore(firstEmpty, select.firstChild);
                            select.value = '';
                        }
                    }
                });
            }
        });

        partidos.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

        // (re)llenar el select si ya existe en DOM
        const select = document.getElementById('municipioSelect');
        if (select) {
            select.innerHTML = '';
            const fragment = document.createDocumentFragment();
            partidos.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                fragment.appendChild(option);
            });
            select.appendChild(fragment);

            // si hay una opción preseleccionada, disparar change para poblar tablas
            if (select.value) select.dispatchEvent(new Event('change'));
        }

        // exponer para uso/debug
        window.partidosInfo = partidosInfo;
    } catch (err) {
        console.error('Error cargando info.csv:', err);
    }
});

partidos.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('municipioSelect');
    if (!select) return;

    // If select is already populated (more than the empty placeholder), avoid duplicating options
    if (select.options.length > 1) {
        // If nothing is selected, explicitly ensure the empty option is selected
        if (!select.value) select.value = '';
        return;
    }

    // Ensure there's an empty default option first
    let firstEmpty = Array.from(select.options).find(o => o.value === '');
    if (!firstEmpty) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Seleccione un partido';
        opt.selected = true;
        select.appendChild(opt);
    } else {
        // ensure it's selected when there's no other selection
        if (!select.value) select.value = '';
    }

    const fragment = document.createDocumentFragment();
    partidos.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        fragment.appendChild(option);
    });
    select.appendChild(fragment);
});

// Cargar y parsear CSV simple (maneja comillas dobles y comas dentro de campos)
function parseCSV(text) {
    const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return [];
    const splitter = /,(?=(?:[^"]*"[^"]*")*[^"]*$)/;
    const strip = s => s.trim().replace(/^"(.*)"$/s, (_, g) => g.replace(/""/g, '"'));
    const headers = lines[0].split(splitter).map(h => strip(h));
    return lines.slice(1).map(line => {
        const cols = line.split(splitter).map(c => strip(c));
        const obj = {};
        headers.forEach((h, i) => obj[h] = cols[i] === undefined ? '' : cols[i]);
        return obj;
    });
}

async function loadCSV(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Error fetching ${path}: ${res.status}`);
    const text = await res.text();
    return parseCSV(text);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [horas, bombas] = await Promise.all([
            loadCSV('./asset/data/horas.csv'),
            loadCSV('./asset/data/bombas.csv')
        ]);
        // Exponer los arrays para uso posterior
        window.horasData = horas;
        window.bombasData = bombas;
        console.log('horas.csv cargado:', horas.length, 'registros');
        console.log('bombas.csv cargado:', bombas.length, 'registros');
    } catch (err) {
        console.error('Error cargando CSVs:', err);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('municipioSelect');
    const tableHoras = document.getElementById('table-horas');
    const tableBombas = document.getElementById('table-bombas');
    const tableConvenios = document.getElementById('table-convenios');
    const tablecanos = document.getElementById('table-canos');
    if (!select || !tableHoras || !tableBombas || !tableConvenios || !tablecanos) return;

    const findPartidoKey = (obj) => Object.keys(obj).find(k => k.toLowerCase() === 'partido');

    // helper to get field value ignoring case
    const getField = (obj, name) => {
        if (!obj) return '';
        const k = _findKeyIgnoreCase(obj, name.toLowerCase());
        return k ? (obj[k] ?? '').toString() : '';
    };

    // load convenios.csv and caños.csv (try both ñ and n variants for safety)
    (async () => {
        try {
            const conveniosPromise = loadCSV('./asset/data/convenios.csv').catch(() => []);
            const canosPromise = loadCSV('./asset/data/caños.csv')
                .catch(() => loadCSV('./asset/data/canos.csv').catch(() => []));
            const [convenios, canos] = await Promise.all([conveniosPromise, canosPromise]);
            window.conveniosData = Array.isArray(convenios) ? convenios : [];
            window.canosData = Array.isArray(canos) ? canos : [];
        } catch (err) {
            console.error('Error cargando convenios/caños:', err);
            window.conveniosData = [];
            window.canosData = [];
        }
    })();

    const buildConveniosTable = (tableEl, rows) => {
        tableEl.innerHTML = '';
        if (!rows || rows.length === 0) {
            const tbody = document.createElement('tbody');
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.textContent = 'No hay datos';
            td.colSpan = 1;
            tr.appendChild(td);
            tbody.appendChild(tr);
            tableEl.appendChild(tbody);
            return;
        }

        const keys = ['tipo', 'afectación', 'estado', 'ubicación'];
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        keys.forEach(k => {
            const th = document.createElement('th');
            th.textContent = k.toUpperCase();
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        tableEl.appendChild(thead);

        const tbody = document.createElement('tbody');
        rows.forEach(r => {
            const tr = document.createElement('tr');

            // tipo
            const tdTipo = document.createElement('td');
            tdTipo.textContent = getField(r, 'tipo');
            tr.appendChild(tdTipo);

            // afectación
            const tdAfect = document.createElement('td');
            tdAfect.textContent = getField(r, 'afectación') || getField(r, 'afectacion');
            tr.appendChild(tdAfect);

            // estado
            const tdEstado = document.createElement('td');
            tdEstado.textContent = getField(r, 'estado');
            tr.appendChild(tdEstado);

            // ubicación as anchor with href from field "link"
            const tdUb = document.createElement('td');
            const ubicText = getField(r, 'ubicación') || getField(r, 'ubicacion') || '';
            const href = getField(r, 'link') || getField(r, 'url') || '';
            if (ubicText && href) {
                const a = document.createElement('a');
                a.href = href;
                a.textContent = ubicText;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                tdUb.appendChild(a);
            } else if (ubicText) {
                tdUb.textContent = ubicText;
            } else if (href) {
                const a = document.createElement('a');
                a.href = href;
                a.textContent = href;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                tdUb.appendChild(a);
            } else {
                tdUb.textContent = '';
            }
            tr.appendChild(tdUb);

            tbody.appendChild(tr);
        });
        tableEl.appendChild(tbody);
    };

    const buildCanosTable = (tableEl, rows) => {
        tableEl.innerHTML = '';
        if (!rows || rows.length === 0) {
            const tbody = document.createElement('tbody');
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.textContent = 'No hay datos';
            td.colSpan = 1;
            tr.appendChild(td);
            tbody.appendChild(tr);
            tableEl.appendChild(tbody);
            return;
        }

        const keys = ['fecha', 'material', 'diametro', 'entregados'];
        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        keys.forEach(k => {
            const th = document.createElement('th');
            th.textContent = k.toUpperCase();
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        tableEl.appendChild(thead);

        const tbody = document.createElement('tbody');
        rows.forEach(r => {
            const tr = document.createElement('tr');
            keys.forEach(k => {
                const td = document.createElement('td');
                td.textContent = getField(r, k);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        tableEl.appendChild(tbody);
    };

    const updateConveniosAndCanosFor = (partido) => {
        const convenios = Array.isArray(window.conveniosData) ? window.conveniosData : [];
        const canos = Array.isArray(window.canosData) ? window.canosData : [];

        const filteredConvenios = convenios.filter(c => partidoMatches(c, partido));
        const filteredCanos = canos.filter(c => partidoMatches(c, partido));

        buildConveniosTable(tableConvenios, filteredConvenios);
        buildCanosTable(tablecanos, filteredCanos);
    };

    // wire up select to update convenios and caños as well
    select.addEventListener('change', () => {
        updateConveniosAndCanosFor(select.value || '');
    });

    // initial populate if preselected
    if (select.value) updateConveniosAndCanosFor(select.value);

    const partidoMatches = (obj, partido) => {
        const key = findPartidoKey(obj);
        if (!key) return false;
        const val = (obj[key] ?? '').toString().trim();
        return val.localeCompare(partido, 'es', { sensitivity: 'base' }) === 0;
    };

    const buildTable = (tableEl, rows) => {
        // Clear existing content
        tableEl.innerHTML = '';

        if (!rows || rows.length === 0) {
            const tbody = document.createElement('tbody');
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.textContent = 'No hay datos';
            td.colSpan = 1;
            tr.appendChild(td);
            tbody.appendChild(tr);
            tableEl.appendChild(tbody);
            return;
        }

        // Use keys from first row to build header (preserves CSV order)
        let keys = Object.keys(rows[0]);

        // For table-horas omit the 'partido', 'inicio', 'final' and 'inversion' columns
        if (tableEl.id === 'table-horas') {
            keys = keys.filter(k => {
                const lowerKey = k.toLowerCase();
                return lowerKey !== 'id' && lowerKey !== 'partido' && lowerKey !== 'inicio' && lowerKey !== 'final' && lowerKey !== 'inversion';
            });
        }
        // For table-bombas omit 'partido' and 'coordenadas' from visible columns
        if (tableEl.id === 'table-bombas') {
            keys = keys.filter(k => {
                const kl = k.toLowerCase();
                return kl !== 'partido' && kl !== 'coordenadas';
            });
        }

        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        keys.forEach(k => {
            const th = document.createElement('th');
            th.textContent = k.toUpperCase();
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        tableEl.appendChild(thead);

        const tbody = document.createElement('tbody');
        rows.forEach(r => {
            const tr = document.createElement('tr');
            keys.forEach(k => {
                const td = document.createElement('td');
                const keyLower = k.toLowerCase();
                const val = r[k] ?? '';

                // For table-horas, render 'maps' and 'ficha' as anchors with text 'link'
                if (tableEl.id === 'table-horas' && (keyLower === 'maps' || keyLower === 'ficha')) {
                    if (val !== '') {
                        const a = document.createElement('a');
                        a.href = val;
                        a.textContent = 'link';
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        td.appendChild(a);
                    } else {
                        td.textContent = '';
                    }
                }
                // For table-bombas, display 'ubicación' as an anchor whose href is the row's 'coordenadas'
                else if (tableEl.id === 'table-bombas' && (keyLower === 'ubicación' || keyLower === 'ubicacion')) {
                    const coordKey = Object.keys(r).find(k2 => k2.toLowerCase() === 'coordenadas');
                    const coordVal = coordKey ? (r[coordKey] ?? '') : '';
                    if (val !== '') {
                        if (coordVal) {
                            const a = document.createElement('a');
                            a.href = coordVal;
                            a.textContent = val;
                            a.target = '_blank';
                            a.rel = 'noopener noreferrer';
                            td.appendChild(a);
                        } else {
                            td.textContent = val;
                        }
                    } else {
                        td.textContent = '';
                    }
                } else {
                    td.textContent = val;
                }

                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        tableEl.appendChild(tbody);
    };

    const updateTablesFor = (partido) => {
        // Ensure data is available
        const horas = Array.isArray(window.horasData) ? window.horasData : [];
        const bombas = Array.isArray(window.bombasData) ? window.bombasData : [];

        const filteredHoras = horas.filter(h => partidoMatches(h, partido));
        const filteredBombas = bombas.filter(b => partidoMatches(b, partido));

        buildTable(tableHoras, filteredHoras);
        buildTable(tableBombas, filteredBombas);
    };

    // update on change
    select.addEventListener('change', () => {
        updateTablesFor(select.value || '');
    });

    // initial populate (in case there's a preselected option)
    if (select.value) updateTablesFor(select.value);

    // --- Button active toggle logic ---
    const tableBtn = document.getElementById('table_button');
    const mapBtn = document.getElementById('map_button');
    const mapSection = document.getElementById('map-section');
    const tableSection = document.getElementById('table-section');

    const setActiveButton = (which) => {
        if (!tableBtn || !mapBtn) return;
        if (which === 'table') {
            tableBtn.classList.add('active');
            mapBtn.classList.remove('active');
            if (tableSection) {
                tableSection.style.display = '';
                tableSection.setAttribute('aria-hidden', 'false');
            }
            if (mapSection) {
                mapSection.style.display = 'none';
                mapSection.setAttribute('aria-hidden', 'true');
            }
        } else if (which === 'map') {
            mapBtn.classList.add('active');
            tableBtn.classList.remove('active');
            if (mapSection) {
                mapSection.style.display = '';
                mapSection.setAttribute('aria-hidden', 'false');
            }
            if (tableSection) {
                tableSection.style.display = 'none';
                tableSection.setAttribute('aria-hidden', 'true');
            }
        }
    };

    if (tableBtn) {
        tableBtn.addEventListener('click', () => setActiveButton('table'));
    }
    if (mapBtn) {
        mapBtn.addEventListener('click', () => setActiveButton('map'));
    }

    // Optional: keep current active state if one button already has .active on load
    if (tableBtn?.classList.contains('active')) setActiveButton('table');
    else if (mapBtn?.classList.contains('active')) setActiveButton('map');
});

(function(){
    const summaryList = document.getElementById('summary-list');
    const grid = document.querySelector('.grid-2x2');
    const select = document.getElementById('municipioSelect');

    if (!grid || !summaryList) return;

    function countRowsInTable(table){
        if(!table) return 0;

        // special sums for certain tables
        if (table.id === 'table-horas') return sumColumnInTable(table, ['horas']);
        if (table.id === 'table-canos') return sumColumnInTable(table, ['entregados']);

        const tbody = table.tBodies && table.tBodies.length ? table.tBodies[0] : table.querySelector('tbody');
        if(!tbody) return 0;
        // count only TR elements that are not empty and not the "No hay datos" placeholder row
        return Array.from(tbody.querySelectorAll('tr')).filter(tr => {
            const cells = Array.from(tr.querySelectorAll('td,th'));
            if (cells.length === 0) return false;
            const hasMeaningful = cells.some(cell => {
                const txt = (cell.textContent || '').trim();
                if (txt && txt.toLowerCase() !== 'no hay datos') return true;
                if (cell.querySelector('a[href], button, input')) return true;
                return false;
            });
            return hasMeaningful;
        }).length;
    }

    function sumColumnInTable(table, possibleNames){
        const tbody = table.tBodies && table.tBodies.length ? table.tBodies[0] : table.querySelector('tbody');
        if(!tbody) return 0;

        // find header index (case-insensitive)
        let headers = Array.from(table.querySelectorAll('thead th'));
        let colIndex = -1;
        if (headers.length > 0) {
            headers.some((th, idx) => {
                const txt = (th.textContent || '').trim().toLowerCase();
                if (possibleNames.some(n => n.toLowerCase() === txt)) {
                    colIndex = idx;
                    return true;
                }
                return false;
            });
        } else {
            // fallback: try first row's cells as headers
            const firstRow = table.querySelector('tr');
            if (firstRow) {
                headers = Array.from(firstRow.children);
                headers.some((th, idx) => {
                    const txt = (th.textContent || '').trim().toLowerCase();
                    if (possibleNames.some(n => n.toLowerCase() === txt)) {
                        colIndex = idx;
                        return true;
                    }
                    return false;
                });
            }
        }

        // if header not found, try to infer by looking for numeric cells and summing any numeric-looking column
        if (colIndex === -1) {
            // try to find any column whose header contains a possible name substring
            headers.some((th, idx) => {
                const txt = (th.textContent || '').trim().toLowerCase();
                if (possibleNames.some(n => txt.includes(n.toLowerCase()))) {
                    colIndex = idx;
                    return true;
                }
                return false;
            });
        }

        // if still not found, return 0
        if (colIndex === -1) return 0;

        let sum = 0;
        Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
            const cells = Array.from(tr.querySelectorAll('td,th'));
            if (cells.length <= colIndex) return;
            let raw = (cells[colIndex].textContent || '').trim();
            if (!raw) return;

            // normalize numbers: handle thousand separators and decimal comma
            let t = raw.replace(/\s/g, '');
            if (t.includes(',') && t.includes('.')) {
                // assume dots are thousands, comma decimal
                t = t.replace(/\./g, '').replace(',', '.');
            } else {
                // replace comma with dot (decimal comma)
                t = t.replace(',', '.');
            }
            // remove any non-numeric except minus and dot
            t = t.replace(/[^0-9\.\-]+/g, '');
            const n = parseFloat(t);
            if (!isNaN(n)) sum += n;
        });

        // format: integer if whole, otherwise keep up to 2 decimals
        if (Number.isInteger(sum)) return sum;
        return parseFloat(sum.toFixed(2));
    }

    function buildSummary(){
        summaryList.innerHTML = '';
        const cards = Array.from(grid.querySelectorAll('.card'));
        if(cards.length === 0){
            const li = document.createElement('li');
            li.innerHTML = '<span class="count">0</span><span class="title">Sin secciones</span>';
            summaryList.appendChild(li);
            return;
        }
        cards.forEach(card => {
            const title = (card.querySelector('h2') && card.querySelector('h2').textContent.trim()) || 'Sin título';
            const table = card.querySelector('table');
            const count = countRowsInTable(table) || 0;
            const li = document.createElement('li');
            li.innerHTML = '<span class="count">' + count + '</span><span class="title">' + title + '</span>';
            summaryList.appendChild(li);
        });
    }

    // update after small delay to allow other scripts to populate tables
    function delayedUpdate(delay = 80){ clearTimeout(delayedUpdate._t); delayedUpdate._t = setTimeout(buildSummary, delay); }

    // initial build
    document.addEventListener('DOMContentLoaded', delayedUpdate);
    // also run immediately in case DOMContentLoaded already fired
    delayedUpdate(0);

    // update when select changes
    if(select){
        select.addEventListener('change', () => delayedUpdate(120));
    }

    // observe changes to the grid (table contents inserted/changed)
    const observer = new MutationObserver(() => delayedUpdate(40));
    observer.observe(grid, { childList: true, subtree: true, characterData: true, attributes: true });

    // optional: expose a function for other scripts to trigger the summary update
    window.__updateSummaryAside = delayedUpdate;
})();

document.addEventListener('DOMContentLoaded', async () => {
    const select = document.getElementById('municipioSelect');
    const extractP = document.getElementById('extract-p');
    const extractT = document.getElementById('extract-t');
    // Force empty default title so when nothing is selected the H4 is blank
    const defaultTitle = '';

    // set title h4 based on selected partido (tries partidosInfo case-insensitive, falls back to the raw name)
    const setExtractTitle = (partido) => {
        if (!extractT) return;
        if (!partido) {
            extractT.textContent = defaultTitle;
            return;
        }

        let title = partido;
        try {
            // try direct lookup
            if (partidosInfo && partidosInfo[partido]) {
                const info = partidosInfo[partido];
                const key = _findKeyIgnoreCase(info, 'partido') || _findKeyIgnoreCase(info, 'nombre');
                if (key && info[key]) title = info[key].toString();
            } else if (partidosInfo) {
                // try case-insensitive match
                const foundKey = Object.keys(partidosInfo).find(k =>
                    k.localeCompare(partido, 'es', { sensitivity: 'base' }) === 0
                );
                if (foundKey) {
                    const info = partidosInfo[foundKey];
                    const key = _findKeyIgnoreCase(info, 'partido') || _findKeyIgnoreCase(info, 'nombre');
                    if (key && info[key]) title = info[key].toString();
                }
            }
        } catch (e) {
            // ignore lookup errors and fallback to partido
        }
        extractT.textContent = title;
    };

    // update title on change and initialize (ensure blank when nothing selected)
    if (select) {
        select.addEventListener('change', () => setExtractTitle(select.value || ''));
        setExtractTitle(select.value || '');
    }
    if (!select || !extractP) return;

    // preserve default content to restore when no selection
    const defaultContent = extractP.innerHTML;

    // load datainfo.csv and build map by partido (case/diacritics insensitive matching later)
    let datainfoMap = {};
    try {
        const rows = await loadCSV('./asset/data/info.csv').catch(() => []);
        rows.forEach(r => {
            const partidoKey = _findKeyIgnoreCase(r, 'partido') || Object.keys(r)[0];
            const partido = (r[partidoKey] ?? '').toString().trim();
            if (!partido) return;
            const extractKey = _findKeyIgnoreCase(r, 'extracto') || _findKeyIgnoreCase(r, 'extract');
            const extractVal = extractKey ? (r[extractKey] ?? '').toString() : '';
            datainfoMap[partido] = extractVal;
        });
    } catch (err) {
        console.error('Error cargando datainfo.csv:', err);
    }
    // expose for debugging if needed
    window.datainfoMap = datainfoMap;

    const lookupExtractFor = (partido) => {
        if (!partido) return null;
        // find key in datainfoMap ignoring case/diacritics
        const found = Object.keys(datainfoMap).find(k =>
            k.localeCompare(partido, 'es', { sensitivity: 'base' }) === 0
        );
        return found ? datainfoMap[found] : null;
    };

    const updateExtract = () => {
        const partido = select.value || '';
        if (!partido) {
            // restore default
            extractP.innerHTML = defaultContent;
            return;
        }
        const txt = lookupExtractFor(partido);
        if (txt && txt !== '') {
            // set as plain text to avoid injecting HTML from CSV; restore defaultHtml when empty
            extractP.textContent = txt;
        } else {
            extractP.innerHTML = defaultContent;
        }
    };

    select.addEventListener('change', updateExtract);
    // initial populate if preselected
    const escapeHTML = s => s == null ? '' : String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const applyExtractWithBreaks = () => {
        const partido = select.value || '';
        const txt = lookupExtractFor(partido);
        if (txt && txt !== '') {
            // escapar HTML del CSV y luego reemplazar '|' por <br>
            extractP.innerHTML = escapeHTML(txt).replace(/\|/g, '<br>');
        } else {
            // restaurar comportamiento original (default content)
            updateExtract();
        }
    };

    select.addEventListener('change', applyExtractWithBreaks);
    // initial populate si preseleccionado
    if (select.value) applyExtractWithBreaks();
});
document.addEventListener('DOMContentLoaded', () => {
    const copyBtn = document.getElementById('copy-icon');
    const extract = document.getElementById('extract-p');
    const extractT = document.getElementById('extract-t');
    if (!copyBtn || !extract) return;

    copyBtn.addEventListener('click', async () => {
        const title = extractT ? ((extractT.innerText || extractT.textContent || '').toString().trim()) : '';
        const body = (extract.innerText || extract.textContent || '').toString().trim();
        const text = title ? (title + ':\n' + body) : body;
        if (!text) return;

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.setAttribute('readonly', '');
                ta.style.position = 'absolute';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                ta.setSelectionRange(0, ta.value.length);
                document.execCommand('copy');
                document.body.removeChild(ta);
            }

            // breve indicación visual accesible
            copyBtn.setAttribute('aria-live', 'polite');
            copyBtn.setAttribute('aria-label', 'Copiado');
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.setAttribute('aria-label', 'Copiar');
            }, 1500);
        } catch (err) {
            console.error('Error copiando al portapapeles:', err);
        }
    });
});

document.addEventListener('DOMContentLoaded', async () => {
    const select = document.getElementById('municipioSelect');
    const iframe = document.getElementById('iframe-selected');
    if (!select || !iframe) return;

    // load info.csv and build a map partido -> iframe value (case preserved)
    let rows = [];
    try {
        rows = await loadCSV('./asset/data/info.csv').catch(() => []);
    } catch (err) {
        rows = [];
    }

    const iframeMap = {};
    rows.forEach(r => {
        const partidoKey = _findKeyIgnoreCase(r, 'partido') || Object.keys(r)[0];
        const partido = (r[partidoKey] ?? '').toString().trim();
        if (!partido) return;
        const iframeKey = _findKeyIgnoreCase(r, 'iframe');
        const iframeVal = iframeKey ? (r[iframeKey] ?? '').toString().trim() : '';
        if (iframeVal) iframeMap[partido] = iframeVal;
    });

    const lookupIframeFor = (partido) => {
        if (!partido) return null;
        const found = Object.keys(iframeMap).find(k =>
            k.localeCompare(partido, 'es', { sensitivity: 'base' }) === 0
        );
        return found ? iframeMap[found] : null;
    };

    const updateIframe = () => {
        const partido = select.value || '';
        const src = lookupIframeFor(partido);
        if (src) {
            if (iframe.getAttribute('src') !== src) iframe.setAttribute('src', src);
        } else {
            // remove src when no matching iframe to avoid showing stale content
            iframe.removeAttribute('src');
        }
    };

    select.addEventListener('change', updateIframe);
    // initial update if preselected
    if (select.value) updateIframe();
});

