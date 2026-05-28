/**
 * ArborMark - Core Application & Leaflet Controller (Async Hybrid Support)
 */

import { auth } from './auth.js';
import { 
    getTrees, 
    saveTree, 
    deleteTree, 
    getApprovedUsernames, 
    addApprovedUsername, 
    removeApprovedUsername, 
    getCustomFields, 
    addCustomField, 
    removeCustomField,
    getRegisteredUsers 
} from './storage.js';

// Application State
let map = null;
const markers = new Map(); // TreeID -> LeafletMarker
let currentSelectedTree = null;
let isPlacingMarker = false;
let activeFilterQuery = '';

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear-btn');
const mapCrosshair = document.getElementById('map-crosshair');
const toastNotification = document.getElementById('toast-notification');

// FABs
const locateBtn = document.getElementById('locate-btn');
const exportGpxBtn = document.getElementById('export-gpx-btn');
const adminPanelBtn = document.getElementById('admin-panel-btn');
const authTriggerBtn = document.getElementById('auth-trigger-btn');
const userBadge = document.getElementById('user-badge');
const addTreeBtn = document.getElementById('add-tree-btn');

// Bottom Sheet Elements
const detailsSheet = document.getElementById('details-sheet');
const closeSheetBtn = document.getElementById('close-sheet-btn');
const editModeBtn = document.getElementById('edit-mode-btn');

// View State Elements
const viewStateContainer = document.getElementById('view-state');
const viewCommonName = document.getElementById('view-common-name');
const viewScientificName = document.getElementById('view-scientific-name');
const viewStatusBadge = document.getElementById('view-status-badge');
const viewCoords = document.getElementById('view-coords');
const viewAuthor = document.getElementById('view-author');
const viewDynamicFieldsContainer = document.getElementById('view-dynamic-fields-container');

// Edit Form Elements
const editForm = document.getElementById('edit-state');
const formTitle = document.getElementById('form-title');
const treeIdInput = document.getElementById('tree-id-input');
const treeLatInput = document.getElementById('tree-lat-input');
const treeLngInput = document.getElementById('tree-lng-input');
const formCoordsDisplay = document.getElementById('form-coords-display');
const commonNameInput = document.getElementById('tree-common-name-input');
const scientificNameInput = document.getElementById('tree-scientific-name-input');
const statusInput = document.getElementById('tree-status-input');
const dynamicFormFieldsContainer = document.getElementById('dynamic-form-fields-container');
const deleteTreeBtn = document.getElementById('delete-tree-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Auth Modal Elements
const authModal = document.getElementById('auth-modal');
const closeAuthBtn = document.getElementById('close-auth-btn');
const authStepUsername = document.getElementById('auth-step-username');
const authStepLogin = document.getElementById('auth-step-login');
const authStepRegister = document.getElementById('auth-step-register');
const authStepProfile = document.getElementById('auth-step-profile');

const authUsernameInput = document.getElementById('auth-username-input');
const usernameErrorMsg = document.getElementById('username-error-msg');
const authNextBtn = document.getElementById('auth-next-btn');

const authPasswordInput = document.getElementById('auth-password-input');
const loginErrorMsg = document.getElementById('login-error-msg');
const authLoginBtn = document.getElementById('auth-login-btn');
const authBackToUsernameBtn = document.getElementById('auth-back-to-username-btn');

const regPasswordInput = document.getElementById('reg-password-input');
const regConfirmPasswordInput = document.getElementById('reg-confirm-password-input');
const registerErrorMsg = document.getElementById('register-error-msg');
const authRegisterBtn = document.getElementById('auth-register-btn');
const authBackFromRegBtn = document.getElementById('auth-back-from-reg-btn');

const profileWelcome = document.getElementById('profile-welcome');
const userTreesCount = document.getElementById('user-trees-count');
const authLogoutBtn = document.getElementById('auth-logout-btn');

// Admin Panel Elements
const adminPanelModal = document.getElementById('admin-panel');
const closeAdminBtn = document.getElementById('close-admin-btn');
const tabUsersBtn = document.getElementById('tab-users-btn');
const tabFieldsBtn = document.getElementById('tab-fields-btn');
const tabUsersContent = document.getElementById('tab-users-content');
const tabFieldsContent = document.getElementById('tab-fields-content');

const adminNewUsername = document.getElementById('admin-new-username');
const adminAddUsernameBtn = document.getElementById('admin-add-username-btn');
const adminUserError = document.getElementById('admin-user-error');
const permittedUsersList = document.getElementById('permitted-users-list');

const adminAddFieldForm = document.getElementById('admin-add-field-form');
const fieldLabelInput = document.getElementById('field-label-input');
const fieldTypeInput = document.getElementById('field-type-input');
const fieldOptionsGroup = document.getElementById('field-options-group');
const fieldOptionsInput = document.getElementById('field-options-input');
const adminFieldError = document.getElementById('admin-field-error');
const customFieldsList = document.getElementById('custom-fields-list');


/* ----------------------------------------------------
   NOTIFICATION TOAST & LOGGING
   ---------------------------------------------------- */
function showToast(message, type = 'success') {
    toastNotification.textContent = message;
    toastNotification.className = 'toast show';
    
    if (type === 'error') {
        toastNotification.classList.add('toast-error');
    } else if (type === 'warning') {
        toastNotification.classList.add('toast-warning');
    }
    
    setTimeout(() => {
        toastNotification.classList.remove('show');
    }, 3500);
}

/* ----------------------------------------------------
   INITIALS CALCULATOR FOR SCIENTIFIC NAMES
   ---------------------------------------------------- */
function getScientificInitials(scientificName) {
    if (!scientificName) return '??';
    
    const words = scientificName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '??';
    
    if (words.length === 1) {
        const word = words[0];
        const initial1 = word.charAt(0).toUpperCase();
        const initial2 = word.length > 1 ? word.charAt(1).toLowerCase() : '';
        return initial1 + initial2;
    }
    
    const genus = words[0];
    const species = words[1];
    
    const genusInitial = genus.charAt(0).toUpperCase();
    const speciesInitial = species.charAt(0).toLowerCase();
    
    return genusInitial + speciesInitial;
}

/* ----------------------------------------------------
   BOTTOM SHEET DRAWER INTERACTIVITY
   ---------------------------------------------------- */
function openBottomSheet(full = false) {
    detailsSheet.classList.remove('collapsed');
    
    if (window.innerWidth < 768) {
        if (full) {
            detailsSheet.classList.remove('open-partial');
            detailsSheet.classList.add('open-full');
        } else {
            detailsSheet.classList.remove('open-full');
            detailsSheet.classList.add('open-partial');
        }
    } else {
        detailsSheet.classList.add('open-full');
    }
}

function closeBottomSheet() {
    detailsSheet.classList.add('collapsed');
    detailsSheet.classList.remove('open-partial', 'open-full');
    
    clearMarkerHighlights();
    currentSelectedTree = null;
}

function clearMarkerHighlights() {
    markers.forEach(marker => {
        const el = marker.getElement();
        if (el) el.classList.remove('active-marker');
    });
}

function highlightMarker(treeId) {
    clearMarkerHighlights();
    const marker = markers.get(treeId);
    if (marker) {
        const el = marker.getElement();
        if (el) el.classList.add('active-marker');
    }
}

/* ----------------------------------------------------
   LEAFLET MAP CONTROLLER
   ---------------------------------------------------- */
async function initMap() {
    const defaultCenter = [51.505, -0.09];
    
    // Enable map zooming up to level 22 (for extreme pinpointing accuracy)
    map = L.map('map', {
        zoomControl: false,
        maxZoom: 22
    }).setView(defaultCenter, 15);
    
    // 1. Define standard OpenStreetMap Layer (Beautifully colored vector-style map)
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 22,
        maxNativeZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    
    // 2. Define Satellite Imagery Layer (Stretches from zoom 19 to 22 without disappearing)
    const satImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 22,
        maxNativeZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP'
    });
    
    // 3. Define Satellite Hybrid Boundary and Label Overlay Layer
    const satLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 22,
        maxNativeZoom: 19,
        attribution: 'Labels &copy; Esri'
    });
    
    // Set OpenStreetMap standard colored map as default on startup
    osmLayer.addTo(map);
    let activeMapStyle = 'standard';
    let currentLayers = [osmLayer];
    
    // Connect map layer style toggler FAB
    const layerToggleBtn = document.getElementById('layer-toggle-btn');
    if (layerToggleBtn) {
        layerToggleBtn.addEventListener('click', () => {
            currentLayers.forEach(l => map.removeLayer(l));
            
            if (activeMapStyle === 'standard') {
                // Switch to Satellite Hybrid Mode
                satImagery.addTo(map);
                satLabels.addTo(map);
                currentLayers = [satImagery, satLabels];
                activeMapStyle = 'satellite';
                layerToggleBtn.innerHTML = '<i class="fa-solid fa-map"></i>';
                showToast('Switched to Satellite Hybrid View');
            } else {
                // Switch to standard OpenStreetMap vector style
                osmLayer.addTo(map);
                currentLayers = [osmLayer];
                activeMapStyle = 'standard';
                layerToggleBtn.innerHTML = '<i class="fa-solid fa-layer-group"></i>';
                showToast('Switched to OpenStreetMap Standard View');
            }
        });
    }
    
    // Setup initial marker renders
    await renderTreeMarkers();
    
    // Setup Map Click Handler for marker placement
    map.on('click', (e) => {
        if (!isPlacingMarker) {
            closeBottomSheet();
        } else {
            triggerAddTreeForm(e.latlng.lat, e.latlng.lng);
        }
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                map.setView([lat, lng], 16);
            },
            () => {
                console.log("Geolocation permission denied. Sticking to default center.");
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    }
}

/**
 * Render all tree markers onto map canvas
 */
async function renderTreeMarkers() {
    markers.forEach(marker => map.removeLayer(marker));
    markers.clear();
    
    const trees = await getTrees();
    
    const filteredTrees = trees.filter(tree => {
        if (!activeFilterQuery) return true;
        const q = activeFilterQuery.toLowerCase();
        return (
            tree.commonName.toLowerCase().includes(q) ||
            tree.scientificName.toLowerCase().includes(q) ||
            (tree.status && tree.status.replace('_', ' ').toLowerCase().includes(q))
        );
    });
    
    filteredTrees.forEach(tree => {
        const initials = getScientificInitials(tree.scientificName);
        
        const markerIcon = L.divIcon({
            className: `custom-tree-marker ${tree.status}`,
            html: `<span>${initials}</span>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });
        
        const marker = L.marker([tree.lat, tree.lng], { icon: markerIcon }).addTo(map);
        
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            
            const offsetLat = window.innerWidth < 768 ? tree.lat - 0.003 : tree.lat;
            map.panTo([offsetLat, tree.lng], { animate: true, duration: 0.6 });
            
            showTreeDetails(tree);
        });
        
        markers.set(tree.id, marker);
    });
}

/* ----------------------------------------------------
   DYNAMIC TREE FORM ENGINE
   ---------------------------------------------------- */
async function compileDynamicFieldsForm(treeData = null) {
    dynamicFormFieldsContainer.innerHTML = '';
    const customFields = await getCustomFields();
    
    if (customFields.length === 0) {
        dynamicFormFieldsContainer.innerHTML = '<p class="helper-text">No additional custom fields configured.</p>';
        return;
    }
    
    customFields.forEach(field => {
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        
        const label = document.createElement('label');
        label.setAttribute('for', `dynamic-${field.id}`);
        label.textContent = field.label;
        inputGroup.appendChild(label);
        
        let inputEl = null;
        const savedValue = treeData && treeData.customFields ? treeData.customFields[field.id] || '' : '';
        
        if (field.type === 'select') {
            inputEl = document.createElement('select');
            inputEl.id = `dynamic-${field.id}`;
            
            const options = field.options.split(',').map(o => o.trim()).filter(Boolean);
            
            const placeholderOpt = document.createElement('option');
            placeholderOpt.value = '';
            placeholderOpt.textContent = '-- Select Selection --';
            inputEl.appendChild(placeholderOpt);
            
            options.forEach(opt => {
                const optEl = document.createElement('option');
                optEl.value = opt;
                optEl.textContent = opt;
                if (opt === savedValue) {
                    optEl.selected = true;
                }
                inputEl.appendChild(optEl);
            });
        } else {
            inputEl = document.createElement('input');
            inputEl.id = `dynamic-${field.id}`;
            inputEl.type = field.type;
            inputEl.placeholder = field.type === 'number' ? 'e.g. 15' : 'Enter details...';
            inputEl.value = savedValue;
        }
        
        inputGroup.appendChild(inputEl);
        dynamicFormFieldsContainer.appendChild(inputGroup);
    });
}

async function compileDynamicFieldsView(treeData) {
    viewDynamicFieldsContainer.innerHTML = '';
    const customFields = await getCustomFields();
    
    let hasDetails = false;
    
    customFields.forEach(field => {
        const val = treeData.customFields ? treeData.customFields[field.id] : '';
        if (val) {
            hasDetails = true;
            
            const row = document.createElement('div');
            row.className = 'detail-row';
            
            const labelSpan = document.createElement('span');
            labelSpan.className = 'detail-label';
            labelSpan.textContent = field.label;
            
            const valSpan = document.createElement('span');
            valSpan.className = 'detail-value';
            valSpan.textContent = val;
            
            row.appendChild(labelSpan);
            row.appendChild(valSpan);
            viewDynamicFieldsContainer.appendChild(row);
        }
    });
    
    if (!hasDetails) {
        viewDynamicFieldsContainer.innerHTML = '<p class="helper-text text-center mt-2">No additional custom field details logged.</p>';
    }
}

/* ----------------------------------------------------
   DETAIL VIEW / FORM STATE MANAGEMENT
   ---------------------------------------------------- */
async function showTreeDetails(tree) {
    currentSelectedTree = tree;
    highlightMarker(tree.id);
    
    viewCommonName.textContent = tree.commonName;
    viewScientificName.textContent = tree.scientificName;
    viewCoords.textContent = `${tree.lat.toFixed(6)}, ${tree.lng.toFixed(6)}`;
    viewAuthor.textContent = tree.createdBy || 'anonymous';
    
    viewStatusBadge.className = 'status-badge';
    viewStatusBadge.classList.add(`status-${tree.status}`);
    
    const cleanStatus = tree.status.replace('_', ' ');
    viewStatusBadge.textContent = cleanStatus.charAt(0).toUpperCase() + cleanStatus.slice(1);
    
    // Populate Dynamic Fields View
    await compileDynamicFieldsView(tree);
    
    if (auth.isLoggedIn()) {
        editModeBtn.classList.remove('hidden');
    } else {
        editModeBtn.classList.add('hidden');
    }
    
    viewStateContainer.classList.remove('hidden');
    editForm.classList.add('hidden');
    
    openBottomSheet(false);
}

async function triggerAddTreeForm(lat, lng) {
    disablePlacingMode();
    
    currentSelectedTree = null;
    
    treeIdInput.value = '';
    treeLatInput.value = lat;
    treeLngInput.value = lng;
    formCoordsDisplay.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    formTitle.textContent = 'Mark New Tree';
    commonNameInput.value = '';
    scientificNameInput.value = '';
    statusInput.value = 'well_maintained';
    
    // Compile custom dynamic fields
    await compileDynamicFieldsForm();
    
    deleteTreeBtn.classList.add('hidden');
    
    viewStateContainer.classList.add('hidden');
    editForm.classList.remove('hidden');
    
    openBottomSheet(true);
}

async function triggerEditTreeForm() {
    if (!currentSelectedTree) return;
    
    const tree = currentSelectedTree;
    
    treeIdInput.value = tree.id;
    treeLatInput.value = tree.lat;
    treeLngInput.value = tree.lng;
    formCoordsDisplay.textContent = `${tree.lat.toFixed(6)}, ${tree.lng.toFixed(6)}`;
    
    formTitle.textContent = 'Modify Tree Record';
    commonNameInput.value = tree.commonName;
    scientificNameInput.value = tree.scientificName;
    statusInput.value = tree.status;
    
    // Compile dynamic inputs with existing data
    await compileDynamicFieldsForm(tree);
    
    deleteTreeBtn.classList.remove('hidden');
    
    viewStateContainer.classList.add('hidden');
    editForm.classList.remove('hidden');
    
    openBottomSheet(true);
}

/* ----------------------------------------------------
   MARKER PLACING CROSSHAIR LOGIC
   ---------------------------------------------------- */
function enablePlacingMode() {
    if (!auth.isLoggedIn()) {
        showToast('Please sign in to mark trees.', 'warning');
        return;
    }
    
    isPlacingMarker = true;
    closeBottomSheet();
    
    mapCrosshair.classList.remove('hidden');
    addTreeBtn.classList.add('cancel-mode');
    
    showToast('Pan map to location and tap crosshair center to place marker', 'warning');
}

function disablePlacingMode() {
    isPlacingMarker = false;
    mapCrosshair.classList.add('hidden');
    addTreeBtn.classList.remove('cancel-mode');
}

function togglePlacingMode() {
    if (isPlacingMarker) {
        disablePlacingMode();
    } else {
        enablePlacingMode();
    }
}

// Tap Center Crosshair Trigger
mapCrosshair.addEventListener('click', () => {
    if (!isPlacingMarker) return;
    const center = map.getCenter();
    triggerAddTreeForm(center.lat, center.lng);
});

/* ----------------------------------------------------
   FORM SUBMISSION & SAVING LOGIC
   ---------------------------------------------------- */
editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const commonName = commonNameInput.value.trim();
    const scientificName = scientificNameInput.value.trim();
    const status = statusInput.value;
    const lat = parseFloat(treeLatInput.value);
    const lng = parseFloat(treeLngInput.value);
    
    let hasError = false;
    
    commonNameInput.parentElement.classList.remove('has-error');
    scientificNameInput.parentElement.classList.remove('has-error');
    
    if (!commonName) {
        commonNameInput.parentElement.classList.add('has-error');
        hasError = true;
    }
    
    if (!scientificName) {
        scientificNameInput.parentElement.classList.add('has-error');
        hasError = true;
    } else {
        const words = scientificName.split(/\s+/).filter(Boolean);
        if (words.length < 2) {
            scientificNameInput.parentElement.classList.add('has-error');
            showToast('Scientific Name must contain Genus and Species (e.g. Quercus robur)', 'error');
            hasError = true;
        }
    }
    
    if (hasError) {
        showToast('Please complete all required fields.', 'error');
        return;
    }
    
    const customFieldsData = {};
    const customFields = await getCustomFields();
    customFields.forEach(field => {
        const inputEl = document.getElementById(`dynamic-${field.id}`);
        if (inputEl) {
            customFieldsData[field.id] = inputEl.value.trim();
        }
    });
    
    const treeRecord = {
        commonName,
        scientificName,
        status,
        lat,
        lng,
        customFields: customFieldsData
    };
    
    if (treeIdInput.value) {
        treeRecord.id = treeIdInput.value;
    } else {
        treeRecord.createdBy = auth.getUsername() || 'anonymous';
    }
    
    await saveTree(treeRecord);
    
    showToast(treeRecord.id ? 'Tree record updated successfully!' : 'New tree marked successfully!');
    
    await renderTreeMarkers();
    
    if (treeRecord.id) {
        const updatedTrees = await getTrees();
        const freshRecord = updatedTrees.find(t => t.id === treeRecord.id);
        await showTreeDetails(freshRecord);
    } else {
        closeBottomSheet();
    }
});

// Delete Record Event
deleteTreeBtn.addEventListener('click', async () => {
    if (!currentSelectedTree) return;
    
    if (confirm(`Are you sure you want to delete the record for ${currentSelectedTree.commonName}?`)) {
        await deleteTree(currentSelectedTree.id);
        showToast('Tree record removed from map.', 'warning');
        await renderTreeMarkers();
        closeBottomSheet();
    }
});

// Cancel Edit Button
cancelEditBtn.addEventListener('click', async () => {
    if (currentSelectedTree) {
        await showTreeDetails(currentSelectedTree);
    } else {
        closeBottomSheet();
    }
});

/* ----------------------------------------------------
   AUTHENTICATION STATE SYNCER
   ---------------------------------------------------- */
auth.onAuthStateChanged((user) => {
    if (user) {
        authTriggerBtn.innerHTML = `<i class="fa-solid fa-user-check"></i>`;
        userBadge.textContent = user.username.slice(0, 2);
        userBadge.classList.remove('hidden');
        
        addTreeBtn.classList.remove('hidden');
        
        if (user.isAdmin) {
            adminPanelBtn.classList.remove('hidden');
        } else {
            adminPanelBtn.classList.add('hidden');
        }
        
        if (currentSelectedTree) {
            editModeBtn.classList.remove('hidden');
        }
    } else {
        authTriggerBtn.innerHTML = `<i class="fa-solid fa-user-lock"></i>`;
        userBadge.classList.add('hidden');
        
        addTreeBtn.classList.add('hidden');
        adminPanelBtn.classList.add('hidden');
        editModeBtn.classList.add('hidden');
        
        disablePlacingMode();
        
        if (!editForm.classList.contains('hidden')) {
            closeBottomSheet();
        }
    }
});

/* ----------------------------------------------------
   GPX XML EXPORT ENGINE
   ---------------------------------------------------- */
async function exportGpxData() {
    const trees = await getTrees();
    if (trees.length === 0) {
        showToast('No tree records available to export.', 'warning');
        return;
    }
    
    const customFieldsList = await getCustomFields();
    
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ArborMark App" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
    <metadata>
        <name>ArborMark Tree Database Export</name>
        <desc>Geographic coordinates and status records of catalogued trees</desc>
        <time>${new Date().toISOString()}</time>
    </metadata>
`;

    trees.forEach(tree => {
        const statusClean = tree.status.replace('_', ' ').toUpperCase();
        
        let desc = `Scientific Name: ${tree.scientificName} | Status: ${statusClean}`;
        
        if (tree.customFields) {
            customFieldsList.forEach(cf => {
                const val = tree.customFields[cf.id];
                if (val) {
                    desc += ` | ${cf.label}: ${val}`;
                }
            });
        }
        
        desc += ` | Marked by: ${tree.createdBy || 'anonymous'}`;
        
        const cleanName = tree.commonName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const cleanDesc = desc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        gpx += `    <wpt lat="${tree.lat.toFixed(6)}" lon="${tree.lng.toFixed(6)}">
        <name>${cleanName}</name>
        <desc>${cleanDesc}</desc>
        <sym>Forest</sym>
        <type>Tree Point</type>
    </wpt>
`;
    });
    
    gpx += `</gpx>`;
    
    const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `arbormark_export_${Date.now()}.gpx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`Exported ${trees.length} tree points as GPX. Check your downloads!`);
}

exportGpxBtn.addEventListener('click', exportGpxData);

/* ----------------------------------------------------
   AUTHENTICATION INTERFACES MODULE
   ---------------------------------------------------- */
authTriggerBtn.addEventListener('click', async () => {
    authUsernameInput.value = '';
    authPasswordInput.value = '';
    regPasswordInput.value = '';
    regConfirmPasswordInput.value = '';
    
    usernameErrorMsg.classList.add('hidden');
    loginErrorMsg.classList.add('hidden');
    registerErrorMsg.classList.add('hidden');
    
    if (auth.isLoggedIn()) {
        profileWelcome.textContent = `Hello, ${auth.getUsername()}!`;
        
        const allTrees = await getTrees();
        const usersTrees = allTrees.filter(t => t.createdBy === auth.getUsername()).length;
        userTreesCount.textContent = usersTrees;
        
        authStepUsername.classList.add('hidden');
        authStepLogin.classList.add('hidden');
        authStepRegister.classList.add('hidden');
        authStepProfile.classList.remove('hidden');
    } else {
        authStepUsername.classList.remove('hidden');
        authStepLogin.classList.add('hidden');
        authStepRegister.classList.add('hidden');
        authStepProfile.classList.add('hidden');
    }
    
    authModal.classList.remove('hidden');
});

closeAuthBtn.addEventListener('click', () => authModal.classList.add('hidden'));
authModal.addEventListener('click', (e) => {
    if (e.target === authModal) authModal.classList.add('hidden');
});

// Step 1 Check Authorization
authNextBtn.addEventListener('click', async () => {
    const username = authUsernameInput.value.trim().toLowerCase();
    usernameErrorMsg.classList.add('hidden');
    
    if (!username) {
        usernameErrorMsg.textContent = 'Please enter a username.';
        usernameErrorMsg.classList.remove('hidden');
        return;
    }
    
    const isApproved = await auth.isUsernameApproved(username);
    if (!isApproved) {
        usernameErrorMsg.textContent = 'This username is not approved to register or edit the map. Please request permission from the admin.';
        usernameErrorMsg.classList.remove('hidden');
        return;
    }
    
    // Check if already registered (asynchronously from hybrid storage)
    const users = await getRegisteredUsers();
    
    if (users[username]) {
        document.getElementById('login-title').textContent = 'Sign In';
        document.getElementById('login-subtitle').textContent = `Welcome back, ${username}! Please enter your password to login.`;
        
        authStepUsername.classList.add('hidden');
        authStepLogin.classList.remove('hidden');
    } else {
        authStepUsername.classList.add('hidden');
        authStepRegister.classList.remove('hidden');
    }
});

authBackToUsernameBtn.addEventListener('click', () => {
    authStepLogin.classList.add('hidden');
    authStepUsername.classList.remove('hidden');
});

authBackFromRegBtn.addEventListener('click', () => {
    authStepRegister.classList.add('hidden');
    authStepUsername.classList.remove('hidden');
});

// Login Execution
authLoginBtn.addEventListener('click', async () => {
    const username = authUsernameInput.value.trim().toLowerCase();
    const password = authPasswordInput.value;
    
    loginErrorMsg.classList.add('hidden');
    
    try {
        await auth.login(username, password);
        showToast(`Successfully logged in as ${username}!`);
        authModal.classList.add('hidden');
    } catch (err) {
        loginErrorMsg.textContent = err.message;
        loginErrorMsg.classList.remove('hidden');
    }
});

// Registration Execution
authRegisterBtn.addEventListener('click', async () => {
    const username = authUsernameInput.value.trim().toLowerCase();
    const password = regPasswordInput.value;
    const confirmPass = regConfirmPasswordInput.value;
    
    registerErrorMsg.classList.add('hidden');
    
    if (password !== confirmPass) {
        registerErrorMsg.textContent = 'Passwords do not match.';
        registerErrorMsg.classList.remove('hidden');
        return;
    }
    
    try {
        await auth.register(username, password);
        showToast(`Account registered and logged in as ${username}!`);
        authModal.classList.add('hidden');
    } catch (err) {
        registerErrorMsg.textContent = err.message;
        registerErrorMsg.classList.remove('hidden');
    }
});

authLogoutBtn.addEventListener('click', () => {
    const oldUser = auth.getUsername();
    auth.logout();
    showToast(`Logged out of ${oldUser}.`, 'warning');
    authModal.classList.add('hidden');
});

/* ----------------------------------------------------
   ADMIN CONTROL PANEL PROGRAMMING
   ---------------------------------------------------- */
adminPanelBtn.addEventListener('click', async () => {
    await renderAdminUsersList();
    await renderAdminFieldsList();
    
    tabUsersBtn.click();
    
    adminPanelModal.classList.remove('hidden');
});

closeAdminBtn.addEventListener('click', () => adminPanelModal.classList.add('hidden'));
adminPanelModal.addEventListener('click', (e) => {
    if (e.target === adminPanelModal) adminPanelModal.classList.add('hidden');
});

tabUsersBtn.addEventListener('click', () => {
    tabUsersBtn.classList.add('active');
    tabFieldsBtn.classList.remove('active');
    tabUsersContent.classList.remove('hidden');
    tabFieldsContent.classList.add('hidden');
});

tabFieldsBtn.addEventListener('click', () => {
    tabFieldsBtn.classList.add('active');
    tabUsersBtn.classList.remove('active');
    tabFieldsContent.classList.remove('hidden');
    tabUsersContent.classList.add('hidden');
});

fieldTypeInput.addEventListener('change', () => {
    if (fieldTypeInput.value === 'select') {
        fieldOptionsGroup.classList.remove('hidden');
    } else {
        fieldOptionsGroup.classList.add('hidden');
    }
});

/* --- Admin Tab 1: User Management --- */
async function renderAdminUsersList() {
    permittedUsersList.innerHTML = '';
    const users = await getApprovedUsernames();
    
    users.forEach(username => {
        const li = document.createElement('li');
        
        const textWrapper = document.createElement('div');
        textWrapper.className = 'admin-username-tag';
        textWrapper.textContent = username;
        
        if (username === 'admin') {
            textWrapper.textContent += ' (System Admin)';
        }
        
        li.appendChild(textWrapper);
        
        if (username !== 'admin') {
            const delBtn = document.createElement('button');
            delBtn.className = 'admin-delete-btn';
            delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            delBtn.addEventListener('click', async () => {
                if (confirm(`Remove mapping rights for username "${username}"?`)) {
                    await removeApprovedUsername(username);
                    showToast(`Privileges revoked for ${username}.`, 'warning');
                    await renderAdminUsersList();
                }
            });
            li.appendChild(delBtn);
        }
        
        permittedUsersList.appendChild(li);
    });
}

adminAddUsernameBtn.addEventListener('click', async () => {
    const user = adminNewUsername.value.trim().toLowerCase();
    adminUserError.classList.add('hidden');
    
    if (!user) {
        adminUserError.textContent = 'Please enter a valid username.';
        adminUserError.classList.remove('hidden');
        return;
    }
    
    const added = await addApprovedUsername(user);
    if (added) {
        showToast(`User "${user}" successfully pre-approved for registration!`);
        adminNewUsername.value = '';
        await renderAdminUsersList();
    } else {
        adminUserError.textContent = 'Username already permitted or invalid.';
        adminUserError.classList.remove('hidden');
    }
});

/* --- Admin Tab 2: Custom Field Configurator --- */
async function renderAdminFieldsList() {
    customFieldsList.innerHTML = '';
    const fields = await getCustomFields();
    
    if (fields.length === 0) {
        customFieldsList.innerHTML = '<p class="helper-text text-center py-4">No custom fields logged.</p>';
        return;
    }
    
    fields.forEach(field => {
        const li = document.createElement('li');
        
        const info = document.createElement('div');
        info.className = 'field-info';
        
        const label = document.createElement('span');
        label.className = 'field-label-display';
        label.textContent = field.label;
        
        const pill = document.createElement('span');
        pill.className = 'field-type-pill';
        pill.textContent = field.type;
        
        info.appendChild(label);
        info.appendChild(pill);
        li.appendChild(info);
        
        const delBtn = document.createElement('button');
        delBtn.className = 'admin-delete-btn';
        delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        delBtn.addEventListener('click', async () => {
            if (confirm(`Remove dynamic data field "${field.label}"?`)) {
                await removeCustomField(field.id);
                showToast(`Dynamic field "${field.label}" removed.`, 'warning');
                await renderAdminFieldsList();
            }
        });
        li.appendChild(delBtn);
        
        customFieldsList.appendChild(li);
    });
}

adminAddFieldForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    adminFieldError.classList.add('hidden');
    
    const label = fieldLabelInput.value.trim();
    const type = fieldTypeInput.value;
    const options = fieldOptionsInput.value.trim();
    
    if (!label) {
        adminFieldError.textContent = 'Please enter a field label.';
        adminFieldError.classList.remove('hidden');
        return;
    }
    
    if (type === 'select' && !options) {
        adminFieldError.textContent = 'Please enter comma-separated choices for dropdown selections.';
        adminFieldError.classList.remove('hidden');
        return;
    }
    
    try {
        await addCustomField({ label, type, options });
        showToast(`Custom field "${label}" added!`);
        
        fieldLabelInput.value = '';
        fieldTypeInput.value = 'text';
        fieldOptionsInput.value = '';
        fieldOptionsGroup.classList.add('hidden');
        
        await renderAdminFieldsList();
    } catch (err) {
        adminFieldError.textContent = err.message;
        adminFieldError.classList.remove('hidden');
    }
});

/* ----------------------------------------------------
   SEARCH AND AUTOCOMPLETE INTERFACES
   ---------------------------------------------------- */
searchInput.addEventListener('input', async () => {
    activeFilterQuery = searchInput.value;
    
    if (activeFilterQuery) {
        searchClearBtn.classList.remove('hidden');
    } else {
        searchClearBtn.classList.add('hidden');
    }
    
    await renderTreeMarkers();
});

searchClearBtn.addEventListener('click', async () => {
    searchInput.value = '';
    activeFilterQuery = '';
    searchClearBtn.classList.add('hidden');
    await renderTreeMarkers();
});

/* ----------------------------------------------------
   CORE BINDINGS & DEVICE ACTIONS
   ---------------------------------------------------- */

// GPS Geolocation Focus FAB Trigger
locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
        showToast('GPS geolocation is not supported by your device browser.', 'error');
        return;
    }
    
    showToast('Locating device position...', 'warning');
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            
            map.setView([lat, lng], 17, { animate: true, duration: 1.0 });
            
            const userLocIcon = L.divIcon({
                className: 'custom-tree-marker active-marker',
                html: '<i class="fa-solid fa-crosshairs text-green"></i>',
                iconSize: [28, 28]
            });
            const locationMarker = L.marker([lat, lng], { icon: userLocIcon }).addTo(map);
            
            setTimeout(() => {
                map.removeLayer(locationMarker);
            }, 5000);
            
            showToast('Device location centered successfully!');
        },
        (err) => {
            showToast(`Could not obtain GPS lock: ${err.message}`, 'error');
        },
        { enableHighAccuracy: true, timeout: 7000 }
    );
});

addTreeBtn.addEventListener('click', togglePlacingMode);
closeSheetBtn.addEventListener('click', closeBottomSheet);
editModeBtn.addEventListener('click', triggerEditTreeForm);

// Application Initialization
window.addEventListener('DOMContentLoaded', async () => {
    auth.init();
    await initMap();
});
