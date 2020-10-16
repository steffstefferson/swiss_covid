console.log("covid background.js");

// var baseUrl = "http://localhost:5001/swiss-covid/us-central1/getData?date=";
var baseUrl =
  "https://us-central1-swiss-covid.cloudfunctions.net/getData?date=";
var checkForNewDataInMin = 120;


function init(){
  setIcon(false);
  checkAndUpdateData();
  chrome.runtime.onMessage.addListener(messageCallback);
  setInterval(function(){
      console.log("setInterval: check for new data");
      checkAndUpdateData();
  },checkForNewDataInMin * 60 * 1000);
};

function messageCallback(obj, sender, sendResponse) {
  if (obj) {
      console.log("got "+obj.method+" from popup.js");
      if (obj.method == "refreshData") {
      checkAndUpdateData().then(function (data) {
        setIcon(false);
        sendResponse(data);
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
    var {newDataLoaded, data} = fetchedData;
    console.log("background-js countryData:", data);
  
    if(newDataLoaded){
      chrome.storage.local.set({ countryData: data }, function () {
        console.log("countryData is set to " + data);
      });
    
      setIcon(newDataLoaded);
    } 
    return data;
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
      var today = new Date();
      var lastDataDate = new Date(localData.countryData.date);
      const diffTime = Math.abs(today - lastDataDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        reslove({newDataLoaded: false, data :localData.countryData});
      }
      if (
        diffDays > 1 &&
        !(
          today.getDay() == 6 ||
          today.getDay() == 0 ||
          lastDataDate.getDay() == 5
        )
      ) {
        console.log(
          "skip fetching data since it is weekend",
          lastDataDate.toUTCString()
        );
        //no new data on weeked
        reslove({newDataLoaded: false, data :localData.countryData});
      } else {
        var newData = await fetchLastData(localData.countryData.date);
        if(newData == null){
          var isNewData = newData.date != localData.countryData.date;
          reslove({newDataLoaded: false ,data: newData});
        }else{
          var isNewData = newData.date != localData.countryData.date;
          reslove({newDataLoaded: isNewData,data: localData.countryData});
        }
      }
    });
  });
}

async function fetchLastData(lastFetchDate) {
  for (var i = 0; i < 10; i++) {
    var date = new Date();
    date.setDate(date.getDate() - i);
    var data = await fetchLastDate(date,lastFetchDate);
    if (data.date) {
      console.log("got new data for " + date.toUTCString(), data);
      data = resolveCsv(data);
      return data;
    }
  }
}

async function fetchLastDate(d,lastFetchDate) {
  var url = baseUrl + d.toISOString().substring(0, 10);
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
  var csvArray = item.split(",");
  var json = {
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