let indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB,
    IDBTransaction  = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction,
    IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

let db;

let excludeMetric = ['day']; //массив исключений для фильтра metric

const firstUppercaseLetter = (word) => word.charAt(0).toUpperCase() + word.slice(1);
const transformMonthDate = (month) => ('0'+(month+1)).slice(-2);
const diffArray = (a, b) => a.filter((i) => b.indexOf(i) < 0);

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
	//newDateFilter(elementsValue.monthFrom, elementsValue.monthTo);
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

      let stats;
      if (!db.objectStoreNames.contains('stats')) {
         stats = db.createObjectStore('stats', {autoIncrement: true});
      } else {
         stats = dbReq.transaction.objectStore('stats');
      }

      //создание индексов из первой записи в файле
      let dataIndexNames = allData.shift(); // allData - получать из файла!!!!
      for (let val in dataIndexNames) {
         if (!stats.indexNames.contains(val)) {
               stats.createIndex(val, val);
         }
      }
      let transaction = event.target.transaction;// the important part
      transaction.oncomplete = (event) => {
         //добавление данных в БД
         addDataStats(db, allData); // allData - получать из файла!!!!
      }
      ifSuccessMessages('dbUpgrade');
   }

   dbReq.onsuccess = (event) => {
      db = event.target.result;

      getStatsForTable(db); //при загрузке показать таблицу с данными
      getStatsForGraph(db); //при загрузке показать график с данными
      getValuesForFiltres(db); //добавлние дат и метрик в фильтры

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

		if (dateFrom || dateTo) {
			//добавление выбранного диапазона дат,
			//и сортирка по дате
			let df = new Date(dateFrom);
			let preDateFrom = `${df.getFullYear()}-${transformMonthDate(df.getMonth())}-01`;
			keyRange = IDBKeyRange.bound(preDateFrom, dateTo);
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
const getStatsForGraph = (db, key = 'impressions', dateFrom = null, dateTo = '2020-03-01') => {
    let tx = db.transaction(['stats'], 'readonly');
    let store = tx.objectStore('stats');
	
	//отображение записей в таблице с сортировкой по индексу
	let keyRange = null;
	let allNotes = [];
	let index = store.index(key);
	
	if (dateFrom) {
		//добавление выбранного диапазона дат,
		//и сортирка по дате
		let df = new Date(dateFrom);
		let preDateFrom = `${df.getFullYear()}-${transformMonthDate(df.getMonth())}-01`;
		keyRange = IDBKeyRange.bound(preDateFrom, dateTo);
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

        let noteDay = new Date(note.day);
        let noteYear = noteDay.getFullYear();
        let noteMonth = transformMonthDate(noteDay.getMonth());
        
        arrBottom.push({ date: `${noteMonth}-${noteYear}`, value: note[key]});
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

    let listSelect = '';
    let arrDate = [];

    //добавить проверку на наличие записей

    for (let i = 0; i < notes.length; i++) {
        let note = notes[i];

		let noteDate = new Date(note.day);
		noteDate.setDate(1);

		let noteTimestamp = noteDate.getTime();
		let noteDay = noteDate.getDate();
		let noteMonth = transformMonthDate(noteDate.getMonth());
		let noteYear = noteDate.getFullYear();
		
      arrDate[`${noteTimestamp}`] = {valueDate: `${noteDay}-${noteMonth}-${noteYear}` , titleDate: `${noteMonth}-${noteYear}`, timestamp: noteTimestamp };
      //arrDate.push({valueDate: `${noteDay}-${noteMonth}-${noteYear}` , titleDate: `${noteMonth}-${noteYear}`, timestamp: noteTimestamp });
	}
   //сортируем по убыванию
   // !!!доделать
   //let uniqueArrDate = arrDate.sort((a, b) => b.timestamp - a.timestamp); 
   //let uniqueArrDate = arrDate.filter((v, i, a) => a.indexOf(v.timestamp) === i.timestamp).sort((a, b) => b.timestamp - a.timestamp);

	for (let key in arrDate) {
		listSelect += `<option value="${arrDate[key].valueDate}">${arrDate[key].titleDate}</option>`;
	}

    document.getElementById('monthFrom').innerHTML = listSelect;
    document.getElementById('monthTo').innerHTML = listSelect;
}

//добавление всех метрик в фильтр
const allMetric = (notes, excludeArr = []) => {
	let listSelect = '';
	let noteKeys = Object.keys(notes.shift()); //получаем ключи только первой записи
	let filteredNoteKeys = diffArray(noteKeys, excludeArr); //убираем не нужные ключи

    for (let val in filteredNoteKeys) {
		listSelect += `<option value="${filteredNoteKeys[val]}">${firstUppercaseLetter(filteredNoteKeys[val])}</option>`;
	}
	
    document.getElementById('metric').innerHTML = listSelect;
}

//данные для БД
const allData = [
    {
       "impressions":16500140,
       "clicks":17732,
       "amount":16.50014,
       "leads":6,
       "lead_price":3.655,
       "revenue":13.5709,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.107,
       "ecpm":0.001,
       "ecpa":2.75,
       "day":"2019-10-01"
    },
    {
       "impressions":19021111,
       "clicks":19860,
       "amount":19.021111,
       "leads":7,
       "lead_price":49.232,
       "revenue":15.624841,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.104,
       "ecpm":0.001,
       "ecpa":2.717,
       "day":"2019-10-02"
    },
    {
       "impressions":18053285,
       "clicks":20112,
       "amount":18.053285,
       "leads":12,
       "lead_price":10.897,
       "revenue":14.880962,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.111,
       "ecpm":0.001,
       "ecpa":1.504,
       "day":"2019-10-03"
    },
    {
       "impressions":16945146,
       "clicks":18850,
       "amount":16.945146,
       "leads":4,
       "lead_price":3.0685,
       "revenue":13.973869,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.111,
       "ecpm":0.001,
       "ecpa":4.236,
       "day":"2019-10-04"
    },
    {
       "impressions":12191411,
       "clicks":14974,
       "amount":12.191411,
       "leads":9,
       "lead_price":8.43,
       "revenue":10.064984,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.122,
       "ecpm":0.001,
       "ecpa":1.354,
       "day":"2019-10-05"
    },
    {
       "impressions":15181846,
       "clicks":17578,
       "amount":15.181846,
       "leads":7,
       "lead_price":6.936,
       "revenue":12.489066,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.115,
       "ecpm":0.001,
       "ecpa":2.168,
       "day":"2019-10-06"
    },
    {
       "impressions":14691348,
       "clicks":16793,
       "amount":14.691348,
       "leads":6,
       "lead_price":1.989,
       "revenue":12.10381,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.114,
       "ecpm":0.001,
       "ecpa":2.448,
       "day":"2019-10-07"
    },
    {
       "impressions":16409165,
       "clicks":19174,
       "amount":16.409165,
       "leads":7,
       "lead_price":20.502,
       "revenue":13.511667,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.116,
       "ecpm":0.001,
       "ecpa":2.344,
       "day":"2019-10-08"
    },
    {
       "impressions":18271608,
       "clicks":21781,
       "amount":18.271608,
       "leads":11,
       "lead_price":11.2239,
       "revenue":15.077033,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.119,
       "ecpm":0.001,
       "ecpa":1.661,
       "day":"2019-10-09"
    },
    {
       "impressions":15856767,
       "clicks":19390,
       "amount":15.856767,
       "leads":5,
       "lead_price":0.3995,
       "revenue":13.100115,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.122,
       "ecpm":0.001,
       "ecpa":3.171,
       "day":"2019-10-10"
    },
    {
       "impressions":15405933,
       "clicks":18713,
       "amount":15.405933,
       "leads":7,
       "lead_price":5.304,
       "revenue":12.742449,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.121,
       "ecpm":0.001,
       "ecpa":2.2,
       "day":"2019-10-11"
    },
    {
       "impressions":16681407,
       "clicks":20056,
       "amount":16.681407,
       "leads":8,
       "lead_price":3.213,
       "revenue":13.821398,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.12,
       "ecpm":0.001,
       "ecpa":2.085,
       "day":"2019-10-12"
    },
    {
       "impressions":15742806,
       "clicks":18262,
       "amount":15.742806,
       "leads":7,
       "lead_price":6.5527,
       "revenue":13.032339,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.116,
       "ecpm":0.001,
       "ecpa":2.248,
       "day":"2019-10-13"
    },
    {
       "impressions":16619698,
       "clicks":18253,
       "amount":16.619698,
       "leads":10,
       "lead_price":4.301,
       "revenue":13.748339,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.109,
       "ecpm":0.001,
       "ecpa":1.661,
       "day":"2019-10-14"
    },
    {
       "impressions":16673793,
       "clicks":18141,
       "amount":16.673793,
       "leads":5,
       "lead_price":1.088,
       "revenue":13.75285,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.108,
       "ecpm":0.001,
       "ecpa":3.334,
       "day":"2019-10-15"
    },
    {
       "impressions":18894693,
       "clicks":19930,
       "amount":18.894693,
       "leads":10,
       "lead_price":5.7238,
       "revenue":15.462683,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.105,
       "ecpm":0.001,
       "ecpa":1.889,
       "day":"2019-10-16"
    },
    {
       "impressions":18489528,
       "clicks":19675,
       "amount":18.489528,
       "leads":30,
       "lead_price":5.0768,
       "revenue":15.14706,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.106,
       "ecpm":0.001,
       "ecpa":0.616,
       "day":"2019-10-17"
    },
    {
       "impressions":19244651,
       "clicks":19627,
       "amount":19.244651,
       "leads":40,
       "lead_price":5.2422,
       "revenue":15.707811,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.101,
       "ecpm":0.001,
       "ecpa":0.481,
       "day":"2019-10-18"
    },
    {
       "impressions":20132115,
       "clicks":21489,
       "amount":20.132115,
       "leads":22,
       "lead_price":2.941,
       "revenue":16.468855,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.106,
       "ecpm":0.001,
       "ecpa":0.915,
       "day":"2019-10-19"
    },
    {
       "impressions":20206614,
       "clicks":21241,
       "amount":20.206614,
       "leads":37,
       "lead_price":11.8685,
       "revenue":16.507343,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.105,
       "ecpm":0.001,
       "ecpa":0.546,
       "day":"2019-10-20"
    },
    {
       "impressions":17144916,
       "clicks":19624,
       "amount":17.144916,
       "leads":32,
       "lead_price":18.0734,
       "revenue":14.076242,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.114,
       "ecpm":0.001,
       "ecpa":0.535,
       "day":"2019-10-21"
    },
    {
       "impressions":15346412,
       "clicks":19547,
       "amount":15.346412,
       "leads":44,
       "lead_price":50.1458,
       "revenue":12.639472,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.127,
       "ecpm":0.001,
       "ecpa":0.348,
       "day":"2019-10-22"
    },
    {
       "impressions":15056995,
       "clicks":19041,
       "amount":15.056995,
       "leads":42,
       "lead_price":10.4002,
       "revenue":12.390005,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.126,
       "ecpm":0.001,
       "ecpa":0.358,
       "day":"2019-10-23"
    },
    {
       "impressions":14812070,
       "clicks":19563,
       "amount":14.81207,
       "leads":39,
       "lead_price":4.7913,
       "revenue":12.228285,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.132,
       "ecpm":0.001,
       "ecpa":0.379,
       "day":"2019-10-24"
    },
    {
       "impressions":15185530,
       "clicks":20926,
       "amount":15.18553,
       "leads":63,
       "lead_price":6.7935,
       "revenue":12.554109,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.137,
       "ecpm":0.001,
       "ecpa":0.241,
       "day":"2019-10-25"
    },
    {
       "impressions":18677063,
       "clicks":25517,
       "amount":18.677063,
       "leads":56,
       "lead_price":12.2132,
       "revenue":15.372624,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.136,
       "ecpm":0.001,
       "ecpa":0.333,
       "day":"2019-10-26"
    },
    {
       "impressions":17554304,
       "clicks":24223,
       "amount":17.554304,
       "leads":50,
       "lead_price":6.8514,
       "revenue":14.410242,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.137,
       "ecpm":0.001,
       "ecpa":0.351,
       "day":"2019-10-27"
    },
    {
       "impressions":20149946,
       "clicks":25221,
       "amount":20.149946,
       "leads":53,
       "lead_price":19.2422,
       "revenue":16.538882,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.125,
       "ecpm":0.001,
       "ecpa":0.38,
       "day":"2019-10-28"
    },
    {
       "impressions":23937820,
       "clicks":28581,
       "amount":23.93782,
       "leads":47,
       "lead_price":7.791,
       "revenue":19.492195,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.119,
       "ecpm":0.001,
       "ecpa":0.509,
       "day":"2019-10-29"
    },
    {
       "impressions":22472697,
       "clicks":27664,
       "amount":22.472697,
       "leads":68,
       "lead_price":6.5509,
       "revenue":18.32767,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.123,
       "ecpm":0.001,
       "ecpa":0.33,
       "day":"2019-10-30"
    },
    {
       "impressions":20222256,
       "clicks":25107,
       "amount":20.222256,
       "leads":46,
       "lead_price":11.862,
       "revenue":16.547267,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.124,
       "ecpm":0.001,
       "ecpa":0.439,
       "day":"2019-10-31"
    },
    {
       "impressions":19755208,
       "clicks":25622,
       "amount":19.755208,
       "leads":63,
       "lead_price":62.138,
       "revenue":16.150523,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.129,
       "ecpm":0.001,
       "ecpa":0.313,
       "day":"2019-11-01"
    },
    {
       "impressions":17553621,
       "clicks":23570,
       "amount":17.553621,
       "leads":74,
       "lead_price":58.1562,
       "revenue":14.316981,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.134,
       "ecpm":0.001,
       "ecpa":0.237,
       "day":"2019-11-02"
    },
    {
       "impressions":19406690,
       "clicks":23138,
       "amount":19.40669,
       "leads":53,
       "lead_price":4.449,
       "revenue":15.706446,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.119,
       "ecpm":0.001,
       "ecpa":0.366,
       "day":"2019-11-03"
    },
    {
       "impressions":16738006,
       "clicks":21051,
       "amount":16.738006,
       "leads":62,
       "lead_price":12.1932,
       "revenue":13.654923,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.125,
       "ecpm":0.001,
       "ecpa":0.269,
       "day":"2019-11-04"
    },
    {
       "impressions":9784918,
       "clicks":11835,
       "amount":9.784918,
       "leads":34,
       "lead_price":3.5126,
       "revenue":8.008656,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.12,
       "ecpm":0.001,
       "ecpa":0.287,
       "day":"2019-11-05"
    },
    {
       "impressions":5050567,
       "clicks":6635,
       "amount":5.050567,
       "leads":10,
       "lead_price":3.1191,
       "revenue":4.173662,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.131,
       "ecpm":0.001,
       "ecpa":0.505,
       "day":"2019-11-06"
    },
    {
       "impressions":7293284,
       "clicks":10267,
       "amount":7.293284,
       "leads":16,
       "lead_price":0.803,
       "revenue":6.016754,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.14,
       "ecpm":0.001,
       "ecpa":0.455,
       "day":"2019-11-07"
    },
    {
       "impressions":12510576,
       "clicks":15787,
       "amount":12.510576,
       "leads":18,
       "lead_price":5.7623,
       "revenue":10.241335,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.126,
       "ecpm":0.001,
       "ecpa":0.695,
       "day":"2019-11-08"
    },
    {
       "impressions":21936223,
       "clicks":27438,
       "amount":21.936223,
       "leads":64,
       "lead_price":10.9042,
       "revenue":17.879949,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.125,
       "ecpm":0.001,
       "ecpa":0.342,
       "day":"2019-11-09"
    },
    {
       "impressions":21932771,
       "clicks":25413,
       "amount":21.932771,
       "leads":48,
       "lead_price":10.6476,
       "revenue":17.815652,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.115,
       "ecpm":0.001,
       "ecpa":0.456,
       "day":"2019-11-10"
    },
    {
       "impressions":23898305,
       "clicks":28271,
       "amount":23.898305,
       "leads":57,
       "lead_price":13.8039,
       "revenue":19.402087,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.118,
       "ecpm":0.001,
       "ecpa":0.419,
       "day":"2019-11-11"
    },
    {
       "impressions":23838027,
       "clicks":32603,
       "amount":23.838027,
       "leads":74,
       "lead_price":4.3817,
       "revenue":19.452164,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.136,
       "ecpm":0.001,
       "ecpa":0.322,
       "day":"2019-11-12"
    },
    {
       "impressions":22797150,
       "clicks":30684,
       "amount":22.79715,
       "leads":72,
       "lead_price":9.9112,
       "revenue":18.679122,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.134,
       "ecpm":0.001,
       "ecpa":0.316,
       "day":"2019-11-13"
    },
    {
       "impressions":24521918,
       "clicks":33438,
       "amount":24.521918,
       "leads":55,
       "lead_price":9.7996,
       "revenue":20.094759,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.136,
       "ecpm":0.001,
       "ecpa":0.445,
       "day":"2019-11-14"
    },
    {
       "impressions":25853833,
       "clicks":34957,
       "amount":25.853833,
       "leads":57,
       "lead_price":17.8733,
       "revenue":21.159263,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.135,
       "ecpm":0.001,
       "ecpa":0.453,
       "day":"2019-11-15"
    },
    {
       "impressions":28605837,
       "clicks":39243,
       "amount":28.605837,
       "leads":61,
       "lead_price":21.8034,
       "revenue":23.400356,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.137,
       "ecpm":0.001,
       "ecpa":0.468,
       "day":"2019-11-16"
    },
    {
       "impressions":28564474,
       "clicks":38430,
       "amount":28.564474,
       "leads":47,
       "lead_price":9.3833,
       "revenue":23.379739,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.134,
       "ecpm":0.001,
       "ecpa":0.607,
       "day":"2019-11-17"
    },
    {
       "impressions":27113110,
       "clicks":34710,
       "amount":27.11311,
       "leads":33,
       "lead_price":19.0347,
       "revenue":22.238115,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.128,
       "ecpm":0.001,
       "ecpa":0.821,
       "day":"2019-11-18"
    },
    {
       "impressions":26853994,
       "clicks":33394,
       "amount":26.853994,
       "leads":61,
       "lead_price":20.8733,
       "revenue":22.012524,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.124,
       "ecpm":0.001,
       "ecpa":0.44,
       "day":"2019-11-19"
    },
    {
       "impressions":25402051,
       "clicks":31773,
       "amount":25.402051,
       "leads":47,
       "lead_price":6.969,
       "revenue":20.841281,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.125,
       "ecpm":0.001,
       "ecpa":0.54,
       "day":"2019-11-20"
    },
    {
       "impressions":24962685,
       "clicks":33080,
       "amount":24.962685,
       "leads":56,
       "lead_price":17.4992,
       "revenue":20.520758,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.132,
       "ecpm":0.001,
       "ecpa":0.445,
       "day":"2019-11-21"
    },
    {
       "impressions":24320144,
       "clicks":35629,
       "amount":24.320144,
       "leads":55,
       "lead_price":15.5459,
       "revenue":20.080042,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.146,
       "ecpm":0.001,
       "ecpa":0.442,
       "day":"2019-11-22"
    },
    {
       "impressions":23332162,
       "clicks":33234,
       "amount":23.332162,
       "leads":67,
       "lead_price":25.2881,
       "revenue":19.224178,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.142,
       "ecpm":0.001,
       "ecpa":0.348,
       "day":"2019-11-23"
    },
    {
       "impressions":23428902,
       "clicks":33153,
       "amount":23.428902,
       "leads":47,
       "lead_price":6.5886,
       "revenue":19.278124,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.141,
       "ecpm":0.001,
       "ecpa":0.498,
       "day":"2019-11-24"
    },
    {
       "impressions":23223239,
       "clicks":32815,
       "amount":23.223239,
       "leads":47,
       "lead_price":3.6512,
       "revenue":19.126003,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.141,
       "ecpm":0.001,
       "ecpa":0.494,
       "day":"2019-11-25"
    },
    {
       "impressions":22698161,
       "clicks":30115,
       "amount":22.698161,
       "leads":56,
       "lead_price":19.7537,
       "revenue":18.701599,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.132,
       "ecpm":0.001,
       "ecpa":0.405,
       "day":"2019-11-26"
    },
    {
       "impressions":23184502,
       "clicks":30063,
       "amount":23.184502,
       "leads":44,
       "lead_price":7.8693,
       "revenue":19.115136,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.129,
       "ecpm":0.001,
       "ecpa":0.526,
       "day":"2019-11-27"
    },
    {
       "impressions":22544555,
       "clicks":30648,
       "amount":22.544555,
       "leads":55,
       "lead_price":4.4397,
       "revenue":18.596169,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.135,
       "ecpm":0.001,
       "ecpa":0.409,
       "day":"2019-11-28"
    },
    {
       "impressions":23103558,
       "clicks":30424,
       "amount":23.103558,
       "leads":47,
       "lead_price":13.9786,
       "revenue":19.011051,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.131,
       "ecpm":0.001,
       "ecpa":0.491,
       "day":"2019-11-29"
    },
    {
       "impressions":24220201,
       "clicks":31921,
       "amount":24.220201,
       "leads":49,
       "lead_price":53.7071,
       "revenue":19.938178,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.131,
       "ecpm":0.001,
       "ecpa":0.494,
       "day":"2019-11-30"
    },
    {
       "impressions":24172773,
       "clicks":32451,
       "amount":24.172773,
       "leads":77,
       "lead_price":12.7003,
       "revenue":19.902329,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.134,
       "ecpm":0.001,
       "ecpa":0.313,
       "day":"2019-12-01"
    },
    {
       "impressions":22904230,
       "clicks":30266,
       "amount":22.90423,
       "leads":61,
       "lead_price":9.0849,
       "revenue":18.877506,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.132,
       "ecpm":0.001,
       "ecpa":0.375,
       "day":"2019-12-02"
    },
    {
       "impressions":22948762,
       "clicks":31252,
       "amount":22.948762,
       "leads":51,
       "lead_price":7.2691,
       "revenue":18.97076,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.136,
       "ecpm":0.001,
       "ecpa":0.449,
       "day":"2019-12-03"
    },
    {
       "impressions":24333420,
       "clicks":31271,
       "amount":24.33342,
       "leads":47,
       "lead_price":3.7423,
       "revenue":20.111099,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.128,
       "ecpm":0.001,
       "ecpa":0.517,
       "day":"2019-12-04"
    },
    {
       "impressions":23866854,
       "clicks":30920,
       "amount":23.866854,
       "leads":57,
       "lead_price":39.0979,
       "revenue":19.74485,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.129,
       "ecpm":0.001,
       "ecpa":0.418,
       "day":"2019-12-05"
    },
    {
       "impressions":24290629,
       "clicks":29665,
       "amount":24.290629,
       "leads":52,
       "lead_price":21.5445,
       "revenue":20.035582,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.122,
       "ecpm":0.001,
       "ecpa":0.467,
       "day":"2019-12-06"
    },
    {
       "impressions":25691627,
       "clicks":31415,
       "amount":25.691627,
       "leads":45,
       "lead_price":7.4951,
       "revenue":21.187982,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.122,
       "ecpm":0.001,
       "ecpa":0.57,
       "day":"2019-12-07"
    },
    {
       "impressions":26527962,
       "clicks":32075,
       "amount":26.527962,
       "leads":43,
       "lead_price":27.824,
       "revenue":21.874259,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.12,
       "ecpm":0.001,
       "ecpa":0.616,
       "day":"2019-12-08"
    },
    {
       "impressions":25016869,
       "clicks":39050,
       "amount":25.016869,
       "leads":37,
       "lead_price":5.0149,
       "revenue":20.649423,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.156,
       "ecpm":0.001,
       "ecpa":0.676,
       "day":"2019-12-09"
    },
    {
       "impressions":25247459,
       "clicks":35268,
       "amount":25.247459,
       "leads":39,
       "lead_price":3.5371,
       "revenue":20.780373,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.139,
       "ecpm":0.001,
       "ecpa":0.647,
       "day":"2019-12-10"
    },
    {
       "impressions":26269773,
       "clicks":28139,
       "amount":26.269773,
       "leads":48,
       "lead_price":19.7666,
       "revenue":21.593972,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.107,
       "ecpm":0.001,
       "ecpa":0.547,
       "day":"2019-12-11"
    },
    {
       "impressions":24230364,
       "clicks":29708,
       "amount":24.230364,
       "leads":62,
       "lead_price":18.1208,
       "revenue":20.022264,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.122,
       "ecpm":0.001,
       "ecpa":0.39,
       "day":"2019-12-12"
    },
    {
       "impressions":23801618,
       "clicks":28575,
       "amount":23.801618,
       "leads":42,
       "lead_price":5.277,
       "revenue":19.649584,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.12,
       "ecpm":0.001,
       "ecpa":0.566,
       "day":"2019-12-13"
    },
    {
       "impressions":22598641,
       "clicks":27667,
       "amount":22.598641,
       "leads":60,
       "lead_price":17.9388,
       "revenue":18.659955,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.122,
       "ecpm":0.001,
       "ecpa":0.376,
       "day":"2019-12-14"
    },
    {
       "impressions":22673400,
       "clicks":28001,
       "amount":22.6734,
       "leads":46,
       "lead_price":15.235,
       "revenue":18.637966,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.123,
       "ecpm":0.001,
       "ecpa":0.492,
       "day":"2019-12-15"
    },
    {
       "impressions":22325728,
       "clicks":27434,
       "amount":22.325728,
       "leads":48,
       "lead_price":13.9405,
       "revenue":18.351136,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.122,
       "ecpm":0.001,
       "ecpa":0.465,
       "day":"2019-12-16"
    },
    {
       "impressions":22454522,
       "clicks":27203,
       "amount":22.454522,
       "leads":42,
       "lead_price":16.5357,
       "revenue":18.406008,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.121,
       "ecpm":0.001,
       "ecpa":0.534,
       "day":"2019-12-17"
    },
    {
       "impressions":21351513,
       "clicks":27213,
       "amount":21.351513,
       "leads":53,
       "lead_price":17.882,
       "revenue":17.594356,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.127,
       "ecpm":0.001,
       "ecpa":0.402,
       "day":"2019-12-18"
    },
    {
       "impressions":19696723,
       "clicks":26008,
       "amount":19.696723,
       "leads":63,
       "lead_price":17.2352,
       "revenue":16.279759,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.132,
       "ecpm":0.001,
       "ecpa":0.312,
       "day":"2019-12-19"
    },
    {
       "impressions":19811865,
       "clicks":26464,
       "amount":19.811865,
       "leads":56,
       "lead_price":11.2356,
       "revenue":16.371716,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.133,
       "ecpm":0.001,
       "ecpa":0.353,
       "day":"2019-12-20"
    },
    {
       "impressions":17358495,
       "clicks":25261,
       "amount":17.358495,
       "leads":52,
       "lead_price":5.9011,
       "revenue":14.421514,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.145,
       "ecpm":0.001,
       "ecpa":0.333,
       "day":"2019-12-21"
    },
    {
       "impressions":17381034,
       "clicks":26022,
       "amount":17.381034,
       "leads":67,
       "lead_price":22.009,
       "revenue":14.414613,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.149,
       "ecpm":0.001,
       "ecpa":0.259,
       "day":"2019-12-22"
    },
    {
       "impressions":16906329,
       "clicks":25019,
       "amount":16.906329,
       "leads":48,
       "lead_price":36.9243,
       "revenue":14.02345,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.147,
       "ecpm":0.001,
       "ecpa":0.352,
       "day":"2019-12-23"
    },
    {
       "impressions":15865796,
       "clicks":25427,
       "amount":15.865796,
       "leads":45,
       "lead_price":16.439,
       "revenue":13.136595,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.16,
       "ecpm":0.001,
       "ecpa":0.352,
       "day":"2019-12-24"
    },
    {
       "impressions":15486465,
       "clicks":25549,
       "amount":15.486465,
       "leads":46,
       "lead_price":9.9327,
       "revenue":12.844132,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.164,
       "ecpm":0.001,
       "ecpa":0.336,
       "day":"2019-12-25"
    },
    {
       "impressions":17432820,
       "clicks":26957,
       "amount":17.43282,
       "leads":54,
       "lead_price":48.5549,
       "revenue":14.447579,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.154,
       "ecpm":0.001,
       "ecpa":0.322,
       "day":"2019-12-26"
    },
    {
       "impressions":19187814,
       "clicks":29119,
       "amount":19.187814,
       "leads":66,
       "lead_price":55.9842,
       "revenue":15.875683,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.151,
       "ecpm":0.001,
       "ecpa":0.29,
       "day":"2019-12-27"
    },
    {
       "impressions":17720367,
       "clicks":29296,
       "amount":17.720367,
       "leads":69,
       "lead_price":16.1564,
       "revenue":14.703031,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.165,
       "ecpm":0.001,
       "ecpa":0.256,
       "day":"2019-12-28"
    },
    {
       "impressions":17739925,
       "clicks":28263,
       "amount":17.739925,
       "leads":64,
       "lead_price":54.7989,
       "revenue":14.715937,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.159,
       "ecpm":0.001,
       "ecpa":0.277,
       "day":"2019-12-29"
    },
    {
       "impressions":17962951,
       "clicks":28427,
       "amount":17.962951,
       "leads":55,
       "lead_price":2.723,
       "revenue":14.912821,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.158,
       "ecpm":0.001,
       "ecpa":0.326,
       "day":"2019-12-30"
    },
    {
       "impressions":16477577,
       "clicks":27013,
       "amount":16.477577,
       "leads":57,
       "lead_price":18.8509,
       "revenue":13.652243,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.163,
       "ecpm":0.001,
       "ecpa":0.289,
       "day":"2019-12-31"
    },
    {
       "impressions":21587825,
       "clicks":28367,
       "amount":21.587825,
       "leads":64,
       "lead_price":67.1081,
       "revenue":17.8016,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.131,
       "ecpm":0.001,
       "ecpa":0.337,
       "day":"2020-01-01"
    },
    {
       "impressions":22848992,
       "clicks":31022,
       "amount":22.848992,
       "leads":59,
       "lead_price":11.2936,
       "revenue":18.875619,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.135,
       "ecpm":0.001,
       "ecpa":0.387,
       "day":"2020-01-02"
    },
    {
       "impressions":22780287,
       "clicks":30348,
       "amount":22.780287,
       "leads":65,
       "lead_price":12.6237,
       "revenue":18.814002,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.133,
       "ecpm":0.001,
       "ecpa":0.35,
       "day":"2020-01-03"
    },
    {
       "impressions":22505359,
       "clicks":27925,
       "amount":22.505359,
       "leads":73,
       "lead_price":20.1938,
       "revenue":18.606677,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.124,
       "ecpm":0.001,
       "ecpa":0.308,
       "day":"2020-01-04"
    },
    {
       "impressions":21587759,
       "clicks":27676,
       "amount":21.587759,
       "leads":72,
       "lead_price":45.1029,
       "revenue":17.863795,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.128,
       "ecpm":0.001,
       "ecpa":0.299,
       "day":"2020-01-05"
    },
    {
       "impressions":21292410,
       "clicks":27912,
       "amount":21.29241,
       "leads":78,
       "lead_price":19.0213,
       "revenue":17.63525,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.131,
       "ecpm":0.001,
       "ecpa":0.272,
       "day":"2020-01-06"
    },
    {
       "impressions":20965240,
       "clicks":31564,
       "amount":20.96524,
       "leads":85,
       "lead_price":21.2733,
       "revenue":17.359411,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.15,
       "ecpm":0.001,
       "ecpa":0.246,
       "day":"2020-01-07"
    },
    {
       "impressions":23076515,
       "clicks":37475,
       "amount":23.076515,
       "leads":114,
       "lead_price":23.32,
       "revenue":18.907351,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.162,
       "ecpm":0.001,
       "ecpa":0.202,
       "day":"2020-01-08"
    },
    {
       "impressions":23048381,
       "clicks":37714,
       "amount":23.048381,
       "leads":129,
       "lead_price":29.5001,
       "revenue":18.806988,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.163,
       "ecpm":0.001,
       "ecpa":0.178,
       "day":"2020-01-09"
    },
    {
       "impressions":20244940,
       "clicks":35332,
       "amount":20.24494,
       "leads":124,
       "lead_price":70.8987,
       "revenue":16.725144,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.174,
       "ecpm":0.001,
       "ecpa":0.163,
       "day":"2020-01-10"
    },
    {
       "impressions":20651736,
       "clicks":36703,
       "amount":20.651736,
       "leads":109,
       "lead_price":18.5984,
       "revenue":17.229039,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.177,
       "ecpm":0.001,
       "ecpa":0.189,
       "day":"2020-01-11"
    },
    {
       "impressions":21729753,
       "clicks":37385,
       "amount":21.729753,
       "leads":121,
       "lead_price":23.976,
       "revenue":18.152231,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.172,
       "ecpm":0.001,
       "ecpa":0.179,
       "day":"2020-01-12"
    },
    {
       "impressions":22022379,
       "clicks":37351,
       "amount":22.022379,
       "leads":183,
       "lead_price":29.98,
       "revenue":18.420955,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.169,
       "ecpm":0.001,
       "ecpa":0.12,
       "day":"2020-01-13"
    },
    {
       "impressions":21687162,
       "clicks":36313,
       "amount":21.687162,
       "leads":199,
       "lead_price":40.7927,
       "revenue":18.192833,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.167,
       "ecpm":0.001,
       "ecpa":0.108,
       "day":"2020-01-14"
    },
    {
       "impressions":20123597,
       "clicks":33540,
       "amount":20.123597,
       "leads":169,
       "lead_price":18.6617,
       "revenue":16.872095,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.166,
       "ecpm":0.001,
       "ecpa":0.119,
       "day":"2020-01-15"
    },
    {
       "impressions":16957343,
       "clicks":31705,
       "amount":16.957343,
       "leads":164,
       "lead_price":22.8302,
       "revenue":14.294019,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.186,
       "ecpm":0.001,
       "ecpa":0.103,
       "day":"2020-01-16"
    },
    {
       "impressions":17551565,
       "clicks":30581,
       "amount":17.551565,
       "leads":177,
       "lead_price":21.054,
       "revenue":14.811291,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.174,
       "ecpm":0.001,
       "ecpa":0.099,
       "day":"2020-01-17"
    },
    {
       "impressions":19311845,
       "clicks":33435,
       "amount":19.311845,
       "leads":143,
       "lead_price":31.7298,
       "revenue":16.309635,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.173,
       "ecpm":0.001,
       "ecpa":0.135,
       "day":"2020-01-18"
    },
    {
       "impressions":19401867,
       "clicks":32713,
       "amount":19.401867,
       "leads":140,
       "lead_price":25.5288,
       "revenue":16.375431,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.168,
       "ecpm":0.001,
       "ecpa":0.138,
       "day":"2020-01-19"
    },
    {
       "impressions":17458967,
       "clicks":30255,
       "amount":17.458967,
       "leads":163,
       "lead_price":13.0248,
       "revenue":14.690862,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.173,
       "ecpm":0.001,
       "ecpa":0.107,
       "day":"2020-01-20"
    },
    {
       "impressions":18927453,
       "clicks":31090,
       "amount":18.927453,
       "leads":173,
       "lead_price":25.2259,
       "revenue":15.839129,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.164,
       "ecpm":0.001,
       "ecpa":0.109,
       "day":"2020-01-21"
    },
    {
       "impressions":17588422,
       "clicks":30855,
       "amount":17.588422,
       "leads":177,
       "lead_price":26.4052,
       "revenue":14.716591,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.175,
       "ecpm":0.001,
       "ecpa":0.099,
       "day":"2020-01-22"
    },
    {
       "impressions":16347724,
       "clicks":34528,
       "amount":19.461095,
       "leads":148,
       "lead_price":18.4155,
       "revenue":16.308631,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.211,
       "ecpm":0.00119,
       "ecpa":0.131,
       "day":"2020-01-23"
    },
    {
       "impressions":15757716,
       "clicks":33326,
       "amount":21.21646,
       "leads":158,
       "lead_price":21.541,
       "revenue":17.810838,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.211,
       "ecpm":0.001346,
       "ecpa":0.134,
       "day":"2020-01-24"
    },
    {
       "impressions":18957578,
       "clicks":38674,
       "amount":24.907565,
       "leads":166,
       "lead_price":26.5677,
       "revenue":20.915309,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.204,
       "ecpm":0.001313,
       "ecpa":0.15,
       "day":"2020-01-25"
    },
    {
       "impressions":18807754,
       "clicks":37617,
       "amount":25.014502,
       "leads":182,
       "lead_price":40.0049,
       "revenue":21.007447,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.2,
       "ecpm":0.00133,
       "ecpa":0.137,
       "day":"2020-01-26"
    },
    {
       "impressions":20577251,
       "clicks":38398,
       "amount":26.572852,
       "leads":205,
       "lead_price":34.8204,
       "revenue":22.267656,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.186,
       "ecpm":0.001291,
       "ecpa":0.129,
       "day":"2020-01-27"
    },
    {
       "impressions":18823651,
       "clicks":36677,
       "amount":24.214832,
       "leads":193,
       "lead_price":27.8215,
       "revenue":20.329497,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.194,
       "ecpm":0.001286,
       "ecpa":0.125,
       "day":"2020-01-28"
    },
    {
       "impressions":10170553,
       "clicks":19340,
       "amount":12.960997,
       "leads":76,
       "lead_price":14.2681,
       "revenue":10.885049,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.19,
       "ecpm":0.001274,
       "ecpa":0.17,
       "day":"2020-01-29"
    },
    {
       "impressions":9687324,
       "clicks":19769,
       "amount":12.49499,
       "leads":60,
       "lead_price":13.5615,
       "revenue":10.484732,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.204,
       "ecpm":0.001289,
       "ecpa":0.208,
       "day":"2020-01-30"
    },
    {
       "impressions":8611633,
       "clicks":19340,
       "amount":11.59916,
       "leads":64,
       "lead_price":4.2495,
       "revenue":9.750829,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.224,
       "ecpm":0.001346,
       "ecpa":0.181,
       "day":"2020-01-31"
    },
    {
       "impressions":9136461,
       "clicks":20383,
       "amount":12.221052,
       "leads":57,
       "lead_price":10.9817,
       "revenue":10.268776,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.223,
       "ecpm":0.001337,
       "ecpa":0.214,
       "day":"2020-02-01"
    },
    {
       "impressions":13267396,
       "clicks":30042,
       "amount":18.329811,
       "leads":140,
       "lead_price":14.272,
       "revenue":15.393772,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.226,
       "ecpm":0.001381,
       "ecpa":0.13,
       "day":"2020-02-02"
    },
    {
       "impressions":13925493,
       "clicks":30691,
       "amount":19.171431,
       "leads":157,
       "lead_price":33.6975,
       "revenue":16.104993,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.22,
       "ecpm":0.001376,
       "ecpa":0.122,
       "day":"2020-02-03"
    },
    {
       "impressions":11040110,
       "clicks":22904,
       "amount":14.734005,
       "leads":83,
       "lead_price":18.9986,
       "revenue":12.408201,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.207,
       "ecpm":0.001334,
       "ecpa":0.177,
       "day":"2020-02-04"
    },
    {
       "impressions":7119348,
       "clicks":13196,
       "amount":8.990878,
       "leads":40,
       "lead_price":16.1933,
       "revenue":7.568085,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.185,
       "ecpm":0.001262,
       "ecpa":0.224,
       "day":"2020-02-05"
    },
    {
       "impressions":10169311,
       "clicks":20458,
       "amount":12.905631,
       "leads":92,
       "lead_price":10.9908,
       "revenue":10.85777,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.201,
       "ecpm":0.001269,
       "ecpa":0.14,
       "day":"2020-02-06"
    },
    {
       "impressions":13148927,
       "clicks":27838,
       "amount":17.021012,
       "leads":135,
       "lead_price":50.2082,
       "revenue":14.296481,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.211,
       "ecpm":0.001294,
       "ecpa":0.126,
       "day":"2020-02-07"
    },
    {
       "impressions":13344400,
       "clicks":29216,
       "amount":17.335246,
       "leads":153,
       "lead_price":27.7378,
       "revenue":14.572364,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.218,
       "ecpm":0.001299,
       "ecpa":0.113,
       "day":"2020-02-08"
    },
    {
       "impressions":14330174,
       "clicks":31588,
       "amount":18.645106,
       "leads":133,
       "lead_price":36.6237,
       "revenue":15.664382,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.22,
       "ecpm":0.001301,
       "ecpa":0.14,
       "day":"2020-02-09"
    },
    {
       "impressions":13432920,
       "clicks":28980,
       "amount":17.402813,
       "leads":135,
       "lead_price":21.5834,
       "revenue":14.606702,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.215,
       "ecpm":0.001295,
       "ecpa":0.128,
       "day":"2020-02-10"
    },
    {
       "impressions":12455473,
       "clicks":28279,
       "amount":16.203698,
       "leads":129,
       "lead_price":28.5439,
       "revenue":13.625974,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.227,
       "ecpm":0.0013,
       "ecpa":0.125,
       "day":"2020-02-11"
    },
    {
       "impressions":13542133,
       "clicks":29104,
       "amount":17.345379,
       "leads":163,
       "lead_price":24.7193,
       "revenue":14.610385,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.214,
       "ecpm":0.00128,
       "ecpa":0.106,
       "day":"2020-02-12"
    },
    {
       "impressions":14499360,
       "clicks":29655,
       "amount":18.260341,
       "leads":167,
       "lead_price":26.9961,
       "revenue":15.396319,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.204,
       "ecpm":0.001259,
       "ecpa":0.109,
       "day":"2020-02-13"
    },
    {
       "impressions":14296655,
       "clicks":29634,
       "amount":18.120071,
       "leads":176,
       "lead_price":42.5331,
       "revenue":15.276193,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.207,
       "ecpm":0.001267,
       "ecpa":0.102,
       "day":"2020-02-14"
    },
    {
       "impressions":14728778,
       "clicks":32253,
       "amount":18.834179,
       "leads":179,
       "lead_price":60.5927,
       "revenue":15.851898,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.218,
       "ecpm":0.001278,
       "ecpa":0.105,
       "day":"2020-02-15"
    },
    {
       "impressions":12648828,
       "clicks":28965,
       "amount":16.610304,
       "leads":132,
       "lead_price":26.0725,
       "revenue":13.99315,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.228,
       "ecpm":0.001313,
       "ecpa":0.125,
       "day":"2020-02-16"
    },
    {
       "impressions":13543626,
       "clicks":30937,
       "amount":17.67981,
       "leads":123,
       "lead_price":19.4404,
       "revenue":14.901345,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.228,
       "ecpm":0.001305,
       "ecpa":0.143,
       "day":"2020-02-17"
    },
    {
       "impressions":13286260,
       "clicks":30394,
       "amount":17.368576,
       "leads":120,
       "lead_price":35.2695,
       "revenue":14.644098,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.228,
       "ecpm":0.001307,
       "ecpa":0.144,
       "day":"2020-02-18"
    },
    {
       "impressions":12561532,
       "clicks":28710,
       "amount":16.552851,
       "leads":141,
       "lead_price":29.0552,
       "revenue":13.954432,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.228,
       "ecpm":0.001317,
       "ecpa":0.117,
       "day":"2020-02-19"
    },
    {
       "impressions":14398246,
       "clicks":32363,
       "amount":18.868088,
       "leads":168,
       "lead_price":24.5548,
       "revenue":15.926625,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.224,
       "ecpm":0.00131,
       "ecpa":0.112,
       "day":"2020-02-20"
    },
    {
       "impressions":13881254,
       "clicks":30438,
       "amount":18.373706,
       "leads":159,
       "lead_price":58.0052,
       "revenue":15.519026,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.219,
       "ecpm":0.001323,
       "ecpa":0.115,
       "day":"2020-02-21"
    },
    {
       "impressions":16096665,
       "clicks":32541,
       "amount":20.864413,
       "leads":172,
       "lead_price":33.1417,
       "revenue":17.625599,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.202,
       "ecpm":0.001296,
       "ecpa":0.121,
       "day":"2020-02-22"
    },
    {
       "impressions":16531021,
       "clicks":32600,
       "amount":21.37692,
       "leads":202,
       "lead_price":45.1434,
       "revenue":18.05714,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.197,
       "ecpm":0.001293,
       "ecpa":0.105,
       "day":"2020-02-23"
    },
    {
       "impressions":15479263,
       "clicks":31979,
       "amount":20.311515,
       "leads":160,
       "lead_price":38.9373,
       "revenue":17.130939,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.206,
       "ecpm":0.001312,
       "ecpa":0.126,
       "day":"2020-02-24"
    },
    {
       "impressions":13571972,
       "clicks":31952,
       "amount":18.275682,
       "leads":138,
       "lead_price":16.3324,
       "revenue":15.405278,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.235,
       "ecpm":0.001346,
       "ecpa":0.132,
       "day":"2020-02-25"
    },
    {
       "impressions":14583902,
       "clicks":36422,
       "amount":19.771449,
       "leads":161,
       "lead_price":22.0285,
       "revenue":16.643126,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.249,
       "ecpm":0.001355,
       "ecpa":0.122,
       "day":"2020-02-26"
    },
    {
       "impressions":16653098,
       "clicks":37292,
       "amount":22.077409,
       "leads":190,
       "lead_price":23.4485,
       "revenue":18.631528,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.223,
       "ecpm":0.001325,
       "ecpa":0.116,
       "day":"2020-02-27"
    },
    {
       "impressions":15852386,
       "clicks":35488,
       "amount":21.009528,
       "leads":183,
       "lead_price":30.0473,
       "revenue":17.734827,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.223,
       "ecpm":0.001325,
       "ecpa":0.114,
       "day":"2020-02-28"
    },
    {
       "impressions":17704286,
       "clicks":39385,
       "amount":23.438549,
       "leads":164,
       "lead_price":21.0731,
       "revenue":19.845595,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.222,
       "ecpm":0.001323,
       "ecpa":0.142,
       "day":"2020-02-29"
    },
    {
       "impressions":19062710,
       "clicks":39693,
       "amount":24.847017,
       "leads":186,
       "lead_price":35.3258,
       "revenue":21.06574,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.208,
       "ecpm":0.001303,
       "ecpa":0.133,
       "day":"2020-03-01"
    },
    {
       "impressions":17946634,
       "clicks":38429,
       "amount":23.320791,
       "leads":188,
       "lead_price":68.4462,
       "revenue":19.779478,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.214,
       "ecpm":0.001299,
       "ecpa":0.124,
       "day":"2020-03-02"
    },
    {
       "impressions":17707533,
       "clicks":37885,
       "amount":23.168063,
       "leads":155,
       "lead_price":37.1602,
       "revenue":19.664074,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.213,
       "ecpm":0.001308,
       "ecpa":0.149,
       "day":"2020-03-03"
    },
    {
       "impressions":15234072,
       "clicks":35270,
       "amount":20.668704,
       "leads":137,
       "lead_price":69.5052,
       "revenue":17.588272,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.231,
       "ecpm":0.001356,
       "ecpa":0.15,
       "day":"2020-03-04"
    },
    {
       "impressions":11648791,
       "clicks":28164,
       "amount":15.974183,
       "leads":94,
       "lead_price":17.7584,
       "revenue":13.524025,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.241,
       "ecpm":0.001371,
       "ecpa":0.169,
       "day":"2020-03-05"
    },
    {
       "impressions":16649519,
       "clicks":39331,
       "amount":22.061221,
       "leads":114,
       "lead_price":36.3219,
       "revenue":18.675602,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.236,
       "ecpm":0.001325,
       "ecpa":0.193,
       "day":"2020-03-06"
    },
    {
       "impressions":18710278,
       "clicks":42030,
       "amount":24.357398,
       "leads":139,
       "lead_price":19.5486,
       "revenue":20.659136,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.224,
       "ecpm":0.001301,
       "ecpa":0.175,
       "day":"2020-03-07"
    },
    {
       "impressions":18496996,
       "clicks":40303,
       "amount":23.939789,
       "leads":151,
       "lead_price":28.3065,
       "revenue":20.313998,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.217,
       "ecpm":0.001294,
       "ecpa":0.158,
       "day":"2020-03-08"
    },
    {
       "impressions":8346013,
       "clicks":17777,
       "amount":10.710289,
       "leads":46,
       "lead_price":11.9668,
       "revenue":9.091949,
       "net_revenue":0,
       "net_potential":0,
       "ctr":0.212,
       "ecpm":0.001283,
       "ecpa":0.232,
       "day":"2020-03-09"
    }
];