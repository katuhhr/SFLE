function createListItems(container, values) {
    if (!container) return;
    container.innerHTML = "";

    if (!Array.isArray(values) || values.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Нет данных";
        container.appendChild(li);
        return;
    }

    values.forEach((value) => {
        const li = document.createElement("li");
        li.textContent = value;
        container.appendChild(li);
    });
}

function createPerformanceTable(table, columns, rows) {
    if (!table) return;

    const safeColumns = Array.isArray(columns) && columns.length ? columns : ["Дата"];
    const safeRows = Array.isArray(rows) ? rows : [];

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    safeColumns.forEach((col) => {
        const th = document.createElement("th");
        th.textContent = col;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");
    if (!safeRows.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = safeColumns.length;
        td.textContent = "Нет данных";
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        safeRows.forEach((row) => {
            const tr = document.createElement("tr");
            safeColumns.forEach((key, index) => {
                const td = document.createElement("td");
                const value = row[key] ?? row[index] ?? "";
                td.textContent = value;
                if (index === 0) td.classList.add("date-cell");
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    table.innerHTML = "";
    table.appendChild(thead);
    table.appendChild(tbody);
}

async function loadPageData(page) {
    // Подставьте ваш реальный backend URL или прокси.
    const response = await fetch(`/api/student/${page}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    return response.json();
}

function renderMaterials(data) {
    const topicsList = document.getElementById("topicsList");
    const selectedTopicTitle = document.getElementById("selectedTopicTitle");
    const materialsPanel = document.getElementById("materialsPanel");

    createListItems(topicsList, data.topics);
    if (selectedTopicTitle) selectedTopicTitle.textContent = data.selectedTopic || "Тема";
    if (materialsPanel) materialsPanel.textContent = data.topicDescription || "";
}

function renderDebts(data) {
    const debtTopicTitle = document.getElementById("debtTopicTitle");
    const debtTopicItems = document.getElementById("debtTopicItems");
    const currentTasksList = document.getElementById("currentTasksList");
    const debtsList = document.getElementById("debtsList");

    if (debtTopicTitle) debtTopicTitle.textContent = data.topicTitle || "Тема";
    createListItems(debtTopicItems, data.topicMenuItems);
    createListItems(currentTasksList, data.currentTasks);
    createListItems(debtsList, data.debts);
}

function renderSelfstudy(data) {
    const selfStudyContent = document.getElementById("selfStudyContent");
    if (!selfStudyContent) return;

    const items = Array.isArray(data.tasks) ? data.tasks : [];
    if (!items.length) {
        selfStudyContent.textContent = "Нет данных";
        return;
    }

    const list = document.createElement("ul");
    list.className = "debt-list";
    list.style.marginTop = "22px";
    list.style.listStyle = "none";

    items.forEach((task) => {
        const li = document.createElement("li");
        li.textContent = task;
        list.appendChild(li);
    });

    selfStudyContent.innerHTML = "";
    selfStudyContent.appendChild(list);
}

function renderPerformance(data) {
    const studentName = document.getElementById("studentName");
    const performanceTable = document.getElementById("performanceTable");

    if (studentName) studentName.textContent = data.studentName || "Студент";
    createPerformanceTable(performanceTable, data.columns, data.rows);
}

async function initStudentPage() {
    const page = document.body.dataset.page;
    if (!page) return;

    try {
        const data = await loadPageData(page);

        if (page === "materials") renderMaterials(data);
        if (page === "debts") renderDebts(data);
        if (page === "selfstudy") renderSelfstudy(data);
        if (page === "performance") renderPerformance(data);
    } catch (error) {
        // Ошибка API не ломает верстку: просто показываем пустые состояния.
        if (page === "materials") renderMaterials({});
        if (page === "debts") renderDebts({});
        if (page === "selfstudy") renderSelfstudy({});
        if (page === "performance") renderPerformance({});
        console.error(error);
    }
}

document.addEventListener("DOMContentLoaded", initStudentPage);
