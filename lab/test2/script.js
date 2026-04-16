
const STORAGE_KEY = "parking-event-map-v6";

const defaultState = {
  mapCenter: [41.6770, -71.2639],
  mapZoom: 18,
  eventTitle: "Student Parking Map",
  eventDate: "",
  locationName: "East Greenwich Campus",
  contactName: "",
  eventNotes: "Student Parking Highlighted in Yellow\n\nStudents should NOT park in Lot A1 — which is in the front of the Main building",
  referenceImageData: "assets/east-greenwich-campus-reference.jpeg",
  areas: []
};

let state = loadState();
let map;
let drawnItems;

const refs = {
  mapSearchInput: document.getElementById("mapSearchInput"),
  eventTitle: document.getElementById("eventTitle"),
  eventDate: document.getElementById("eventDate"),
  locationName: document.getElementById("locationName"),
  contactName: document.getElementById("contactName"),
  eventNotes: document.getElementById("eventNotes"),
  referenceImageInput: document.getElementById("referenceImageInput"),
  referenceImage: document.getElementById("referenceImage"),
  areaList: document.getElementById("areaList"),
  printEventTitle: document.getElementById("printEventTitle"),
  printEventDate: document.getElementById("printEventDate"),
  printLocationName: document.getElementById("printLocationName"),
  printContactName: document.getElementById("printContactName"),
  printEventNotes: document.getElementById("printEventNotes")
};

document.addEventListener("DOMContentLoaded", initialize);

function initialize(){
  fillForm();
  bindEvents();
  initMap();
  restoreAreas();
  renderReferenceImage();
  renderAreaList();
  renderPrintCard();

  setTimeout(() => { if (map) map.invalidateSize(); }, 350);
  setTimeout(searchLocation, 600);
}

function bindEvents(){
  document.getElementById("mapSearchBtn").addEventListener("click", searchLocation);
  refs.mapSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter"){
      event.preventDefault();
      searchLocation();
    }
  });
  document.getElementById("printBtn").addEventListener("click", () => window.print());
  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("resetBtn").addEventListener("click", resetDemo);

  [refs.eventTitle, refs.eventDate, refs.locationName, refs.contactName, refs.eventNotes].forEach(input => {
    input.addEventListener("input", syncFormToState);
  });

  refs.referenceImageInput.addEventListener("change", handleReferenceImageUpload);
}

function fillForm(){
  refs.eventTitle.value = state.eventTitle || "";
  refs.eventDate.value = state.eventDate || "";
  refs.locationName.value = state.locationName || "";
  refs.contactName.value = state.contactName || "";
  refs.eventNotes.value = state.eventNotes || "";
}

function syncFormToState(){
  state.eventTitle = refs.eventTitle.value.trim();
  state.eventDate = refs.eventDate.value.trim();
  state.locationName = refs.locationName.value.trim();
  state.contactName = refs.contactName.value.trim();
  state.eventNotes = refs.eventNotes.value.trim();
  persist();
  renderPrintCard();
}

function initMap(){
  map = L.map("map", { zoomControl: true, preferCanvas: true }).setView(state.mapCenter, state.mapZoom);

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 20, attribution: "Tiles © Esri" }
  ).addTo(map);

  L.tileLayer(
    "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 20, attribution: "Labels © Esri" }
  ).addTo(map);

  drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    position: "topleft",
    edit: { featureGroup: drawnItems },
    draw: {
      polyline: false,
      polygon: false,
      circle: false,
      circlemarker: false,
      marker: false,
      rectangle: {
        shapeOptions: {
          color: "#ffd400",
          weight: 2,
          fillColor: "#ffd400",
          fillOpacity: 0.28
        }
      }
    }
  });
  map.addControl(drawControl);

  map.on(L.Draw.Event.CREATED, function(event){
    const layer = event.layer;
    const details = askAreaDetails({ name: "Event Parking Area", notes: "" });
    layer.feature = {
      type: "Feature",
      properties: { id: generateId(), name: details.name, notes: details.notes },
      geometry: layer.toGeoJSON().geometry
    };
    styleArea(layer);
    attachAreaHandlers(layer);
    drawnItems.addLayer(layer);
    saveAreasFromMap();
  });

  map.on(L.Draw.Event.EDITED, saveAreasFromMap);
  map.on(L.Draw.Event.DELETED, saveAreasFromMap);

  map.on("moveend zoomend", () => {
    const center = map.getCenter();
    state.mapCenter = [center.lat, center.lng];
    state.mapZoom = map.getZoom();
    persist();
  });
}

function styleArea(layer){
  if (layer.setStyle){
    layer.setStyle({
      color: "#ffd400",
      weight: 2,
      fillColor: "#ffd400",
      fillOpacity: 0.28
    });
  }
}

function attachAreaHandlers(layer){
  if (layer.feature?.properties){
    layer.bindPopup(buildPopupHtml(layer.feature.properties));
  }
  layer.on("click", () => {
    const current = layer.feature?.properties || { name: "Event Parking Area", notes: "" };
    const updated = askAreaDetails(current);
    layer.feature.properties.name = updated.name;
    layer.feature.properties.notes = updated.notes;
    layer.bindPopup(buildPopupHtml(layer.feature.properties)).openPopup();
    saveAreasFromMap();
  });
}

function buildPopupHtml(props){
  return `
    <div>
      <strong>${escapeHtml(props.name || "Event Parking Area")}</strong><br>
      <div style="margin-top:6px;">${escapeHtml(props.notes || "No notes")}</div>
      <div style="margin-top:8px; font-size:12px; color:#666;">Click the rectangle again to edit the name and notes.</div>
    </div>
  `;
}

function askAreaDetails(current){
  const name = window.prompt("Area name:", current.name || "Event Parking Area");
  if (name === null) return current;
  const notes = window.prompt("Area notes / instructions:", current.notes || "");
  if (notes === null) return { name: name.trim() || "Event Parking Area", notes: current.notes || "" };
  return { name: name.trim() || "Event Parking Area", notes: notes.trim() };
}

async function searchLocation(){
  const query = refs.mapSearchInput.value.trim();
  if (!query) return;

  const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" + encodeURIComponent(query);

  try{
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("Search failed");
    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0){
      alert("Location not found.");
      return;
    }
    const result = results[0];
    map.setView([Number(result.lat), Number(result.lon)], 19);
  }catch(error){
    alert("Could not search the map right now.");
  }
}

function saveAreasFromMap(){
  const areas = [];
  drawnItems.eachLayer(layer => {
    const geo = layer.toGeoJSON();
    geo.properties = { ...(layer.feature?.properties || {}) };
    areas.push(geo);
  });
  state.areas = areas;
  persist();
  renderAreaList();
}

function restoreAreas(){
  drawnItems.clearLayers();
  (state.areas || []).forEach(feature => {
    const collection = L.geoJSON(feature);
    collection.eachLayer(layer => {
      layer.feature = feature;
      styleArea(layer);
      attachAreaHandlers(layer);
      drawnItems.addLayer(layer);
    });
  });
}

function renderAreaList(){
  refs.areaList.innerHTML = "";
  if (!state.areas || state.areas.length === 0){
    refs.areaList.innerHTML = '<div class="area-item"><h4>No marked areas yet</h4><p>Use the rectangle tool on the map to mark the event area.</p></div>';
    return;
  }
  state.areas.forEach(area => {
    const item = document.createElement("div");
    item.className = "area-item";
    item.innerHTML = `<h4>${escapeHtml(area.properties?.name || "Event Parking Area")}</h4><p>${escapeHtml(area.properties?.notes || "No notes")}</p>`;
    refs.areaList.appendChild(item);
  });
}

function handleReferenceImageUpload(event){
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.referenceImageData = reader.result;
    persist();
    renderReferenceImage();
  };
  reader.readAsDataURL(file);
}

function renderReferenceImage(){
  refs.referenceImage.src = state.referenceImageData || "assets/east-greenwich-campus-reference.jpeg";
}

function renderPrintCard(){
  refs.printEventTitle.textContent = state.eventTitle || "Event Map";
  refs.printEventDate.textContent = state.eventDate || "-";
  refs.printLocationName.textContent = state.locationName || "-";
  refs.printContactName.textContent = state.contactName || "-";
  refs.printEventNotes.textContent = state.eventNotes || "-";
}

function exportData(){
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "parking-event-map-data.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function resetDemo(){
  state = structuredClone(defaultState);
  persist();
  fillForm();
  renderReferenceImage();
  renderPrintCard();
  if (drawnItems) drawnItems.clearLayers();
  renderAreaList();
  refs.mapSearchInput.value = "New England Tech East Greenwich";
  refs.referenceImageInput.value = "";
  if (map){
    map.setView(state.mapCenter, state.mapZoom);
    setTimeout(searchLocation, 300);
  }
}

function generateId(){
  return "area-" + Math.random().toString(36).slice(2, 10);
}

function loadState(){
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultState);
  try{
    const parsed = JSON.parse(saved);
    return { ...structuredClone(defaultState), ...parsed, areas: Array.isArray(parsed.areas) ? parsed.areas : [] };
  }catch{
    return structuredClone(defaultState);
  }
}

function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value){
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
