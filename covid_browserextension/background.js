console.log("covid background.js");

// let baseUrl = "http://localhost:5001/swiss-covid/us-central1/getData?date=";
let baseUrl =
  "https://us-central1-swiss-covid.cloudfunctions.net/getData?date=";

function init(){
  setIcon(false);
  chrome.runtime.onMessage.addListener(messageCallback);
  periodicallyCheckForNewData();
};

function periodicallyCheckForNewData(){
  checkAndUpdateData().then((data) => {
    let checkForNewDataInMin = getMinutesToNextCheck();
    console.log("periodicallyCheckForNewData: next check in "+checkForNewDataInMin+" minutes.");
    setTimeout(periodicallyCheckForNewData,checkForNewDataInMin * 60 * 1000);
    if(data.newDataLoaded){
      //notfiy popup
      chrome.runtime.sendMessage({ method: 'newDataLoadedInBackground', data: data.data },null);
    }
  });
}

function getMinutesToNextCheck(){
  //BAG data are release week-daily between 12.00 and 13.30 Uhr, during this period we check every 5 min.
  let afterTwelve = 12 * 60;
  let beforeOne = 13 * 60 + 30;
  let today = new Date();
  let currentDayTimeInMinutes = today.getHours()*60 + today.getMinutes();
  let isSaturdayOrSunday = today.getDay() == 6 || today.getDay() == 0; //käh luscht
  if(afterTwelve < currentDayTimeInMinutes && currentDayTimeInMinutes < beforeOne && !isSaturdayOrSunday){
    return 5;
  }else{
    return 60 * 4; //4 hours
  }
}

function messageCallback(obj, sender, sendResponse) {
  if (obj) {
      console.log("got "+obj.method+" from popup.js");
      if (obj.method == "refreshData") {
      checkAndUpdateData().then(function (data) {
        sendResponse(data.data);
      });
    }
    else if (obj.method == "popupOpened") {
      setIcon(false);
      sendResponse(null);
    }
  }
  return true;
}

function checkAndUpdateData() {
  return checkAndFetchData().then((fetchedData) => {
    console.log("background-js countryData:", fetchedData.data);
    if(fetchedData.newDataLoaded){
      chrome.storage.local.set({ countryData: fetchedData.data }, function () {
        console.log("chrome.storage.local countryData is set to " + fetchedData.data);
      });
    } 
    return fetchedData;
  });
}
function setIcon(newData){
  let suffix = newData ? "info" :"empty";
  chrome.browserAction.setIcon({
    path : {
      "19": "images/badge/icons19_"+suffix+".png",
      "38": "images/badge/icons38_"+suffix+".png",
    }
  });
}

async function checkAndFetchData() {
  return new Promise( (reslove, reject) => {
    chrome.storage.local.get(["countryData"],async function (localData) {
      if (!(localData.countryData && localData.countryData.date)) {
        reslove({newDataLoaded: true, data : await fetchLastData('')});
        return;
      }
      let today = new Date().toISOString().substring(0, 10);
      let lastDataDate = new Date(localData.countryData.date).toISOString().substring(0, 10);
      if (today === lastDataDate) {
        reslove({newDataLoaded: false, data :localData.countryData});
        return;
      }
      let newData = await fetchLastData(localData.countryData.date);
      if(newData == null){
        reslove({newDataLoaded: false ,data: localData.countryData});
      }else{
        let isNewData = newData.date != localData.countryData.date;
        reslove({newDataLoaded: isNewData,data: newData});
      }
    });
  });
}

async function fetchLastData(lastFetchDate) {
  for (let i = 0; i < 10; i++) {
    let date = new Date();
    date.setDate(date.getDate() - i);
    let data = await fetchLastDate(date,lastFetchDate);
    if (data.date) {
      console.log("got new data for " + date.toUTCString(), data);
      data = resolveCsv(data);
      return data;
    }
  }
}

async function fetchLastDate(d,lastFetchDate) {
  let url = baseUrl + d.toISOString().substring(0, 10);
  url += "&lastFetchDate="+lastFetchDate;
  return await fetch(url, {}).then((response) => {
    if(response.status == 304) // not modified
    {
      console.log("the server returned 304 not modified");
      return null;
    }
    return response.json();
  });
}

function resolveCsv(json) {
  json.country = resolveItem(json.country);
  for (var i = 0; i < json.cantons.length; i++) {
    json.cantons[i] = resolveItem(json.cantons[i]);
  }
  return json;
}

function resolveItem(item) {
  let csvArray = item.split(",");
  let json = {
    name: csvArray[0],
    cases: +csvArray[1],
    casesDiff: +csvArray[2],
    casesTwoWeeks: +csvArray[3],
    casesTwoWeeksDiff: +csvArray[4],
    incidence: +csvArray[5],
    incidenceDiff: +csvArray[6],
    incidenceTwoWeeks: +csvArray[7],
    incidenceTwoWeeksDiff: +csvArray[8],
  };
  return json;
}
init();