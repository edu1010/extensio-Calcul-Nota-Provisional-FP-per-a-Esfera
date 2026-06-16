const chk = document.getElementById('chk');

chrome.storage.local.get({ calculActiu: true }, data => {
  chk.checked = data.calculActiu;
});

chk.addEventListener('change', () => {
  chrome.storage.local.set({ calculActiu: chk.checked });
});
