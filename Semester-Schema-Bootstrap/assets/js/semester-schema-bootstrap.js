document.addEventListener('DOMContentLoaded', function () {
    const container = document.getElementById('semester-schema-bootstrap-container');

    if (!container) {
        console.error("Element with id 'semester-schema-bootstrap-container' not found.");
        return;
    }

    let scheduleData = {};
    let users = [];
    let currentMonth = 0; // Startar från januari (0 = januari, 11 = december)
    let currentYear = new Date().getFullYear(); // Innevarande år
    let autoPollingInterval = null; // Interval ID for auto-polling

    const statuses = ['', 'Semester', 'Föräldraledig', 'Tjänstledig', 'Preliminär semester', 'Flexledig', 'Vakant'];
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
        weekend: '#FFEBE6', // Ljus röd för helger och helgdagar
        holiday: '#FFEBE6' // Samma färg för helgdagar
    };

    const swedishMonths = [
        'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
        'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
    ];

    const swedishWeekdays = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre'];

    // Sveriges helgdagar för 2025
    const publicHolidays = {
        "2025-01-01": "Nyårsdagen",
        "2025-01-06": "Trettondedag jul",
        "2025-04-18": "Långfredagen",
        "2025-04-20": "Påskdagen",
        "2025-04-21": "Annandag påsk",
        "2025-05-01": "Första maj",
        "2025-05-29": "Kristi himmelsfärds dag",
        "2025-06-06": "Sveriges nationaldag",
        "2025-06-21": "Midsommardagen",
        "2025-11-01": "Alla helgons dag",
        "2025-12-25": "Juldagen",
        "2025-12-26": "Annandag jul"
    };

    // CSS för att dölja texten i valda dropdown-alternativ
    const style = document.createElement('style');
    style.textContent = `
        .hidden-text-dropdown option {
            color: black; /* Visa texten normalt för alla alternativ */
        }
        .hidden-text-dropdown option:checked {
            color: transparent; /* Dölj texten för det valda alternativet */
            text-indent: -9999px; /* Flytta texten bort från synfältet */
        }
        .hidden-text-dropdown:hover option,
        .hidden-text-dropdown:focus option {
            color: black; /* Visa texten när dropdown är öppen */
            text-indent: 0; /* Återställ textens position */
        }
    `;
    document.head.appendChild(style);

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

            // Filtrera bort användare utan en grupp
            users = userList
                .filter(user => user.group && user.group.trim() !== "" && user.group !== "Ingen grupp")
                .map(user => ({
                    name: user.name || "Okänd användare", // Använd "name" för användarnamn med fallback
                    group: user.group // Använd grupp från backend
                }));

            renderTable();
        })
        .catch(err => console.error('Error loading data:', err));
    }

    function bindControlPanelEvents() {
        const monthSelect = document.getElementById('month-select');
        const weekSelect = document.getElementById('week-select');
        const prevMonthButton = document.getElementById('prevMonth');
        const nextMonthButton = document.getElementById('nextMonth');
        const yearSelect = document.getElementById('year-select');

        // Uppdatera tabellen när månads-väljaren ändras
        monthSelect.addEventListener('change', function () {
            currentMonth = parseInt(monthSelect.value, 10);
            updateTable(currentMonth, currentYear);
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
                updateTable(currentMonth, currentYear);
            }
        });

        // Nästa månad-knappen
        nextMonthButton.addEventListener('click', function () {
            if (currentMonth < 11) {
                currentMonth++;
                monthSelect.value = currentMonth; // Sync dropdown
                updateTable(currentMonth, currentYear);
            }
        });

        // Uppdatera tabellen när årsväljaren ändras
        yearSelect.addEventListener('change', function () {
            currentYear = parseInt(yearSelect.value, 10);
            console.log(`Updating table for year: ${currentYear}`);
            updateTable(currentMonth, currentYear);
        });
    }

    function renderTable() {
        container.innerHTML = `
            <div id="sticky-header" style="position: sticky; top: 0; z-index: 10; background: #d3e4f8; text-align: left; padding: 0 8px; font-weight: bold; height: 36px; line-height: 36px; margin: 0; border-bottom: 1px solid #ccc;">
                <span id="month-year">${swedishMonths[currentMonth]} ${currentYear}</span>
            </div>
            <div id="table-wrapper" style="overflow-x: auto; overflow-y: auto; height: 80vh; margin: 0; padding: 0; box-sizing: border-box;">
                <table class="table table-bordered" style="margin: 0; border-collapse: collapse; width: 100%;">
                    <thead>
                        <tr id="week-row" style="position: sticky; top: 0; z-index: 9; background: #E0F7FA; margin: 0; padding: 0; white-space: nowrap; text-align: center; vertical-align: middle;"></tr>
                        <tr id="date-row" style="position: sticky;font-size: 14px; top: 36px; z-index: 8; background: white; margin: 0; padding: 0; white-space: nowrap; text-align: center; vertical-align: middle;"></tr>
                    </thead>
                    <tbody id="table-body"></tbody>
                </table>
            </div>
        `;

        const tableWrapper = document.getElementById('table-wrapper');
        const stickyHeader = document.getElementById('sticky-header');

        // Synkronisera horisontell scroll för "månad och år"
        tableWrapper.addEventListener('scroll', function () {
            stickyHeader.style.left = `-${this.scrollLeft}px`;
        });

        updateTable(currentMonth, currentYear); // Ladda initial data
    }

    function updateTable(month, year) {
        const weekRow = document.getElementById('week-row');
        const dateRow = document.getElementById('date-row');
        const tableBody = document.getElementById('table-body');

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => {
            const date = new Date(year, month, i + 1);
            const dateString = date.toISOString().split('T')[0];
            const weekdayIndex = (date.getDay() + 6) % 7; // Gör måndag till första dagen
            const isHoliday = publicHolidays[dateString] || null;
            return {
                fullDate: dateString,
                day: date.getDate(),
                week: getWeekNumber(date),
                monthName: swedishMonths[month],
                weekday: swedishWeekdays[weekdayIndex],
                isWeekend: weekdayIndex >= 5, // Lördag och söndag
                isHoliday
            };
        }).filter(day => !day.isWeekend); // Filtrera bort helger (lördagar och söndagar)

        weekRow.innerHTML = `<th style="position: sticky; left: 0; background: #E0F7FA;">Vecka</th>`;
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

        dateRow.innerHTML = `<th style="position: sticky; left: 0; background: white;">Datum</th>`;
        days.forEach(day => {
            const bgColor = day.isHoliday ? dayColors.holiday : dayColors.weekday;
            const content = day.isHoliday ? day.isHoliday : `${day.weekday} ${day.day}`;
            dateRow.innerHTML += `<th class="text-center" style="background: ${bgColor};">${content}</th>`;
        });

        tableBody.innerHTML = '';
        users.forEach(user => {
            const tr = document.createElement('tr');
            const nameCell = document.createElement('td');
            nameCell.innerHTML = `${user.name}<br><small style="font-size: 12px; color: gray;">(${user.group})</small>`;
            nameCell.style.position = 'sticky';
            nameCell.style.left = '0';
            nameCell.style.background = 'white';
            nameCell.style.whiteSpace = 'nowrap';
            tr.appendChild(nameCell);

            days.forEach(day => {
                const td = document.createElement('td');
                if (day.isHoliday) {
                    td.textContent = "Ledig"; // Visa "Ledig" för helgdagar
                    td.style.backgroundColor = dayColors.holiday;
                    td.style.textAlign = 'center';
                } else {
                    const status = scheduleData[user.name]?.[day.fullDate] || '';
                    td.innerHTML = `
                        <select class="form-select form-select-sm hidden-text-dropdown" style="width: 100%; height: 100%; background-color: ${colors[status]};">
                            ${statuses.map(s => `<option value="${s}" ${s === status ? 'selected' : ''} style="background-color: ${colors[s]}">${s || '-'}</option>`).join('')}
                        </select>`;
                    td.querySelector('select').addEventListener('change', function () {
                        const newStatus = this.value;
                        td.style.backgroundColor = colors[newStatus];
                        this.style.backgroundColor = colors[newStatus];
                        saveData(user.name, day.fullDate, newStatus);
                    });
                }
                tr.appendChild(td);
            });

            tableBody.appendChild(tr);
        });
    }

    function saveData(person, datum, status) {
        fetch(SemesterSchemaSettings.restUrl + 'save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce': SemesterSchemaSettings.nonce },
            body: JSON.stringify({ person, datum, status })
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`Failed to save data: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => {
            console.log('Data saved:', data);
        })
        .catch(err => console.error('Error saving data:', err));
    }

    function scrollToWeek(week) {
        const days = [];
        for (let month = 0; month < 12; month++) {
            const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(currentYear, month, day);
                const weekdayIndex = (date.getDay() + 6) % 7;
                if (weekdayIndex < 5) {
                    days.push({
                        date,
                        week: getWeekNumber(date),
                        month
                    });
                }
            }
        }

        const targetDay = days.find(d => d.week === week);
        if (targetDay) {
            currentMonth = targetDay.month;
            document.getElementById('month-select').value = currentMonth;
            updateTable(currentMonth, currentYear);

            const weekCells = Array.from(document.querySelectorAll('#week-row th'));
            const targetCell = weekCells.find(cell => cell.textContent.includes(`Vecka ${week}`));
            if (targetCell) {
                targetCell.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    function startAutoPolling() {
        if (autoPollingInterval) clearInterval(autoPollingInterval);

        autoPollingInterval = setInterval(() => {
            console.log('Auto-polling for updates...');
            fetch(SemesterSchemaSettings.restUrl + 'load', {
                method: 'GET',
                headers: { 'X-WP-Nonce': SemesterSchemaSettings.nonce }
            })
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to load updated data: ${res.statusText}`);
                }
                return res.json();
            })
            .then(updatedSchedule => {
                console.log('Updated schedule received:', updatedSchedule);

                // Endast rendera om schemat har ändrats
                if (JSON.stringify(scheduleData) !== JSON.stringify(updatedSchedule)) {
                    scheduleData = updatedSchedule;
                    updateTable(currentMonth, currentYear); // Uppdatera tabellen med nya data
                }
            })
            .catch(err => console.error('Error in auto-polling:', err));
        }, 5000); // Polla var 5:e sekund
    }

    bindControlPanelEvents();
    loadData();
    startAutoPolling(); // Starta auto-polling direkt efter att data laddats
});
