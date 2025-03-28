let extensionState;
let extensionSettings;
let extensionScannerState;
let interval;

let allowed = false;
let TAB_ID;

let snapshot;


const platform = "yandex"




//UTILITY
function getTimeFromTimeString(str, divider) {
  console.log(str, typeof str);
  if (str == undefined) { return undefined }
  let split = str.split(divider);
  if (split.length == 1) {
    return parseInt(str);
  } else if (split.length == 2) {
    return parseInt(split[0]) * 60 + parseInt(split[1]);
  } else if (split.length == 3) {
    return parseInt(split[0]) * 3600 + parseInt(split[1]) * 60 + parseInt(split[2]);
  }
}

function sendMessage(msg) {
  chrome.runtime.sendMessage(msg)
}

//GETS DATA FROM STORAGE
async function onLaunch() {
  extensionState = (await chrome.storage.local.get("extension-state"))["extension-state"];
  extensionSettings = (await chrome.storage.local.get("extension-settings"))["extension-settings"];

  //GET TAB
  let res = await chrome.runtime.sendMessage({ key: "listener-register", data: { platform: platform, title: document.title } });
  TAB_ID = res.tabId;
  if (extensionState.selectedScanner != TAB_ID || TAB_ID != undefined) {
    return;
  }
  allowed = true;
}

new MutationObserver(function (mutations) {
  //Tab title changed
  sendMessage({ key: "listener-update", data: { platform: platform, title: document.title } });
}).observe(document.querySelector("title"), { subtree: true, characterData: true, childList: true });

//UPDATE
let data = null;
function update(forceUpdate) {
  if (allowed != true) {
    return;
  }
  try {
    data = getData();
  } catch (e) {
    data = snapshot
    console.warn(`MOS - Failed to fetch data for current song!`)
    console.warn(e)
  }
  if (JSON.stringify(data) == JSON.stringify(snapshot) && forceUpdate != true) {
    return; // ALREADY UPDATED
  }

  chrome.storage.local.set({
    "extension-scanner-state": {
      paused: data.paused,
      title: data.title,
      subtitle: data.subtitle,
      currentTime: getTimeFromTimeString(data.progress, ":"),
      currentLength: getTimeFromTimeString(data.duration, ":"),
      url: data.url,
      cover: data.cover,
    },
  });
  if (!snapshot) {
    sendMessage({ key: "sync-server" });
  } else {
    if (JSON.stringify(snapshot) != JSON.stringify(data)) {
      sendMessage({ key: "sync-server" });
    }
  }
  snapshot = data;
}

function isPlayerPaused() {
    const playerButton = document.querySelector('.player-controls__btn.player-controls__btn_play');
    const isPaused = !playerButton.classList.contains('player-controls__btn_pause');
    return isPaused;
}

function getTrackName() {
    const trackElement = document.querySelector('.track__title');
    return trackElement ? trackElement.textContent.trim() : 'unknown';
}

function getArtistName() {
    const artistElement = document.querySelector('.d-artists__expanded .d-link');
    return artistElement ? artistElement.textContent.trim() : 'unknown';
}

function getTrackDuration() {
    const durationElement = document.querySelector('.progress__right');
    if (!durationElement) return '0:00';
    const durationText = durationElement.textContent.trim();
    return durationText;
}

function getCurrentTrackTime() {
    const currentTimeElement = document.querySelector('.progress__left');
    if (!currentTimeElement) return '0:00';
    const currentTimeText = currentTimeElement.textContent.trim();
    return currentTimeText;
}

function getTrackCoverUrl() {
    const playerControlsWrapper = document.querySelector('.player-controls__wrapper');
    if (!playerControlsWrapper) return '';
    const coverElement = playerControlsWrapper.querySelector('.entity-cover__image');
    
    if (!coverElement) return '';
    
    const coverUrl = coverElement.srcset 
        ? coverElement.srcset.split(', ')[1]?.split(' ')[0] || coverElement.src
        : coverElement.src;
    
    return coverUrl.startsWith('//') ? `http:${coverUrl}` : coverUrl;
}

function getTrackLink() {
    const trackLinkElement = document.querySelector('.track__title');
    if (!trackLinkElement) return '';
    const relativeLink = trackLinkElement.getAttribute('href');
    return relativeLink 
        ? `https://music.yandex.ru${relativeLink}` 
        : '';
}


//GETS DATA FROM PAGE
function getData() {
  return {
    url: getTrackLink(),
    subtitle: getArtistName(),
    title: getTrackName(),
    cover: getTrackCoverUrl(),
    progress: getCurrentTrackTime(),
    duration: getTrackDuration(),
    paused: isPlayerPaused()
  };
}

//MAKES SURE DATA FROM DB IS UP TO DATE
chrome.storage.onChanged.addListener(async (object, areaName) => {
  if (areaName != "local") {
    return;
  }
  if (object["extension-state"] != undefined) {
    extensionState = object["extension-state"].newValue;
    if (extensionState.selectedScanner == TAB_ID && TAB_ID != undefined && extensionState.stopped == false) {
      allowed = true;
      update(true);
    } else {
      allowed = false;
    }
  }
  if (object["extension-settings"] != undefined) {
    extensionSettings = object["extension-settings"].newValue;
  }
  if (object["extension-scanner-state"] != undefined) {
    extensionScannerState = object["extension-scanner-state"].newValue;
  }
});



console.log(`MOS - ${platform} Scanner ready`);
onLaunch();

setInterval(update, 1000);
