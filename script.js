console.log("--- script.js starting execution ---"); // DEBUG VERY TOP

// ===========================================
// === GLOBAL VARIABLES & CONSTANTS ========
// ===========================================

// --- DOM Element Variables (will be assigned in DOMContentLoaded) ---
let listNameInput, createListBtn, targetListSelect, listInput, addItemsBtn, 
    categoryListElement, tabContainer, listContentContainer, manageListsTabButton, 
    categorySettingsContainer, addNewCategoryBtn, saveSettingsBtn, dynamicStyleSheet, 
    toggleSettingsBtn, settingsAreaWrapper, hamburgerBtn, mobileNavPanel, 
    mobileManageListsTabButton, pasteBtn;

// --- Category Definitions --- 
const DEFAULT_CATEGORIES = {
    fruit: { name: 'Fruit', color: '#5a994a' },
    dairy: { name: 'Dairy', color: '#4a7db1' },
    household: { name: 'Household', color: '#666666' },
    meat: { name: 'Meat', color: '#b15a4a' },
    snacks: { name: 'Snacks', color: '#b1a04a' },
    pantry: { name: 'Pantry', color: '#8a6d3b' },
    frozen: { name: 'Frozen', color: '#5bc0de' },
    default: { name: 'Other', color: '#4a4a4a' } 
};
let currentCategoryConfig = {}; // Will be loaded or initialized

// --- Application State --- 
let shoppingLists = {};
let activeListId = null;

// --- Local Storage Keys --- 
const LISTS_STORAGE_KEY = 'shoppingLists';
const CATEGORY_STORAGE_KEY = 'categoryConfig';

// --- Autocomplete Cache --- 
let knownItems = {}; 

// --- Long Press Timer ---
let pressTimer = null;
let longPressDetected = false;
const LONG_PRESS_DURATION = 700; // milliseconds

// ===========================================
// === FUNCTION DEFINITIONS ==================
// ===========================================

function saveState() {
    // console.log("[saveState] Saving lists and categories to localStorage."); // DEBUG
    try {
        localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(shoppingLists));
        localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(currentCategoryConfig));
    } catch (e) {
        console.error("[saveState] Error saving state:", e);
        alert("Error saving data. Your changes might not persist.");
    }
}

function loadState() {
    // console.log("[loadState] Starting state load/initialization...");
    try {
        // console.log("[loadState] ENTERING TRY BLOCK.");
        // console.log("[loadState] Checking DEFAULT_CATEGORIES structure:", typeof DEFAULT_CATEGORIES, DEFAULT_CATEGORIES ? JSON.stringify(DEFAULT_CATEGORIES) : 'undefined/null'); 

        // --- Load/Initialize Categories ---
        // console.log("[loadState] Checking categories...");
        let savedCategories = null; 
        try {
             savedCategories = localStorage.getItem(CATEGORY_STORAGE_KEY);
             // console.log(`[loadState] localStorage.getItem(${CATEGORY_STORAGE_KEY}) returned:`, savedCategories ? '(found data)' : '(no data)');
        } catch(e) {
            console.error("[loadState] Error reading categories from localStorage:", e); // KEEP Error
        }

        if (!savedCategories) {
            // console.log("[loadState] No categories found or error reading, initializing defaults.");
            currentCategoryConfig = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
            // console.log("[loadState] Assigned DEFAULT_CATEGORIES to currentCategoryConfig:", JSON.parse(JSON.stringify(currentCategoryConfig)));
            // if (!currentCategoryConfig || Object.keys(currentCategoryConfig).length === 0) {
            //     console.error("[loadState] CRITICAL: currentCategoryConfig is empty/invalid immediately after default assignment!"); // KEEP Error?
            // }
            try {
                localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(currentCategoryConfig));
                // console.log("[loadState] localStorage.setItem(categories) called.");
                const checkCat = localStorage.getItem(CATEGORY_STORAGE_KEY);
                // console.log("[loadState] Immediate check after set (categories):", checkCat ? '(found)' : '(NOT FOUND!)');
            } catch (e) {
                console.error("[loadState] Error setting default categories:", e); // KEEP Error
            }
        } else {
            // console.log("[loadState] Found categories, parsing...");
            try {
                currentCategoryConfig = JSON.parse(savedCategories);
                if (!currentCategoryConfig.default || typeof currentCategoryConfig.default !== 'object') {
                    console.warn("[loadState] Loaded categories missing/invalid 'default', adding it back."); // KEEP Warn
                    currentCategoryConfig.default = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES.default));
                }
                 // console.log("[loadState] Categories parsed successfully:", JSON.parse(JSON.stringify(currentCategoryConfig)));
            } catch (parseError) {
                console.error("[loadState] Error parsing categories, resetting to defaults:", parseError); // KEEP Error
                currentCategoryConfig = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
                try {
                    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(currentCategoryConfig));
                } catch(e) { console.error("[loadState] Error saving reset categories after parse error:", e); } // KEEP Error
            }
        }

        // --- Load/Initialize Lists ---
        // console.log("[loadState] Checking lists...");
        let savedListsString = null;
        try {
            savedListsString = localStorage.getItem(LISTS_STORAGE_KEY);
            // console.log(`[loadState] localStorage.getItem(${LISTS_STORAGE_KEY}) returned:`, savedListsString ? '(found data)' : '(no data)');
        } catch(e) {
            console.error("[loadState] Error reading lists from localStorage:", e); // KEEP Error
        }

        if (!savedListsString) {
            // console.log("[loadState] No lists found or error reading, initializing empty.");
            shoppingLists = {};
            try {
                localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(shoppingLists));
                // console.log("[loadState] localStorage.setItem(lists) called.");
                const checkList = localStorage.getItem(LISTS_STORAGE_KEY);
                // console.log("[loadState] Immediate check after set (lists):", checkList ? '(found)' : '(NOT FOUND!)');
            } catch (e) {
                console.error("[loadState] Error setting default lists:", e); // KEEP Error
            }
        } else {
             // console.log("[loadState] Found lists, parsing...");
             try {
                shoppingLists = JSON.parse(savedListsString);
                // console.log("[loadState] Lists parsed successfully.");
            } catch (parseError) {
                console.error("[loadState] Error parsing lists, resetting to empty:", parseError); // KEEP Error
                shoppingLists = {};
                try {
                    localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(shoppingLists));
                } catch (e) { console.error("[loadState] Error saving reset lists after parse error:", e); } // KEEP Error
            }
        }

        // --- Final Check for valid category config before proceeding ---
        if (!currentCategoryConfig || typeof currentCategoryConfig !== 'object' || !currentCategoryConfig.default || typeof currentCategoryConfig.default !== 'object') {
             console.error("[loadState] CRITICAL: currentCategoryConfig is invalid before validation/rendering!", JSON.parse(JSON.stringify(currentCategoryConfig))); // KEEP Error
             currentCategoryConfig = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
             // console.log("[loadState] Attempted recovery of currentCategoryConfig.");
        }

        // --- Validate Loaded Lists ---
        // console.log("[loadState] Validating lists...");
        Object.values(shoppingLists).forEach(list => {
             if (!list.items) list.items = [];
             list.items.forEach(item => {
                if (!item.id) item.id = generateId();
                if (item.category && !currentCategoryConfig[item.category]) {
                    console.warn(`[loadState] Item "${item.name}" had invalid category "${item.category}", reverting to default.`); // KEEP Warn
                    item.category = null;
                }
             });
        });
        // console.log("[loadState] Validation complete.");

        // --- Proceed to Rendering Sequence ---
        // console.log("[loadState] Calling continueLoadSequence().");
        continueLoadSequence();

    } catch (error) {
        console.error('[loadState] CRITICAL ERROR:', error); // KEEP Error
        try {
            currentCategoryConfig = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
            shoppingLists = {};
            saveState();
            console.log("[loadState] State reset due to critical error."); // KEEP Log
            continueLoadSequence();
        } catch (fallbackError) {
            console.error("[loadState] Fallback reset failed:", fallbackError); // KEEP Error
            if(listContentContainer) { 
                listContentContainer.innerHTML = '<p style="color: red; padding: 20px;">A critical error occurred while loading the application. Please try clearing site data and refreshing.</p>';
            } else {
                 alert("A critical error occurred. Please clear site data and refresh.");
            }
        }
    }
    // console.log("[loadState] Finished.");
}

// Encapsulate the rest of the loading/rendering sequence
function continueLoadSequence() {
    // console.log("[continueLoadSequence] Starting..."); 
    buildKnownItemsCacheFromStorage();

    fetch('defaultItems.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(defaultItemsData => {
            addDefaultItemsToCache(defaultItemsData);
        })
        .catch(error => {
            console.warn('[continueLoadSequence] Could not load defaultItems.json for suggestions:', error); // KEEP Warn
        })
        .finally(() => {
            // console.log("[continueLoadSequence] Applying styles and rendering UI..."); 
             applyCategoryStyles(); 
            renderTabsAndContent(); 
            updateTargetListDropdown(); 
            renderCategorySettings(); 
            populateCategoryGuide(); 

            const sortedListIds = Object.keys(shoppingLists).sort((a, b) => shoppingLists[a].name.localeCompare(shoppingLists[b].name));
            const firstListId = sortedListIds[0];
            // console.log("[continueLoadSequence] Determining initial active tab..."); 
            if (firstListId) {
                // console.log(`[continueLoadSequence] Activating first list tab: list-${firstListId}`); 
                switchTab(`list-${firstListId}`);
            } else {
                // console.log("[continueLoadSequence] No lists found, activating input tab."); 
                switchTab('inputTab');
            }
            
            // Populate datalists AFTER the initial tab has been switched
            populateAllDatalists();

            // console.log("[continueLoadSequence] Finished."); 
        });
}

// --- ID Generation --- 
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// --- Target List Dropdown --- 
function updateTargetListDropdown() {
    if (!targetListSelect) { console.error("updateTargetListDropdown: targetListSelect is null"); return; } // KEEP Error
    const currentSelection = targetListSelect.value;
    // console.log('[updateTargetListDropdown] Updating. Lists:', Object.keys(shoppingLists), 'Current selection:', currentSelection);
    targetListSelect.innerHTML = '<option value="" disabled selected>Select list to add items to...</option>';

    const sortedLists = Object.values(shoppingLists).sort((a, b) => a.name.localeCompare(b.name));
    let firstListId = null; 

    if (sortedLists.length === 0) {
        targetListSelect.disabled = true;
        if (addItemsBtn) addItemsBtn.disabled = true;
    } else {
        targetListSelect.disabled = false;
        sortedLists.forEach((list, index) => {
            if (index === 0) firstListId = list.id;
            const option = document.createElement('option');
            option.value = list.id;
            option.textContent = list.name;
            targetListSelect.appendChild(option);
        });
        
        if (shoppingLists[currentSelection]) {
            targetListSelect.value = currentSelection;
        } else if (firstListId) {
             targetListSelect.value = firstListId;
        }
        
         if (addItemsBtn) addItemsBtn.disabled = !targetListSelect.value;
    }
    // console.log('[updateTargetListDropdown] Finished. Disabled:', targetListSelect.disabled, 'Value:', targetListSelect.value);
}

// --- Dynamic Stylesheet --- 
function createDynamicStyleSheet() {
    const style = document.createElement('style');
    style.id = 'dynamic-category-styles';
    document.head.appendChild(style);
    return style.sheet;
}

function applyCategoryStyles() {
    if (!dynamicStyleSheet) { console.error("applyCategoryStyles: dynamicStyleSheet not initialized"); return; } // KEEP Error
    // Clear existing rules
    while (dynamicStyleSheet.cssRules.length > 0) {
        try { dynamicStyleSheet.deleteRule(0); } catch(e) { console.warn("Minor error clearing dynamic styles:", e); break; } // Handle potential race condition errors
    }
    // Add new rules
    if (!currentCategoryConfig || typeof currentCategoryConfig !== 'object') {
         console.error("applyCategoryStyles: currentCategoryConfig is invalid", currentCategoryConfig); return; // KEEP Error
    }
    for (const key in currentCategoryConfig) {
        const config = currentCategoryConfig[key];
        if (!config || typeof config.color !== 'string') {
             console.warn(`applyCategoryStyles: Invalid config for key ${key}`, config); continue; // KEEP Warn
        }
        const className = `category-${key}`; // Generate class name
        try {
            // Apply !important cautiously, maybe only needed if specificity conflicts arise
            dynamicStyleSheet.insertRule(`.${className} { background-color: ${config.color}; }`, dynamicStyleSheet.cssRules.length);
            // Add rule for category guide swatches too
            dynamicStyleSheet.insertRule(`.guide-swatch-${key} { background-color: ${config.color}; border: 1px solid #555; display: inline-block; width: 15px; height: 15px; margin-right: 8px; vertical-align: middle; border-radius: 3px; }`, dynamicStyleSheet.cssRules.length);
        } catch (e) {
            console.error(`Error applying style for category ${key} with color ${config.color}:`, e); // KEEP Error
        }
    }
     // console.log("[applyCategoryStyles] Styles applied for categories:", Object.keys(currentCategoryConfig)); // DEBUG
}

// --- Category Settings UI --- 
function renderCategorySettings() {
    if (!categorySettingsContainer) { console.error("renderCategorySettings: categorySettingsContainer is null"); return; } // KEEP Error
    categorySettingsContainer.innerHTML = ''; // Clear previous settings
    if (!currentCategoryConfig || typeof currentCategoryConfig !== 'object') {
         console.error("renderCategorySettings: currentCategoryConfig is invalid", currentCategoryConfig); return; // KEEP Error
    }
    const sortedKeys = Object.keys(currentCategoryConfig).sort((a, b) => {
        if (a === 'default') return 1; if (b === 'default') return -1; return a.localeCompare(b);
    });
    sortedKeys.forEach(key => {
        renderCategorySettingRow(key, currentCategoryConfig[key]);
    });
     // console.log("[renderCategorySettings] Settings rendered."); // DEBUG
}

function renderCategorySettingRow(key, config) {
    if (!config) { console.warn(`renderCategorySettingRow: Invalid config passed for key ${key}`); return; } // KEEP Warn
    const isDefault = key === 'default';
    const row = document.createElement('div');
    row.classList.add('category-setting-row');
    row.dataset.categoryKey = key;

    // Key Input (readonly)
    const keyInput = document.createElement('input');
    keyInput.type = 'text';
    keyInput.value = key;
    keyInput.classList.add('category-key-input');
    keyInput.readOnly = true; // Keep readonly unless newly added
    keyInput.disabled = true; // Keep disabled unless newly added
    row.appendChild(keyInput);

    // Name Input
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = config.name || ''; // Handle potentially missing name
    nameInput.placeholder = 'Display Name';
    nameInput.classList.add('category-name-input');
    nameInput.readOnly = isDefault;
    nameInput.disabled = isDefault;
    row.appendChild(nameInput);

    // Color Input
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = config.color || '#cccccc'; // Handle potentially missing color
    colorInput.classList.add('category-color-input');
    row.appendChild(colorInput);

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'X';
    deleteBtn.classList.add('delete-category-btn');
    deleteBtn.disabled = isDefault;
    deleteBtn.title = isDefault ? 'Cannot delete default category' : 'Delete category';
    if (!isDefault) {
        deleteBtn.addEventListener('click', () => {
            if (confirm(`Delete category "${key}"? Items using it will revert to "Other".`)) {
                row.remove(); // Remove from UI immediately
            }
        });
    }
    row.appendChild(deleteBtn);

    categorySettingsContainer.appendChild(row);
}

function handleAddNewCategory() {
    const newKey = prompt("Enter a short, unique key for the new category (e.g., 'bakery', 'drinks'):")?.toLowerCase().trim();
    if (!newKey) return;
    if (!/^[a-z0-9]+$/.test(newKey)) {
        alert("Key can only contain lowercase letters and numbers."); return;
    }
    if (currentCategoryConfig[newKey] || categorySettingsContainer.querySelector(`.category-setting-row[data-category-key="${newKey}"]`)) {
         alert(`Category key "${newKey}" already exists.`); return;
    }
    
    const tempConfig = { name: '', color: '#cccccc' }; 
    renderCategorySettingRow(newKey, tempConfig);
    const newRow = categorySettingsContainer.lastElementChild;
    if (newRow) { // Make sure row was actually added
        const newKeyInput = newRow.querySelector('.category-key-input');
        if (newKeyInput) {
            newKeyInput.readOnly = false;
            newKeyInput.disabled = false;
            newKeyInput.style.backgroundColor = '#4a4a4a';
            newKeyInput.style.color = '#e0e0e0';
            newKeyInput.style.fontStyle = 'normal';
        }
        const newNameInput = newRow.querySelector('.category-name-input');
        if (newNameInput) newNameInput.focus();
    }
     // console.log(`[handleAddNewCategory] Added temporary row for key: ${newKey}`); // DEBUG
}

function handleSaveCategorySettings() {
    const newConfig = {};
    const rows = categorySettingsContainer.querySelectorAll('.category-setting-row');
    let isValid = true;
    const usedKeys = new Set();

    rows.forEach(row => {
        if (!isValid) return; // Stop processing if already invalid
        const keyInput = row.querySelector('.category-key-input');
        const nameInput = row.querySelector('.category-name-input');
        const colorInput = row.querySelector('.category-color-input');
        
        // Safety check elements exist
        if (!keyInput || !nameInput || !colorInput) {
             console.error("handleSaveCategorySettings: Input elements not found in a row.", row); // KEEP Error
             alert("An unexpected error occurred saving settings. Please check console.");
             isValid = false; return;
        }
        
        const key = keyInput.value.toLowerCase().trim();
        const name = nameInput.value.trim();
        const color = colorInput.value;

        if (!key || !name) {
            alert(`Error in row for key "${row.dataset.categoryKey || key}": Key and Name cannot be empty.`);
            isValid = false; return;
        }
        if (!/^[a-z0-9]+$/.test(key)) {
             alert(`Error in row for key "${row.dataset.categoryKey || key}": Key "${key}" is invalid (only lowercase letters/numbers).`);
             isValid = false; return;
         }
         if (usedKeys.has(key)) {
             alert(`Error: Duplicate category key found: "${key}". Keys must be unique.`);
             isValid = false; return;
         }
         usedKeys.add(key);

        newConfig[key] = { name, color };
    });

    // console.log("[handleSaveCategorySettings] Generated newConfig:", JSON.stringify(newConfig, null, 2));

    if (!isValid) return;
    if (!newConfig.default) {
         alert("Error: The 'default' category cannot be deleted.");
         console.error("[handleSaveCategorySettings] Validation failed: newConfig is missing 'default' key.", newConfig); // KEEP Error
         return;
    }

    // Update main config
    currentCategoryConfig = newConfig;
    
    // Update items using potentially renamed/deleted categories
    Object.values(shoppingLists).forEach(list => {
        list.items.forEach(item => {
            if (item.category && !currentCategoryConfig[item.category]) {
                // console.log(`[handleSaveCategorySettings] Reverting category for item "${item.name}" from "${item.category}" to default.`); 
                item.category = null;
            }
        });
    });
    
    applyCategoryStyles();
    populateCategoryGuide();
    renderCategorySettings(); // Re-render settings to reflect saved state
    renderTabsAndContent(); // Re-render lists as item categories might have changed
    
    // Repopulate *all* list-specific selects
    document.querySelectorAll('.single-item-category-select').forEach(select => {
         populateSingleItemCategorySelect(select);
    });

    buildKnownItemsCacheFromStorage(); // Rebuild cache (includes defaults now handled in load)
    saveState();

    alert("Category settings saved!");
    // console.log("[handleSaveCategorySettings] Settings saved successfully."); // DEBUG
}


// --- Single Item Add --- 
function populateSingleItemCategorySelect(selectElement) {
    if (!selectElement) { console.error("populateSingleItemCategorySelect: selectElement is null"); return; } // KEEP Error
    const currentVal = selectElement.value;
    selectElement.innerHTML = '<option value="">Category</option>'; // Placeholder

    if (!currentCategoryConfig || typeof currentCategoryConfig !== 'object') {
        console.error("[populateSingleItemCategorySelect] currentCategoryConfig is invalid!", currentCategoryConfig); // KEEP Error
        return;
    }

    const sortedKeys = Object.keys(currentCategoryConfig)
        .filter(key => key !== 'default') 
        .sort((a, b) => { 
            const configA = currentCategoryConfig[a];
            const configB = currentCategoryConfig[b];
            // Robust sorting: handle cases where name might be missing during transient states
            const nameA = (configA && configA.name) ? configA.name : '';
            const nameB = (configB && configB.name) ? configB.name : '';
            if (!nameA && a) console.warn(`[populateSingleItemCategorySelect] Missing name for category key ${a} during sort.`); // KEEP Warn
            if (!nameB && b) console.warn(`[populateSingleItemCategorySelect] Missing name for category key ${b} during sort.`); // KEEP Warn
            return nameA.localeCompare(nameB);
        }); 
    
    sortedKeys.forEach(key => {
         const config = currentCategoryConfig[key];
         if (!config || !config.name) {
              console.error(`[populateSingleItemCategorySelect] Invalid config for key during loop: ${key}`, config); // KEEP Error
              return; // Skip this invalid entry
         }
        const option = document.createElement('option');
        option.value = key;
        option.textContent = config.name;
        selectElement.appendChild(option);
    });

    if (currentCategoryConfig.default && currentCategoryConfig.default.name) {
        const defaultOption = document.createElement('option');
        defaultOption.value = ''; 
        defaultOption.textContent = currentCategoryConfig.default.name; // Should be 'Other' or user-defined default
        selectElement.appendChild(defaultOption);
    } else {
         console.error("[populateSingleItemCategorySelect] Default category config is missing or invalid!", currentCategoryConfig.default); // KEEP Error
    }
    
    selectElement.value = currentVal; // Restore previous selection if possible
}

function addSingleItem(listId, nameInput, qtyInput, categorySelect) {
    // Safety check inputs
    if (!nameInput || !qtyInput || !categorySelect) {
        console.error("addSingleItem: One or more input elements are missing."); return; // KEEP Error
    }
    const itemName = nameInput.value.trim();
    
    if (!listId) { console.error("addSingleItem called without listId"); return; } // KEEP Error
    if (!itemName) { alert("Please enter an item name."); nameInput.focus(); return; }
    if (!shoppingLists[listId]) { alert("Target list not found."); return; }
    
    const qtyValue = qtyInput.value.trim();
    const quantity = qtyValue ? parseInt(qtyValue, 10) : null;
    if (quantity !== null && (isNaN(quantity) || quantity < 1)) {
         alert("Quantity must be a positive number.");
         qtyInput.focus();
         return;
    }

    const category = categorySelect.value || null; 
    
    const newItem = { id: generateId(), name: itemName, quantity: quantity, category: category, done: false };
    // console.log("[addSingleItem] Adding new item:", newItem, "to list:", listId); // DEBUG
    
    // Check for duplicates (case-insensitive name, same category, same quantity, not done)
    const exists = shoppingLists[listId].items.some(existingItem => 
        existingItem.name.toLowerCase() === newItem.name.toLowerCase() && 
        existingItem.category === newItem.category && 
        existingItem.quantity === newItem.quantity &&
        !existingItem.done 
    );
    
    if (exists) {
        if (!confirm(`Item "${itemName}" seems to already be on the active list. Add anyway?`)) {
             // console.log("[addSingleItem] Duplicate add cancelled by user."); // DEBUG
            return;
        }
        // console.log("[addSingleItem] Adding duplicate item as requested."); // DEBUG
    }
    
    shoppingLists[listId].items.push(newItem);
    updateKnownItem(newItem); // Update autocomplete cache
    renderItemsForList(listId); // Re-render just the items for this list
    saveState();
    
    // Clear inputs specific to this list
    nameInput.value = '';
    qtyInput.value = '';
    categorySelect.value = '';
    nameInput.focus();
}

// --- Long Press, Hamburger, Tab Management, List Create/Delete, Item Parsing --- 
function handlePointerDown(event, listId, itemId) {
    const card = event.target.closest('.item-card');
    if (!card || !card.closest('.completed-list')) return; // Only for completed items

    longPressDetected = false;
    pressTimer = setTimeout(() => {
        longPressDetected = true;
        card.style.transform = 'scale(0.95)'; 
        const itemToDelete = shoppingLists[listId]?.items.find(i => i.id === itemId);
        if (itemToDelete && confirm(`Permanently delete item "${itemToDelete.name}"?`)) {
            deleteItem(listId, itemId);
        } else {
             // Reset style immediately if cancelled
            card.style.transform = 'scale(1)'; 
        }
    }, LONG_PRESS_DURATION);
}

function handlePointerUpOrLeave(event) {
    const card = event.target.closest('.item-card');
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
    if (card) card.style.transform = 'scale(1)'; // Reset style regardless
    if (longPressDetected) {
        event.preventDefault(); 
        event.stopPropagation(); // Prevent click toggle
        // console.log("[handlePointerUpOrLeave] Long press detected, preventing click."); // DEBUG
    }
    longPressDetected = false;
}

// --- Hamburger Menu Logic --- 
function toggleMobileNav(show) {
     if (!mobileNavPanel || !hamburgerBtn) { console.error("toggleMobileNav: Panel or button not found."); return; } // KEEP Error
    if (show) {
        mobileNavPanel.classList.add('active');
        hamburgerBtn.innerHTML = '&#10005;'; // Close icon (X)
    } else {
        mobileNavPanel.classList.remove('active');
        hamburgerBtn.innerHTML = '&#9776;'; // Hamburger icon
    }
}

function handleHamburgerClick(e) {
    e.stopPropagation(); 
    toggleMobileNav(!mobileNavPanel.classList.contains('active'));
}

function handleDocumentClick(e) {
    // Close nav if clicking outside of it AND it's active
    if (mobileNavPanel && mobileNavPanel.classList.contains('active') && !mobileNavPanel.contains(e.target) && e.target !== hamburgerBtn) {
        toggleMobileNav(false);
    }
}

// --- Tab Management --- 
function switchTab(targetTabId) {
    // console.log(`[switchTab] Switching to tab: ${targetTabId}`); 
    // Deactivate all tabs and content
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Activate the target tab button (desktop and mobile)
    const targetButtons = document.querySelectorAll(`.tab-button[data-tab="${targetTabId}"]`);
    if (targetButtons.length > 0) {
        targetButtons.forEach(btn => btn.classList.add('active'));
    } else {
        console.warn(`[switchTab] No button found for targetTabId: ${targetTabId}`); // KEEP Warn
    }
    
    // Activate the target content pane
    const targetContentId = targetTabId === 'inputTab' 
        ? 'inputTab' 
        : `list-tab-content-${targetTabId.replace('list-', '')}`;
    const targetContent = document.getElementById(targetContentId);
    if (targetContent) {
        targetContent.classList.add('active');
        // console.log(`[switchTab] Activated content pane: ${targetContentId}`);
    } else {
         console.warn(`[switchTab] No content pane found for ID: ${targetContentId}`); // KEEP Warn
         const inputContent = document.getElementById('inputTab');
         if(inputContent) inputContent.classList.add('active');
         const inputButton = document.querySelector('.tab-button[data-tab="inputTab"]');
         if(inputButton) inputButton.classList.add('active');
    }

    // Update activeListId state variable
    activeListId = targetTabId.startsWith('list-') ? targetTabId.replace('list-', '') : null;
     // console.log(`[switchTab] Active list ID set to: ${activeListId}`); 

    // Close mobile nav if it's open
    if (mobileNavPanel && mobileNavPanel.classList.contains('active')) {
        toggleMobileNav(false);
    }
}

// --- Rendering --- 
function renderTabsAndContent() {
    // console.log("[renderTabsAndContent] Starting full UI render..."); 
    if (!tabContainer || !mobileNavPanel || !listContentContainer) {
         console.error("renderTabsAndContent: Core container elements not found!"); return; // KEEP Error
    }
    const previouslyActiveListId = activeListId;
    // Determine if the input tab was active by checking its button
    const inputTabButton = tabContainer.querySelector('[data-tab="inputTab"]');
    const inputTabWasActive = inputTabButton ? inputTabButton.classList.contains('active') : false;
     // console.log(`[renderTabsAndContent] Previous active list: ${previouslyActiveListId}, Input tab was active: ${inputTabWasActive}`); 

    // Clear dynamic tabs from BOTH containers
    tabContainer.querySelectorAll('.list-tab-button').forEach(btn => btn.remove());
    mobileNavPanel.querySelectorAll('.list-tab-button').forEach(btn => btn.remove());
    listContentContainer.innerHTML = ''; // Clear old list content panes
    
    const sortedLists = Object.values(shoppingLists).sort((a, b) => a.name.localeCompare(b.name));
    // console.log(`[renderTabsAndContent] Rendering ${sortedLists.length} lists.`); 

    sortedLists.forEach(list => {
        if (list && list.id) { 
            renderListTab(list); 
            renderListContentStructure(list); 
            renderItemsForList(list.id); 
        } else { console.warn('[renderTabsAndContent] Skipping render for invalid list object:', list); } // KEEP Warn
    });
    
    // Determine which tab should be active after re-render
    let targetTabIdToActivate;
    if (inputTabWasActive) {
        targetTabIdToActivate = 'inputTab';
    } else if (previouslyActiveListId && shoppingLists[previouslyActiveListId]) {
        // If the previously active list still exists, keep it active
        targetTabIdToActivate = `list-${previouslyActiveListId}`;
    } else if (sortedLists.length > 0) {
        // Otherwise, if there are lists, activate the first one
        targetTabIdToActivate = `list-${sortedLists[0].id}`;
    } else {
        // If no lists exist, activate the input tab
        targetTabIdToActivate = 'inputTab';
    }
    
    // console.log(`[renderTabsAndContent] Determined target tab to activate: ${targetTabIdToActivate}`); 
    switchTab(targetTabIdToActivate); 
    // console.log("[renderTabsAndContent] Finished full UI render."); 
}

function renderListTab(list) {
    const tabId = `list-${list.id}`;

    // --- Create Desktop Tab Button --- 
    const desktopButton = document.createElement('button');
    desktopButton.classList.add('tab-button', 'list-tab-button');
    desktopButton.dataset.tab = tabId;
    desktopButton.textContent = list.name;
    desktopButton.addEventListener('click', () => switchTab(tabId));
    // Append list tabs to the end of the desktop container
    if (tabContainer) tabContainer.appendChild(desktopButton); 

    // --- Create Mobile Tab Button --- 
    const mobileButton = document.createElement('button');
    mobileButton.classList.add('tab-button', 'mobile-tab-button', 'list-tab-button');
    mobileButton.dataset.tab = tabId;
    mobileButton.textContent = list.name;
    mobileButton.addEventListener('click', () => switchTab(tabId));
     // Append list tabs to the end of the mobile container
    if (mobileNavPanel) mobileNavPanel.appendChild(mobileButton); 
}

function renderListContentStructure(list) {
    // console.log(`[renderListContentStructure] Creating structure for list: ${list.name} (${list.id})`); 
    let contentDiv = document.getElementById(`list-tab-content-${list.id}`);
    // Only create if it doesn't exist
    if (!contentDiv) { 
        contentDiv = document.createElement('div');
        contentDiv.id = `list-tab-content-${list.id}`;
        contentDiv.classList.add('tab-content', 'list-tab'); // Initially hidden by default CSS
        
        // Add List Name Heading
        const heading = document.createElement('h2');
        heading.textContent = list.name;
        contentDiv.appendChild(heading);

        // --- Create Single Item Add Section --- 
        const singleAddSection = document.createElement('div');
        singleAddSection.classList.add('input-area', 'add-single-item-section');
        singleAddSection.dataset.listId = list.id; 

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Item Name';
        nameInput.required = true;
        nameInput.classList.add('single-item-name-input');
        nameInput.setAttribute('list', `itemSuggestions-${list.id}`); 
        singleAddSection.appendChild(nameInput);

        const datalist = document.createElement('datalist');
        datalist.id = `itemSuggestions-${list.id}`;
        // Datalist will be populated later or by updateKnownItem
        singleAddSection.appendChild(datalist);

        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.placeholder = 'Qty';
        qtyInput.min = '1';
        qtyInput.style.maxWidth = '70px'; 
        qtyInput.classList.add('single-item-qty-input');
        singleAddSection.appendChild(qtyInput);

        const categorySelect = document.createElement('select');
        categorySelect.classList.add('single-item-category-select');
        populateSingleItemCategorySelect(categorySelect); // Populate categories now
        singleAddSection.appendChild(categorySelect);

        const addButton = document.createElement('button');
        addButton.textContent = '+';
        addButton.title = 'Add Item';
        addButton.classList.add('add-single-item-btn');
        addButton.addEventListener('click', () => {
            addSingleItem(list.id, nameInput, qtyInput, categorySelect);
        });

        // Input listener for category prefill
        nameInput.addEventListener('input', (e) => {
            const enteredNameLower = e.target.value.toLowerCase();
            const knownData = knownItems[enteredNameLower]; 
            if (knownData !== undefined) { 
                categorySelect.value = knownData.category === null ? '' : knownData.category;
            }
        });

        // Add via Enter key
        nameInput.addEventListener('keypress', (e) => {
             if (e.key === 'Enter') {
                 e.preventDefault();
                 addSingleItem(list.id, nameInput, qtyInput, categorySelect);
             }
         });
        singleAddSection.appendChild(addButton);
        contentDiv.appendChild(singleAddSection); // Add section below heading

        // Active Items Container (will be populated by renderItemsForList)
        const activeContainer = document.createElement('div');
        activeContainer.className = 'list-container active-list-items'; // Added class for clarity
        activeContainer.id = `activeListContainer-${list.id}`;
        contentDiv.appendChild(activeContainer);

        // Completed Items Section Structure
        const completedSection = document.createElement('div');
        completedSection.classList.add('list-section', 'completed-list');
         const completedHeading = document.createElement('h3'); 
        completedHeading.textContent = 'Completed Items';
        completedSection.appendChild(completedHeading);
        const completedContainer = document.createElement('div');
        completedContainer.classList.add('list-container');
        completedContainer.id = `completedListContainer-${list.id}`;
        completedSection.appendChild(completedContainer);
        contentDiv.appendChild(completedSection);
        
        // Delete List Button
        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-list-btn');
        deleteBtn.dataset.listId = list.id;
        deleteBtn.textContent = 'Delete List';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            deleteList(list.id);
        });
        contentDiv.appendChild(deleteBtn);

        listContentContainer.appendChild(contentDiv); // Add the whole structure to the main container
         // console.log(`[renderListContentStructure] Structure created for list: ${list.id}`);
    } else {
         // console.log(`[renderListContentStructure] Structure already exists for list: ${list.id}`);
    }
}

function renderItemsForList(listId, poppedItemId = null) { 
    // console.log(`[renderItemsForList] Rendering items for list: ${listId}${poppedItemId ? ', popping item: ' + poppedItemId : ''}`);
    const list = shoppingLists[listId];
    if (!list) { console.error(`[renderItemsForList] List not found: ${listId}`); return; }
    
    const activeContainer = document.getElementById(`activeListContainer-${listId}`);
    const completedContainer = document.getElementById(`completedListContainer-${listId}`);
    
    if (!activeContainer || !completedContainer) {
        console.error(`[renderItemsForList] Containers not found for list ${listId}.`); // KEEP Error
        return; 
    }

    // Clear previous items
    activeContainer.innerHTML = ''; 
    completedContainer.innerHTML = ''; 

    const activeItems = list.items.filter(item => !item.done);
    const completedItems = list.items.filter(item => item.done);
    // console.log(`[renderItemsForList] List ${listId}: ${activeItems.length} active, ${completedItems.length} completed.`);

    const groupedActiveItems = activeItems.reduce((acc, item) => {
         const categoryKey = item.category || 'default'; 
         if (!acc[categoryKey]) acc[categoryKey] = [];
         acc[categoryKey].push(item);
         return acc;
     }, {});

    const allCategoryKeys = Object.keys(currentCategoryConfig)
        .sort((a, b) => {
            if (a === 'default') return 1; if (b === 'default') return -1;
            const nameA = currentCategoryConfig[a]?.name || '';
            const nameB = currentCategoryConfig[b]?.name || '';
            return nameA.localeCompare(nameB);
        });
     // console.log(`[renderItemsForList] Sorted category keys for rendering: ${allCategoryKeys.join(', ')}`);

    // Render active items grouped by category
    allCategoryKeys.forEach(categoryKey => {
        if (groupedActiveItems[categoryKey] && groupedActiveItems[categoryKey].length > 0) { 
            const categoryConfig = currentCategoryConfig[categoryKey]; 
            if (!categoryConfig) { 
                console.error(`[renderItemsForList] Config not found for category key: ${categoryKey}`); // KEEP Error
                return; 
            }
            const categoryHeader = document.createElement('div');
            categoryHeader.classList.add('category-header');
            categoryHeader.textContent = categoryConfig.name; 
            categoryHeader.dataset.categoryKey = categoryKey;
            activeContainer.appendChild(categoryHeader);
            
            groupedActiveItems[categoryKey].forEach(item => {
                 // Pass poppedItemId to createItemCard
                const card = createItemCard(item, listId, poppedItemId === item.id); 
                activeContainer.appendChild(card);
            });
        }
    });
    
    // Render completed items and handle section visibility
    const completedSection = completedContainer.closest('.completed-list'); 
    if (completedItems.length > 0) {
        if (completedSection) completedSection.style.display = '';
        completedItems.forEach(item => {
            // Pass poppedItemId to createItemCard
            const card = createItemCard(item, listId, poppedItemId === item.id); 
            card.addEventListener('pointerdown', (e) => handlePointerDown(e, listId, item.id));
            card.addEventListener('pointerup', handlePointerUpOrLeave);
            card.addEventListener('pointerleave', handlePointerUpOrLeave);
            completedContainer.appendChild(card);
        });
    } else {
        if (completedSection) completedSection.style.display = 'none'; 
    }
    // console.log(`[renderItemsForList] Finished rendering items for list: ${listId}`);
}


// --- Card Creation --- 
function createItemCard(item, listId, isPoppingIn = false) {
    const card = document.createElement('div');
    card.className = `item-card category-${item.category || 'default'} ${item.done ? 'done' : ''}`;
    card.dataset.itemId = item.id;
    card.dataset.listId = listId;
    card.dataset.category = item.category || 'default';

    // --- Apply Pop-in animation if needed ---
    if (isPoppingIn) {
        // console.log(`[createItemCard] Applying pop-in to item ${item.id}`);
        card.classList.add('popping-in');
        card.addEventListener('animationend', () => {
            if (card.classList.contains('popping-in')) { 
                 // console.log(`[createItemCard] Pop-in animation ended for ${item.id}, removing class.`);
                 card.classList.remove('popping-in');
            }
        }, { once: true }); 
    }

    // Create nameSpan
    const nameSpan = document.createElement('span');
    nameSpan.className = 'item-name';
    nameSpan.textContent = item.name;
    card.appendChild(nameSpan);

    // Display quantity only if > 1
    if (item.quantity && item.quantity > 1) {
        const detailsSpan = document.createElement('span');
        detailsSpan.className = 'item-details';
        detailsSpan.textContent = `x${item.quantity}`;
        card.appendChild(detailsSpan);
    }

    // Add click handler for toggling done state
    card.addEventListener('click', (e) => {
        if (!longPressDetected) { 
             toggleItemDone(listId, item.id);
        } else {
             // console.log("[createItemCard] Click prevented due to long press flag.");
        }
    });

    return card;
}

function toggleItemDone(listId, itemId) {
    // console.log(`[toggleItemDone] Toggling item ${itemId} in list ${listId} using SHRINK/POP`);
    const list = shoppingLists[listId];
    if (!list) { console.error("[toggleItemDone] List not found"); return; } // KEEP Error

    const itemIndex = list.items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) { console.error("[toggleItemDone] Item not found in list data"); return; } // KEEP Error
    const item = list.items[itemIndex];

    const card = document.querySelector(`.item-card[data-item-id="${itemId}"][data-list-id="${listId}"]`);
    if (!card) { console.error("[toggleItemDone] Card element not found in DOM"); return; } // KEEP Error

    // --- Remove potentially lingering animation classes --- 
    card.classList.remove('popping-in', 'sliding-to-completed', 'sliding-from-completed'); 
    void card.offsetWidth; // Reflow after removing

    // --- Shrink Out Animation ---
    // console.log(`[toggleItemDone] Applying shrink-out to item ${itemId}`);
    card.classList.add('shrinking-out');

    // --- State Update & Re-render after Shrink ---
    setTimeout(() => {
        // console.log(`[toggleItemDone] Shrink timeout reached for ${itemId}. Updating state and re-rendering.`);
        const wasDone = item.done; // Check state *before* toggling
        item.done = !item.done; 
        // console.log(`[toggleItemDone] Item state toggled to done: ${item.done}.`);
        
        // If item was moved from completed back to active, increment its count via updateKnownItem
        if (wasDone && !item.done) {
            // console.log(`[toggleItemDone] Item "${item.name}" moved back to active list. Incrementing count.`);
            updateKnownItem(item); // updateKnownItem handles incrementing count and saving state
        } else {
            // If item was just completed (active -> done), just save the state change
            saveState(); 
        }
        
        // Always re-render the list after the state change
        renderItemsForList(listId, itemId); 
    }, 300); 
}


// --- Item Input / Parsing / Adding --- 
function addItemsToList() {
    let addedCount = 0;
    let skippedCount = 0;
    // Use a for...of loop instead of forEach to potentially avoid syntax issues
    for (const newItem of newItems) {
        // Check for duplicates (case-insensitive name, same category, same quantity, not done)
        const exists = currentList.items.some(existingItem => 
            existingItem.name.toLowerCase() === newItem.name.toLowerCase() && 
            existingItem.category === newItem.category && 
            existingItem.quantity === newItem.quantity &&
            !existingItem.done 
        );
        if (!exists) {
            currentList.items.push(newItem);
            updateKnownItem(newItem); // Update cache
            addedCount++;
        } else {
             // console.log(`[addItemsToList] Skipping duplicate item: ${newItem.name}`);
             skippedCount++;
         }
    } // End of for...of loop

    // console.log(`[addItemsToList] Added: ${addedCount}, Skipped (duplicates): ${skippedCount}`);

    if (addedCount > 0) {
        renderItemsForList(selectedListId); 
        saveState(); 
        listInput.value = ''; // Clear input only if items were added
        switchTab(`list-${selectedListId}`); // Switch to the list
    } else if (skippedCount > 0 && addedCount === 0) {
        alert("All items entered were already on the active list.");
        // Maybe don't clear input or switch tab here?
    } else if (newItems.length === 0){
         alert("Please enter items to add.");
         // Don't clear or switch
    } else {
        // No items added, none skipped - likely means input was empty after trim/filter
         alert("Please enter items to add.");
    }
}

function handlePasteClick() {
    // console.log("[handlePasteClick] Paste button clicked");
    if (!navigator.clipboard || !navigator.clipboard.readText) {
        alert('Clipboard API not available.'); return;
    }
    if (!listInput) { console.error("[handlePasteClick] listInput element not found."); return; } // KEEP Error

    navigator.clipboard.readText()
        .then(text => {
            if (text) {
                // console.log("[handlePasteClick] Pasting text:", text);
                listInput.value += (listInput.value ? '\n' : '') + text; // Append
                listInput.focus();
            } else {
                alert('Clipboard is empty.');
            }
        })
        .catch(err => {
            console.error('[handlePasteClick] Failed to read clipboard:', err); // KEEP Error
            alert('Failed to paste. Check browser permissions?');
        });
}

function deleteItem(listId, itemId) {
     // console.log(`[deleteItem] Attempting to delete item ${itemId} from list ${listId}`);
     const list = shoppingLists[listId];
     if (!list) { console.error("[deleteItem] List not found."); return; } // KEEP Error
     const itemIndex = list.items.findIndex(item => item.id === itemId);
     if (itemIndex > -1) {
         const deletedItemName = list.items[itemIndex].name;
         list.items.splice(itemIndex, 1); // Remove item from array
         // console.log(`[deleteItem] Item "${deletedItemName}" removed from data.`);
         renderItemsForList(listId); // Re-render the list UI
         saveState(); // Save changes
         // console.log("[deleteItem] List re-rendered and state saved.");
     } else {
          console.warn(`[deleteItem] Item ${itemId} not found in list ${listId} data.`); // KEEP Warn
     }       
}

// --- Category Guide --- 
function populateCategoryGuide() {
    if (!categoryListElement) { console.error("populateCategoryGuide: categoryListElement is null."); return; } // KEEP Error
    categoryListElement.innerHTML = ''; // Clear existing
    if (!currentCategoryConfig || typeof currentCategoryConfig !== 'object') {
         console.error("populateCategoryGuide: currentCategoryConfig is invalid.", currentCategoryConfig); return; // KEEP Error
    }
    const sortedKeys = Object.keys(currentCategoryConfig).sort((a,b) => {
         if (a === 'default') return 1; if (b === 'default') return -1;
         const nameA = currentCategoryConfig[a]?.name || '';
         const nameB = currentCategoryConfig[b]?.name || '';
         return nameA.localeCompare(nameB);
    });

    sortedKeys.forEach(key => {
        if (key !== 'default') { // Usually exclude default from the quick guide
            const config = currentCategoryConfig[key];
            if (!config || !config.name) { // Safety check
                 console.warn(`populateCategoryGuide: Skipping invalid config for key ${key}`); return; // KEEP Warn
            }
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.classList.add(`guide-swatch-${key}`); // Style applied by applyCategoryStyles
            li.appendChild(span);
            li.appendChild(document.createTextNode(`${key} (${config.name})`));
            categoryListElement.appendChild(li);
        }
    });
     // console.log("[populateCategoryGuide] Guide populated.");
}

// --- Settings Toggle ---
function handleToggleSettingsClick() {
    if (!settingsAreaWrapper || !toggleSettingsBtn) { console.error("handleToggleSettingsClick: Core elements missing."); return; } // KEEP Error
    const isHidden = settingsAreaWrapper.style.display === 'none';
    settingsAreaWrapper.style.display = isHidden ? 'block' : 'none';
    toggleSettingsBtn.innerHTML = isHidden ? 'Hide Category Settings &#9650;' : 'Show Category Settings &#9660;';
     // console.log(`[handleToggleSettingsClick] Settings visibility toggled to: ${isHidden ? 'block' : 'none'}`);
}

// --- List Creation / Deletion --- 
function createNewList() {
     if (!listNameInput) { console.error("createNewList: listNameInput is null."); return; } // KEEP Error
     // console.log("[createNewList] Create List button/enter triggered.");
    const listName = listNameInput.value.trim();
    if (!listName) {
        alert("Please enter a name for the new list."); return;
    }
    if (Object.values(shoppingLists).some(list => list.name.toLowerCase() === listName.toLowerCase())) { // Case-insensitive check
         alert(`A list named "${listName}" already exists.`); return;
    }

    const newListId = generateId();
    shoppingLists[newListId] = { id: newListId, name: listName, items: [] };
    // console.log(`[createNewList] Created new list: ${listName} (${newListId})`);

    renderTabsAndContent(); // Re-render UI (includes new tab and content pane)
    updateTargetListDropdown(); // Update the main dropdown
    
    // Select the newly created list in the main dropdown
    if (targetListSelect) targetListSelect.value = newListId; 
    if (addItemsBtn) addItemsBtn.disabled = false; // Ensure add button is enabled

    saveState();
    listNameInput.value = ''; // Clear name input
    
    // Optional: Focus on the item input for the new list?
    const newItemInput = document.querySelector(`#list-tab-content-${newListId} .single-item-name-input`);
    if (newItemInput) newItemInput.focus();

}

function deleteList(listIdToDelete) {
    if (!shoppingLists[listIdToDelete]) { console.warn(`[deleteList] List ${listIdToDelete} not found.`); return; } // KEEP Warn

    const listName = shoppingLists[listIdToDelete].name;
    if (confirm(`Are you sure you want to delete the list "${listName}"? This cannot be undone.`)) {
        // console.log(`[deleteList] Deleting list: ${listName} (${listIdToDelete})`);
        const wasActive = activeListId === listIdToDelete;
        delete shoppingLists[listIdToDelete]; // Remove from data
        
        renderTabsAndContent(); // Re-render UI (removes tab and content)
        updateTargetListDropdown(); // Update main dropdown
        saveState();

        // Switch to 'Manage Lists' tab if the deleted list was the active one
        if (wasActive) {
             // console.log("[deleteList] Deleted list was active, switching to inputTab.");
            switchTab('inputTab');
        }
    } else {
        // console.log("[deleteList] Deletion cancelled by user.");
    }
}

// --- Item Parsing --- 
function parseItemString(itemStr) {
    itemStr = itemStr.trim();
    if (!itemStr) return null;

    // Regex breakdown:
    // ^(.*?)          - Group 1: Item name (non-greedy)
    // (?:\s+x(\d+))?  - Optional Group 2: space, 'x', one or more digits (quantity)
    // (?:\s+(?:cat(?:egory)?):\s*(\w+))? - Optional Group 3: space, 'cat' or 'category', ':', optional space, one or more word characters (category key)
    // $               - End of string
    // i               - Case-insensitive
    const itemRegex = /^(.*?)(?:\s+x(\d+))?(?:\s+(?:cat(?:egory)?):\s*(\w+))?$/i;
    const match = itemStr.match(itemRegex);

    let baseItem = { id: generateId(), name: itemStr.trim(), quantity: null, category: null, done: false };

    if (match) {
        baseItem.name = match[1].trim(); // Use captured name
        if (match[2]) { // If quantity was captured
            baseItem.quantity = parseInt(match[2], 10);
            // Handle potential NaN if regex somehow captures non-digits (shouldn't with \d+)
            if (isNaN(baseItem.quantity)) baseItem.quantity = null; 
        }
        if (match[3]) { // If category key was captured
            const potentialKey = match[3].toLowerCase();
            // Validate against current config ONLY if config is loaded (avoid error during initial parse)
             if (currentCategoryConfig && currentCategoryConfig[potentialKey]) {
                 baseItem.category = potentialKey;
             } else if (currentCategoryConfig && potentialKey === 'other') { // Allow 'other' to map to default
                  baseItem.category = null; // null represents the default category internally
             } else {
                  console.warn(`[parseItemString] Unknown category key "${potentialKey}" found for item "${baseItem.name}". Assigning to default.`); // KEEP Warn
                  baseItem.category = null; // Assign to default if key unknown
             }
        }
         // If no category specified, check the knownItems cache
        if (baseItem.category === null && baseItem.name) {
             const lowerName = baseItem.name.toLowerCase();
             if (knownItems[lowerName] && knownItems[lowerName].category !== null) {
                 // console.log(`[parseItemString] Auto-assigning category "${knownItems[lowerName].category}" to "${baseItem.name}" from cache.`); 
                 baseItem.category = knownItems[lowerName].category;
             }
         }

    } else {
         // Regex didn't match complex structure, assume whole string is the name
         // Check cache for category based on the full name
         const lowerName = baseItem.name.toLowerCase();
         if (knownItems[lowerName] && knownItems[lowerName].category !== null) {
             // console.log(`[parseItemString] Auto-assigning category "${knownItems[lowerName].category}" to "${baseItem.name}" from cache (simple parse).`); 
             baseItem.category = knownItems[lowerName].category;
         }
    }

    // Final quantity check: ensure it's null or > 0
    if (baseItem.quantity !== null && baseItem.quantity < 1) {
         baseItem.quantity = null;
    }

    return baseItem;
}


// --- Autocomplete Cache --- 
function buildKnownItemsCacheFromStorage() {
    // console.log("[buildKnownItemsCacheFromStorage] Building cache from storage with counts...");
    knownItems = {}; // Reset cache
    let itemsProcessed = 0;
    Object.values(shoppingLists).forEach(list => {
        list.items.forEach(item => {
            if (item.name) { 
                const lowerCaseName = item.name.toLowerCase();
                if (knownItems[lowerCaseName]) {
                    // Increment count if item already exists
                    knownItems[lowerCaseName].count++;
                    // Optionally update original name/category if the current item provides more info
                    // e.g., update if current item has a category and cached one doesn't
                    if (item.category !== null && knownItems[lowerCaseName].category === null) {
                         knownItems[lowerCaseName].category = item.category;
                         knownItems[lowerCaseName].original = item.name; // Keep original casing consistent
                    }
                    // Maybe update 'original' to the most recently added casing? Matter of preference.
                    // knownItems[lowerCaseName].original = item.name; 
                } else {
                    // Add new item with count 1
                    knownItems[lowerCaseName] = { 
                        original: item.name, 
                        category: item.category || null,
                        count: 1 
                    };
                }
                itemsProcessed++;
             }
        });
    });
     // console.log(`[buildKnownItemsCacheFromStorage] Built cache with ${Object.keys(knownItems).length} unique items (considering counts) from ${itemsProcessed} total items.`);
}

function addDefaultItemsToCache(defaultItems) {
     if (!Array.isArray(defaultItems)) {
         console.warn("[addDefaultItemsToCache] Default items data is not an array, skipping.", defaultItems); return; // KEEP Warn
     }
    let defaultsAdded = 0;
    let needsDatalistUpdate = false;
    
    defaultItems.forEach(item => {
        if (item && item.name) {
            const lowerCaseName = item.name.toLowerCase();
            // Only add default item if the item doesn't already exist in knownItems
            // OR if the existing known item has no category and the default item DOES.
            // This prevents overwriting user-categorized items with defaults.
            if (!knownItems[lowerCaseName]) {
                 knownItems[lowerCaseName] = {
                     original: item.name, // Use original casing from default file
                     category: item.category || null,
                     count: 1 // Give default items a base count
                 };
                 defaultsAdded++;
                 needsDatalistUpdate = true;
             } else if (knownItems[lowerCaseName].category === null && item.category) {
                 // Update category and original name if default provides it and user version didn't
                 knownItems[lowerCaseName].category = item.category;
                 knownItems[lowerCaseName].original = item.name;
                 // Don't reset count here, keep the user's count
                 needsDatalistUpdate = true;
             }
         } else {
            console.warn("[addDefaultItemsToCache] Skipping invalid default item:", item); // KEEP Warn
         }
    });

     // console.log(`[addDefaultItemsToCache] Added ${defaultsAdded} default items to suggestion cache.`);
     
    // // If defaults were added, repopulate ALL datalists -- REMOVED LOGIC
    // if (needsDatalistUpdate) {
    //     // console.log("[addDefaultItemsToCache] Repopulating datalists after adding defaults...");
    //     // // Update main datalist
    //     // const mainDatalist = document.getElementById('itemSuggestions');
    //     // if (mainDatalist) {
    //     //     populateItemDatalist(mainDatalist);
    //     // } else {
    //     //     console.warn("[addDefaultItemsToCache] Could not find main datalist 'itemSuggestions' to update.");
    //     // }
    //     // // Update ALL list-specific datalists
    //     // document.querySelectorAll('datalist[id^="itemSuggestions-"]').forEach(datalist => {
    //     //     populateItemDatalist(datalist);
    //     // });
    // }
}

function updateKnownItem(item) {
    if (!item || !item.name) return;
    const lowerCaseName = item.name.toLowerCase();
    let needsDatalistUpdate = false;
    
    // Update cache if:
    // 1. Item is new to the cache.
    // 2. Item has a category, and the cached version doesn't.
    if (!knownItems[lowerCaseName]) {
        // console.log(`[updateKnownItem] Adding NEW item to cache: "${item.name}" with category "${item.category || 'null'}"`);
        knownItems[lowerCaseName] = {
            original: item.name,
            category: item.category || null,
            count: 1 // Start count at 1 for new items
        };
        needsDatalistUpdate = true;
    } else {
        // Item exists, increment count
        knownItems[lowerCaseName].count++;
        // console.log(`[updateKnownItem] Incrementing count for "${item.name}" to ${knownItems[lowerCaseName].count}`);
        // Check if category needs updating (if new item provides one)
        if (item.category !== null && knownItems[lowerCaseName].category === null) {
            // console.log(`[updateKnownItem] Updating category for existing item "${item.name}" to "${item.category}"`);
            knownItems[lowerCaseName].category = item.category;
            knownItems[lowerCaseName].original = item.name; // Update original casing too?
            needsDatalistUpdate = true;
        } else if (!needsDatalistUpdate) {
            // If only count changed, we still might need to update datalist due to sorting
            needsDatalistUpdate = true; 
        }
    } // End of else block (item exists)
    
    if (needsDatalistUpdate) {
        // Update ALL list-specific datalists when cache changes
        document.querySelectorAll('datalist[id^="itemSuggestions-"]').forEach(datalist => {
            populateItemDatalist(datalist);
        });
        // // ALSO update the main datalist for the bulk input -- REMOVED as it causes warnings when inputTab is hidden
        // const mainDatalist = document.getElementById('itemSuggestions');
        // if (mainDatalist) {
        //     populateItemDatalist(mainDatalist);
        // } else {
        //     console.warn("[updateKnownItem] Could not find main datalist 'itemSuggestions' to update.");
        // }
    }
}

function populateItemDatalist(datalistElement, maxSuggestions = 15) {
    if (!datalistElement) { console.error("populateItemDatalist: datalistElement is null."); return; } // KEEP Error
    datalistElement.innerHTML = ''; // Clear old suggestions
    
    // Convert knownItems object to an array for sorting
    const itemsArray = Object.entries(knownItems).map(([key, value]) => ({ key, ...value }));

    // Sort by count (descending), then by original name (ascending)
    itemsArray.sort((a, b) => {
        const countDiff = (b.count || 0) - (a.count || 0);
        if (countDiff !== 0) {
            return countDiff;
        }
        return a.original.localeCompare(b.original);
    });

    // Take the top N suggestions
    const topSuggestions = itemsArray.slice(0, maxSuggestions);

    // Populate the datalist
    topSuggestions.forEach(itemData => {
        const option = document.createElement('option');
        option.value = itemData.original; 
        datalistElement.appendChild(option);
    });
     // console.log(`[populateItemDatalist] Populated datalist #${datalistElement.id} with ${topSuggestions.length} (max ${maxSuggestions}) items after sorting by count.`); // DEBUG
}

function populateAllDatalists() {
    // console.log("[populateAllDatalists] Populating ALL datalists...");
    // Update main datalist
    const mainDatalistElement = document.getElementById('itemSuggestions');
    if (mainDatalistElement) {
        populateItemDatalist(mainDatalistElement);
    } else {
        console.warn("[populateAllDatalists] Could not find main datalist 'itemSuggestions' to populate.");
    }
    // Update ALL list-specific datalists
    document.querySelectorAll('datalist[id^="itemSuggestions-"]').forEach(datalist => {
        populateItemDatalist(datalist);
    });
}

// ==================================================
// === DOMContentLoaded - INITIALIZATION & LISTENERS ==
// ==================================================

document.addEventListener('DOMContentLoaded', () => {
    // console.log("[DOMContentLoaded] Starting initialization...");

    // --- Assign DOM Element Variables ---
    listNameInput = document.getElementById('listNameInput');
    createListBtn = document.getElementById('createListBtn');
    targetListSelect = document.getElementById('targetListSelect');
    listInput = document.getElementById('listInput');
    addItemsBtn = document.getElementById('addItemsBtn');
    categoryListElement = document.getElementById('categoryList');
    tabContainer = document.getElementById('tabContainer');
    listContentContainer = document.getElementById('listContentContainer');
    // Find the 'Manage Lists' / Input Tab button in the main tab container
    manageListsTabButton = tabContainer ? tabContainer.querySelector('[data-tab="inputTab"]') : null; 
    categorySettingsContainer = document.getElementById('categorySettingsContainer');
    addNewCategoryBtn = document.getElementById('addNewCategoryBtn');
    saveSettingsBtn = document.getElementById('saveSettingsBtn');
    dynamicStyleSheet = createDynamicStyleSheet(); // Needs to run early
    toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
    settingsAreaWrapper = document.getElementById('settingsAreaWrapper');
    hamburgerBtn = document.getElementById('hamburgerBtn');
    mobileNavPanel = document.getElementById('mobileNavPanel');
    // Find the mobile 'Manage Lists' button inside the mobile panel
    mobileManageListsTabButton = mobileNavPanel ? mobileNavPanel.querySelector('[data-tab="inputTab"]') : null; 
    pasteBtn = document.getElementById('pasteBtn');

    // --- Check if essential elements were found ---
    let essentialElementsFound = true;
    const essentialIDs = ['listNameInput', 'createListBtn', 'targetListSelect', 'listInput', 'addItemsBtn', 'categoryList', 'tabContainer', 'listContentContainer', 'categorySettingsContainer', 'addNewCategoryBtn', 'saveSettingsBtn', 'toggleSettingsBtn', 'settingsAreaWrapper', 'hamburgerBtn', 'mobileNavPanel', 'pasteBtn'];
    essentialIDs.forEach(id => {
        if (!document.getElementById(id)) {
            console.error(`[DOMContentLoaded] CRITICAL: Essential DOM element with ID '${id}' not found!`); // KEEP Error
            essentialElementsFound = false;
        }
    });

    if (!essentialElementsFound) {
        alert("Error initializing the application: Core HTML elements are missing. Please check the HTML structure or report the issue.");
        return; // Stop initialization if core elements are missing
    }
    if (!manageListsTabButton) console.warn("[DOMContentLoaded] Desktop 'Manage Lists' button not found."); // KEEP Warn
    if (!mobileManageListsTabButton) console.warn("[DOMContentLoaded] Mobile 'Manage Lists' button not found."); // KEEP Warn

    // --- Add EXTRA check specifically for inputTab AND its datalist ---
    const checkInputContent = document.getElementById('inputTab');
    const checkDatalist = document.getElementById('itemSuggestions'); // CHECK DATALIST HERE
    // console.log("[DOMContentLoaded] Checking for #inputTab BEFORE loadState:", checkInputContent ? 'FOUND' : 'NOT FOUND!');
    // console.log("[DOMContentLoaded] Checking for #itemSuggestions BEFORE loadState:", checkDatalist ? 'FOUND' : 'NOT FOUND!'); // DEBUG
    if (!checkInputContent) {
        alert("CRITICAL HTML ERROR: The main input area container (#inputTab) is missing from index.html!");
        return;
    }
    if (!checkDatalist) { // ADDED CHECK
        alert("CRITICAL HTML ERROR: The main datalist (#itemSuggestions) for the bulk input is missing from index.html!");
        return;
    }

    // --- Add Event Listeners ---
    // console.log("[DOMContentLoaded] Adding event listeners...");

    // List Creation
    if (createListBtn) createListBtn.addEventListener('click', createNewList);
    if (listNameInput) listNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); createNewList(); } });

    // Item Adding (Bulk)
    if (addItemsBtn) addItemsBtn.addEventListener('click', addItemsToList);
    if (listInput) listInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addItemsToList(); } });
    if (pasteBtn) pasteBtn.addEventListener('click', handlePasteClick);

    // Tab Switching (Static Tabs)
    if (manageListsTabButton) manageListsTabButton.addEventListener('click', () => switchTab('inputTab'));
    if (mobileManageListsTabButton) mobileManageListsTabButton.addEventListener('click', () => switchTab('inputTab'));

    // Category Settings
    if (addNewCategoryBtn) addNewCategoryBtn.addEventListener('click', handleAddNewCategory);
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', handleSaveCategorySettings);
    if (toggleSettingsBtn) toggleSettingsBtn.addEventListener('click', handleToggleSettingsClick);

    // Hamburger Menu
    if (hamburgerBtn) hamburgerBtn.addEventListener('click', handleHamburgerClick);
    // Close mobile nav on outside click
    document.addEventListener('click', handleDocumentClick); 

    // Disable add button initially if no list selected
     if (addItemsBtn && targetListSelect && !targetListSelect.value) {
         addItemsBtn.disabled = true;
     }
      if (targetListSelect && !targetListSelect.value) { // Also disable dropdown if initially empty? Or handled by updateTargetListDropdown?
          // targetListSelect.disabled = true; // updateTargetListDropdown handles this
      }


    // --- Load State & Initial Render ---
    // console.log("[DOMContentLoaded] Calling loadState() to load data and start initial render...");
    loadState(); 

    // --- Register Service Worker ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // console.log("[DOMContentLoaded] Page loaded, attempting to register service worker...");
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('[SW] Registration successful, scope is:', registration.scope); // Keep SW logs?
                })
                .catch(err => {
                    console.error('[SW] Registration failed:', err); // KEEP Error
                });
        });
    }

    // console.log("[DOMContentLoaded] Initialization complete.");
}); // End of the single DOMContentLoaded wrapper