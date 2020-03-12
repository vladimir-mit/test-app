let indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB,
    IDBTransaction  = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction,
    IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

let db;

const excludeMetric = ['day']; //массив исключений для фильтра metric
const urlDataFile = 'https://raw.githubusercontent.com/vladimir-mit/test-app/master/data/data.json';

const firstUppercaseLetter = (word) => word.charAt(0).toUpperCase() + word.slice(1);
const diffArray = (a, b) => a.filter((i) => b.indexOf(i) < 0);

const transformMonthDate = (month) => ('0'+(month+1)).slice(-2);
const transformDayDate = (day) => ('0'+(day)).slice(-2);
const setDayOfTheMonth = (date, day = 1) => {
	let dt = new Date(date);

	switch (day) {
		case 'first':
			dt.setDate(1);
			break;
		case 'last':
			let dtYear = dt.getFullYear();
			let dtMonth = transformMonthDate(dt.getMonth());
			let dtLastDay = transformDayDate(new Date(dtYear, dtMonth, 0).getDate());
			dt.setDate(dtLastDay);
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

//добавить способ получения файла JSON через Fetch API
// const getDataFromFile = async (dataUrl) => {
// 	const returnData = await fetch(dataUrl)
// 		.then((response) => {
// 			if (response.status !== 200) { 
// 				console.log('Looks like there was a problem. Status Code: ' +  response.status);  
// 				return;
// 			}
// 			console.log('file upload - ok');
// 			return response.json();
// 		})
// 		//.then((data) => data)
// 		.catch((err) => console.log('Fetch Error: ', err));

// 	//console.log(returnData);//выводит JSON
// 	return returnData; //возвращает Promise
// }

// const allDataFromFile = getDataFromFile(urlDataFile);
// console.log(allDataFromFile); //выводит Promise

//получение данных файла JSON через XMLHttpRequest
const getDataFromFileXHR = (dataUrl) => {
	let xhr = new XMLHttpRequest();
	xhr.open("GET", dataUrl, false);
	xhr.onload = (e) => {
		if (xhr.readyState === 4) {
			if (xhr.status === 200) {
				console.log('file upload - ok');
				//return xhr.response;
			} else {
				console.error(xhr.statusText);
			}
		}
	};
	xhr.onerror = (e) => console.error(xhr.statusText);
	xhr.send(null);
	return JSON.parse(xhr.response);
}

//сортировка в таблице по столбцам
const flipStatsOrder = (key) => {
    const item = document.getElementById(key);
    getStatsForTable(db, key, item.dataset.order, true);
    ifSuccessMessages('flipOrder');
}

const newGraphFromMetric = (key, dateFrom, dateTo) => getStatsForGraph(db, key, dateFrom, dateTo); //отображение нового графика при изменении фильтра metric
const newDateFilter = (dateFrom, dateTo) => getStatsForTable(db, 'day', 'next', true, dateFrom, dateTo); //отображение новой таблицы при изменении фильтра дат

//получаем значения фильтров
const getFormValues = (formElemets) => {
	let elementsValue = [];
	for (let i = 0; i < formElemets.length; i++) {
		elementsValue[formElemets[i].name] = formElemets[i].value;
	}
	return elementsValue;
}

//изменение фильтров
const applyFilter = (formElemets) => {
	const elementsValue = getFormValues(formElemets);
	newGraphFromMetric(elementsValue.metric, elementsValue.monthFrom, elementsValue.monthTo);
	newDateFilter(elementsValue.monthFrom, elementsValue.monthTo);
}

//отобразить все записи в таблице
const allShown = () => getStatsForTable(db, null, 'next', true);

const getValuesForFiltres = (db) => {
	let tx = db.transaction(['stats'], 'readonly');
	let store = tx.objectStore('stats');
	allNotesForFilters = store.getAll();
	allNotesForFilters.onsuccess = (event) => {
		allMonth(event.target.result);
		allMetric(event.target.result, excludeMetric);
	}
}

//создание БД с индексами
const connectDB = (dbName, dbVersion) => {
   let dbReq = indexedDB.open(dbName, dbVersion);

   dbReq.onupgradeneeded = (event) => {
	  db = event.target.result;

	  //получение данных файла JSON через XMLHttpRequest
	  const allDataFromFileXHR = getDataFromFileXHR(urlDataFile);

      let stats;
      if (!db.objectStoreNames.contains('stats')) {
         stats = db.createObjectStore('stats', {autoIncrement: true});
      } else {
         stats = dbReq.transaction.objectStore('stats');
      }

	  //создание индексов из первой записи в файле
      let dataIndexNames = allDataFromFileXHR.shift();
      for (let val in dataIndexNames) {
         if (!stats.indexNames.contains(val)) {
               stats.createIndex(val, val);
         }
      }
      let transaction = event.target.transaction;
      transaction.oncomplete = (event) => {
         //добавление всех данных в БД
         addDataStats(db, allDataFromFileXHR);
      }
      ifSuccessMessages('dbUpgrade');
   }

   dbReq.onsuccess = (event) => {
      db = event.target.result;

      getStatsForTable(db); //при загрузке показать таблицу с данными
      getStatsForGraph(db); //при загрузке показать график с данными
      getValuesForFiltres(db); //добавление дат и метрик в фильтры

      ifSuccessMessages('db');
   }

   dbReq.onerror = (event) => ifErrorMessage(event.target.errorCode);
}

//открытие БД
connectDB('TrafficStarsDB', 1);

//добавление всех записей из файла в БД
const addDataStats = (db, data) => {
    let tx = db.transaction(['stats'], 'readwrite');
    let store = tx.objectStore('stats');

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
const getStatsForTable = (db, key = null, order = 'prev', allShown = false, dateFrom = null, dateTo = null) => {
	let tx = db.transaction(['stats'], 'readonly');
	let store = tx.objectStore('stats');
	
	if (key) {
		//отображение записей в таблице с сортировкой по индексу
		let keyRange = null;
		let allNotes = [];
		let index = store.index(key);

		if (dateFrom > dateTo) {
			alert('Неверно выбран диапазон дат.\nРезультат будет показан за весь период');
			document.getElementById('monthFrom').selectedIndex = 0;
			document.getElementById('monthTo').selectedIndex = document.getElementById('monthTo').options.length-1;
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
				displayNotesTable(allNotes, key, order, true);
				ifSuccessMessages('display');
			}
		}

		req.onerror = (event) => ifErrorMessage(event.target.errorCode);

	} else {
		//отображение записей в таблице без указания индекса
		allN = store.getAll(null, (allShown) ? null : 8);
		allN.onsuccess = (event) => {
			displayNotesTable(event.target.result, null, order, allShown);
		}
	}
}

//получение данных из БД для графика
const getStatsForGraph = (db, key = 'impressions', dateFrom = null, dateTo = null) => {
    let tx = db.transaction(['stats'], 'readonly');
	let store = tx.objectStore('stats');
	let keyForGraph = key;

	let keyRange = null;
	let allNotes = [];
	let index = store.index(keyForGraph);
	
	if (dateFrom && dateTo && (dateFrom < dateTo)) {
		//добавление выбранного диапазона дат
		index = store.index('day');
		keyRange = IDBKeyRange.bound(dateFrom, dateTo);
	}

	let req = index.openCursor(keyRange, 'next');

	req.onsuccess = (event) => {
		let cursor = event.target.result;
		if (cursor) {
			allNotes.push(cursor.value);
			cursor.continue();
		} else {
			displayNotesGraph(allNotes, keyForGraph);
			ifSuccessMessages('display');
		}
	}

	req.onerror = (event) => ifErrorMessage(event.target.errorCode);
}

// views
// Отображение данных в виде таблицы
const displayNotesTable = (notes, activeKey = null, order = 'next', allShown = false) => {
    let activeTD = null;
    let listHTML = '<table class="table table-striped table-bordered table-hover table-sm">';

    //добавить проверку на наличие записей

    //создание head таблицы
    let notesHead = notes.shift();
    let noteKeys = Object.keys(notesHead);
    let noteOrder = (order === 'next') ? 'prev' : 'next';
    let listHTMLHead = '<thead class="thead-light"><tr>';
    for (let val in noteKeys) {
        if (activeKey && activeKey === noteKeys[val]) {
			//выделяем столбец, если есть сортировка
            activeTD = val;
            listHTMLHead += `<th scope="col" onclick="flipStatsOrder('${noteKeys[val]}')" id="${noteKeys[val]}" data-order="${noteOrder}"><span class="th-order-${order}">${firstUppercaseLetter(noteKeys[val])}</span></th>`;
        } else {
            listHTMLHead += `<th scope="col" onclick="flipStatsOrder('${noteKeys[val]}')" id="${noteKeys[val]}" data-order="${noteOrder}">${firstUppercaseLetter(noteKeys[val])}</th>`;
        }
    }
    listHTMLHead += '</tr></thead><tbody>';
    listHTML += listHTMLHead;
    //head

    //создание записей (строк) в таблице
    for (let i = 0; i < notes.length; i++) {
        let note = notes[i];
        let noteValues = Object.values(note);
        listHTML += '<tr>';
        for (let tdValue in noteValues) {
            if (activeTD && activeTD === tdValue) {
				//выделяем столбец, если есть сортировка
                listHTML += `<td class="table-primary">${noteValues[tdValue]}</td>`;
            } else {
                listHTML += `<td>${noteValues[tdValue]}</td>`;
            }
        }
        listHTML += '</tr>';
    }
    listHTML += '</tbody></table>';
    //rows

	//при первой загрузке показываем только последние 7 записей,
	//поэтому добавляем кнопку для отображение всех
    if (!allShown) {
        let buttonShowAll = '<button class="btn-border" onclick="allShown()">Show All</button>';
        listHTML += buttonShowAll;
    }

    document.getElementById('dataTable').innerHTML = listHTML;
}

// Отображение данных на графике по индексу
const displayNotesGraph = (notes, key = 'impressions') => {
	
    //bottomChart
    let listBottom = '';
    let arrBottom = [];
    
    for (let i = 0; i < notes.length; i++) {
        let note = notes[i];
		let noteDay = getStringDate(new Date(note.day), 'MY');
        arrBottom.push({ date: noteDay, value: note[key]});
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

	//выводим месяцы внизу графика (доступные из данных) (по оси x)
    let liWidth = parseInt( 100 / Object.keys(arrBottomSum).length );
    for (let key in arrBottomSum) {
        listBottom += `<li style="width:${liWidth}%;">${key}</li>`;
    }
    document.getElementById('bottomChart').innerHTML = listBottom;
    //bottomChart

    //добавляем график
	let listMain = '';
	let maxValue = Math.max.apply(Math, Object.values(arrBottomSum).map((value, index) => value)); //узнаем максимальное значение по месяцам
	if (maxValue < 10) {
		maxValue = 10;
	}
	let onePercent = maxValue / 100;
	for (let key in arrBottomSum) {
		let valueInPercent = Math.floor(arrBottomSum[key] / onePercent); //переводим значения в проценты
		listMain += `<dd style="width:${liWidth}%;" class="p${valueInPercent}"><span><b>${parseFloat(arrBottomSum[key].toFixed(4))}</b></span></dd>`;
	}
    document.getElementById('csschart').innerHTML = listMain;
    //mainChart

    //выводим значения слева от графика (по оси y)
	let listLeft = '';
	for (let i = 100; i >= 0; i -= 10) {
		let liValue = parseInt(onePercent * i);
		listLeft += `<li>${liValue}</li>`;
	}
    document.getElementById('leftChart').innerHTML = listLeft;
    //leftChart
}

//добавление всех дат (месяц-год) в фильтр
const allMonth = (notes) => {

	let listSelectFrom = '';
	let listSelectTo = '';
    let arrDate = [];

    //добавить проверку на наличие записей

    for (let i = 0; i < notes.length; i++) {
        let note = notes[i];

		let noteDate = new Date(note.day);
		let valueDateTo = getStringDate(setDayOfTheMonth(noteDate, 'last'));
		let valueDateFrom = getStringDate(setDayOfTheMonth(noteDate, 'first'));
		let titleDate = getStringDate(noteDate, 'MY');
		let noteTimestamp = getStringDate(valueDateFrom, 'timestamp');
		
		arrDate[`${noteTimestamp}`] = {valueDateFrom, valueDateTo, titleDate, noteTimestamp};
      //arrDate.push({valueDate: `${noteDay}-${noteMonth}-${noteYear}` , titleDate: `${noteMonth}-${noteYear}`, timestamp: noteTimestamp });
	}
   //сортируем по убыванию
   // !!!доделать
   //let uniqueArrDate = arrDate.sort((a, b) => b.timestamp - a.timestamp); 
   //let uniqueArrDate = arrDate.filter((v, i, a) => a.indexOf(v.timestamp) === i.timestamp).sort((a, b) => b.timestamp - a.timestamp);

	for (let key in arrDate) {
		listSelectFrom += `<option value="${arrDate[key].valueDateFrom}">${arrDate[key].titleDate}</option>`;
		listSelectTo += `<option value="${arrDate[key].valueDateTo}">${arrDate[key].titleDate}</option>`;
	}

    document.getElementById('monthFrom').innerHTML = listSelectFrom;
    document.getElementById('monthTo').innerHTML = listSelectTo;
}

//добавление всех метрик в фильтр
const allMetric = (notes, excludeArr = []) => {
	let listSelect = '';
	let noteKeys = Object.keys(notes.shift()); //получаем ключи только первой записи
	let filteredNoteKeys = diffArray(noteKeys, excludeArr); //убираем ненужные ключи

    for (let val in filteredNoteKeys) {
		listSelect += `<option value="${filteredNoteKeys[val]}">${firstUppercaseLetter(filteredNoteKeys[val])}</option>`;
	}
	
    document.getElementById('metric').innerHTML = listSelect;
}