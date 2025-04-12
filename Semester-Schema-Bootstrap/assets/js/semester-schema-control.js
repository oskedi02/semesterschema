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
        yearSelect?.addEventListener('change', function () {
            currentYear = parseInt(yearSelect.value, 10);
            updateTable();
        });

        // Uppdatera tabellen när månads-väljaren ändras
        monthSelect?.addEventListener('change', function () {
            currentMonth = parseInt(monthSelect.value, 10);
            updateTable();
        });

        // Bind övriga kontrollknappar...
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

    bindControlPanelEvents(); // Koppla event till kontrollpanelen (om den finns på sidan)
});