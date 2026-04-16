
const STORAGE_KEY = "parking-manager-v2";

const defaultData = {
  buildingName: "Campus Parking Lot",
  buildingMapUrl: "https://maps.google.com/?q=Roger+Williams+University",
  rows: 4,
  cols: 6,
  spaces: []
};

let state = loadState();

const refs = {
  buildingName: document.getElementById("buildingName"),
  buildingMapUrl: document.getElementById("buildingMapUrl"),
  openMapLink: document.getElementById("openMapLink"),
  rowsInput: document.getElementById("rowsInput"),
  colsInput: document.getElementById("colsInput"),
  lotGrid: document.getElementById("lotGrid"),
  noSelectionState: document.getElementById("noSelectionState"),
  spaceForm: document.getElementById("spaceForm"),
  selectedSpaceTitle: document.getElementById("selectedSpaceTitle"),
  spaceStatus: document.getElementById("spaceStatus"),
  assignedTo: document.getElementById("assignedTo"),
  licensePlate: document.getElementById("licensePlate"),
  permitNumber: document.getElementById("permitNumber"),
  spaceNotes: document.getElementById("spaceNotes"),
  reservationTableBody: document.getElementById("reservationTableBody"),
  searchInput: document.getElementById("searchInput"),
};

let selectedSpaceId = null;

initialize();

function initialize(){
  if (!Array.isArray(state.spaces) || state.spaces.length === 0){
    generateSpaces(state.rows, state.cols);
    seedDemoReservations();
    persist();
  }

  bindTopControls();
  renderBuilding();
  renderLot();
  renderTable();
}

function loadState(){
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return structuredClone(defaultData);
  try{
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultData),
      ...parsed,
      spaces: Array.isArray(parsed.spaces) ? parsed.spaces : []
    };
  }catch{
    return structuredClone(defaultData);
  }
}

function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindTopControls(){
  refs.buildingName.value = state.buildingName || "";
  refs.buildingMapUrl.value = state.buildingMapUrl || "";
  refs.rowsInput.value = state.rows;
  refs.colsInput.value = state.cols;

  document.getElementById("saveBuildingBtn").addEventListener("click", () => {
    state.buildingName = refs.buildingName.value.trim() || "Untitled Building";
    state.buildingMapUrl = refs.buildingMapUrl.value.trim() || "#";
    persist();
    renderBuilding();
    alert("Building information saved.");
  });

  document.getElementById("generateLotBtn").addEventListener("click", () => {
    const rows = clampNumber(Number(refs.rowsInput.value), 1, 12, 4);
    const cols = clampNumber(Number(refs.colsInput.value), 1, 12, 6);
    state.rows = rows;
    state.cols = cols;
    generateSpaces(rows, cols);
    selectedSpaceId = null;
    seedDemoReservations();
    persist();
    renderLot();
    renderForm();
    renderTable();
  });

  document.getElementById("resetDemoBtn").addEventListener("click", () => {
    state = structuredClone(defaultData);
    generateSpaces(state.rows, state.cols);
    seedDemoReservations();
    selectedSpaceId = null;
    persist();
    refs.buildingName.value = state.buildingName;
    refs.buildingMapUrl.value = state.buildingMapUrl;
    refs.rowsInput.value = state.rows;
    refs.colsInput.value = state.cols;
    renderBuilding();
    renderLot();
    renderForm();
    renderTable();
  });

  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("clearSpaceBtn").addEventListener("click", clearSelectedSpace);
  refs.searchInput.addEventListener("input", renderTable);

  refs.spaceForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!selectedSpaceId) return;
    const space = state.spaces.find(item => item.id === selectedSpaceId);
    if (!space) return;

    space.status = refs.spaceStatus.value;
    space.assignedTo = refs.assignedTo.value.trim();
    space.licensePlate = refs.licensePlate.value.trim();
    space.permitNumber = refs.permitNumber.value.trim();
    space.notes = refs.spaceNotes.value.trim();

    persist();
    renderLot();
    renderTable();
  });
}

function renderBuilding(){
  refs.openMapLink.href = state.buildingMapUrl || "#";
}

function generateSpaces(rows, cols){
  const spaces = [];
  let n = 1;
  for (let r = 0; r < rows; r++){
    for (let c = 0; c < cols; c++){
      spaces.push({
        id: "P" + n,
        status: "open",
        assignedTo: "",
        licensePlate: "",
        permitNumber: "",
        notes: ""
      });
      n++;
    }
  }
  state.spaces = spaces;
}

function seedDemoReservations(){
  const examples = [
    { id: "P2", status: "reserved", assignedTo: "Professor Adams", licensePlate: "RWU-214", permitNumber: "FAC-1002", notes: "Weekday reserved" },
    { id: "P5", status: "visitor", assignedTo: "Visitor", licensePlate: "", permitNumber: "", notes: "Front office guest parking" },
    { id: "P7", status: "staff", assignedTo: "Security", licensePlate: "PATROL-1", permitNumber: "STF-88", notes: "Shift vehicle" },
    { id: "P10", status: "handicap", assignedTo: "", licensePlate: "", permitNumber: "", notes: "Accessible space" },
    { id: "P18", status: "blocked", assignedTo: "", licensePlate: "", permitNumber: "", notes: "Maintenance cones" }
  ];

  examples.forEach(example => {
    const space = state.spaces.find(item => item.id === example.id);
    if (space){
      Object.assign(space, example);
    }
  });
}

function renderLot(){
  refs.lotGrid.innerHTML = "";
  refs.lotGrid.style.gridTemplateColumns = `repeat(${state.cols}, minmax(90px, 1fr))`;

  state.spaces.forEach(space => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `space ${space.status}${space.id === selectedSpaceId ? " selected" : ""}`;

    const code = document.createElement("div");
    code.className = "space-code";
    code.textContent = space.id;

    const meta = document.createElement("div");
    meta.className = "space-meta";
    meta.textContent = buildSpaceMeta(space);

    button.appendChild(code);
    button.appendChild(meta);

    button.addEventListener("click", () => {
      selectedSpaceId = space.id;
      renderLot();
      renderForm();
    });

    refs.lotGrid.appendChild(button);
  });
}

function buildSpaceMeta(space){
  if (space.assignedTo) return `${labelForStatus(space.status)} • ${space.assignedTo}`;
  return labelForStatus(space.status);
}

function renderForm(){
  if (!selectedSpaceId){
    refs.noSelectionState.classList.remove("hidden");
    refs.spaceForm.classList.add("hidden");
    return;
  }

  const space = state.spaces.find(item => item.id === selectedSpaceId);
  if (!space) return;

  refs.noSelectionState.classList.add("hidden");
  refs.spaceForm.classList.remove("hidden");

  refs.selectedSpaceTitle.textContent = `Space ${space.id}`;
  refs.spaceStatus.value = space.status;
  refs.assignedTo.value = space.assignedTo || "";
  refs.licensePlate.value = space.licensePlate || "";
  refs.permitNumber.value = space.permitNumber || "";
  refs.spaceNotes.value = space.notes || "";
}

function clearSelectedSpace(){
  if (!selectedSpaceId) return;
  const space = state.spaces.find(item => item.id === selectedSpaceId);
  if (!space) return;

  space.status = "open";
  space.assignedTo = "";
  space.licensePlate = "";
  space.permitNumber = "";
  space.notes = "";

  persist();
  renderLot();
  renderForm();
  renderTable();
}

function renderTable(){
  const query = refs.searchInput.value.trim().toLowerCase();
  const filtered = state.spaces.filter(space => {
    if (!query) return true;
    const haystack = [
      space.id,
      labelForStatus(space.status),
      space.assignedTo,
      space.licensePlate,
      space.permitNumber,
      space.notes
    ].join(" ").toLowerCase();

    return haystack.includes(query);
  });

  refs.reservationTableBody.innerHTML = "";

  filtered.forEach(space => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(space.id)}</td>
      <td><span class="status-pill ${escapeHtml(space.status)}">${escapeHtml(labelForStatus(space.status))}</span></td>
      <td>${escapeHtml(space.assignedTo || "-")}</td>
      <td>${escapeHtml(space.licensePlate || "-")}</td>
      <td>${escapeHtml(space.permitNumber || "-")}</td>
      <td>${escapeHtml(space.notes || "-")}</td>
    `;
    refs.reservationTableBody.appendChild(row);
  });
}

function exportData(){
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "parking-lot-data.json";
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function labelForStatus(status){
  const labels = {
    open: "Open",
    reserved: "Reserved",
    visitor: "Visitor",
    staff: "Staff",
    handicap: "Handicap",
    blocked: "Blocked"
  };
  return labels[status] || "Open";
}

function clampNumber(value, min, max, fallback){
  if (Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value){
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const lot = document.getElementById("lot")

for(let i=1;i<=20;i++){

const space=document.createElement("div")
space.className="space"
space.innerText="P"+i

space.onclick=()=>{
space.classList.toggle("reserved")
}

lot.appendChild(space)

}

