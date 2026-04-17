console.log("--- script.js starting execution ---"); // DEBUG VERY TOP

// ===========================================
// === GLOBAL VARIABLES & CONSTANTS ========
// ===========================================

// --- DOM Element Variables (will be assigned in DOMContentLoaded) ---
let listNameInput, createListBtn, targetListSelect, listInput, addItemsBtn, 
    categoryListElement, tabContainer, listContentContainer, manageListsTabButton, 
    categorySettingsContainer, addNewCategoryBtn, saveSettingsBtn, dynamicStyleSheet, 
    toggleSettingsBtn, settingsAreaWrapper, hamburgerBtn, mobileNavPanel, 
    mobileManageListsTabButton, pasteFromAiBtn, copyFormatAiBtn;

// --- Category Definitions --- 
const DEFAULT_CATEGORIES = {
    fruit: { name: 'Fruit', color: '#5a994a' },
    vegetables: { name: 'Vegetables', color: '#37b24d' },
    dairy: { name: 'Dairy', color: '#4a7db1' },
    beverages: { name: 'Beverages', color: '#228be6' },
    bakery: { name: 'Bakery', color: '#f08c00' },
    household: { name: 'Household', color: '#666666' },
    meat: { name: 'Meat', color: '#b15a4a' },
    snacks: { name: 'Snacks', color: '#b1a04a' },
    pantry: { name: 'Pantry', color: '#8a6d3b' },
    frozen: { name: 'Frozen', color: '#5bc0de' },
    default: { name: 'Other', color: '#4a4a4a' },
};
let currentCategoryConfig = {}; // Will be loaded or initialized

/** Adds new stock categories for users who saved config before those keys existed */
function mergeMissingDefaultCategories() {
    if (!currentCategoryConfig || typeof currentCategoryConfig !== 'object') return;
    let changed = false;
    for (const key of Object.keys(DEFAULT_CATEGORIES)) {
        if (!(key in currentCategoryConfig)) {
            currentCategoryConfig[key] = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES[key]));
            changed = true;
        }
    }
    if (changed) {
        try {
            localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(currentCategoryConfig));
        } catch (e) {
            console.warn('[mergeMissingDefaultCategories] Could not save:', e);
        }
    }
}

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
/** Long-press to edit item */
const LONG_PRESS_DURATION = 500; // milliseconds

/** Dropdown sentinel: create list from Manage Items page */
const NEW_LIST_SELECT_VALUE = '__new_list__';

/** One list at a time: hide nav, tap-only cards, Undo / Finish */
let shoppingTripListId = null;
let lastShoppingUndo = null; // { listId, itemId, wasDoneBefore }

/** Clipboard text for AI assistants — rebuilt on copy so categories match currentCategoryConfig */
function buildAiFormattingRulesText() {
    const lines = [
        'Paste & Shop — format for AI-generated lists',
        '',
        'Return the list inside a code block for easy copying.',
        '',
        'Separate items with commas, semicolons, or newlines.',
        '',
        'Optional quantity: Item Name x3',
        'Optional category: Item Name cat:category_key',
        '',
    ];
    if (!currentCategoryConfig || typeof currentCategoryConfig !== 'object') {
        lines.push('Configure categories in the app, then copy again for an up-to-date key list.');
        lines.push('');
        lines.push('Examples:');
        lines.push('Milk x2');
        lines.push('Bread cat:bakery');
        lines.push('Eggs x12 cat:dairy');
        return lines.join('\n');
    }
    const sortedKeys = Object.keys(currentCategoryConfig).sort((a, b) => {
        if (a === 'default') return 1;
        if (b === 'default') return -1;
        const nameA = currentCategoryConfig[a]?.name || '';
        const nameB = currentCategoryConfig[b]?.name || '';
        return nameA.localeCompare(nameB);
    });
    lines.push('Category keys in this app (same labels as "Available categories" on the page):');
    sortedKeys.forEach((key) => {
        const config = currentCategoryConfig[key];
        if (!config?.name) return;
        lines.push(`- ${key} (${config.name})`);
    });
    lines.push('');
    const nonDefault = sortedKeys.filter((k) => k !== 'default');
    const ex1 = nonDefault[0] || 'fruit';
    const ex2 = nonDefault[1] || 'dairy';
    lines.push('Examples:');
    lines.push('Milk x2');
    lines.push(`Bread cat:${ex1}`);
    lines.push(`Eggs x12 cat:${ex2}`);
    return lines.join('\n');
}

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

        // --- Assign Order to Lists if Missing --- 
        let maxOrder = -1;
        const listArray = Object.values(shoppingLists);
        listArray.forEach(list => {
            if (typeof list.order !== 'number' || list.order < 0) {
                list.order = -1; // Mark for assignment
            }
            if (list.order > maxOrder) {
                maxOrder = list.order;
            }
        });
        // Assign sequential order starting from maxOrder + 1 for those missing it
        listArray.filter(list => list.order === -1).forEach(list => {
            maxOrder++;
            list.order = maxOrder;
        });
        // console.log("[loadState] Assigned/verified order property for lists.");

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

        mergeMissingDefaultCategories();

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

            // Initialize SortableJS AFTER tabs are rendered and populated
            initializeSortableTabs();

            // console.log("[continueLoadSequence] Finished."); 
        });
}

// --- ID Generation --- 
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// --- Target List Dropdown --- 
function updateTargetListDropdown() {
    // Ensure elements exist
    if (!targetListSelect) { console.error("updateTargetListDropdown: targetListSelect is null"); return; } // KEEP Error
    const firstListNameInput = document.getElementById('firstListNameInput');
    if (!firstListNameInput) { console.error("updateTargetListDropdown: firstListNameInput is null"); return; } // KEEP Error
    if (!addItemsBtn) { console.warn("updateTargetListDropdown: addItemsBtn is null"); } // KEEP Warn but continue

    const currentSelection = targetListSelect.value;
    const listsExist = Object.keys(shoppingLists).length > 0;

    if (!listsExist) {
        // NO LISTS EXIST: Show input field, hide dropdown
        // console.log("[updateTargetListDropdown] No lists exist. Showing first list name input.");
        targetListSelect.classList.add('hidden');
        firstListNameInput.classList.remove('hidden');
        firstListNameInput.value = ''; // Clear any previous value
        if (addItemsBtn) addItemsBtn.disabled = true; // Disable add button initially

        // Add temporary listener to enable Add button when input has text
        firstListNameInput.oninput = () => {
            if (addItemsBtn) addItemsBtn.disabled = firstListNameInput.value.trim() === '';
        };
        const newListWrapNoLists = document.getElementById('newListFromDropdownWrap');
        if (newListWrapNoLists) newListWrapNoLists.classList.add('hidden');

    } else {
        // LISTS EXIST: Show dropdown, hide input field
        // console.log("[updateTargetListDropdown] Lists exist. Showing dropdown.");
        targetListSelect.classList.remove('hidden');
        firstListNameInput.classList.add('hidden');
        if (firstListNameInput.oninput) firstListNameInput.oninput = null; // Remove listener

        targetListSelect.innerHTML = '<option value="" disabled selected>Select list to add items to...</option>';
        // Sort by order for consistency with tabs, then name
        const sortedLists = Object.values(shoppingLists).sort((a, b) => {
            const orderDiff = (a.order || 0) - (b.order || 0);
            return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name);
        });
        let firstListId = null;

        sortedLists.forEach((list, index) => {
            if (index === 0) firstListId = list.id;
            const option = document.createElement('option');
            option.value = list.id;
            option.textContent = list.name;
            targetListSelect.appendChild(option);
        });

        const newListOpt = document.createElement('option');
        newListOpt.value = NEW_LIST_SELECT_VALUE;
        newListOpt.textContent = '+ New list…';
        targetListSelect.appendChild(newListOpt);
        
        // Restore previous selection or select first list (never leave sentinel selected)
        if (currentSelection === NEW_LIST_SELECT_VALUE) {
            if (firstListId) targetListSelect.value = firstListId;
        } else if (shoppingLists[currentSelection]) {
            targetListSelect.value = currentSelection;
        } else if (firstListId) {
             targetListSelect.value = firstListId;
        }
        
        const newListWrap = document.getElementById('newListFromDropdownWrap');
        if (newListWrap) newListWrap.classList.add('hidden');
        updateAddItemsButtonForTargetListUI();
    }
    // console.log('[updateTargetListDropdown] Finished.');
}

function isNewListDraftOpen() {
    const wrap = document.getElementById('newListFromDropdownWrap');
    return !!(wrap && !wrap.classList.contains('hidden'));
}

/** Disable Add while the “name your new list” row is open so items aren’t added to the old dropdown selection by mistake */
function updateAddItemsButtonForTargetListUI() {
    if (!addItemsBtn || !targetListSelect) return;
    if (isNewListDraftOpen()) {
        addItemsBtn.disabled = true;
        addItemsBtn.title = 'Create the new list first, or choose another list in the dropdown.';
        return;
    }
    addItemsBtn.title = '';
    addItemsBtn.disabled = !targetListSelect.value || targetListSelect.value === NEW_LIST_SELECT_VALUE;
}

function handleTargetListSelectChange() {
    if (!targetListSelect) return;
    if (targetListSelect.value === NEW_LIST_SELECT_VALUE) {
        const sortedLists = Object.values(shoppingLists).sort((a, b) => {
            const orderDiff = (a.order || 0) - (b.order || 0);
            return orderDiff !== 0 ? orderDiff : a.name.localeCompare(b.name);
        });
        if (sortedLists.length) targetListSelect.value = sortedLists[0].id;
        const wrap = document.getElementById('newListFromDropdownWrap');
        const inp = document.getElementById('newListFromDropdownInput');
        if (wrap && inp) {
            wrap.classList.remove('hidden');
            inp.value = '';
            inp.focus();
        }
    } else {
        const wrap = document.getElementById('newListFromDropdownWrap');
        if (wrap) wrap.classList.add('hidden');
    }
    updateAddItemsButtonForTargetListUI();
}

function submitNewListFromDropdown() {
    const inp = document.getElementById('newListFromDropdownInput');
    const wrap = document.getElementById('newListFromDropdownWrap');
    const name = inp ? inp.value.trim() : '';
    if (!name) {
        alert('Please enter a name for the new list.');
        if (inp) inp.focus();
        return;
    }
    const newId = createNewList(name, { stayOnManageTab: true });
    if (newId && wrap && inp) {
        wrap.classList.add('hidden');
        inp.value = '';
    }
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
// REMOVED old handlePointerDown and handlePointerUpOrLeave functions
// function handlePointerDown(event, listId, itemId) { ... }
// function handlePointerUpOrLeave(event) { ... }

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

function showAppToast(message, options = {}) {
    let t = document.getElementById('appToast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'appToast';
        t.setAttribute('role', 'status');
        document.body.appendChild(t);
    }
    const variant = options.variant ? String(options.variant).replace(/[^a-z0-9_-]/gi, '') : '';
    t.className = 'app-toast' + (variant ? ` app-toast--${variant}` : '');
    t.textContent = message;
    t.classList.add('visible');
    clearTimeout(showAppToast._tid);
    const ms = typeof options.duration === 'number' ? options.duration : 2200;
    showAppToast._tid = setTimeout(() => t.classList.remove('visible'), ms);
}

function handleCopyFormattingForAi() {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
        alert('Clipboard skriving støttes ikke i denne nettleseren.');
        return;
    }
    navigator.clipboard.writeText(buildAiFormattingRulesText().trim())
        .then(() => showAppToast('Copied formatting rules to clipboard'))
        .catch(() => alert('Kunne ikke kopiere. Sjekk tillatelser.'));
}

function ensureShoppingBanner() {
    let banner = document.getElementById('shoppingTripBanner');
    if (banner) return banner;
    banner = document.createElement('div');
    banner.id = 'shoppingTripBanner';
    banner.className = 'shopping-trip-banner';
    banner.hidden = true;
    banner.innerHTML = `
        <div class="shopping-trip-inner">
            <span class="shopping-trip-title" id="shoppingTripTitle">Shopping</span>
            <span class="shopping-trip-remaining" id="shoppingTripRemaining" aria-live="polite"></span>
            <div class="shopping-trip-actions">
                <button type="button" id="shoppingUndoBtn" class="shopping-banner-btn">Undo</button>
                <button type="button" id="shoppingFinishBtn" class="shopping-banner-btn primary">Finish</button>
            </div>
        </div>`;
    const container = document.querySelector('.container');
    if (container) container.insertBefore(banner, container.firstChild);
    else document.body.insertBefore(banner, document.body.firstChild);

    document.getElementById('shoppingUndoBtn').addEventListener('click', undoLastShoppingToggle);
    document.getElementById('shoppingFinishBtn').addEventListener('click', exitShoppingTrip);
    return banner;
}

function updateShoppingBanner(listId) {
    const banner = ensureShoppingBanner();
    const list = shoppingLists[listId];
    const titleEl = document.getElementById('shoppingTripTitle');
    const remEl = document.getElementById('shoppingTripRemaining');
    if (titleEl && list) titleEl.textContent = 'Shopping: ' + list.name;
    const remaining = list ? list.items.filter(i => !i.done).length : 0;
    if (remEl) remEl.textContent = remaining + (remaining === 1 ? ' item left' : ' items left');
    banner.hidden = false;
}

function exitShoppingTrip() {
    const lid = shoppingTripListId;
    shoppingTripListId = null;
    lastShoppingUndo = null;
    document.body.classList.remove('shopping-trip-active');
    delete document.body.dataset.shoppingListId;
    document.querySelectorAll('.list-shopping-focus').forEach(el => el.classList.remove('list-shopping-focus'));
    const banner = document.getElementById('shoppingTripBanner');
    if (banner) banner.hidden = true;
    if (lid && shoppingLists[lid]) activeListId = lid;
    renderTabsAndContent();
}

function enterShoppingTrip(listId) {
    if (!shoppingLists[listId]) return;
    shoppingTripListId = listId;
    lastShoppingUndo = null;
    activeListId = listId;
    document.body.classList.add('shopping-trip-active');
    document.body.dataset.shoppingListId = listId;
    document.querySelectorAll('.list-shopping-focus').forEach(el => el.classList.remove('list-shopping-focus'));
    const pane = document.getElementById(`list-tab-content-${listId}`);
    if (pane) pane.classList.add('list-shopping-focus');
    ensureShoppingBanner();
    updateShoppingBanner(listId);
    syncAllStartFinishButtons();
    renderItemsForList(listId);
    switchTab(`list-${listId}`);
}

function syncAllStartFinishButtons() {
    document.querySelectorAll('[id^="startShoppingBtn-"]').forEach(btn => {
        const id = btn.id.replace('startShoppingBtn-', '');
        const isThisTrip = shoppingTripListId === id;
        btn.innerHTML = isThisTrip
            ? '<i class="fas fa-flag-checkered"></i> Finish'
            : '<i class="fas fa-shopping-cart"></i> Start';
        btn.title = isThisTrip ? 'Avslutt handletur og lås opp faner' : 'Start handletur (kun denne listen, ingen bytte av fane)';
        btn.classList.toggle('finish-shopping-btn', isThisTrip);
    });
}

function undoLastShoppingToggle() {
    if (!lastShoppingUndo || !shoppingTripListId) return;
    const { listId, itemId, wasDoneBefore } = lastShoppingUndo;
    const list = shoppingLists[listId];
    if (!list) return;
    const item = list.items.find(i => i.id === itemId);
    if (item) {
        item.done = wasDoneBefore;
        saveState();
        renderItemsForList(listId, itemId);
    }
    lastShoppingUndo = null;
    updateShoppingBanner(listId);
}

// --- Tab Management --- 
function switchTab(targetTabId) {
    if (shoppingTripListId) {
        const allowed = targetTabId === `list-${shoppingTripListId}`;
        if (!allowed) return;
    }
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
    
    tabContainer.innerHTML = ''; // Clear existing desktop tabs
    mobileNavPanel.innerHTML = ''; // Clear existing mobile tabs

    // Add the static "Manage Items" tab first
    const manageItemsDesktopTab = createTabElement("Manage Items", 'inputTab', activeListId === null || activeListId === 'inputTab');
    tabContainer.appendChild(manageItemsDesktopTab);
    const manageItemsMobileTab = createTabElement("Manage Items", 'inputTab', activeListId === null || activeListId === 'inputTab', true);
    mobileNavPanel.appendChild(manageItemsMobileTab);

    // Add container for sortable desktop list tabs
    const desktopListTabContainer = document.createElement('div');
    desktopListTabContainer.id = 'desktop-list-tabs';
    desktopListTabContainer.classList.add('sortable-list-tabs');
    tabContainer.appendChild(desktopListTabContainer);

    // Add container for sortable mobile list tabs
    const mobileListTabContainer = document.createElement('div');
    mobileListTabContainer.id = 'mobile-list-tabs';
    mobileListTabContainer.classList.add('sortable-list-tabs');
    mobileNavPanel.appendChild(mobileListTabContainer);

    // Get lists and sort them by the 'order' property
    const sortedLists = Object.values(shoppingLists).sort((a, b) => (a.order || 0) - (b.order || 0));

    // Clear old content panes *before* potentially creating new ones
    if (listContentContainer) listContentContainer.innerHTML = '';

    // Create tabs and content structures for each list
    sortedLists.forEach(list => {
        const isActive = activeListId === list.id;
        const desktopTab = createTabElement(list.name, `list-${list.id}`, isActive);
        desktopTab.dataset.listId = list.id; // Add listId for sortable
        desktopListTabContainer.appendChild(desktopTab); // Append to specific container

        const mobileTab = createTabElement(list.name, `list-${list.id}`, isActive, true);
        mobileTab.dataset.listId = list.id; // Add listId for sortable
        mobileListTabContainer.appendChild(mobileTab); // Append to specific container

        // Ensure content structure exists (important for sortable)
        renderListContentStructure(list);
    });

    // Add the '+' button after the list tab containers
    const addListDesktopBtn = createAddListButton(false);
    tabContainer.appendChild(addListDesktopBtn);
    const addListMobileBtn = createAddListButton(true);
    mobileNavPanel.appendChild(addListMobileBtn);

    // ** Re-render items for ALL lists after structure is built **
    Object.keys(shoppingLists).forEach(listId => {
        renderItemsForList(listId);
    });

    // Determine which tab should be active after re-render
    let targetTabIdToActivate;
    if (shoppingTripListId && shoppingLists[shoppingTripListId]) {
        targetTabIdToActivate = `list-${shoppingTripListId}`;
    } else if (inputTabWasActive) {
        targetTabIdToActivate = 'inputTab';
    } else if (previouslyActiveListId && shoppingLists[previouslyActiveListId]) {
        targetTabIdToActivate = `list-${previouslyActiveListId}`;
    } else if (sortedLists.length > 0) {
        targetTabIdToActivate = `list-${sortedLists[0].id}`;
    } else {
        targetTabIdToActivate = 'inputTab';
    }
    
    // console.log(`[renderTabsAndContent] Determined target tab to activate: ${targetTabIdToActivate}`); 
    switchTab(targetTabIdToActivate);
    syncAllStartFinishButtons();
    if (shoppingTripListId && shoppingLists[shoppingTripListId]) {
        const pane = document.getElementById(`list-tab-content-${shoppingTripListId}`);
        if (pane) pane.classList.add('list-shopping-focus');
        updateShoppingBanner(shoppingTripListId);
    } 
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
        contentDiv.dataset.listPaneId = list.id;
        
        // Add List Name Heading
        const heading = document.createElement('h2');
        heading.textContent = list.name;
        heading.classList.add('list-pane-title');
        contentDiv.appendChild(heading);

        const actionBtnContainer = document.createElement('div');
        actionBtnContainer.classList.add('list-action-buttons');

        const startShoppingBtn = document.createElement('button');
        startShoppingBtn.type = 'button';
        startShoppingBtn.id = `startShoppingBtn-${list.id}`;
        startShoppingBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Start';
        startShoppingBtn.title = 'Start handletur (låser faner til du trykker Finish)';
        startShoppingBtn.classList.add('action-btn', 'start-shopping-btn');
        startShoppingBtn.addEventListener('click', () => {
            if (shoppingTripListId === list.id) {
                exitShoppingTrip();
            } else if (!shoppingTripListId) {
                enterShoppingTrip(list.id);
            }
        });
        actionBtnContainer.appendChild(startShoppingBtn);

        contentDiv.appendChild(actionBtnContainer);

        // Active Items Container 
        const activeContainer = document.createElement('div');
        activeContainer.className = 'list-container active-list-items'; 
        activeContainer.id = `activeListContainer-${list.id}`;
        contentDiv.appendChild(activeContainer);

        // --- Create Single Item Add Section (MOVED) --- 
        const singleAddSection = document.createElement('div');
        singleAddSection.classList.add('input-area', 'add-single-item-section', 'list-edit-only');
        singleAddSection.dataset.listId = list.id; 
        // --- Start of moved block --- (Copied from original location)
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Add item...'; // Changed placeholder slightly
        nameInput.required = true;
        nameInput.classList.add('single-item-name-input');
        nameInput.setAttribute('list', `itemSuggestions-${list.id}`); 
        singleAddSection.appendChild(nameInput);

        const datalist = document.createElement('datalist');
        datalist.id = `itemSuggestions-${list.id}`;
        singleAddSection.appendChild(datalist);
        populateItemDatalist(datalist); // Keep population here

        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.placeholder = 'Qty';
        qtyInput.min = '1';
        qtyInput.style.maxWidth = '60px'; // Adjusted width slightly
        qtyInput.classList.add('single-item-qty-input');
        singleAddSection.appendChild(qtyInput);

        const categorySelect = document.createElement('select');
        categorySelect.classList.add('single-item-category-select');
        populateSingleItemCategorySelect(categorySelect); 
        singleAddSection.appendChild(categorySelect);

        const addButton = document.createElement('button');
        addButton.textContent = '+';
        addButton.title = 'Add Item';
        addButton.classList.add('add-single-item-btn');
        addButton.addEventListener('click', () => {
            addSingleItem(list.id, nameInput, qtyInput, categorySelect);
        });

        nameInput.addEventListener('input', (e) => { // Keep category prefill
            const enteredNameLower = e.target.value.toLowerCase();
            const knownData = knownItems[enteredNameLower]; 
            if (knownData !== undefined) { 
                categorySelect.value = knownData.category === null ? '' : knownData.category;
            }
        });
        nameInput.addEventListener('keypress', (e) => { // Keep add via Enter
             if (e.key === 'Enter') {
                 e.preventDefault();
                 addSingleItem(list.id, nameInput, qtyInput, categorySelect);
             }
         });
        singleAddSection.appendChild(addButton);
         // --- End of moved block ---
        contentDiv.appendChild(singleAddSection); // Append AFTER active items container

        // Completed Items Section Structure
        const completedSection = document.createElement('div');
        completedSection.classList.add('list-section', 'completed-list', 'list-edit-only');
         const completedHeading = document.createElement('h3'); 
        completedHeading.textContent = 'Completed Items';
        completedSection.appendChild(completedHeading);
        const completedContainer = document.createElement('div');
        completedContainer.classList.add('list-container');
        completedContainer.id = `completedListContainer-${list.id}`;
        completedSection.appendChild(completedContainer);

        // Add "Clear Completed" button inside the completed section
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear Completed Items';
        clearBtn.classList.add('clear-completed-btn');
        clearBtn.dataset.listId = list.id;
        clearBtn.style.display = 'none'; // Initially hidden
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent potential event bubbling
            clearCompletedItems(list.id);
        });
        completedSection.appendChild(clearBtn);
        // Add completed section to the content div
        contentDiv.appendChild(completedSection);
        
        // Delete List Button
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.classList.add('delete-list-btn', 'list-edit-only');
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
    const shoppingThisList = shoppingTripListId === listId;

    const completedSection = completedContainer.closest('.completed-list');
    if (shoppingThisList) {
        if (completedSection) completedSection.style.display = 'none';
        completedContainer.innerHTML = '';
    } else if (completedSection) {
        completedSection.style.display = '';
    }

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
    const clearCompletedBtn = completedSection ? completedSection.querySelector('.clear-completed-btn') : null;

    if (!shoppingThisList && completedItems.length > 0) {
        if (completedSection) completedSection.style.display = '';
        if (clearCompletedBtn) clearCompletedBtn.style.display = '';
        completedItems.forEach(item => {
            const card = createItemCard(item, listId, poppedItemId === item.id); 
            completedContainer.appendChild(card);
        });
    } else if (!shoppingThisList) {
        if (completedSection) completedSection.style.display = 'none'; 
        if (clearCompletedBtn) clearCompletedBtn.style.display = 'none';
    }
    // console.log(`[renderItemsForList] Finished rendering items for list: ${listId}`);
}


// --- Card Creation ---
// Corrected version
function createItemCard(item, listId, isPoppingIn = false) {
    const card = document.createElement('div');
    // Apply base classes: item-card, category-*, done
    card.className = `item-card category-${item.category || 'default'} ${item.done ? 'done' : ''}`;
    card.dataset.itemId = item.id;
    card.dataset.listId = listId; // Store listId for handlers

    card.addEventListener(
        'selectstart',
        (e) => {
            e.preventDefault();
        },
        false
    );
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // --- Apply Pop-in animation if needed ---
    if (isPoppingIn) {
        // console.log(`[createItemCard] Applying pop-in to item ${item.id}`);
        // Determine animation based on done state
        const animationClass = item.done ? 'sliding-to-completed' : 'sliding-from-completed';
        card.classList.add(animationClass);
        // Remove animation class after animation ends
        card.addEventListener('animationend', () => {
            card.classList.remove('popping-in', 'sliding-to-completed', 'sliding-from-completed'); // Remove all potential animation classes
        }, { once: true });
    }

    const cardContent = document.createElement('div');
    cardContent.classList.add('item-card-content'); // Wrapper for name/qty

    const itemName = document.createElement('span');
    itemName.classList.add('item-name');
    itemName.textContent = item.name;
    cardContent.appendChild(itemName);

    if (item.quantity) { // Show quantity if it exists (could be 1 or more)
        const itemQuantity = document.createElement('span');
        itemQuantity.classList.add('item-quantity');
        itemQuantity.textContent = ` x${item.quantity}`;
        cardContent.appendChild(itemQuantity);
    }

    card.appendChild(cardContent);

    // --- Controls (No visible controls; Edit via Long Press) ---
    // const cardControls = document.createElement('div');
    // cardControls.classList.add('item-card-controls');
    
    // // Delete Button - REMOVED
    // const deleteBtn = document.createElement('button');
    // deleteBtn.classList.add('delete-item-btn');
    // deleteBtn.textContent = 'X';
    // deleteBtn.title = 'Delete Item';
    // deleteBtn.addEventListener('click', (e) => { ... });
    // cardControls.appendChild(deleteBtn);

    // card.appendChild(cardControls);

    // --- Event Listeners for Interaction ---
    // longPressDetected is cleared before the synthetic click fires — use suppressNextCardClick instead.
    let longPressDetected = false;
    let suppressNextCardClick = false;
    let suppressClearTimer = null;

    card.addEventListener('click', (ev) => {
        if (suppressNextCardClick) {
            suppressNextCardClick = false;
            ev.preventDefault();
            ev.stopPropagation();
            return;
        }
        if (!card.classList.contains('editing') && !longPressDetected) {
            toggleItemDone(listId, item.id);
        }
    });

    // Long press detection (ONLY for ACTIVE items triggers edit); disabled during shopping trip
    let pressTimer = null;
    /** True once the long-press timer has opened the edit modal (still holding finger) */
    let openedEditWhileHolding = false;
    const shoppingFocus = shoppingTripListId === listId;

    const startPress = (e) => {
        if (shoppingFocus) return;
        // Only start timer for ACTIVE items
        if (!item.done) {
            // console.log(`[startPress] Active item: ${item.name}, Type: ${e.type}`);
            longPressDetected = false; // Reset flag on new press start
            openedEditWhileHolding = false;
            clearTimeout(pressTimer); // Clear any lingering timer
            pressTimer = setTimeout(() => {
                longPressDetected = true; // Set flag when timer completes
                // console.log(`[startPress] Long press timeout reached for: ${item.name}`);
                if (navigator.vibrate) navigator.vibrate(50);
                card.classList.add('long-press-active'); // Add visual feedback
                openedEditWhileHolding = true;
                suppressNextCardClick = true;
                clearTimeout(suppressClearTimer);
                suppressClearTimer = setTimeout(() => {
                    suppressNextCardClick = false;
                }, 600);
                startItemEdit(listId, item.id);
            }, LONG_PRESS_DURATION);
        }
    };

    const endPress = (e) => {
        if (shoppingFocus) return;
        clearTimeout(pressTimer);
        pressTimer = null;
        card.classList.remove('long-press-active'); // Remove feedback style

        if (openedEditWhileHolding) {
            openedEditWhileHolding = false;
            longPressDetected = false;
            e.stopPropagation();
            e.preventDefault();
            return;
        }

        longPressDetected = false;
    };

    const cancelPress = () => {
         if (shoppingFocus) return;
         clearTimeout(pressTimer);
         pressTimer = null;
         card.classList.remove('long-press-active');
         if (!openedEditWhileHolding) {
             longPressDetected = false;
         }
    };

    if (!shoppingFocus) {
        card.addEventListener('mousedown', startPress);
        card.addEventListener('touchstart', startPress, { passive: true });
        card.addEventListener('mouseup', endPress);
        card.addEventListener('mouseleave', cancelPress);
        card.addEventListener('touchend', endPress);
        card.addEventListener('touchcancel', cancelPress);
    }

    return card;
} // End of createItemCard

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
        const wasDone = item.done; 
        item.done = !item.done;

        if (shoppingTripListId === listId) {
            lastShoppingUndo = { listId, itemId, wasDoneBefore: wasDone };
            updateShoppingBanner(listId);
        }
        
        // If item was moved from completed back to active, increment its count
        if (wasDone && !item.done) {
            updateKnownItem(item); // Update cache count
        } // No 'else' needed here anymore
        
        // ALWAYS save state after toggling 'done' status
        saveState(); 
        
        // Always re-render the list after the state change
        renderItemsForList(listId, itemId);

        const justCheckedOff = !wasDone && item.done;
        const onShoppingTripForThisList = shoppingTripListId === listId;
        if (
            justCheckedOff &&
            onShoppingTripForThisList &&
            list.items.length > 0 &&
            list.items.every((i) => i.done)
        ) {
            setTimeout(() => {
                showAppToast(`Good job — everything on "${list.name}" is checked off!`, {
                    variant: 'celebrate',
                    duration: 4200,
                });
            }, 120);
        }
    }, 300); 
}


// --- Item Input / Parsing / Adding --- 
function addItemsToList() {
    const firstListNameInput = document.getElementById('firstListNameInput');
    const isFirstListScenario = firstListNameInput && !firstListNameInput.classList.contains('hidden');
    let targetListId = null;

    // console.log(`[addItemsToList] Triggered. isFirstListScenario: ${isFirstListScenario}`);

    if (isFirstListScenario) {
        // --- Scenario: Create First List --- 
        const firstListName = firstListNameInput.value.trim();
        if (!firstListName) {
            alert("Please enter a name for the first list."); 
            firstListNameInput.focus();
            return;
        }
        // console.log(`[addItemsToList] Attempting to create first list: "${firstListName}"`);
        const newListId = createNewList(firstListName);
        if (!newListId) {
            // createNewList shows its own alerts (e.g., duplicate)
            firstListNameInput.focus();
            return; // Stop if list creation failed
        }
        targetListId = newListId; // Set target ID for adding items
        // updateTargetListDropdown() will be called by createNewList via renderTabsAndContent,
        // switching back to the dropdown view automatically.
        // console.log(`[addItemsToList] First list created with ID: ${targetListId}`);
    } else {
        // --- Scenario: Add to Existing List --- 
        if (!targetListSelect) { console.error("addItemsToList: targetListSelect missing."); return; } // KEEP Error
        if (isNewListDraftOpen()) {
            alert('Finish creating your new list first (click Create list), or choose another list in the dropdown.');
            return;
        }
        targetListId = targetListSelect.value;
        if (!targetListId || targetListId === NEW_LIST_SELECT_VALUE) {
            alert('Choose a list in the dropdown (or finish creating a new list there).');
            return;
        }
        // console.log(`[addItemsToList] Adding items to existing list ID: ${targetListId}`);
    }

    // --- Common Logic: Parse and Add Items --- 
    if (!listInput) { console.error("addItemsToList: listInput missing."); return; } // KEEP Error
    const currentList = shoppingLists[targetListId];
    if (!currentList) { 
        alert(`Error: Could not find list with ID ${targetListId}. Please refresh.`); 
        return; 
    }

    const inputText = listInput.value;
    const itemsArray = inputText.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    const newItems = itemsArray.map(parseItemString).filter(item => item !== null);
    
    if (newItems.length === 0 && inputText.trim() !== '') {
        alert("Could not parse any valid items from the input.");
        return;
    } else if (newItems.length === 0) {
        alert("Please enter items to add.");
        return;
    }

    let addedCount = 0;
    let skippedCount = 0;
    for (const newItem of newItems) {
        const exists = currentList.items.some(existingItem => 
            existingItem.name.toLowerCase() === newItem.name.toLowerCase() && 
            existingItem.category === newItem.category && 
            existingItem.quantity === newItem.quantity &&
            !existingItem.done 
        );
        if (!exists) {
            currentList.items.push(newItem);
            // Pass list ID to updateKnownItem for context if needed later?
            updateKnownItem(newItem); 
            addedCount++;
        } else {
             skippedCount++;
         }
    } 

    if (addedCount > 0) {
        renderItemsForList(targetListId); 
        saveState(); 
        listInput.value = ''; // Clear item input
        if (!isFirstListScenario) {
            switchTab(`list-${targetListId}`); // Switch only if not creating first list (createNewList handles that)
        }
    } else if (skippedCount > 0 && addedCount === 0) {
        alert("All items entered were already on the active list.");
    } else {
        // Should not happen based on earlier check, but as a fallback:
         alert("No items were added.");
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
// options.stayOnManageTab — stay on "Manage Items" instead of switching to the new list tab (+ button / dropdown)
function createNewList(listName, options = {}) {
    const stayOnManageTab = !!options.stayOnManageTab;
     // console.log(`[createNewList] Attempting to create list: "${listName}"`);
    listName = listName.trim(); // Ensure trimmed
    if (!listName) {
        alert("Please enter a name for the new list."); 
        return false; // Indicate failure
    }
    // Case-insensitive duplicate check
    if (Object.values(shoppingLists).some(list => list.name.toLowerCase() === listName.toLowerCase())) { 
         alert(`A list named "${listName}" already exists.`); 
         return false; // Indicate failure (duplicate)
    }

    const newListId = generateId();
    // Find the highest current order number
    const maxExistingOrder = Object.values(shoppingLists).reduce((max, list) => Math.max(max, list.order || 0), -1);
    shoppingLists[newListId] = { id: newListId, name: listName, items: [], order: maxExistingOrder + 1 };
    // console.log(`[createNewList] Created new list: ${listName} (${newListId}) with order ${shoppingLists[newListId].order}`);

    renderTabsAndContent(); // Re-render UI (includes new tab and content pane)
    updateTargetListDropdown(); // Update the main dropdown
    
    // Select the newly created list in the main dropdown
    if (targetListSelect) targetListSelect.value = newListId; 
    if (addItemsBtn) addItemsBtn.disabled = false; // Ensure add button is enabled

    saveState();
    // listNameInput.value = ''; // No longer needed as input is handled elsewhere
    
    if (stayOnManageTab) {
        switchTab('inputTab');
    } else {
        switchTab(`list-${newListId}`);
    }

    return newListId;
}

function deleteList(listIdToDelete) {
    if (!shoppingLists[listIdToDelete]) { console.warn(`[deleteList] List ${listIdToDelete} not found.`); return; } // KEEP Warn

    const listName = shoppingLists[listIdToDelete].name;
    if (confirm(`Are you sure you want to delete the list "${listName}"? This cannot be undone.`)) {
        // console.log(`[deleteList] Deleting list: ${listName} (${listIdToDelete})`);
        if (shoppingTripListId === listIdToDelete) {
            shoppingTripListId = null;
            lastShoppingUndo = null;
            document.body.classList.remove('shopping-trip-active');
            delete document.body.dataset.shoppingListId;
            const banner = document.getElementById('shoppingTripBanner');
            if (banner) banner.hidden = true;
            document.querySelectorAll('.list-shopping-focus').forEach(el => el.classList.remove('list-shopping-focus'));
        }
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

// --- Add List Input Display --- 
let tempInputCleanup = null; // Function to remove temp input if user cancels

function showCreateListInput(buttonElement) {
    // Prevent showing multiple inputs if already visible
    if (document.getElementById('tempListInputContainer')) {
        return; 
    }

    buttonElement.style.display = 'none'; // Hide the '+' button

    const container = document.createElement('div');
    container.id = 'tempListInputContainer';
    container.classList.add('temp-input-container'); // For potential styling

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'tempListNameInput';
    input.placeholder = 'New list name...';
    input.classList.add('temp-list-name-input');

    const createBtn = document.createElement('button');
    createBtn.textContent = '+'; // Use plus symbol
    createBtn.title = 'Create List'; // Add title for clarity
    createBtn.id = 'tempCreateListBtn';
    createBtn.classList.add('temp-create-list-btn');

    container.appendChild(input);
    container.appendChild(createBtn);

    // Insert the container right after the hidden button
    buttonElement.parentNode.insertBefore(container, buttonElement.nextSibling);

    input.focus();

    // --- Event Listeners for Creation ---
    const handleCreate = () => {
        const listName = input.value.trim();
        if (listName) {
            handleCreateListFromTempInput(listName, container, buttonElement);
        } else {
            alert("Please enter a name for the new list.");
            input.focus();
        }
    };

    createBtn.addEventListener('click', handleCreate);
    input.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent potential form submission
            handleCreate();
        }
    });

    // --- Logic for handling clicks outside the input container ---
    const handleClickOutside = (event) => {
        if (container && !container.contains(event.target) && event.target !== buttonElement) {
            // Click was outside the temp container and not on the original button
            // console.log("[handleClickOutside] Click detected outside temp input. Cleaning up.");
            if (tempInputCleanup) {
                tempInputCleanup();
            }
        }
    };

    // Add Escape listener to input and click outside listener to document
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            // console.log("[Escape Key] Detected. Cleaning up temp input.");
            if (tempInputCleanup) {
                tempInputCleanup();
            }
        }
    });
    // Add click listener AFTER a tiny delay to prevent the initial button click from triggering it immediately
    setTimeout(() => {
         document.addEventListener('click', handleClickOutside);
         // console.log("[showCreateListInput] Added click outside listener.");
    }, 0);


    // --- Enhanced Cleanup Function --- 
    tempInputCleanup = () => {
         document.removeEventListener('click', handleClickOutside); // REMOVE click listener
         // console.log("[tempInputCleanup] Removed click outside listener.");
         if (container && container.parentNode) {
            container.remove();
         }
         buttonElement.style.display = ''; // Show the '+' button again
         tempInputCleanup = null; // Reset cleanup function
    };
}

function handleCreateListFromTempInput(listName, inputContainer, originalButton) {
     // console.log(`[handleCreateListFromTempInput] Attempting to create list: "${listName}"`);
    
     const success = createNewList(listName, { stayOnManageTab: true });

     if (success) {
         // console.log("[handleCreateListFromTempInput] List created successfully. Cleaning up input.");
         if (tempInputCleanup) {
            tempInputCleanup(); // Remove temp input and show '+' button again
         }
     } else {
         // console.log("[handleCreateListFromTempInput] List creation failed (e.g., duplicate name). Input remains visible.");
         // Optionally re-focus the input field if creation failed
         const inputField = inputContainer.querySelector('#tempListNameInput');
         if (inputField) {
             inputField.focus();
             inputField.select(); // Select text for easy correction
         }
     }
}

// --- Clear Completed Items --- 
function clearCompletedItems(listId) {
    const list = shoppingLists[listId];
    if (!list) { console.error(`[clearCompletedItems] List not found: ${listId}`); return; } // KEEP Error

    const completedCount = list.items.filter(item => item.done).length;
    if (completedCount === 0) {
        alert("There are no completed items to clear.");
        return;
    }

    if (confirm(`Are you sure you want to permanently delete all ${completedCount} completed items from this list?`)) {
        // console.log(`[clearCompletedItems] Clearing ${completedCount} completed items from list ${listId}`);
        // Keep only the items that are NOT done
        list.items = list.items.filter(item => !item.done);
        saveState();
        renderItemsForList(listId);
    }
}

// --- Item Editing (Revised for Modal) --- 
// Global reference to the currently edited item's IDs
let currentlyEditing = null; 
// Global reference to modal elements (assigned in DOMContentLoaded)
let editItemModal, editNameInput, editQtyInput, editCategorySelect, editModalSaveBtn, editModalCancelBtn;

function startItemEdit(listId, itemId) {
    console.log(`[startItemEdit - Modal] Triggered for item ${itemId} in list ${listId}`);
    const list = shoppingLists[listId];
    if (!list) { console.error(`[startItemEdit] List not found: ${listId}`); return; }
    const itemIndex = list.items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) { console.error(`[startItemEdit] Item data not found for item ${itemId}`); return; }
    const item = list.items[itemIndex];

    currentlyEditing = { listId, itemId }; // Store reference

    // Populate modal fields (Ensure modal elements are assigned in DOMContentLoaded)
    if (editNameInput) editNameInput.value = item.name;
    if (editQtyInput) editQtyInput.value = item.quantity || '';
    if (editCategorySelect) {
        populateSingleItemCategorySelect(editCategorySelect); // Ensure options are up-to-date
        editCategorySelect.value = item.category || '';
    }
    
    // Show the modal (Implementation assumes modal element exists)
    if (editItemModal) {
        editItemModal.style.display = 'flex'; // Or 'block'
        // Focus first field
        if(editNameInput) editNameInput.focus();
    } else {
        console.error("[startItemEdit] Edit modal element not found!");
    }
} 

function handleSaveItemEdit(/* Reads from modal/global state */) {
    console.log(`[handleSaveItemEdit - Modal] Save triggered.`);
    if (!currentlyEditing) return;
    
    // Ensure modal elements are available
    if (!editNameInput || !editQtyInput || !editCategorySelect) {
        console.error("[handleSaveItemEdit] Modal input elements not found!");
        return;
    }

    const { listId, itemId } = currentlyEditing;

    // --- Get values from MODAL --- 
    const newName = editNameInput.value.trim();
    const qtyValue = editQtyInput.value.trim();
    const newQuantity = qtyValue ? parseInt(qtyValue, 10) : null; 
    const newCategory = editCategorySelect.value || null; 

    // --- Validate --- 
    if (!newName) {
        alert("Item name cannot be empty.");
        editNameInput.focus();
        return; // Keep modal open
    }
    if (newQuantity !== null && (isNaN(newQuantity) || newQuantity < 1)) {
        alert("Quantity must be a positive number or empty.");
        editQtyInput.focus();
        return; // Keep modal open
    }

    // --- Update Data --- 
    const list = shoppingLists[listId];
    if (!list) { console.error("Save Error: List not found"); hideEditModal(); return; } 
    const itemIndex = list.items.findIndex(i => i.id === itemId);
    if (itemIndex === -1) { console.error("Save Error: Item not found"); hideEditModal(); return; } 

    const itemToUpdate = list.items[itemIndex];
    const changed = itemToUpdate.name !== newName || itemToUpdate.quantity !== newQuantity || itemToUpdate.category !== newCategory;

    if (changed) {
        itemToUpdate.name = newName;
        itemToUpdate.quantity = newQuantity;
        itemToUpdate.category = newCategory;
        updateKnownItem(itemToUpdate); 
        saveState();
        hideEditModal(); 
        renderItemsForList(listId); 
    } else {
        // console.log("[handleSaveItemEdit] No changes detected.");
        hideEditModal(); // Close modal even if no changes
    }
}

// Function to hide the modal
function hideEditModal() {
     // console.log("[hideEditModal] Hiding modal.");
     if (editItemModal) {
         editItemModal.style.display = 'none';
     }
     currentlyEditing = null; // Clear reference
}

/** Step quantity in edit modal: empty field = no quantity; minus from 1 clears */
function adjustEditItemQuantity(delta) {
    const input = document.getElementById('editQtyInput');
    if (!input) return;
    const raw = input.value.trim();
    const parsed = raw === '' ? 0 : parseInt(raw, 10);
    const current = Number.isNaN(parsed) ? 0 : parsed;
    const next = current + delta;
    input.value = next < 1 ? '' : String(next);
}

// --- Helper function to create tabs --- 
function createTabElement(text, tabId, isActive, isMobile = false) {
    const button = document.createElement('button');
    button.textContent = text;
    button.dataset.tab = tabId;
    button.type = 'button';
    button.className = isMobile ? 'tab-button mobile-tab-button' : 'tab-button';
    if (tabId.startsWith('list-')) button.classList.add('list-tab-button');
    if (isActive) button.classList.add('active');
    button.addEventListener('click', () => switchTab(tabId));
    return button;
}

// --- Helper function to create Add List buttons ---
function createAddListButton(isMobile) {
     const button = document.createElement('button');
     button.textContent = isMobile ? '+ Add New List' : '+';
     button.title = 'Create New List';
     button.className = isMobile ? 'mobile-tab-button add-tab-btn' : 'tab-button add-tab-btn';
     button.id = isMobile ? 'addListMobileBtn' : 'addListTabBtn';
     button.addEventListener('click', () => showCreateListInput(button));
     return button;
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
    pasteFromAiBtn = document.getElementById('pasteFromAiBtn');
    copyFormatAiBtn = document.getElementById('copyFormatAiBtn');
    // Add list buttons
    const addListTabBtn = document.getElementById('addListTabBtn');
    const addListMobileBtn = document.getElementById('addListMobileBtn');
    // Edit Modal elements
    editItemModal = document.getElementById('editItemModal');
    editNameInput = document.getElementById('editNameInput');
    editQtyInput = document.getElementById('editQtyInput');
    editCategorySelect = document.getElementById('editCategorySelect');
    editModalSaveBtn = document.getElementById('editModalSaveBtn');
    editModalCancelBtn = document.getElementById('editModalCancelBtn');

    // --- Check if essential elements were found ---
    const essentialIDs = ['targetListSelect', 'listInput', 'addItemsBtn', 'categoryList', 'tabContainer', 'listContentContainer', 'categorySettingsContainer', 'addNewCategoryBtn', 'saveSettingsBtn', 'toggleSettingsBtn', 'settingsAreaWrapper', 'hamburgerBtn', 'mobileNavPanel', 'pasteFromAiBtn', 'copyFormatAiBtn'];
    const missingIds = essentialIDs.filter((id) => !document.getElementById(id));
    missingIds.forEach((id) => {
        console.error(`[DOMContentLoaded] CRITICAL: Essential DOM element with ID '${id}' not found!`); // KEEP Error
    });

    if (missingIds.length) {
        alert(
            `Error initializing the application: missing HTML elements (${missingIds.join(', ')}). Often caused by an old offline cache or service worker for the wrong site path — try Ctrl+F5, or DevTools → Application → Service Workers → Unregister, then reload.`
        );
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

    // Item Adding (Bulk)
    if (addItemsBtn) addItemsBtn.addEventListener('click', addItemsToList);
    if (listInput) listInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addItemsToList(); } });
    if (pasteFromAiBtn) pasteFromAiBtn.addEventListener('click', handlePasteClick);
    if (copyFormatAiBtn) copyFormatAiBtn.addEventListener('click', handleCopyFormattingForAi);
    if (targetListSelect) targetListSelect.addEventListener('change', handleTargetListSelectChange);
    const newListFromDropdownBtnEl = document.getElementById('newListFromDropdownBtn');
    const newListFromDropdownInputEl = document.getElementById('newListFromDropdownInput');
    if (newListFromDropdownBtnEl) newListFromDropdownBtnEl.addEventListener('click', submitNewListFromDropdown);
    if (newListFromDropdownInputEl) {
        newListFromDropdownInputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitNewListFromDropdown();
            }
        });
    }

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

    // Add List Buttons
    if (addListTabBtn) {
        addListTabBtn.addEventListener('click', () => showCreateListInput(addListTabBtn));
    } else { console.warn("[DOMContentLoaded] Add List Tab button not found."); } // KEEP Warn
    if (addListMobileBtn) {
        addListMobileBtn.addEventListener('click', () => showCreateListInput(addListMobileBtn));
    } else { console.warn("[DOMContentLoaded] Add List Mobile button not found."); } // KEEP Warn

    // --- Initial Load ---
    // console.log("[DOMContentLoaded] Calling loadState() to load data and start initial render...");
    loadState(); 

    // --- Register Service Worker ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // console.log("[DOMContentLoaded] Page loaded, attempting to register service worker...");
            const swUrl = new URL('sw.js', window.location.href);
            navigator.serviceWorker.register(swUrl.href)
                .then(registration => {
                    console.log('[SW] Registration successful, scope is:', registration.scope); // Keep SW logs?
                })
                .catch(err => {
                    console.error('[SW] Registration failed:', err); // KEEP Error
                });
        });
    }

    // Edit Modal Listeners
    if (editModalSaveBtn) {
        editModalSaveBtn.addEventListener('click', handleSaveItemEdit); 
    }
    if (editModalCancelBtn) {
        editModalCancelBtn.addEventListener('click', hideEditModal);
    }
    const editQtyMinusBtn = document.getElementById('editQtyMinusBtn');
    const editQtyPlusBtn = document.getElementById('editQtyPlusBtn');
    if (editQtyMinusBtn) editQtyMinusBtn.addEventListener('click', () => adjustEditItemQuantity(-1));
    if (editQtyPlusBtn) editQtyPlusBtn.addEventListener('click', () => adjustEditItemQuantity(1));
    // Optional: Add Escape key listener to close modal
    if (editItemModal) {
         editItemModal.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                hideEditModal();
            }
         });
        // Optional: Close modal on overlay click
         editItemModal.addEventListener('click', (event) => {
            if (event.target === editItemModal) { // Check if click is directly on the overlay
                hideEditModal();
            }
        });
    }

    // console.log("[DOMContentLoaded] Initialization complete.");

    // --- Initial Load & Sortable Init ---
    loadState(); // Load data, which now includes order
    // initializeSortableTabs(); // REMOVED Call from here - Moved to end of continueLoadSequence

}); // END of DOMContentLoaded

// --- SortableJS Initialization --- 
function initializeSortableTabs() {
    // console.log("[initializeSortableTabs] Initializing...");
    // Target the specific sortable containers now
    const desktopSortableContainer = document.getElementById('desktop-list-tabs');
    const mobileSortableContainer = document.getElementById('mobile-list-tabs');

    const sortableOptions = {
        animation: 150, 
        // No filter needed anymore as fixed elements are outside the sortable container
        // filter: ".add-tab-btn, [data-tab='inputTab']", 
        // preventOnFilter: true, 
        onUpdate: function (evt) {
            const container = evt.from; 
            updateListOrder(container);
        },
    };

    if (desktopSortableContainer) {
        new Sortable(desktopSortableContainer, sortableOptions);
    } else {
        console.warn("[initializeSortableTabs] Desktop sortable list container not found.");
    }

    if (mobileSortableContainer) {
         new Sortable(mobileSortableContainer, sortableOptions);
    } else {
        console.warn("[initializeSortableTabs] Mobile sortable list container not found.");
    }
}

// --- Update List Order --- 
function updateListOrder(containerElement) {
    // console.log("[updateListOrder] Updating order based on container:", containerElement.id);
    const childButtons = Array.from(containerElement.children);
    let currentOrder = 0;
    let changesMade = false;

    childButtons.forEach(button => {
        const listId = button.dataset.listId;
        if (listId && shoppingLists[listId]) {
            // console.log(`[updateListOrder] Found list tab: ${shoppingLists[listId].name} (ID: ${listId})`);
            if (shoppingLists[listId].order !== currentOrder) {
                // console.log(` - Updating order from ${shoppingLists[listId].order} to ${currentOrder}`);
                shoppingLists[listId].order = currentOrder;
                changesMade = true;
            }
            currentOrder++;
        } else if (button.dataset.tab === 'inputTab') {
             // console.log("[updateListOrder] Found Manage Items tab, skipping order assignment.");
        } else if (button.classList.contains('add-tab-btn')) {
             // console.log("[updateListOrder] Found Add button, skipping order assignment.");
        } else {
            // console.log("[updateListOrder] Found unexpected element:", button);
        }
    });

    if (changesMade) {
        // console.log("[updateListOrder] Order changed, saving state.");
        saveState();
        // Optional: Force re-render tabs if needed, though visual order is already changed.
        // renderTabsAndContent(); // Usually not needed just for order change
    } else {
         // console.log("[updateListOrder] No order changes detected.");
    }
}


// --- Tab Switching Logic --- 
// ... existing code ...