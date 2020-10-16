var loadedData = null;
var loadedFavoriteState = null;
var sortBy = "name";
var addFuerst = false;


function init(){
  document.getElementById("refreshData").addEventListener("click", hardRefresh);
  refresh();
  callEventPageMethod("popupOpened", null,() => {});
}



function hardRefresh() {
  chrome.storage.local.set({ countryData: null }, function () {
    console.log("countryData is reseted");
    getNewContentFromBackground();
  });
}

function getNewContentFromBackground() {
  data.innerHTML = "<h1>Loading....</h1>";
  callEventPageMethod("refreshData", null, function (response) {
    loadedData = response;
    refresh();
  });
}

function callEventPageMethod(method, data, callback) {
  chrome.runtime.sendMessage({ method: method, data: data }, function (
    response
  ) {
    if (typeof callback === "function") callback(response);
  });
}

function refresh() {
  data.innerHTML = "<h1>Loading....</h1>";
  chrome.storage.local.get({countryData : {},favoriteState : "",addFuerst: false}, function (data) {
    loadedFavoriteState = data?.favoriteState;
      loadedData = data?.countryData;
      addFuerst = data?.addFuerst;
      display(data.countryData, loadedFavoriteState,addFuerst);
  });
}

function display(covidData, favoriteState) {
  data.innerHTML = "";
  console.log("covidData Value currently is ", covidData);
  let states = covidData && covidData.cantons;
  if (states) {
    var headerDate = document.getElementById("date");
    headerDate.innerText = new Intl.DateTimeFormat("de-CH").format(
      new Date(covidData.date)
    );
    headerDate.title = "Generation date: " + covidData.generationDate;

    if (covidData.dayDiffrence > 1) {
      document.getElementById("dayDiffrence").style.visibility = 'block';
      document.getElementById("dayDiffrence").innerText =
        "Day diffrence since last report: " + covidData.dayDiffrence + ' days';
    }else{
      document.getElementById("dayDiffrence").style.visibility = 'hidden';
    }

var cases = covidData.country.casesDiff;
if(!addFuerst){
  cases -= states.filter(x => x.name == "FL")[0].casesDiff ?? 0
  document.getElementById('title').innerText = "Coronavirus in Switzerland"
}else{
  document.getElementById('title').innerText = "Coronavirus in Switzerland + FL"
}

    document.getElementById("totalNewCases").innerText =
      "+" + cases;

    data.appendChild(sortByElement());

    let ul = document.createElement("ul");

    var sortByExpression =
      sortBy == "name"
        ? (x, y) => x.name.localeCompare(y.name)
        : (x, y) => y.casesDiff - x.casesDiff;

    var sortedStates = states.sort(sortByExpression);

    for (let i = 0; i < sortedStates.length; i++) {
      if(sortedStates[i].name == "FL" && !addFuerst){
        continue;
      }
      var cssclass =
        sortedStates[i].name == favoriteState
          ? ["state", "favoriteState"]
          : ["state"];
      ul.appendChild(createListElement(cssclass, sortedStates[i]));
    }
    data.appendChild(ul);
  } else {
    let div = document.createElement("div");
    div.innerText = "no data found so far...";
    data.appendChild(div);
  }
}

function sortByElement() {
  let div = document.createElement("div");
  div.innerText = "sorted by: " + sortBy;
  div.classList.add("sortBy");
  div.addEventListener("click", changeSortBy);
  return div;
}

function changeSortBy() {
  sortBy = sortBy == "name" ? "cases" : "name";
  display(loadedData, loadedFavoriteState,addFuerst);
}

function createListElement(classNameArr, item) {
  let li = document.createElement("li");
  classNameArr.map((x) => li.classList.add(x));

  let divName = document.createElement("div");
  divName.innerText = item.name;
  li.appendChild(divName);

  let divLastDayDiff = document.createElement("div");
  divLastDayDiff.innerText = item.casesDiff > 0 ? `+${item.casesDiff}` : +"0";
  divLastDayDiff.title = `new cases since last report (total cases: ${item.total})`;
  li.appendChild(divLastDayDiff);

  return li;
}

init();
