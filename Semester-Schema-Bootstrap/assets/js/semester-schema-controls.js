document.addEventListener('DOMContentLoaded', function () {
    let currentYear = new Date().getFullYear(); // Nuvarande år
    let currentMonth = 0; // Startar från januari (0 = januari, 11 = december)

    function bindControlPanelEvents() {
        const yearSelect = document.getElementById('year-select');
        const monthSelect = document.getElementById('month-select');
        const weekSelect = document.getElementById('week-select');
        const prevMonthButton = document.getElementById('prevMonth');
        const nextMonthButton = document.getElementById('nextMonth');

        // Uppdatera tabellen när års-väljaren ändras
        yearSelect.addEventListener('change', function () {
            currentYear = parseInt(yearSelect.value, 10);
            updateTable();
        });

        // Uppdatera tabellen när månads-väljaren ändras
        monthSelect.addEventListener('change', function () {
            currentMonth = parseInt(monthSelect.value, 10);
            updateTable();
        });

        // Uppdatera tabellen när veckoväljaren ändras och scrolla till vald vecka
        weekSelect.addEventListener('change', function () {
            const week = parseInt(weekSelect.value, 10);
            scrollToWeek(week);
        });

        // Föregående månad-knappen
        prevMonthButton.addEventListener('click', function () {
            if (currentMonth > 0) {
                currentMonth--;
                monthSelect.value = currentMonth; // Sync dropdown
                updateTable();
            }
        });

        // Nästa månad-knappen
        nextMonthButton.addEventListener('click', function () {
            if (currentMonth < 11) {
                currentMonth++;
                monthSelect.value = currentMonth; // Sync dropdown
                updateTable();
            }
        });
    }

    function renderControlPanel() {
        const controlPanel = `
            <div id="sticky-controls" style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #ddd; background: white;">
                <div>
                    <label for="year-select" style="display: block;">Välj år:</label>
                    <select id="year-select" class="form-select form-select-sm">
                        ${generateYearOptions()}
                    </select>
                </div>
                <div>
                    <label for="month-select" style="display: block;">Välj månad:</label>
                    <select id="month-select" class="form-select form-select-sm">
                        ${swedishMonths.map((month, index) => `<option value="${index}">${month}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label for="week-select" style="display: block;">Välj vecka:</label>
                    <select id="week-select" class="form-select form-select-sm">
                        ${Array.from({ length: 52 }, (_, i) => `<option value="${i + 1}">Vecka ${i + 1}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-primary btn-sm" id="prevMonth">Föregående månad</button>
                <button class="btn btn-primary btn-sm" id="nextMonth">Nästa månad</button>
            </div>
        `;
        document.body.insertAdjacentHTML('afterbegin', controlPanel); // Lägg till kontrollpanelen högst upp
    }

    function generateYearOptions() {
        const startYear = currentYear - 3;
        const endYear = currentYear + 3;
        let options = '';
        for (let year = startYear; year <= endYear; year++) {
            options += `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}</option>`;
        }
        return options;
    }

    function updateTable() {
        const event = new CustomEvent('updateTable', {
            detail: {
                year: currentYear,
                month: currentMonth,
            }
        });
        document.dispatchEvent(event); // Skicka en uppdateringshändelse till tabellen
    }

    function scrollToWeek(week) {
        const event = new CustomEvent('scrollToWeek', {
            detail: { week }
        });
        document.dispatchEvent(event); // Skicka en scroll-händelse till tabellen
    }

    const swedishMonths = [
        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ];

    renderControlPanel(); // Rendera kontrollpanelen
    bindControlPanelEvents(); // Koppla event till kontrollpanelen
});