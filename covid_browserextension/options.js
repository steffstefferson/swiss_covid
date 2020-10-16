console.log("swiss covid: popup.js");

document.getElementById("cantonSelect").addEventListener('change',saveData)
document.getElementById("addFuerst").addEventListener('change',saveData)

function saveData(e) {
  document.getElementById("saveOk").style.visibility = "visible";
  window.setTimeout(function () {
    document.getElementById("saveOk").style.visibility = "hidden";
  }, 3000);

  var favoriteState = document.getElementById("cantonSelect").value; addFuerst
  var addFuerst = document.getElementById("addFuerst").checked; 
  var settings = { favoriteState: favoriteState, addFuerst : addFuerst };
  chrome.storage.local.set(settings, function () {
    console.log("favoriteState is set to: ",settings);
  });
}

function loadData(){
  var defaultSettings = { favoriteState: "BE", addFuerst : false };
chrome.storage.local.get(defaultSettings, function (defaultSettings) {
  document.getElementById("addFuerst").checked = defaultSettings.addFuerst;
  document.getElementById("cantonSelect").value = defaultSettings.favoriteState;
  console.log("favoriteState is set to: ",defaultSettings);
});
}

loadData();