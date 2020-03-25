//==== config =====
let indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB,
    IDBTransaction  = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction,
    IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

let db;

const excludeMetric = ['day']; //массив исключений для фильтра metric
const urlDataFile = 'https://raw.githubusercontent.com/vladimir-mit/test-app/master/data/data.json'; //ссылка на файл
const numberOfRecentEntries = 7; //количество последних записей при первой загрузке
const idFilterMetric = 'filterMetric'; // id контейнера, куда нужно добавить фильтр Метрик
const idFilterDate = 'filterMonth'; // id контейнера, куда нужно добавить фильтр Даты
const idGraph = 'graph'; // id контейнера, куда нужно добавить график
const idTable = 'dataTable'; // id контейнера, куда нужно добавить таблицу
let indexDate = 'date'; //название индекса для сортировки по дате
//==== config =====

//==== utils =====
//
const setIndexDate = (key) => indexDate = key; //установка индекса для даты отличного от дефолтного
const showAlert = (message) => alert(message);

//string
const firstUppercaseLetter = (word) => word.charAt(0).toUpperCase() + word.slice(1);

//array
const diffArray = (a, b) => a.filter((i) => b.indexOf(i) < 0);
const diffValuesFilter = (array, exclude) => array.filter(item => !exclude.includes(item.value));

//number
const numberFormat = (number) => new Intl.NumberFormat('ru-RU').format(number);
const numberFloatFormat = (number, floatcount) => parseFloat(number.toFixed(floatcount));
const isNumberValue = (str) => {
    if (typeof str != "string") return false;
    return !isNaN(str) && !isNaN(parseFloat(str));
}

//date
const transformMonthDate = (month) => ('0'+(month+1)).slice(-2);
const transformDayDate = (day) => ('0'+(day)).slice(-2);
const setDayOfTheMonth = (date, day = 1) => {
	let dt = new Date(date);
	switch (day) {
		case 'first':
            dt.setDate(1);
            dt.setHours(0, 0, 0, 0);
			break;
		case 'last':
			let dtYear = dt.getFullYear();
			let dtMonth = transformMonthDate(dt.getMonth());
			let dtLastDay = transformDayDate(new Date(dtYear, dtMonth, 0).getDate());
            dt.setDate(dtLastDay);
            dt.setHours(23, 59, 59, 59);
			break;
		default:
			dt.setDate(day);
			break;
	}
	return dt;
}
const getStringDate = (date, type = null) => {
	let dt = new Date(date);
	let dtYear = dt.getFullYear();
	let dtMonth = transformMonthDate(dt.getMonth());
	let dtDay = transformDayDate(dt.getDate());
	if (type === 'MY') {
		return `${dtMonth}-${dtYear}`;	
	}
	if (type === 'timestamp') {
		return dt.getTime();
	}
	return `${dtYear}-${dtMonth}-${dtDay}`;
}

//messages
const ifErrorMessage = (errorCode) => console.log('Error storing note ' + errorCode);
const ifSuccessMessages = (type) => {
    switch (type) {
        case 'flipOrder':
            console.log('Flip order');
            break;
        case 'display':
            console.log('All message display');
            break;
        case 'db':
            console.log('DB load');
            break;
        case 'delete':
            console.log('Delete request successful');
            break;
        case 'add':
            console.log('Added new message');
            break;
        case 'addAll':
            console.log('Added all new message');
            break;
        case 'dbUpgrade':
            console.log('DB upgrade');
            break;
        default:
            console.log('Transaction complete');
            break;
    }
}

//получение данных файла JSON через XMLHttpRequest
const getDataFromFileXHR = (dataUrl) => {
    let xhr;
    if (window.XMLHttpRequest) {
        xhr = new XMLHttpRequest();
    } else if (window.ActiveXObject) {
        try {
            xhr = new ActiveXObject('Msxml2.XMLHTTP');
        } 
        catch (e) {
            try {
                xhr = new ActiveXObject('Microsoft.XMLHTTP');
            } 
            catch (e) {}
        }
    }
    xhr.open("GET", dataUrl, false);
	xhr.onload = (e) => {
		if (xhr.readyState === 4) {
			if (xhr.status === 200) {
				console.log('file download - ok');
			} else {
                showAlert('Ошибка с файлом: ' + xhr.statusText);
			}
		}
    };
    xhr.onerror = (e) => console.error(xhr.statusText);
    xhr.send(null);
    return JSON.parse(xhr.response);
}

//сортировка в таблице по столбцам
const flipStatsOrderTH = (event) => {
    const target = event.target.closest('th');
    let thIndex = target.cellIndex;
    const table = target.closest('table');
    let order = 'next';

    //TR - TH
    let sortedTH = Array.from(table.tHead.rows[0].cells);
    const editTH = (thIndex) => (th, index) => {
        if (index === thIndex) {
            th.children[0].classList.add("th-order");
            th.children[0].classList.toggle("next");
            if (th.children[0].classList.contains("next")) {
                order = 'prev';
            }
            return th;
        }
        th.children[0].classList.remove("th-order");
        th.children[0].classList.remove("next");
        return th;
    }
    sortedTH.map(editTH(thIndex));

    //TR - TD
    let sortedRows = Array.from(table.tBodies[0].rows);
    //сортировка чисел
    const sortNumbers = (thIndex, order) => (rowA, rowB) => {
        if (order === 'prev') {
            return rowA.cells[thIndex].innerHTML - rowB.cells[thIndex].innerHTML;
        }
        return rowB.cells[thIndex].innerHTML - rowA.cells[thIndex].innerHTML;
    }
    //сортировка строк
    const sortString = (thIndex, order) => (rowA, rowB) => {
        let orderString = (order === 'prev') ? -1 : 1;
        if (rowA.cells[thIndex].innerHTML > rowB.cells[thIndex].innerHTML) {
            return orderString;
        }
        if (rowA.cells[thIndex].innerHTML < rowB.cells[thIndex].innerHTML) {
            return -orderString;
        }
        return 0;
    }
    let tdValue = sortedRows[0].cells[thIndex].innerHTML; //значение, которое нужно отсортировать
    if (isNumberValue(tdValue)) {
        sortedRows.sort(sortNumbers(thIndex, order));
    } else {
        sortedRows.sort(sortString(thIndex, order));
    }

    //убираем выделение столбца
    table.querySelectorAll('td').forEach(td => td.classList.remove("table-primary"));

    //выделяем столбец по которому идет сортировка
    const editTD = (thIndex) => (tr, index) => {
        tr.children[thIndex].classList.add("table-primary");
        return tr;
    }
    sortedRows.map(editTD(thIndex));

    //table
    table.tHead.children[0].append(...sortedTH);
    table.tBodies[0].append(...sortedRows);
    
    //
    ifSuccessMessages('flipOrder');
}

const newGraphFromMetric = (key, dateFrom, dateTo) => getStatsForGraph(db, 'stats', key, dateFrom, dateTo); //отображение нового графика при изменении фильтра metric
const newDateFilter = (dateFrom, dateTo) => getStatsForTable(db, 'stats', indexDate, 'next', true, dateFrom, dateTo); //отображение новой таблицы при изменении фильтра дат

//получаем значения фильтров
const getFormValues = (formElemets) => {
	let elementsValue = [];
	for (let i = 0; i < formElemets.length; i++) {
		elementsValue[formElemets[i].name] = formElemets[i].value;
	}
	return elementsValue;
}

//устанавливаем значения фильтра дат по умолчанию (если не правильно выбраны даты)
const setDefaultDateFilterValues = () => {
    const firstSelect = document.getElementById(idFilterDate).getElementsByTagName('select')[0];
    const secondSelect = document.getElementById(idFilterDate).getElementsByTagName('select')[1];
    firstSelect.selectedIndex = 0;
    secondSelect.selectedIndex = secondSelect.options.length-1;
}

//применение фильтров
const applyFilter = (formElemets) => {
    const elementsValue = getFormValues(formElemets);
    const elementNameDateFrom = `${idFilterDate}From`;
    const elementNameDateTo = `${idFilterDate}To`;
	newGraphFromMetric(elementsValue.metric, elementsValue[elementNameDateFrom], elementsValue[elementNameDateTo]);
	newDateFilter(elementsValue[elementNameDateFrom], elementsValue[elementNameDateTo]);
}

//отобразить все записи в таблице
const allShown = () => getStatsForTable(db, 'stats', null, 'next', true);

//добавить все варианты значений в фильтры
const getValuesForFiltres = (db, tableName) => {
	let tx = db.transaction([tableName], 'readonly');
	let store = tx.objectStore(tableName);
	allNotesForFilters = store.getAll();
	allNotesForFilters.onsuccess = (event) => {

        //создание нового фильтра select
        const filterIndexNames = Array.from(event.target.source.indexNames).reduce((result, current) => {
            result[current] = current;
            return result;
        },{});
        const metricSelect = filterSelect(filterIndexNames, "metric", "Chart metric", "metric", "form-control", excludeMetric);
        document.getElementById(idFilterMetric).append(metricSelect);

        //создание нового фильтра fromTo дат
        const dateFromTo = filterFromToDate(event.target.result, indexDate, idFilterDate, "Month from", "Month to", idFilterDate, "form-control");
        document.getElementById(idFilterDate).append(dateFromTo);
	}
}

//создание БД с индексами
const connectDB = (dbName, dbVersion, tableName = 'stats') => {
    let dbReq = indexedDB.open(dbName, dbVersion);

    dbReq.onupgradeneeded = (event) => {
        db = event.target.result;

        //получение данных файла JSON через XMLHttpRequest
        const allDataFromFileXHR = getDataFromFileXHR(urlDataFile);

        let stats;
        if (!db.objectStoreNames.contains(tableName)) {
            stats = db.createObjectStore(tableName, {autoIncrement: true});
        } else {
            stats = dbReq.transaction.objectStore(tableName);
        }

        //создание индексов из первой записи в файле
        let dataIndexNames = allDataFromFileXHR.slice(0, 1)[0];
        for (let val in dataIndexNames) {
            if (!stats.indexNames.contains(val)) {
                stats.createIndex(val, val);
            }
        }
        let transaction = event.target.transaction;
        transaction.oncomplete = (event) => {
            //добавление всех данных в БД
            addDataStats(db, allDataFromFileXHR, tableName);
        }
        ifSuccessMessages('dbUpgrade');
    }

    dbReq.onsuccess = (event) => {
        db = event.target.result;

        getValuesForFiltres(db, tableName); //добавление дат и метрик в фильтры

        getStatsForTable(db, tableName); //при загрузке показать таблицу с данными
        getStatsForGraph(db, tableName); //при загрузке показать график с данными

        ifSuccessMessages('db');
    }

    dbReq.onerror = (event) => ifErrorMessage(event.target.errorCode);
}

//создание БД
connectDB('TrafficStarsDB', 1);
setIndexDate('day'); //устанавливаем название столбца с датой

//добавление всех записей из файла в БД
const addDataStats = (db, data, tableName) => {
    let tx = db.transaction([tableName], 'readwrite');
    let store = tx.objectStore(tableName);

    for (let i = 0; i < data.length; i++) {
        let item = {};
        for (let val in data[i]) {
            item[val] = data[i][val];
        }
        store.add(item);
    }

    tx.oncomplete = () => ifSuccessMessages('addAll');
}

//получение данных из БД для таблицы
const getStatsForTable = (db, tableName = 'stats', key = null, order = 'prev', allShown = false, dateFrom = null, dateTo = null) => { ///!! передать название таблицы
    if (db.objectStoreNames[0] !== 'stats' || tableName === '' || tableName === null) {
        tableName = db.objectStoreNames[0];
    }
	let tx = db.transaction([tableName], 'readonly');
    let store = tx.objectStore(tableName);
    let countRequest = store.count();
	
	if (key) {
		//отображение записей в таблице с сортировкой по индексу
		let keyRange = null;
		let allNotes = [];
		let index = store.index(key);

		if (dateFrom > dateTo) {
            showAlert('Неверно выбран диапазон дат.\nРезультат будет показан за весь период');
            setDefaultDateFilterValues();
        }
		if (dateFrom && dateTo && (dateFrom < dateTo)) {
			keyRange = IDBKeyRange.bound(dateFrom, dateTo);
		}

		let req = index.openCursor(keyRange, order);

		req.onsuccess = (event) => {
			let cursor = event.target.result;
			if (cursor) {
				allNotes.push(cursor.value);
                cursor.continue();
			} else {
				displayNotesTable(allNotes, true);
				ifSuccessMessages('display');
			}
		}

		req.onerror = (event) => ifErrorMessage(event.target.errorCode);

	} else {
        //отображение записей в таблице (при загрузке стр) без указания индекса
        countRequest.onsuccess = () => {
            //при первой загрузке показывать только 7 (numberOfRecentEntries) записей
            let rangeFrom = (allShown) ? null : IDBKeyRange.lowerBound(countRequest.result - numberOfRecentEntries, true); 
            allN = store.getAll(rangeFrom, null);
            allN.onsuccess = (event) => {
                displayNotesTable(event.target.result, allShown);
            }
        }
	}
}

//получение данных из БД для графика
const getStatsForGraph = (db, tableName, key, dateFrom = null, dateTo = null) => {
    if (db.objectStoreNames[0] !== 'stats' || tableName === '' || tableName === null) {
        tableName = db.objectStoreNames[0];
    }
    let tx = db.transaction([tableName], 'readonly');
    let store = tx.objectStore(tableName);
    if (!key) {
        //если индекс не передан, то устанавливааем первый индекс в таблице
        key = store.indexNames[0];
    }

	let keyRange = null;
	let allNotes = [];
	let index = store.index(indexDate); //сортируем график по дате
	
	if (dateFrom && dateTo && (dateFrom < dateTo)) {
		//добавление выбранного диапазона дат
		keyRange = IDBKeyRange.bound(dateFrom, dateTo);
	}

	let req = index.openCursor(keyRange, 'next');

	req.onsuccess = (event) => {
		let cursor = event.target.result;
		if (cursor) {
			allNotes.push(cursor.value);
			cursor.continue();
		} else {
			displayNotesGraph(allNotes, key);
			ifSuccessMessages('display');
		}
	}

	req.onerror = (event) => ifErrorMessage(event.target.errorCode);
}

// ==== Views ====
// Отображение данных в виде таблицы
const displayNotesTable = (notes, allShown = false) => {
    let table_exist = document.getElementById("statsTable");

    let table = document.createElement('table');
    table.setAttribute('class', 'table table-striped table-bordered table-hover table-sm table-responsive-lg');
    table.setAttribute('id', 'statsTable');

    //создание head таблицы
    let notesHead = notes.slice(0, 1)[0];
    let noteKeys = Object.keys(notesHead);

    let thead = document.createElement('thead');
    thead.setAttribute('class', 'thead-light');
    
    let thead_tr = document.createElement('tr');
    for (let val in noteKeys) {
        let th = document.createElement('th');
        th.setAttribute('scope', 'col');
        th.setAttribute('id', `${noteKeys[val]}`);
        th.innerHTML = `<span>${firstUppercaseLetter(noteKeys[val])}</span>`;
        thead_tr.appendChild(th);
    }
    thead.appendChild(thead_tr);
    table.appendChild(thead);
    //head

    //создание записей (строк) в таблице
    let tbody = document.createElement('tbody');
    for (let i = 0; i < notes.length; i++) {
        let note = notes[i];
        let noteValues = Object.values(note);
        let tbody_tr = document.createElement('tr');
        for (let tdValue in noteValues) {
            let td = document.createElement('td');
            td.innerHTML = `${noteValues[tdValue]}`;
            tbody_tr.appendChild(td);
        }
        tbody.appendChild(tbody_tr);
    }
    table.appendChild(tbody);
    //rows

    document.getElementById(idTable).innerHTML = '';
    document.getElementById(idTable).appendChild(table);

    //при первой загрузке показываем только последние 7 записей,
	//поэтому добавляем кнопку для отображение всех
    if (!allShown) {
        let buttonShowAll = document.createElement('button');
        buttonShowAll.setAttribute('id', 'allShown');
        buttonShowAll.setAttribute('class', 'btn-border');
        buttonShowAll.setAttribute('onclick', 'allShown()');
        buttonShowAll.innerHTML = 'Show All';
        document.getElementById(idTable).appendChild(buttonShowAll);
    }

    //добавляем клик по TH таблицы для ее сортировки
    document.getElementById('statsTable').querySelectorAll('thead').forEach(tableTH => tableTH.addEventListener('click', () => flipStatsOrderTH(event), false));

    //при изменении фильтров таблица уже была
    //проверяем была ли сортировка в таблице
    if (table_exist !== null) {
        let sortTH = table_exist.querySelector('.th-order');
        if (sortTH !== null) {
            let idSortTH = sortTH.parentNode.getAttribute('id');
            //после применения фильров возвращаем сортировку таблицы
            document.getElementById(idSortTH).click();
        }
    }
}

// Отображение данных на графике по индексу
const displayNotesGraph = (notes, key) => {
    let graph = document.getElementById(idGraph);

    //правая часть графика
    let divRight = document.createElement('div');
    divRight.setAttribute('style', 'flex: 1 0;');
        
    //значения внизу графика
    let listBottom = document.createElement('ul');
    listBottom.setAttribute('class','xAxis');

    //значения слева от графика
    let listLeft = document.createElement('ul');
    listLeft.setAttribute('class','yAxis');

    let arrBottom = [];
    for (let i = 0; i < notes.length; i++) {
        let note = notes[i];
		let noteDay = getStringDate(new Date(note[indexDate]), 'MY');
        arrBottom.push({ date: noteDay, value: note[key] });
    }
	//складываем значения по месяцам
    const arrBottomSum = arrBottom.reduce( ( result, current ) => {
        for (let key in current) {
            let value = current[key];
            if (key === 'date') {
                if (result[value] === undefined) {
                    result[value] = 0;
                }
            }
            if (key === 'value') {
                result[current.date] += value;
            }          
        }
        return result;
    }, {} );

	//расчитываем ширину столбцов графика
    let liWidth = parseInt( 100 / Object.keys(arrBottomSum).length );

    //график
    let listMain = document.createElement('dl');
    listMain.setAttribute('id','csschart');
    
    //узнаем максимальное значение по месяцам
	let maxValue = Math.max.apply(Math, Object.values(arrBottomSum).map((value, index) => value));
	if (maxValue < 10) {
		maxValue = 10;
    }
    
    let onePercent = maxValue / 100;
    
	for (let key in arrBottomSum) {
        //месяцы внизу графика (доступные из данных) (по оси x)
        let li = document.createElement('li');
        li.setAttribute('style', `width:${liWidth}%;`);
        li.innerHTML = `${key}`;
        listBottom.appendChild(li);

        //график
        let valueInPercent = Math.floor(arrBottomSum[key] / onePercent); //переводим значения в проценты
        let dd = document.createElement('dd');
        dd.setAttribute('style', `width:${liWidth}%;`);
        dd.setAttribute('class', `p${valueInPercent}`);
        dd.innerHTML = `<span><b>${numberFormat( numberFloatFormat(arrBottomSum[key], 4) )}</b></span>`;
        listMain.appendChild(dd);
    }
    //mainChart

    //значения слева от графика (по оси y)
	for (let i = 100; i >= 0; i -= 10) {
		let liValue = parseInt(onePercent * i);
        let li = document.createElement('li');
        li.innerHTML = `${numberFormat(liValue)}`;
        listLeft.appendChild(li);
    }
    //leftChart

    divRight.appendChild(listMain);
    divRight.appendChild(listBottom);

    graph.innerHTML = '';
    graph.setAttribute('style', 'display:-ms-flexbox!important;display:flex!important;');
    graph.appendChild(listLeft);
    graph.appendChild(divRight);
}

const filterSelect = (data, nameSelect, labelText, idSelect, classSelect, excludeArray) => {
    if (!data) {
        return;
    }
    let preData = prepareDataFilterSelect(data);

    let label;
    let filteredData;
    let select = document.createElement("SELECT");
    let div = document.createElement("DIV");
    if (nameSelect) {
        select.setAttribute("name", nameSelect);
    }
    if (idSelect) {
        select.setAttribute("id", idSelect);
    }
    if (classSelect) {
        select.setAttribute("class", classSelect);
    }
    select.setAttribute("onchange", "applyFilter(this.form.elements);");

    //придумать как убрать лишнее из данных
    if (excludeArray && excludeArray.length !== 0) {
        filteredData = diffValuesFilter(preData, excludeArray); //убираем ненужное
    } else {
        filteredData = preData;
    }

    for (let val in filteredData) {
        select.append(new Option(firstUppercaseLetter(filteredData[val].title), filteredData[val].value));
    }

    if (labelText) {
        label = document.createElement("LABEL");
        if (idSelect) {
            label.setAttribute("for", idSelect);    
        }
        label.innerHTML = labelText;
        div.append(label);
    }

    div.append(select)
    return div;
}

//добавление всех дат (месяц-год) в фильтр
const filterFromToDate = (data, key, nameFilter, labelFrom, labelTo, idFilter, classFilter) => {
    if (!data) {
        return;
    }
    let div = document.createElement("DIV");
    div.setAttribute('class', 'row');

    const filterNameFrom = `${nameFilter}From`;
    const filterNameTo = `${nameFilter}To`;
    const filterIdFrom = `${idFilter}From`;
    const filterIdTo = `${idFilter}To`;

    const preDate = prepareFilterDate(data, key);
    
    let filterFrom = filterSelect(preDate[0], filterNameFrom, labelFrom, filterIdFrom, classFilter);
    let filterTo = filterSelect(preDate[1], filterNameTo, labelTo, filterIdTo, classFilter);

    filterFrom.setAttribute('class', 'col-12 col-sm-6');
    filterTo.setAttribute('class', 'col-12 col-sm-6');

    filterFrom.getElementsByTagName('select')[0].options.selectedIndex = 0;
    filterTo.getElementsByTagName('select')[0].options.selectedIndex = filterTo.getElementsByTagName('select')[0].options.length-1;

    div.appendChild(filterFrom);
    div.appendChild(filterTo);
    return div;
}

const prepareFilterDate = (data, key) => {
    let arrDateFrom = [];
    let arrDateTo = [];
    for (let i = 0; i < data.length; i++) {
        let note = data[i];

		let noteDate = new Date(note[key]);
        let valueDateFrom = getStringDate(setDayOfTheMonth(noteDate, 'first'));
        let valueDateTo = getStringDate(setDayOfTheMonth(noteDate, 'last'));
		let titleDate = getStringDate(noteDate, 'MY');
        let noteTimestamp = getStringDate(setDayOfTheMonth(noteDate, 'first'), 'timestamp');
		
        arrDateFrom[`${noteTimestamp}`] = {value: valueDateFrom, title: titleDate};
        arrDateTo[`${noteTimestamp}`] = {value: valueDateTo, title: titleDate};
    }
    return { 0: arrDateFrom, 1: arrDateTo };
}

const prepareDataFilterSelect = (data) => {
    if (Array.isArray(data)) {
        return data;
    }
    let newData = [];
    let dataKeys = Object.keys(data);
    for (let val in dataKeys) {
        newData.push({value: dataKeys[val], title: dataKeys[val]});
    }
    return newData;
}