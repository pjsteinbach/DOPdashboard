const partidosInfo = {};
const partidos = [];

const _findKeyIgnoreCase = (obj, keyLower) => {
    if (!obj) return undefined;
    return Object.keys(obj).find(k => k.toLowerCase() === keyLower);
};

document.addEventListener('DOMContentLoaded', () => {
    const iframe = document.getElementById('iframe-selected');
    const select = document.getElementById('municipioSelect');
    if (!iframe || !select) return;

    const updateIframe = () => {
        const partido = select.value || '';
        const info = partidosInfo[partido] ?? null;
        const iframeKey = _findKeyIgnoreCase(info, 'iframe');
        const src = iframeKey ? (info[iframeKey] ?? '').toString().trim() : '';

        if (src) {
            iframe.src = src;
        } else {
            // Si no hay valor, eliminar el atributo src para que no cargue nada
            iframe.removeAttribute('src');
        }
    };

    // Actualizar cuando el usuario cambie la selección
    select.addEventListener('change', updateIframe);

    // Observar cambios en las opciones (cuando se cargan desde info.csv)
    const mo = new MutationObserver(() => updateIframe());
    mo.observe(select, { childList: true });

    // Llamada inicial por si ya hay una opción preseleccionada
    updateIframe();
});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('./asset/data/info.csv');
        if (!res.ok) throw new Error(`Error fetching info.csv: ${res.status}`);
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

        const keys = ['fecha', 'diametro', 'solicitados', 'retirados', 'pendientes'];
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

        // For table-horas omit the 'partido' column
        if (tableEl.id === 'table-horas') {
            keys = keys.filter(k => k.toLowerCase() !== 'partido');
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
        const tbody = table.tBodies && table.tBodies.length ? table.tBodies[0] : table.querySelector('tbody');
        if(!tbody) return 0;
        // count only TR elements that are not empty and not the "No hay datos" placeholder row
        return Array.from(tbody.querySelectorAll('tr')).filter(tr => {
            const cells = Array.from(tr.querySelectorAll('td,th'));
            if (cells.length === 0) return false;
            // consider row meaningful if any cell has non-empty text (other than the placeholder)
            // or contains an interactive element (like an anchor)
            const hasMeaningful = cells.some(cell => {
                const txt = (cell.textContent || '').trim();
                if (txt && txt.toLowerCase() !== 'no hay datos') return true;
                // if there's an anchor or other interactive element, count it as meaningful
                if (cell.querySelector('a[href], button, input')) return true;
                return false;
            });
            return hasMeaningful;
        }).length;
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