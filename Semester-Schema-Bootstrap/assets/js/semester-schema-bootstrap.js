document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('semester-schema-bootstrap-container');

    if (!container) {
        console.error("Element with id 'semester-schema-bootstrap-container' not found.");
        return;
    }

    let scheduleData = {};
    let users = [];
    let currentMonth = 0; // Startar från januari (0 = januari, 11 = december)

    const statuses = ['Semester', 'Föräldraledig', 'Tjänstledig', 'Preliminär semester', 'Flexledig', 'Vakant'];
    const colors = {
        'Semester': '#4CAF50',
        'Föräldraledig': '#F48FB1',
        'Tjänstledig': '#90A4AE',
        'Preliminär semester': '#FF9800',
        'Flexledig': '#FFEB3B',
        'Vakant': '#9E9E9E',
        '': '#FFFFFF' // Blank cell
    };

    const dayColors = {
        weekday: '#EAF6FF', // Ljusblå för vardagar
        weekend: '#FFEBE6' // Ljus röd för helger och helgdagar
    };

    const swedishMonths = [
        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ];

    const swedishWeekdays = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

    const publicHolidays = {
        "2025-01-01": "Nyårsdagen",
        "2025-01-06": "Trettondedag jul",
        "2025-04-18": "Långfredagen",
        "2025-04-20": "Påskdagen",
        "2025-04-21": "Annandag påsk",
        "2025-05-01": "Första maj",
        "2025-05-29": "Kristi himmelsfärds dag",
        "2025-06-06": "Sveriges nationaldag",
        "2025-06-22": "Midsommardagen",
        "2025-11-01": "Alla helgons dag",
        "2025-12-25": "Juldagen",
        "2025-12-26": "Annandag jul"
    };

    function loadData() {
        console.log('Loading data...');
        Promise.all([
            fetch(SemesterSchemaSettings.restUrl + 'load', {
                method: 'GET',
                headers: { 'X-WP-Nonce': SemesterSchemaSettings.nonce }
            }).then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to load data: ${res.statusText}`);
                }
                return res.json();
            }),
            fetch(SemesterSchemaSettings.restUrl + 'personer', {
                method: 'GET',
                headers: { 'X-WP-Nonce': SemesterSchemaSettings.nonce }
            }).then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to load users: ${res.statusText}`);
                }
                return res.json();
            })
        ])
        .then(([schedule, userList]) => {
            console.log('Data loaded:', schedule);
            console.log('Users loaded:', userList);

            if (!Array.isArray(userList)) {
                throw new Error('Users data is not an array.');
            }

            scheduleData = schedule;
            users = userList;
            renderTable();
        })
        .catch(err => console.error('Error loading data:', err));
    }

    function bindControlPanelEvents() {
        const monthSelect = document.getElementById('month-select');
        const weekSelect = document.getElementById('week-select');
        const prevMonthButton = document.getElementById('prevMonth');
        const nextMonthButton = document.getElementById('nextMonth');

        // Uppdatera tabellen när månads-väljaren ändras
        monthSelect.addEventListener('change', function () {
            currentMonth = parseInt(monthSelect.value, 10);
            updateTable(currentMonth);
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
                updateTable(currentMonth);
            }
        });

        // Nästa månad-knappen
        nextMonthButton.addEventListener('click', function () {
            if (currentMonth < 11) {
                currentMonth++;
                monthSelect.value = currentMonth; // Sync dropdown
                updateTable(currentMonth);
            }
        });
    }

    function renderTable() {
        container.innerHTML = `
            <div id="table-wrapper" style="overflow-x: auto;">
                <table class="table table-bordered">
                    <thead>
                        <tr id="month-row"></tr>
                        <tr id="week-row"></tr>
                        <tr id="date-row"></tr>
                    </thead>
                    <tbody id="table-body"></tbody>
                </table>
            </div>
        `;

        updateTable(currentMonth); // Ladda initial data
    }

    function updateTable(month) {
        const year = 2025;
        const monthRow = document.getElementById('month-row');
        const weekRow = document.getElementById('week-row');
        const dateRow = document.getElementById('date-row');
        const tableBody = document.getElementById('table-body');

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(year, month, i + 1);
            const dateString = date.toISOString().split('T')[0];
            const weekdayIndex = (date.getDay() + 6) % 7; // Gör måndag till första dagen
            return {
                fullDate: dateString,
                day: date.getDate(),
                week: getWeekNumber(date),
                monthName: swedishMonths[month],
                weekday: swedishWeekdays[weekdayIndex],
                isWeekend: weekdayIndex >= 5, // Lördag och söndag
                isHoliday: publicHolidays[dateString] || null // Holiday name if it exists
            };
        }).filter(day => !day.isWeekend); // Filtrera bort helger (lördag och söndag)

        // Uppdatera månadsraden
        monthRow.innerHTML = `
            <th style="position: sticky; left: 0; top: 0; background: #d3e4f8; z-index: 3; white-space: nowrap; font-weight: bold;" colspan="${days.length + 1}">
                ${days[0]?.monthName || ''}
            </th>
        `;

        // Uppdatera veckoraden
        weekRow.innerHTML = `<th style="position: sticky; left: 0; top: 36px; background: #E0F7FA; z-index: 2; font-weight: bold;">Vecka</th>`;
        let currentWeek = days[0]?.week;
        let weekStartIndex = 0;
        for (let i = 0; i <= days.length; i++) {
            if (i === days.length || days[i].week !== currentWeek) {
                const colspan = i - weekStartIndex;
                weekRow.innerHTML += `<th colspan="${colspan}" class="text-center sticky-cell" style="background: #E0F7FA;">Vecka ${currentWeek}</th>`;
                if (i < days.length) {
                    currentWeek = days[i].week;
                    weekStartIndex = i;
                }
            }
        }

        // Uppdatera datumraden
        dateRow.innerHTML = `<th style="position: sticky; left: 0; top: 72px; background: white; z-index: 1;">Datum</th>`;
        days.forEach(day => {
            const bgColor = day.isHoliday ? dayColors.weekend : dayColors.weekday;
            const content = day.isHoliday ? `<span>${day.isHoliday}</span>` : `${day.weekday} ${day.day}/${month + 1}`;
            dateRow.innerHTML += `<th class="text-center" style="min-width: 100px; background: ${bgColor};">
                ${content}
            </th>`;
        });

        // Uppdatera tabellens rader
        tableBody.innerHTML = '';
        users.forEach(user => {
            const tr = document.createElement('tr');
            const nameCell = document.createElement('td');
            nameCell.textContent = user;
            nameCell.style.position = 'sticky';
            nameCell.style.left = '0';
            nameCell.style.background = 'white';
            nameCell.style.whiteSpace = 'nowrap'; // Förhindra radbryt
            tr.appendChild(nameCell);

            days.forEach(day => {
                const td = document.createElement('td');
                if (day.isHoliday) {
                    td.textContent = day.isHoliday;
                    td.style.backgroundColor = dayColors.weekend;
                    td.style.textAlign = 'center';
                } else {
                    const status = scheduleData[user]?.[day.fullDate] || '';
                    td.style.backgroundColor = colors[status];
                    td.innerHTML = `
                        <select class="form-select form-select-sm" data-person="${user}" data-date="${day.fullDate}" style="min-width: 100px; background-color: ${colors[status]};">
                            <option value="" ${status === '' ? 'selected' : ''}>-</option>
                            ${statuses.map(s => `<option value="${s}" ${s === status ? 'selected' : ''} style="background-color: ${colors[s]};">${s}</option>`).join('')}
                        </select>
                    `;
                }
                tr.appendChild(td);
            });

            tableBody.appendChild(tr);
        });
    }

    function scrollToWeek(week) {
        const year = 2025;
        const days = [];
        for (let month = 0; month < 12; month++) {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const weekdayIndex = (date.getDay() + 6) % 7; // Gör måndag till första dagen
                if (weekdayIndex < 5) { // Endast vardagar
                    days.push({
                        date,
                        week: getWeekNumber(date),
                        month
                    });
                }
            }
        }

        const targetDay = days.find(day => day.week === week);
        if (targetDay) {
            currentMonth = targetDay.month;
            document.getElementById('month-select').value = currentMonth; // Sync dropdown
            updateTable(currentMonth);

            // Scrolla till veckan
            const weekCells = Array.from(document.querySelectorAll('#week-row th'));
            const targetCell = weekCells.find(cell => cell.textContent.includes(`Vecka ${week}`));
            if (targetCell) {
                targetCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    function getWeekNumber(d) {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    }

    bindControlPanelEvents(); // Koppla kontrollpanelen till tabellen
    loadData();
});