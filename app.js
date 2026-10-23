// ============================================================
// PINCH MASTER PRO - APP.JS
// Developer: Hossein Sahraei
// Version: 7.0
// ============================================================

// ==========================================
// ENGINE
// ==========================================
const Engine = {
    round: (x, n) => Math.round(x * Math.pow(10, n)) / Math.pow(10, n),

    problemTable(streams, dTmin) {
        const hot = streams.filter(s => s.Ts > s.Tt);
        const cold = streams.filter(s => s.Ts < s.Tt);
        const tempsSet = new Set();
        hot.forEach(s => {
            tempsSet.add(this.round(s.Ts - dTmin / 2, 4));
            tempsSet.add(this.round(s.Tt - dTmin / 2, 4));
        });
        cold.forEach(s => {
            tempsSet.add(this.round(s.Ts + dTmin / 2, 4));
            tempsSet.add(this.round(s.Tt + dTmin / 2, 4));
        });
        const temps = Array.from(tempsSet).sort((a, b) => b - a);
        const rows = [];
        for (let i = 0; i < temps.length - 1; i++) {
            const Th = temps[i], Tl = temps[i + 1], dT = Th - Tl;
            const cph = hot.filter(s => s.Ts - dTmin / 2 >= Th - 1e-5 && s.Tt - dTmin / 2 <= Tl + 1e-5).reduce((sum, s) => sum + s.CP, 0);
            const cpc = cold.filter(s => s.Tt + dTmin / 2 >= Th - 1e-5 && s.Ts + dTmin / 2 <= Tl + 1e-5).reduce((sum, s) => sum + s.CP, 0);
            rows.push({ Th, Tl, dT, CPh: cph, CPc: cpc, dH: (cph - cpc) * dT });
        }
        const cascade = [0];
        rows.forEach(r => cascade.push(cascade[cascade.length - 1] + r.dH));
        const minC = Math.min(...cascade);
        const QHmin = Math.max(0, -minC);
        const cascadeCorr = cascade.map(c => c + QHmin);
        const QCmin = cascadeCorr[cascadeCorr.length - 1];
        let pinchShifted, ptype;
        if (QHmin > 1e-5 && QCmin > 1e-5) { pinchShifted = temps[cascade.indexOf(minC)]; ptype = 'internal'; }
        else if (QHmin <= 1e-5) { pinchShifted = temps[0]; ptype = 'threshold_hot'; }
        else { pinchShifted = temps[temps.length - 1]; ptype = 'threshold_cold'; }
        return { temps, rows, cascade, cascadeCorr, QHmin, QCmin, pinchShifted,
            pinchHot: pinchShifted + dTmin / 2, pinchCold: pinchShifted - dTmin / 2, pinchType: ptype };
    },

    exergy(streams, T0 = 298.15) {
        const results = streams.map(s => {
            let dE = 0;
            if (Math.abs(s.Ts - s.Tt) > 1e-5) {
                const Th = s.Ts + 273.15, Tc = s.Tt + 273.15;
                dE = s.CP * ((Tc - Th) - T0 * Math.log(Tc / Th));
            }
            return { name: s.Name, type: s.Ts > s.Tt ? 'Hot' : 'Cold', dE };
        });
        const Esup = -results.filter(r => r.type === 'Hot').reduce((s, r) => s + r.dE, 0);
        const Erec = results.filter(r => r.type === 'Cold').reduce((s, r) => s + r.dE, 0);
        return { results, Esup, Erec, Edest: Esup - Erec, eff: Esup > 0 ? Erec / Esup : 0 };
    },

    waterPinch(waterStreams, freshConc = 0) {
        waterStreams.forEach(s => s.massLoad = s.flow * (s.Cout - s.Cin));
        const concsSet = new Set([freshConc]);
        waterStreams.forEach(s => { concsSet.add(s.Cin); concsSet.add(s.Cout); });
        const concs = Array.from(concsSet).sort((a, b) => a - b);
        const intervals = [];
        for (let i = 0; i < concs.length - 1; i++) {
            const Clow = concs[i], Chigh = concs[i + 1];
            const active = waterStreams.filter(s => s.Cin <= Clow && s.Cout >= Chigh);
            const massLoad = active.reduce((sum, s) => sum + s.flow * (Chigh - Clow), 0);
            intervals.push({ Clow, Chigh, dC: Chigh - Clow, active: active.map(s => s.name).join(', ') || '-', massLoad });
        }
        let cumMass = 0;
        const lwpData = [{ C: freshConc, M: 0 }];
        intervals.forEach(intv => {
            cumMass += intv.massLoad;
            intv.cumMass = cumMass;
            lwpData.push({ C: intv.Chigh, M: cumMass });
        });
        let maxFlow = 0, pinchConc = freshConc, pinchPoint = null;
        lwpData.forEach(pt => {
            if (pt.C > freshConc) {
                const flow = pt.M / (pt.C - freshConc);
                if (flow > maxFlow) { maxFlow = flow; pinchConc = pt.C; pinchPoint = pt; }
            }
        });
        return { intervals, lwpData, FfwMin: maxFlow, FwwMin: maxFlow, pinchConc, pinchPoint, freshConc };
    },

    chp(heatDemand, powerDemand, fuelCost, elecPrice, boilerEff = 0.80, chpElecEff = 0.35, chpHeatEff = 0.50) {
        const fuelBoilerBase = heatDemand / boilerEff;
        const costFuelBase = fuelBoilerBase * fuelCost;
        const costPowerBase = powerDemand * elecPrice;
        const totalCostBase = costFuelBase + costPowerBase;
        const fuelChp = powerDemand / chpElecEff;
        const heatRecovered = fuelChp * chpHeatEff;
        const heatDeficit = Math.max(0, heatDemand - heatRecovered);
        const fuelAuxBoiler = heatDeficit / boilerEff;
        const totalFuelChp = fuelChp + fuelAuxBoiler;
        const totalCostChp = totalFuelChp * fuelCost;
        return {
            base: { fuelBoiler: fuelBoilerBase, costFuel: costFuelBase, costPower: costPowerBase, total: totalCostBase },
            chp: { fuelChp, heatRecovered, heatDeficit, fuelAux: fuelAuxBoiler, totalFuel: totalFuelChp, total: totalCostChp },
            savings: totalCostBase - totalCostChp
        };
    },

    refrigeration(coolingLoad, Tproc, Tamb, dTevap = 5, dTcond = 10, etaIso = 0.70, etaMech = 0.90) {
        const TevapK = (Tproc - dTevap) + 273.15;
        const TcondK = (Tamb + dTcond) + 273.15;
        if (TevapK >= TcondK) return null;
        const COPcarnot = TevapK / (TcondK - TevapK);
        const COPactual = COPcarnot * etaIso * etaMech;
        const power = coolingLoad / COPactual;
        return { Tevap: TevapK - 273.15, Tcond: TcondK - 273.15, COPcarnot, COPactual, power, heatRejected: coolingLoad + power };
    }
};

// ==========================================
// CHARTS - Responsive for Mobile
// ==========================================
const Charts = {
    config: { responsive: true, displaylogo: false, staticPlot: false },
    font: { family: 'Vazirmatn, Tahoma, sans-serif', size: 12 },
    layoutBase: { font: { family: 'Vazirmatn, Tahoma, sans-serif', size: 12 }, plot_bgcolor: '#fafbfc', paper_bgcolor: 'white' },

    cascade(pt, dTmin, targetId = 'cascade-chart') {
        const yPositions = pt.rows.map((_, i) => pt.rows.length - i);
        const dhValues = pt.rows.map(r => r.dH);
        const traces = [{ x: dhValues, y: yPositions, mode: 'markers+text',
              marker: { size: 40, color: dhValues.map(v => v > 0 ? '#667eea' : '#f56565'), line: { width: 2, color: '#2d3748' } },
              text: dhValues.map(v => v.toFixed(1)), textposition: 'middle',
              textfont: { color: 'white', size: 10 }, type: 'scatter' }];
        const layout = { ...this.layoutBase, title: `نمودار آبشاری (ΔTmin = ${dTmin}°C)`,
            xaxis: { title: 'ΔH (kW)', zeroline: true },
            yaxis: { title: 'دمای تنظیم‌شده (°C)', tickvals: yPositions, ticktext: pt.rows.map(r => r.Th.toFixed(1)), autorange: 'reversed' },
            height: 500, autosize: true, margin: { t: 50, b: 60, l: 80, r: 40 } };
        Plotly.newPlot(targetId, traces, layout, this.config);
    },

    composite(pt, targetId = 'composite-chart') {
        const traces = [{ x: pt.cascadeCorr, y: pt.temps, mode: 'lines+markers', line: { color: '#667eea', width: 3 }, marker: { size: 10 } }];
        const layout = { ...this.layoutBase, title: 'منحنی ترکیبی', xaxis: { title: 'آنتالپی (kW)' }, yaxis: { title: 'دمای تنظیم‌شده (°C)' },
            height: 450, autosize: true, margin: { t: 50, b: 60, l: 80, r: 40 } };
        Plotly.newPlot(targetId, traces, layout, this.config);
    },

    gcc(pt, targetId = 'gcc-chart') {
        const traces = [{ x: pt.cascadeCorr, y: pt.temps, mode: 'lines+markers', line: { color: '#764ba2', width: 3 }, marker: { size: 10 } }];
        const layout = { ...this.layoutBase, title: 'منحنی جامع (GCC)',
            xaxis: { title: 'جریان حرارت خالص (kW)' }, yaxis: { title: 'دمای تنظیم‌شده (°C)' }, height: 450, autosize: true,
            margin: { t: 50, b: 60, l: 80, r: 40 },
            shapes: [{ type: 'line', x0: Math.min(...pt.cascadeCorr), x1: Math.max(...pt.cascadeCorr), y0: pt.pinchShifted, y1: pt.pinchShifted, line: { color: '#c53030', width: 2, dash: 'dash' } }],
            annotations: [
                { x: Math.max(...pt.cascadeCorr), y: pt.pinchShifted, text: `Pinch: ${pt.pinchShifted.toFixed(1)}°C`, showarrow: true, arrowhead: 3, arrowcolor: '#c53030', bgcolor: 'white', ax: -40, ay: -30 },
                { x: pt.QHmin / 2, y: Math.max(...pt.temps), text: `QHmin: ${pt.QHmin.toFixed(1)} kW`, showarrow: false, bgcolor: '#fed7d7', bordercolor: '#c53030', borderwidth: 1 },
                { x: pt.QCmin / 2, y: Math.min(...pt.temps), text: `QCmin: ${pt.QCmin.toFixed(1)} kW`, showarrow: false, bgcolor: '#bee3f8', bordercolor: '#2c5282', borderwidth: 1 }
            ]};
        Plotly.newPlot(targetId, traces, layout, this.config);
    },

    grid(streams, pt, targetId = 'grid-chart') {
        const traces = [];
        const hot = streams.filter(s => s.Ts > s.Tt).sort((a, b) => b.Ts - a.Ts);
        const cold = streams.filter(s => s.Ts < s.Tt).sort((a, b) => b.Tt - a.Tt);
        let y = hot.length + cold.length + 2;
        hot.forEach((s, i) => {
            const yPos = hot.length - i;
            traces.push({ x: [0, 10], y: [yPos, yPos], mode: 'lines+text', line: { color: '#c53030', width: 3 },
                text: [`H${s.Name}`, `${s.Ts}→${s.Tt}°C`], textposition: ['middle right', 'middle right'],
                textfont: { color: '#c53030', size: 11 } });
        });
        cold.forEach((s, i) => {
            const yPos = cold.length - i;
            traces.push({ x: [0, 10], y: [yPos, yPos], mode: 'lines+text', line: { color: '#3182ce', width: 3 },
                text: [`${s.Ts}→${s.Tt}°C`, `C${s.Name}`], textposition: ['middle left', 'middle left'],
                textfont: { color: '#3182ce', size: 11 } });
        });
        const layout = { ...this.layoutBase, title: 'نمودار پنجره‌ای (Grid Diagram)',
            xaxis: { showgrid: false, showticklabels: false, range: [-1, 11] },
            yaxis: { showgrid: false, showticklabels: false, range: [0, y] },
            height: 450, autosize: true, margin: { t: 50, b: 40, l: 40, r: 40 },
            shapes: [{ type: 'line', x0: 5, x1: 5, y0: 0, y1: y, line: { color: '#2d3748', width: 2, dash: 'dash' } }],
            annotations: [{ x: 5, y: y - 0.5, text: `PINCH<br>Hot: ${pt.pinchHot.toFixed(1)}°C<br>Cold: ${pt.pinchCold.toFixed(1)}°C`, showarrow: false, bgcolor: 'white', bordercolor: '#2d3748', borderwidth: 1, font: { size: 11 } }] };
        Plotly.newPlot(targetId, traces, layout, this.config);
    },

    equipGCC(pt, type, targetId = 'equip-chart') {
        const traces = [{ x: pt.cascadeCorr, y: pt.temps, mode: 'lines+markers', line: { color: '#764ba2', width: 3 }, marker: { size: 10 } }];
        const shapes = [{ type: 'line', x0: 0, x1: 0, y0: Math.min(...pt.temps), y1: Math.max(...pt.temps), line: { color: '#718096', width: 1, dash: 'dot' } },
                        { type: 'line', x0: Math.min(...pt.cascadeCorr), x1: Math.max(...pt.cascadeCorr), y0: pt.pinchShifted, y1: pt.pinchShifted, line: { color: '#c53030', width: 2, dash: 'dash' } }];
        const annotations = [{ x: Math.max(...pt.cascadeCorr), y: pt.pinchShifted, text: `Pinch: ${pt.pinchShifted.toFixed(1)}°C`, showarrow: false, bgcolor: 'white', bordercolor: '#c53030', font: { size: 11 } }];
        if (type === 'furnace') {
            traces.push({ x: [0, pt.QHmin], y: [Math.max(...pt.temps) + 100, pt.pinchShifted + 20], mode: 'lines', line: { color: '#ed8936', width: 4, dash: 'dashdot' } });
            annotations.push({ x: pt.QHmin / 2, y: Math.max(...pt.temps) + 50, text: '🔥 Furnace', showarrow: false, bgcolor: '#feebc8', bordercolor: '#ed8936', font: { color: '#7b341e', size: 11 } });
        } else if (type === 'turbine') {
            shapes.push({ type: 'line', x0: 0, x1: 0, y0: Math.max(...pt.temps), y1: pt.pinchShifted + 10, line: { color: '#805ad5', width: 4 } });
            annotations.push({ x: -pt.QHmin * 0.15, y: (Math.max(...pt.temps) + pt.pinchShifted) / 2, text: 'Turbine (W)', showarrow: false, bgcolor: '#e9d8fd', bordercolor: '#805ad5', font: { color: '#553c9a', size: 11 } });
        } else if (type === 'heatpump') {
            shapes.push({ type: 'line', x0: 0, x1: pt.QHmin * 0.3, y0: pt.pinchShifted - 20, y1: pt.pinchShifted + 20, line: { color: '#d69e2e', width: 4 } });
            annotations.push({ x: pt.QHmin * 0.15, y: pt.pinchShifted, text: 'Heat Pump', showarrow: false, bgcolor: '#fefcbf', bordercolor: '#d69e2e', font: { color: '#744210', size: 11 } });
        } else if (type === 'distillation') {
            const Treb = pt.pinchShifted + 40, Tcon = pt.pinchShifted - 40;
            shapes.push({ type: 'rect', x0: 0, x1: pt.QHmin * 0.5, y0: Tcon, y1: Treb, line: { color: '#d53f8c', width: 3, dash: 'dash' } });
            annotations.push({ x: pt.QHmin * 0.25, y: Treb, text: 'Reboiler', showarrow: false, bgcolor: '#fed7e2', bordercolor: '#d53f8c', font: { color: '#702459', size: 10 } });
            annotations.push({ x: pt.QHmin * 0.25, y: Tcon, text: 'Condenser', showarrow: false, bgcolor: '#bee3f8', bordercolor: '#3182ce', font: { color: '#2a4365', size: 10 } });
        }
        const layout = { ...this.layoutBase, title: `جای‌گذاری: ${type}`, xaxis: { title: 'جریان حرارت خالص (kW)' }, yaxis: { title: 'دمای تنظیم‌شده (°C)' },
            height: 500, autosize: true, margin: { t: 50, b: 60, l: 80, r: 40 }, shapes, annotations };
        Plotly.newPlot(targetId, traces, layout, this.config);
    },

    splitDist(pt, Treb, Tcon, Qreb, Qcon, targetId = 'dist-chart') {
        const traces = [{ x: pt.cascadeCorr, y: pt.temps, mode: 'lines+markers', line: { color: '#764ba2', width: 3, dash: 'solid' }, opacity: 0.6 }];
        const shapes = [
            { type: 'line', x0: Math.min(...pt.cascadeCorr), x1: Math.max(...pt.cascadeCorr), y0: pt.pinchShifted, y1: pt.pinchShifted, line: { color: '#c53030', width: 2, dash: 'dash' } },
            { type: 'rect', x0: 0, x1: Math.max(Qreb, Qcon), y0: Tcon, y1: Treb, line: { color: '#d53f8c', width: 3, dash: 'dash' } }
        ];
        const annotations = [
            { x: Qreb / 2, y: Treb + 5, text: `Reboiler: ${Qreb} kW`, showarrow: false, bgcolor: '#fed7e2', bordercolor: '#d53f8c', font: { color: '#702459', size: 10 } },
            { x: Qcon / 2, y: Tcon - 10, text: `Condenser: ${Qcon} kW`, showarrow: false, bgcolor: '#bee3f8', bordercolor: '#3182ce', font: { color: '#2a4365', size: 10 } }
        ];
        if (Tcon < pt.pinchShifted && pt.pinchShifted < Treb) {
            annotations.push({ x: Math.max(...pt.cascadeCorr) / 2, y: (Treb + Tcon) / 2, text: '⚠️ CROSS-PINCH', showarrow: false, font: { color: '#c53030', size: 20 }, opacity: 0.5 });
        }
        const layout = { ...this.layoutBase, title: 'Split GCC', xaxis: { title: 'جریان حرارت (kW)' }, yaxis: { title: 'دمای تنظیم‌شده (°C)' },
            height: 500, autosize: true, margin: { t: 50, b: 60, l: 80, r: 40 }, shapes, annotations };
        Plotly.newPlot(targetId, traces, layout, this.config);
    },

    waterLWP(res, targetId = 'water-chart') {
        const traces = [{ x: res.lwpData.map(p => p.M), y: res.lwpData.map(p => p.C), mode: 'lines+markers', line: { color: '#3182ce', width: 3 }, marker: { size: 10 } }];
        if (res.pinchPoint) {
            traces.push({ x: [0, res.pinchPoint.M], y: [res.freshConc, res.pinchPoint.C], mode: 'lines', line: { color: '#48bb78', width: 3, dash: 'dash' } });
            traces.push({ x: [res.pinchPoint.M], y: [res.pinchPoint.C], mode: 'markers', marker: { size: 22, color: '#c53030', symbol: 'star' } });
        }
        const layout = { ...this.layoutBase, title: 'Water Pinch - LWP', xaxis: { title: 'Cumulative Mass Load (kg/h)' }, yaxis: { title: 'Concentration' },
            height: 500, autosize: true, margin: { t: 50, b: 60, l: 80, r: 40 } };
        Plotly.newPlot(targetId, traces, layout, this.config);
    }
};

// ==========================================
// APP
// ==========================================
const App = {
    streams: [],
    pt: null,
    lastCHP: null,
    lastRef: null,
    lastWater: null,
    lastDist: null,

    init() {
        this.setupTabs();
        this.loadExample(4);
    },

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
                setTimeout(() => {
                    const tab = btn.dataset.tab;
                    if (tab === 'pta' && this.pt) this.renderPTA();
                    if (tab === 'curves' && this.pt) this.renderCurves();
                    if (tab === 'grid' && this.pt) Charts.grid(this.streams, this.pt);
                    if (tab === 'equip' && this.pt) this.renderEquip();
                    if (tab === 'exergy' && this.pt) this.renderExergy();
                    if (tab === 'dist' && this.pt) this.renderDist();
                }, 100);
            });
        });
    },

    loadExample(n) {
        if (n === 4) {
            this.streams = [
                { Name: 'H1', Ts: 170, Tt: 60, CP: 3.0 },
                { Name: 'H2', Ts: 150, Tt: 30, CP: 1.5 },
                { Name: 'C1', Ts: 80, Tt: 140, CP: 4.0 },
                { Name: 'C2', Ts: 20, Tt: 135, CP: 2.0 }
            ];
        } else if (n === 7) {
            this.streams = [
                { Name: '1', Ts: 95, Tt: 205, CP: 2.88 }, { Name: '2', Ts: 40, Tt: 220, CP: 2.88 },
                { Name: '3', Ts: 310, Tt: 205, CP: 4.28 }, { Name: '4', Ts: 150, Tt: 205, CP: 7.43 },
                { Name: '5', Ts: 245, Tt: 95, CP: 2.84 }, { Name: '6', Ts: 65, Tt: 140, CP: 4.72 },
                { Name: '7', Ts: 280, Tt: 65, CP: 2.38 }
            ];
        }
        document.getElementById('dtmin').value = 10;
        this.renderStreams();
        this.calculate();
    },

    clearData() { this.streams = []; this.pt = null; this.renderStreams(); },
    addRow() { this.streams.push({ Name: `S${this.streams.length + 1}`, Ts: 100, Tt: 50, CP: 1.0 }); this.renderStreams(); },
    removeRow(i) { this.streams.splice(i, 1); this.renderStreams(); },
    updateField(i, field, value) { this.streams[i][field] = value; },

    renderStreams() {
        const tbody = document.getElementById('streams-body');
        tbody.innerHTML = '';
        this.streams.forEach((s, i) => {
            const type = s.Ts > s.Tt ? '🔥 گرم' : '❄️ سرد';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="text" value="${s.Name}" onchange="App.updateField(${i}, 'Name', this.value)"></td>
                <td><input type="number" value="${s.Ts}" step="0.1" onchange="App.updateField(${i}, 'Ts', parseFloat(this.value))"></td>
                <td><input type="number" value="${s.Tt}" step="0.1" onchange="App.updateField(${i}, 'Tt', parseFloat(this.value))"></td>
                <td><input type="number" value="${s.CP}" step="0.1" onchange="App.updateField(${i}, 'CP', parseFloat(this.value))"></td>
                <td>${type}</td>
                <td><button class="btn-delete" onclick="App.removeRow(${i})">×</button></td>`;
            tbody.appendChild(tr);
        });
        const hot = this.streams.filter(s => s.Ts > s.Tt).length;
        document.getElementById('stat-count').textContent = this.streams.length;
        document.getElementById('stat-hotcold').textContent = `${hot} / ${this.streams.length - hot}`;
    },

    calculate() {
        if (this.streams.length === 0) { alert('ابتدا داده وارد کنید.'); return; }
        const dTmin = parseFloat(document.getElementById('dtmin').value);
        if (isNaN(dTmin) || dTmin <= 0) { alert('ΔTmin باید مثبت باشد.'); return; }
        this.pt = Engine.problemTable(this.streams, dTmin);
        this.renderPTA();
    },

    renderPTA() {
        const pt = this.pt; if (!pt) return;
        document.getElementById('pta-metrics').innerHTML = `
            <div class="metric-card"><div class="metric-label">🔥 QHmin</div><div class="metric-value">${pt.QHmin.toFixed(2)} kW</div></div>
            <div class="metric-card"><div class="metric-label">❄️ QCmin</div><div class="metric-value">${pt.QCmin.toFixed(2)} kW</div></div>
            <div class="metric-card"><div class="metric-label">📍 Pinch (Shifted)</div><div class="metric-value">${pt.pinchShifted.toFixed(1)} °C</div></div>
            <div class="metric-card"><div class="metric-label">🌡️ Pinch (Hot/Cold)</div><div class="metric-value">${pt.pinchHot.toFixed(1)} / ${pt.pinchCold.toFixed(1)} °C</div></div>`;
        let html = '<table class="data-table"><thead><tr><th>Th (°C)</th><th>Tl (°C)</th><th>ΔT</th><th>ΣCPh</th><th>ΣCPc</th><th>ΔH (kW)</th><th>Cascade</th><th>Feasible</th></tr></thead><tbody>';
        pt.rows.forEach((r, i) => {
            html += `<tr><td>${r.Th.toFixed(1)}</td><td>${r.Tl.toFixed(1)}</td><td>${r.dT.toFixed(1)}</td><td>${r.CPh.toFixed(2)}</td><td>${r.CPc.toFixed(2)}</td><td class="${r.dH > 0 ? 'pos' : 'neg'}">${r.dH.toFixed(2)}</td><td>${pt.cascade[i + 1].toFixed(2)}</td><td>${pt.cascadeCorr[i + 1].toFixed(2)}</td></tr>`;
        });
        html += '</tbody></table>';
        document.getElementById('pta-table-wrap').innerHTML = html;
        Charts.cascade(pt, parseFloat(document.getElementById('dtmin').value));
    },

    renderCurves() { Charts.composite(this.pt); Charts.gcc(this.pt); },

    renderEquip() {
        if (!this.pt) return;
        const type = document.getElementById('equip-select').value;
        Charts.equipGCC(this.pt, type);
        const notes = {
            furnace: 'کوره باید در بالای پینچ قرار گیرد.',
            turbine: 'توربین باید در بالای پینچ قرار گیرد تا کار تولید شود.',
            heatpump: 'پمپ حرارتی باید از عرض پینچ عبور کند.',
            distillation: 'برج تقطیر نباید از پینچ عبور کند.'
        };
        document.getElementById('equip-note').textContent = '💡 ' + notes[type];
    },

    renderExergy() {
        const ex = Engine.exergy(this.streams);
        document.getElementById('exergy-metrics').innerHTML = `
            <div class="metric-card"><div class="metric-label">Exergy Supplied</div><div class="metric-value">${ex.Esup.toFixed(2)} kW</div></div>
            <div class="metric-card"><div class="metric-label">Exergy Recovered</div><div class="metric-value">${ex.Erec.toFixed(2)} kW</div></div>
            <div class="metric-card"><div class="metric-label">Exergy Destroyed</div><div class="metric-value">${ex.Edest.toFixed(2)} kW</div></div>
            <div class="metric-card"><div class="metric-label">Exergy Efficiency</div><div class="metric-value">${(ex.eff * 100).toFixed(1)}%</div></div>`;
        let html = '<table class="data-table"><thead><tr><th>Stream</th><th>Type</th><th>ΔE (kW)</th></tr></thead><tbody>';
        ex.results.forEach(e => { html += `<tr><td>${e.name}</td><td>${e.type}</td><td>${e.dE.toFixed(3)}</td></tr>`; });
        html += '</tbody></table>';
        document.getElementById('exergy-table-wrap').innerHTML = html;
    },

    renderDist() {
        if (!this.pt) return;
        const Treb = parseFloat(document.getElementById('dist-treb').value);
        const Tcon = parseFloat(document.getElementById('dist-tcon').value);
        const Qreb = parseFloat(document.getElementById('dist-qreb').value);
        const Qcon = parseFloat(document.getElementById('dist-qcon').value);
        const isCross = Tcon < this.pt.pinchShifted && this.pt.pinchShifted < Treb;
        document.getElementById('dist-note').innerHTML = isCross
            ? '<div class="error-box">❌ برج تقطیر از پینچ عبور می‌کند.</div>'
            : '<div class="success-box">✅ برج تقطیر با پینچ هماهنگ است.</div>';
        Charts.splitDist(this.pt, Treb, Tcon, Qreb, Qcon);
        this.lastDist = { Treb, Tcon, Qreb, Qcon, isCross };
    },

    calcCHP() {
        const res = Engine.chp(
            parseFloat(document.getElementById('chp-heat').value),
            parseFloat(document.getElementById('chp-power').value),
            parseFloat(document.getElementById('chp-fuel').value),
            parseFloat(document.getElementById('chp-elec').value),
            parseFloat(document.getElementById('chp-boiler').value),
            parseFloat(document.getElementById('chp-elec-eff').value),
            parseFloat(document.getElementById('chp-heat-eff').value)
        );
        this.lastCHP = res;
        document.getElementById('chp-results').innerHTML = `
            <div class="metrics">
                <div class="metric-card"><div class="metric-label">🔴 بدون CHP</div><div class="metric-value">€${res.base.total.toFixed(2)}/h</div></div>
                <div class="metric-card"><div class="metric-label">🟢 با CHP</div><div class="metric-value">€${res.chp.total.toFixed(2)}/h</div></div>
                <div class="metric-card"><div class="metric-label">💰 صرفه‌جویی</div><div class="metric-value">€${res.savings.toFixed(2)}/h</div></div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                <div><h3 style="color:#c53030;">🔴 سیستم جداگانه</h3>
                    <table class="result-table">
                        <tr><td>سوخت بویلر</td><td>${res.base.fuelBoiler.toFixed(1)} kW</td></tr>
                        <tr><td>هزینه سوخت</td><td>€${res.base.costFuel.toFixed(2)}/h</td></tr>
                        <tr><td>هزینه برق</td><td>€${res.base.costPower.toFixed(2)}/h</td></tr>
                        <tr><th>مجموع</th><th>€${res.base.total.toFixed(2)}/h</th></tr>
                    </table>
                </div>
                <div><h3 style="color:#2f855a;">🟢 سیستم CHP</h3>
                    <table class="result-table">
                        <tr><td>سوخت CHP</td><td>${res.chp.fuelChp.toFixed(1)} kW</td></tr>
                        <tr><td>حرارت بازیابی</td><td>${res.chp.heatRecovered.toFixed(1)} kW</td></tr>
                        <tr><td>کمبود حرارت</td><td>${res.chp.heatDeficit.toFixed(1)} kW</td></tr>
                        <tr><td>سوخت کمکی</td><td>${res.chp.fuelAux.toFixed(1)} kW</td></tr>
                        <tr><th>کل سوخت</th><th>${res.chp.totalFuel.toFixed(1)} kW</th></tr>
                        <tr><th>مجموع</th><th>€${res.chp.total.toFixed(2)}/h</th></tr>
                    </table>
                </div>
            </div>`;
    },

    calcRef() {
        const res = Engine.refrigeration(
            parseFloat(document.getElementById('ref-load').value),
            parseFloat(document.getElementById('ref-tproc').value),
            parseFloat(document.getElementById('ref-tamb').value),
            parseFloat(document.getElementById('ref-dtevap').value),
            parseFloat(document.getElementById('ref-dtcond').value),
            parseFloat(document.getElementById('ref-eta').value)
        );
        this.lastRef = res;
        if (!res) {
            document.getElementById('ref-results').innerHTML = '<div class="error-box">خطا: دمای اواپراتور از کندانسور بالاتر است.</div>';
            return;
        }
        document.getElementById('ref-results').innerHTML = `
            <div class="metrics">
                <div class="metric-card"><div class="metric-label">توان کمپرسور</div><div class="metric-value">${res.power.toFixed(2)} kW</div></div>
                <div class="metric-card"><div class="metric-label">حرارت دفع شده</div><div class="metric-value">${res.heatRejected.toFixed(2)} kW</div></div>
                <div class="metric-card"><div class="metric-label">COP کارنو</div><div class="metric-value">${res.COPcarnot.toFixed(2)}</div></div>
                <div class="metric-card"><div class="metric-label">COP واقعی</div><div class="metric-value">${res.COPactual.toFixed(2)}</div></div>
            </div>
            <table class="result-table">
                <thead><tr><th>مرحله</th><th>مقدار</th><th>فرمول</th></tr></thead>
                <tbody>
                    <tr><td>دمای اواپراتور</td><td>${res.Tevap.toFixed(1)} °C</td><td>Tprocess - ΔTevap</td></tr>
                    <tr><td>دمای کندانسور</td><td>${res.Tcond.toFixed(1)} °C</td><td>Tambient + ΔTcond</td></tr>
                    <tr><td>COP کارنو</td><td>${res.COPcarnot.toFixed(2)}</td><td>Tevap / (Tcond - Tevap)</td></tr>
                    <tr><td>COP واقعی</td><td>${res.COPactual.toFixed(2)}</td><td>COPcarnot × η</td></tr>
                    <tr><td>توان کمپرسور</td><td>${res.power.toFixed(2)} kW</td><td>Q / COP</td></tr>
                    <tr><td>حرارت دفع</td><td>${res.heatRejected.toFixed(2)} kW</td><td>Q + W</td></tr>
                </tbody>
            </table>`;
    },

    calcWater() {
        const ws = [];
        for (let i = 1; i <= 3; i++) {
            const name = document.getElementById(`w${i}-name`).value;
            const flow = parseFloat(document.getElementById(`w${i}-flow`).value);
            const cin = parseFloat(document.getElementById(`w${i}-cin`).value);
            const cout = parseFloat(document.getElementById(`w${i}-cout`).value);
            if (!isNaN(flow) && !isNaN(cin) && !isNaN(cout) && flow > 0 && cout > cin) {
                ws.push({ name, flow, Cin: cin, Cout: cout });
            }
        }
        if (ws.length === 0) { alert('حداقل یک جریان معتبر لازم است.'); return; }
        const res = Engine.waterPinch(ws, 0);
        this.lastWater = res;
        document.getElementById('water-results').innerHTML = `
            <div class="metrics">
                <div class="metric-card"><div class="metric-label">حداقل آب تازه</div><div class="metric-value">${res.FfwMin.toFixed(2)} t/h</div></div>
                <div class="metric-card"><div class="metric-label">غلظت پینچ</div><div class="metric-value">${res.pinchConc.toFixed(4)}</div></div>
            </div>
            <div class="table-wrap">
                <table class="data-table">
                    <thead><tr><th>Clow</th><th>Chigh</th><th>ΔC</th><th>جریان</th><th>بار جرمی</th><th>تجمعی</th></tr></thead>
                    <tbody>
                        ${res.intervals.map(intv => `<tr><td>${intv.Clow.toFixed(4)}</td><td>${intv.Chigh.toFixed(4)}</td><td>${intv.dC.toFixed(4)}</td><td>${intv.active}</td><td>${intv.massLoad.toFixed(2)}</td><td>${intv.cumMass.toFixed(2)}</td></tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div id="water-chart" class="chart-container"></div>`;
        setTimeout(() => Charts.waterLWP(res), 100);
    },

    // ==========================================
    // REPORT
    // ==========================================
    async generateReport() {
        if (!this.pt) { alert('ابتدا داده وارد و محاسبه کنید.'); return; }
        
        const pt = this.pt;
        const ex = Engine.exergy(this.streams);
        const dTmin = parseFloat(document.getElementById('dtmin').value);
        const now = new Date().toLocaleString('fa-IR');
        
        document.getElementById('report-status').innerHTML = '<div class="warning-box">⏳ در حال تولید گزارش...</div>';
        document.getElementById('report-content').innerHTML = '';
        
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px;';
        document.body.appendChild(tempContainer);
        
        try {
            const cascadeDiv = document.createElement('div'); cascadeDiv.id = 'temp-cascade'; tempContainer.appendChild(cascadeDiv);
            const compositeDiv = document.createElement('div'); compositeDiv.id = 'temp-composite'; tempContainer.appendChild(compositeDiv);
            const gccDiv = document.createElement('div'); gccDiv.id = 'temp-gcc'; tempContainer.appendChild(gccDiv);
            const gridDiv = document.createElement('div'); gridDiv.id = 'temp-grid'; tempContainer.appendChild(gridDiv);
            
            Charts.cascade(pt, dTmin, 'temp-cascade');
            Charts.composite(pt, 'temp-composite');
            Charts.gcc(pt, 'temp-gcc');
            Charts.grid(this.streams, pt, 'temp-grid');
            
            await new Promise(r => setTimeout(r, 800));
            
            const imgCascade = await Plotly.toImage('temp-cascade', { format: 'png', width: 900, height: 500, scale: 1.5 });
            const imgComposite = await Plotly.toImage('temp-composite', { format: 'png', width: 900, height: 450, scale: 1.5 });
            const imgGCC = await Plotly.toImage('temp-gcc', { format: 'png', width: 900, height: 450, scale: 1.5 });
            const imgGrid = await Plotly.toImage('temp-grid', { format: 'png', width: 900, height: 450, scale: 1.5 });
            
            document.body.removeChild(tempContainer);
            
            const html = this.buildReportHTML(pt, ex, dTmin, now, { imgCascade, imgComposite, imgGCC, imgGrid });
            document.getElementById('report-content').innerHTML = html;
            document.getElementById('report-status').innerHTML = '<div class="success-box">✅ گزارش آماده شد! روی «ذخیره PDF» کلیک کنید.</div>';
        } catch (err) {
            if (tempContainer.parentNode) document.body.removeChild(tempContainer);
            document.getElementById('report-status').innerHTML = `<div class="error-box">❌ خطا: ${err.message}</div>`;
            console.error(err);
        }
    },

    buildReportHTML(pt, ex, dTmin, now, imgs) {
        const chp = this.lastCHP;
        const ref = this.lastRef;
        const water = this.lastWater;
        const dist = this.lastDist;
        
        let html = `
        <div style="font-family: Vazirmatn; direction: rtl; padding: 10px;">
            
            <div style="text-align:center; padding-bottom:15px; border-bottom:3px solid #667eea; margin-bottom:20px;">
                <h1 style="color:#667eea; margin:0 0 8px 0; font-size:1.8rem;">🏭 Pinch Master Pro</h1>
                <h2 style="color:#2d3748; margin:0 0 5px 0; font-size:1.1rem;">گزارش تحلیل تکنولوژی پینچ</h2>
                <p style="color:#718096; margin:5px 0; font-size:0.9rem;">تاریخ: ${now} | ΔTmin = ${dTmin} °C</p>
                <p style="color:#667eea; margin:5px 0; font-size:0.85rem;">توسعه‌دهنده: Hossein Sahraei</p>
            </div>
            
            <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۱. خلاصه نتایج</h2>
            <table style="width:100%; border-collapse:collapse; margin:15px 0;">
                <tr style="background:#f7fafc;"><th style="padding:8px; border:1px solid #e2e8f0; text-align:right;">پارامتر</th><th style="padding:8px; border:1px solid #e2e8f0; text-align:right;">مقدار</th></tr>
                <tr><td style="padding:8px; border:1px solid #e2e8f0;">🔥 QHmin</td><td style="padding:8px; border:1px solid #e2e8f0; font-weight:bold;">${pt.QHmin.toFixed(2)} kW</td></tr>
                <tr><td style="padding:8px; border:1px solid #e2e8f0;">❄️ QCmin</td><td style="padding:8px; border:1px solid #e2e8f0; font-weight:bold;">${pt.QCmin.toFixed(2)} kW</td></tr>
                <tr><td style="padding:8px; border:1px solid #e2e8f0;">📍 Pinch (Shifted)</td><td style="padding:8px; border:1px solid #e2e8f0; font-weight:bold;">${pt.pinchShifted.toFixed(2)} °C</td></tr>
                <tr><td style="padding:8px; border:1px solid #e2e8f0;">🌡️ Pinch (Hot / Cold)</td><td style="padding:8px; border:1px solid #e2e8f0; font-weight:bold;">${pt.pinchHot.toFixed(1)} / ${pt.pinchCold.toFixed(1)} °C</td></tr>
                <tr><td style="padding:8px; border:1px solid #e2e8f0;">نوع مسئله</td><td style="padding:8px; border:1px solid #e2e8f0;">${pt.pinchType}</td></tr>
            </table>
            
            <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۲. داده‌های جریان‌ها</h2>
            <table style="width:100%; border-collapse:collapse; margin:15px 0;">
                <thead><tr style="background:#667eea; color:white;">
                    <th style="padding:8px; border:1px solid #ddd;">نام</th><th style="padding:8px; border:1px solid #ddd;">نوع</th>
                    <th style="padding:8px; border:1px solid #ddd;">Ts (°C)</th><th style="padding:8px; border:1px solid #ddd;">Tt (°C)</th>
                    <th style="padding:8px; border:1px solid #ddd;">CP (kW/K)</th><th style="padding:8px; border:1px solid #ddd;">Q (kW)</th>
                </tr></thead><tbody>
                    ${this.streams.map(s => `<tr>
                        <td style="padding:8px; border:1px solid #e2e8f0;">${s.Name}</td>
                        <td style="padding:8px; border:1px solid #e2e8f0;">${s.Ts > s.Tt ? '🔥 گرم' : '❄️ سرد'}</td>
                        <td style="padding:8px; border:1px solid #e2e8f0;">${s.Ts}</td>
                        <td style="padding:8px; border:1px solid #e2e8f0;">${s.Tt}</td>
                        <td style="padding:8px; border:1px solid #e2e8f0;">${s.CP}</td>
                        <td style="padding:8px; border:1px solid #e2e8f0;">${Math.abs(s.CP * (s.Ts - s.Tt)).toFixed(2)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            
            <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۳. جدول مسئله</h2>
            <table style="width:100%; border-collapse:collapse; margin:15px 0; font-size:0.85rem;">
                <thead><tr style="background:#667eea; color:white;">
                    <th style="padding:6px; border:1px solid #ddd;">Th (°C)</th><th style="padding:6px; border:1px solid #ddd;">Tl (°C)</th>
                    <th style="padding:6px; border:1px solid #ddd;">ΔT</th><th style="padding:6px; border:1px solid #ddd;">ΣCPh</th>
                    <th style="padding:6px; border:1px solid #ddd;">ΣCPc</th><th style="padding:6px; border:1px solid #ddd;">ΔH (kW)</th>
                    <th style="padding:6px; border:1px solid #ddd;">Cascade</th><th style="padding:6px; border:1px solid #ddd;">Feasible</th>
                </tr></thead><tbody>
                    ${pt.rows.map((r, i) => `<tr>
                        <td style="padding:6px; border:1px solid #e2e8f0;">${r.Th.toFixed(1)}</td>
                        <td style="padding:6px; border:1px solid #e2e8f0;">${r.Tl.toFixed(1)}</td>
                        <td style="padding:6px; border:1px solid #e2e8f0;">${r.dT.toFixed(1)}</td>
                        <td style="padding:6px; border:1px solid #e2e8f0;">${r.CPh.toFixed(2)}</td>
                        <td style="padding:6px; border:1px solid #e2e8f0;">${r.CPc.toFixed(2)}</td>
                        <td style="padding:6px; border:1px solid #e2e8f0;">${r.dH.toFixed(2)}</td>
                        <td style="padding:6px; border:1px solid #e2e8f0;">${pt.cascade[i+1].toFixed(2)}</td>
                        <td style="padding:6px; border:1px solid #e2e8f0;">${pt.cascadeCorr[i+1].toFixed(2)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
            
            <div style="page-break-before:always;">
                <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۴. نمودار آبشاری</h2>
                <img src="${imgs.imgCascade}" style="width:100%; max-width:700px; display:block; margin:10px auto;" />
            </div>
            
            <div style="page-break-before:always;">
                <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۵. منحنی ترکیبی</h2>
                <img src="${imgs.imgComposite}" style="width:100%; max-width:700px; display:block; margin:10px auto;" />
            </div>
            
            <div style="page-break-before:always;">
                <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۶. منحنی جامع (GCC)</h2>
                <img src="${imgs.imgGCC}" style="width:100%; max-width:700px; display:block; margin:10px auto;" />
            </div>
            
            <div style="page-break-before:always;">
                <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۷. نمودار پنجره‌ای</h2>
                <img src="${imgs.imgGrid}" style="width:100%; max-width:700px; display:block; margin:10px auto;" />
            </div>
            
            <div style="page-break-before:always;">
                <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۸. تحلیل اکسرژی</h2>
                <table style="width:100%; border-collapse:collapse; margin:15px 0;">
                    <tr style="background:#f7fafc;"><th style="padding:8px; border:1px solid #e2e8f0; text-align:right;">پارامتر</th><th style="padding:8px; border:1px solid #e2e8f0; text-align:right;">مقدار</th></tr>
                    <tr><td style="padding:8px; border:1px solid #e2e8f0;">Exergy Supplied</td><td style="padding:8px; border:1px solid #e2e8f0;">${ex.Esup.toFixed(2)} kW</td></tr>
                    <tr><td style="padding:8px; border:1px solid #e2e8f0;">Exergy Recovered</td><td style="padding:8px; border:1px solid #e2e8f0;">${ex.Erec.toFixed(2)} kW</td></tr>
                    <tr><td style="padding:8px; border:1px solid #e2e8f0;">Exergy Destroyed</td><td style="padding:8px; border:1px solid #e2e8f0;">${ex.Edest.toFixed(2)} kW</td></tr>
                    <tr><td style="padding:8px; border:1px solid #e2e8f0;">Efficiency</td><td style="padding:8px; border:1px solid #e2e8f0; font-weight:bold;">${(ex.eff * 100).toFixed(1)}%</td></tr>
                </table>
                <table style="width:100%; border-collapse:collapse; margin:15px 0;">
                    <thead><tr style="background:#667eea; color:white;">
                        <th style="padding:8px; border:1px solid #ddd;">Stream</th><th style="padding:8px; border:1px solid #ddd;">Type</th><th style="padding:8px; border:1px solid #ddd;">ΔE (kW)</th>
                    </tr></thead><tbody>
                        ${ex.results.map(e => `<tr>
                            <td style="padding:8px; border:1px solid #e2e8f0;">${e.name}</td>
                            <td style="padding:8px; border:1px solid #e2e8f0;">${e.type}</td>
                            <td style="padding:8px; border:1px solid #e2e8f0;">${e.dE.toFixed(3)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        
        if (chp) {
            html += `
            <div style="page-break-before:always;">
                <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۹. تحلیل CHP</h2>
                <table style="width:100%; border-collapse:collapse; margin:15px 0;">
                    <thead><tr style="background:#667eea; color:white;">
                        <th style="padding:8px; border:1px solid #ddd;">پارامتر</th><th style="padding:8px; border:1px solid #ddd;">بدون CHP</th><th style="padding:8px; border:1px solid #ddd;">با CHP</th>
                    </tr></thead><tbody>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;">سوخت (kW)</td><td style="padding:8px; border:1px solid #e2e8f0;">${chp.base.fuelBoiler.toFixed(1)}</td><td style="padding:8px; border:1px solid #e2e8f0;">${chp.chp.totalFuel.toFixed(1)}</td></tr>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;">هزینه کل (€/h)</td><td style="padding:8px; border:1px solid #e2e8f0;">${chp.base.total.toFixed(2)}</td><td style="padding:8px; border:1px solid #e2e8f0;">${chp.chp.total.toFixed(2)}</td></tr>
                        <tr style="background:#c6f6d5;"><td colspan="2" style="padding:8px; border:1px solid #e2e8f0;"><strong>💰 صرفه‌جویی (€/h)</strong></td><td style="padding:8px; border:1px solid #e2e8f0;"><strong>${chp.savings.toFixed(2)}</strong></td></tr>
                    </tbody>
                </table>
            </div>`;
        }
        
        if (ref) {
            html += `
            <div style="page-break-before:always;">
                <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۱۰. تحلیل تبرید</h2>
                <table style="width:100%; border-collapse:collapse; margin:15px 0;">
                    <thead><tr style="background:#667eea; color:white;">
                        <th style="padding:8px; border:1px solid #ddd;">مرحله</th><th style="padding:8px; border:1px solid #ddd;">مقدار</th>
                    </tr></thead><tbody>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;">دمای اواپراتور</td><td style="padding:8px; border:1px solid #e2e8f0;">${ref.Tevap.toFixed(1)} °C</td></tr>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;">دمای کندانسور</td><td style="padding:8px; border:1px solid #e2e8f0;">${ref.Tcond.toFixed(1)} °C</td></tr>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;">COP کارنو</td><td style="padding:8px; border:1px solid #e2e8f0;">${ref.COPcarnot.toFixed(2)}</td></tr>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;">COP واقعی</td><td style="padding:8px; border:1px solid #e2e8f0;">${ref.COPactual.toFixed(2)}</td></tr>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;">توان کمپرسور</td><td style="padding:8px; border:1px solid #e2e8f0; font-weight:bold;">${ref.power.toFixed(2)} kW</td></tr>
                        <tr><td style="padding:8px; border:1px solid #e2e8f0;">حرارت دفع</td><td style="padding:8px; border:1px solid #e2e8f0;">${ref.heatRejected.toFixed(2)} kW</td></tr>
                    </tbody>
                </table>
            </div>`;
        }
        
        if (water) {
            html += `
            <div style="page-break-before:always;">
                <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۱۱. تحلیل پینچ آب</h2>
                <table style="width:100%; border-collapse:collapse; margin:15px 0;">
                    <tr style="background:#f7fafc;"><th style="padding:8px; border:1px solid #e2e8f0; text-align:right;">پارامتر</th><th style="padding:8px; border:1px solid #e2e8f0; text-align:right;">مقدار</th></tr>
                    <tr><td style="padding:8px; border:1px solid #e2e8f0;">حداقل آب تازه</td><td style="padding:8px; border:1px solid #e2e8f0; font-weight:bold;">${water.FfwMin.toFixed(2)} t/h</td></tr>
                    <tr><td style="padding:8px; border:1px solid #e2e8f0;">غلظت پینچ</td><td style="padding:8px; border:1px solid #e2e8f0;">${water.pinchConc.toFixed(4)}</td></tr>
                </table>
            </div>`;
        }
        
        if (dist) {
            html += `
            <div style="page-break-before:always;">
                <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۱۲. تحلیل برج تقطیر</h2>
                <table style="width:100%; border-collapse:collapse; margin:15px 0;">
                    <tr style="background:#f7fafc;"><th style="padding:8px; border:1px solid #e2e8f0; text-align:right;">پارامتر</th><th style="padding:8px; border:1px solid #e2e8f0; text-align:right;">مقدار</th></tr>
                    <tr><td style="padding:8px; border:1px solid #e2e8f0;">دمای ریبویلر</td><td style="padding:8px; border:1px solid #e2e8f0;">${dist.Treb} °C</td></tr>
                    <tr><td style="padding:8px; border:1px solid #e2e8f0;">دمای کندانسور</td><td style="padding:8px; border:1px solid #e2e8f0;">${dist.Tcon} °C</td></tr>
                    <tr style="background:${dist.isCross ? '#fed7d7' : '#c6f6d5'};"><td style="padding:8px; border:1px solid #e2e8f0;"><strong>وضعیت</strong></td><td style="padding:8px; border:1px solid #e2e8f0;"><strong>${dist.isCross ? '❌ Cross-Pinch' : '✅ هماهنگ'}</strong></td></tr>
                </table>
            </div>`;
        }
        
        html += `
            <div style="page-break-before:always;">
                <h2 style="color:#667eea; border-bottom:2px solid #e2e8f0; padding-bottom:8px; margin-top:20px; font-size:1.2rem;">۱۳. روش‌شناسی و مراجع</h2>
                <div style="background:#edf2f7; padding:15px; border-radius:10px; margin-top:15px;">
                    <p><strong>روش‌شناسی:</strong> تحلیل بر اساس الگوریتم جدول مسئله (PTA) با دماهای تنظیم‌شده.</p>
                    <p style="margin-top:10px;"><strong>قوانین طلایی:</strong></p>
                    <ul style="margin-right:20px; margin-top:5px;">
                        <li>انتقال حرارت از روی پینچ ممنوع است</li>
                        <li>استفاده از یوتیلیتی سرد در بالای پینچ ممنوع است</li>
                        <li>استفاده از یوتیلیتی گرم در پایین پینچ ممنوع است</li>
                    </ul>
                    <p style="margin-top:10px;"><strong>مراجع:</strong></p>
                    <ul style="margin-right:20px; margin-top:5px;">
                        <li>Kemp, I.C. - Pinch Analysis & Process Integration</li>
                        <li>Smith, R. - Chemical Process Design and Integration</li>
                        <li>Linnhoff & Hindmarsh - The Pinch Design Method</li>
                        <li>Dr. Omidkhah - Pinch Technology Lecture Notes</li>
                    </ul>
                </div>
                <div style="text-align:center; margin-top:30px; padding-top:15px; border-top:2px solid #e2e8f0; color:#718096; font-size:0.85rem;">
                    <p><strong>Pinch Master Pro v7.0</strong> | تولید شده در ${now}</p>
                    <p style="margin-top:8px;">Developed by <strong>Hossein Sahraei</strong></p>
                    <p style="margin-top:5px; font-size:0.75rem; opacity:0.7;">Based on Kemp · Smith · Linnhoff · Omidkhah</p>
                </div>
            </div>
        </div>`;
        
        return html;
    },

    printReport() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-tab="report"]').classList.add('active');
        document.getElementById('tab-report').classList.add('active');
        
        const reportContent = document.getElementById('report-content');
        if (!reportContent.innerHTML || reportContent.innerHTML.trim() === '') {
            alert('ابتدا روی «تولید گزارش» کلیک کنید.');
            return;
        }
        
        setTimeout(() => { window.print(); }, 300);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());