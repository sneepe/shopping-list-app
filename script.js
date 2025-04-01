document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements --- 
    const listNameInput = document.getElementById('listNameInput');
    const createListBtn = document.getElementById('createListBtn');
    const targetListSelect = document.getElementById('targetListSelect');
    const listInput = document.getElementById('listInput');
    const addItemsBtn = document.getElementById('addItemsBtn');
    const categoryListElement = document.getElementById('categoryList');
    const tabContainer = document.getElementById('tabContainer');
    const listContentContainer = document.getElementById('listContentContainer');
    const manageListsTabButton = tabContainer.querySelector('[data-tab="inputTab"]');
    const categorySettingsContainer = document.getElementById('categorySettingsContainer');
    const addNewCategoryBtn = document.getElementById('addNewCategoryBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const dynamicStyleSheet = createDynamicStyleSheet(); // For category colors
    const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
    const settingsAreaWrapper = document.getElementById('settingsAreaWrapper');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileNavPanel = document.getElementById('mobileNavPanel');
    const mobileManageListsTabButton = mobileNavPanel.querySelector('[data-tab="inputTab"]'); // Get mobile manage lists button
    const pasteBtn = document.getElementById('pasteBtn');

    // --- Category Definitions --- 
    // Initial default categories
    const DEFAULT_CATEGORIES = {
        fruit: { name: 'Fruit', color: '#5a994a' },
        dairy: { name: 'Dairy', color: '#4a7db1' },
        household: { name: 'Household', color: '#666666' },
        meat: { name: 'Meat', color: '#b15a4a' },
        snacks: { name: 'Snacks', color: '#b1a04a' },
        pantry: { name: 'Pantry', color: '#8a6d3b' }, // Example adjusted color
        frozen: { name: 'Frozen', color: '#5bc0de' }, // Example adjusted color
        default: { name: 'Other', color: '#4a4a4a' } 
    };
    let currentCategoryConfig = {}; // Will be loaded or initialized

    // --- Application State --- 
    let shoppingLists = {};
    let activeListId = null;

    // --- Local Storage --- 
    const LISTS_STORAGE_KEY = 'shoppingLists';
    const CATEGORY_STORAGE_KEY = 'categoryConfig';

    // Modified cache structure: { lowerCaseName: { original: 'Original Case Name', category: 'categoryKey' } }
    let knownItems = {}; 

    function saveState() {
        localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(shoppingLists));
        localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(currentCategoryConfig));
    }

    function loadState() {
        // --- Load Categories FIRST --- 
        const savedCategories = localStorage.getItem(CATEGORY_STORAGE_KEY);
        currentCategoryConfig = savedCategories ? JSON.parse(savedCategories) : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)); // Deep copy defaults
        if (!currentCategoryConfig.default) {
            currentCategoryConfig.default = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES.default));
        }

        // --- Load Lists SECOND (Always from storage) --- 
        const savedListsString = localStorage.getItem(LISTS_STORAGE_KEY);
        shoppingLists = savedListsString ? JSON.parse(savedListsString) : {};
        // Validate loaded lists (existing code)
        Object.values(shoppingLists).forEach(list => {
            list.items.forEach(item => {
                if (!item.id) item.id = generateId();
                if (item.category && !currentCategoryConfig[item.category]) {
                    console.warn(`Item "${item.name}" had invalid category "${item.category}", reverting to default.`);
                    item.category = null;
                }
            });
        });
        
        // Start the rest of the sequence (cache building, rendering)
        continueLoadSequence(); 
    }
    
    // Encapsulate the rest of the loading/rendering sequence
    function continueLoadSequence() {
        buildKnownItemsCacheFromStorage(); // Build cache from user's lists first

        // Fetch default items to add them to suggestions cache
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
                console.warn('Could not load defaultItems.json for suggestions:', error);
            })
            .finally(() => {
                 // --- Render UI AFTER cache is potentially populated with defaults --- 
                applyCategoryStyles(); 
                renderTabsAndContent();
                updateTargetListDropdown(); 
                renderCategorySettings(); 
                populateCategoryGuide(); 

                // Activate first list or input tab
                const sortedListIds = Object.keys(shoppingLists).sort((a, b) => shoppingLists[a].name.localeCompare(shoppingLists[b].name));
                const firstListId = sortedListIds[0];
                if (firstListId) switchTab(`list-${firstListId}`);
                else switchTab('inputTab');
            });
    }

    // --- ID Generation --- 
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    // --- Target List Dropdown --- 
    function updateTargetListDropdown() {
        const currentSelection = targetListSelect.value;
        console.log('Updating target list dropdown. Lists:', Object.keys(shoppingLists), 'Current selection:', currentSelection); // DEBUG
        targetListSelect.innerHTML = '<option value="" disabled selected>Select list to add items to...</option>';

        const sortedLists = Object.values(shoppingLists).sort((a, b) => a.name.localeCompare(b.name));
        let firstListId = null; // Keep track of the first list

        if (sortedLists.length === 0) {
            targetListSelect.disabled = true;
            addItemsBtn.disabled = true;
        } else {
            targetListSelect.disabled = false;
            sortedLists.forEach((list, index) => {
                if (index === 0) firstListId = list.id; // Store first ID
                const option = document.createElement('option');
                option.value = list.id;
                option.textContent = list.name;
                targetListSelect.appendChild(option);
            });
            
            // Try to restore previous selection OR select the first list
            if (shoppingLists[currentSelection]) {
                targetListSelect.value = currentSelection;
            } else if (firstListId) {
                 targetListSelect.value = firstListId; // Select the first one if previous doesn't exist
            }
            
             // Enable/disable add button based on selection
            addItemsBtn.disabled = !targetListSelect.value;
        }
        console.log('Finished updating target list dropdown. Disabled:', targetListSelect.disabled, 'Value:', targetListSelect.value); // DEBUG
    }

    // --- Dynamic Stylesheet --- 
    function createDynamicStyleSheet() {
        const style = document.createElement('style');
        style.id = 'dynamic-category-styles';
        document.head.appendChild(style);
        return style.sheet;
    }

    function applyCategoryStyles() {
        // Clear existing rules
        while (dynamicStyleSheet.cssRules.length > 0) {
            dynamicStyleSheet.deleteRule(0);
        }
        // Add new rules
        for (const key in currentCategoryConfig) {
            const config = currentCategoryConfig[key];
            const className = `category-${key}`; // Generate class name
            try {
                dynamicStyleSheet.insertRule(`.${className} { background-color: ${config.color} !important; }`, dynamicStyleSheet.cssRules.length);
                // Add rule for category guide swatches too
                dynamicStyleSheet.insertRule(`.guide-swatch-${key} { background-color: ${config.color}; border: 1px solid #555; display: inline-block; width: 15px; height: 15px; margin-right: 8px; vertical-align: middle; border-radius: 3px; }`, dynamicStyleSheet.cssRules.length);
            } catch (e) {
                console.error(`Error applying style for category ${key} with color ${config.color}:`, e);
            }
        }
    }

    // --- Category Settings UI --- 
    function renderCategorySettings() {
        categorySettingsContainer.innerHTML = ''; // Clear previous settings
        for (const key in currentCategoryConfig) {
            renderCategorySettingRow(key, currentCategoryConfig[key]);
        }
    }

    function renderCategorySettingRow(key, config) {
        const isDefault = key === 'default';
        const row = document.createElement('div');
        row.classList.add('category-setting-row');
        row.dataset.categoryKey = key;

        // Key Input (readonly)
        const keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.value = key;
        keyInput.classList.add('category-key-input');
        keyInput.readOnly = true;
        keyInput.disabled = true;
        row.appendChild(keyInput);

        // Name Input
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = config.name;
        nameInput.placeholder = 'Display Name';
        nameInput.classList.add('category-name-input');
        nameInput.readOnly = isDefault; // Cannot change name of 'default'
        nameInput.disabled = isDefault;
        row.appendChild(nameInput);

        // Color Input
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = config.color;
        colorInput.classList.add('category-color-input');
        row.appendChild(colorInput);

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'X';
        deleteBtn.classList.add('delete-category-btn');
        deleteBtn.disabled = isDefault; // Cannot delete 'default'
        deleteBtn.title = isDefault ? 'Cannot delete default category' : 'Delete category';
        if (!isDefault) {
            deleteBtn.addEventListener('click', () => {
                if (confirm(`Delete category "${key}"? Items using it will revert to "Other".`)) {
                    row.remove(); // Remove from UI immediately
                    // Actual deletion happens on save
                }
            });
        }
        row.appendChild(deleteBtn);

        categorySettingsContainer.appendChild(row);
    }

    addNewCategoryBtn.addEventListener('click', () => {
        const newKey = prompt("Enter a short, unique key for the new category (e.g., 'bakery', 'drinks'):")?.toLowerCase().trim();
        if (!newKey) return; // Cancelled or empty
        // Basic validation
        if (!/^[a-z0-9]+$/.test(newKey)) {
            alert("Key can only contain lowercase letters and numbers.");
            return;
        }
        if (currentCategoryConfig[newKey] || document.querySelector(`.category-setting-row[data-category-key="${newKey}"]`)) {
             alert(`Category key "${newKey}" already exists.`);
             return;
        }
        
        // Add temporary row to UI (will be processed on save)
        const tempConfig = { name: '', color: '#cccccc' }; 
        renderCategorySettingRow(newKey, tempConfig);
        // Make the new key editable temporarily
        const newRow = categorySettingsContainer.lastElementChild;
        const newKeyInput = newRow.querySelector('.category-key-input');
        newKeyInput.readOnly = false;
        newKeyInput.disabled = false;
        newKeyInput.style.backgroundColor = '#4a4a4a'; // Normal background
        newKeyInput.style.color = '#e0e0e0';
        newKeyInput.style.fontStyle = 'normal';
        newRow.querySelector('.category-name-input').focus();
    });

    saveSettingsBtn.addEventListener('click', () => {
        const newConfig = {};
        const rows = categorySettingsContainer.querySelectorAll('.category-setting-row');
        let isValid = true;
        const usedKeys = new Set();

        rows.forEach(row => {
            const keyInput = row.querySelector('.category-key-input');
            const nameInput = row.querySelector('.category-name-input');
            const colorInput = row.querySelector('.category-color-input');
            
            const key = keyInput.value.toLowerCase().trim(); // Read key from input, might have been edited if new
            const name = nameInput.value.trim();
            const color = colorInput.value;

            if (!key || !name) {
                alert(`Error in row for key "${row.dataset.categoryKey}": Key and Name cannot be empty.`);
                isValid = false;
                return;
            }
            if (!/^[a-z0-9]+$/.test(key)) {
                 alert(`Error in row for key "${row.dataset.categoryKey}": Key "${key}" is invalid (only lowercase letters/numbers).`);
                 isValid = false;
                 return;
             }
             if (usedKeys.has(key)) {
                 alert(`Error: Duplicate category key found: "${key}". Keys must be unique.`);
                 isValid = false;
                 return;
             }
             usedKeys.add(key);

            newConfig[key] = { name, color };
        });

        console.log("Generated newConfig before validation:", JSON.stringify(newConfig, null, 2)); // DEBUG

        if (!isValid) return;
        if (!newConfig.default) {
             alert("Error: The 'default' category cannot be deleted.");
             console.error("Validation failed: newConfig is missing 'default' key.", newConfig); // DEBUG
             return; // Should be prevented by disabled button, but double-check
        }

        // Update main config
        currentCategoryConfig = newConfig;
        
        // Update items using potentially renamed/deleted categories
        Object.values(shoppingLists).forEach(list => {
            list.items.forEach(item => {
                if (item.category && !currentCategoryConfig[item.category]) {
                    item.category = null; // Revert to default
                }
            });
        });
        
        applyCategoryStyles();
        populateCategoryGuide();
        renderCategorySettings(); // Re-render settings to reflect saved state (e.g., make keys readonly again)
        renderTabsAndContent(); // Re-render lists as item categories might have changed
        // Repopulate *all* list-specific selects
        document.querySelectorAll('.single-item-category-select').forEach(select => {
             populateSingleItemCategorySelect(select);
        });
        buildKnownItemsCacheFromStorage(); // Rebuild cache in case item categories were affected
        saveState();

        // Rebuild cache completely after settings change
        buildKnownItemsCacheFromStorage();
        fetch('defaultItems.json') // Re-fetch defaults too
           .then(res => res.ok ? res.json() : Promise.reject('Fetch failed'))
           .then(data => addDefaultItemsToCache(data))
           .catch(err => console.warn('Could not reload defaults for cache:', err))
           .finally(() => {
                // Re-render tabs might be needed if categories affect display? Render safe
                renderTabsAndContent(); 
           });

        alert("Category settings saved!");
    });

    // --- Single Item Add --- 
    function populateSingleItemCategorySelect(selectElement) {
        if (!selectElement) return;
        const currentVal = selectElement.value;
        selectElement.innerHTML = '<option value="">Category</option>'; // Simplified placeholder
        const sortedKeys = Object.keys(currentCategoryConfig)
            .filter(key => key !== 'default') 
            .sort((a, b) => currentCategoryConfig[a].name.localeCompare(currentCategoryConfig[b].name));
        
        sortedKeys.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = currentCategoryConfig[key].name;
            selectElement.appendChild(option);
        });
        const defaultOption = document.createElement('option');
        defaultOption.value = ''; 
        defaultOption.textContent = currentCategoryConfig.default.name;
        selectElement.appendChild(defaultOption);
        
        selectElement.value = currentVal;
    }

    function addSingleItem(listId, nameInput, qtyInput, categorySelect) {
        const itemName = nameInput.value.trim();
        
        // listId is now passed directly
        if (!listId) { console.error("addSingleItem called without listId"); return; }
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
        
        const exists = shoppingLists[listId].items.some(existingItem => 
            existingItem.name === newItem.name && 
            existingItem.category === newItem.category && 
            existingItem.quantity === newItem.quantity &&
            !existingItem.done 
        );
        
        if (exists) {
            if (!confirm(`Item "${itemName}" seems to already be on the active list. Add anyway?`)) {
                return;
            }
        }
        
        shoppingLists[listId].items.push(newItem);
        updateKnownItem(newItem); // Update autocomplete cache with the new item
        renderItemsForList(listId);
        saveState();
        
        // Clear inputs specific to this list
        nameInput.value = '';
        qtyInput.value = '';
        categorySelect.value = '';
        nameInput.focus();
        
        // No need to switch tab, already on it
    }

    // --- ID Generation, Long Press, Tab Management, List Create/Delete, Item Parsing --- 
    let pressTimer = null;
    let longPressDetected = false;
    const LONG_PRESS_DURATION = 700; // milliseconds

    function handlePointerDown(event, listId, itemId) {
        // Check if it's a completed item card
        const card = event.target.closest('.item-card');
        if (!card || !card.closest('.completed-list')) return;

        longPressDetected = false;
        pressTimer = setTimeout(() => {
            longPressDetected = true;
            // Optionally add visual feedback for long press start (e.g., slight scale)
            card.style.transform = 'scale(0.95)'; 
            if (confirm(`Permanently delete item "${shoppingLists[listId].items.find(i => i.id === itemId)?.name}"?`)) {
                deleteItem(listId, itemId);
            }
             // Reset style even if cancelled
            setTimeout(() => { card.style.transform = 'scale(1)'; }, 150); 
        }, LONG_PRESS_DURATION);
    }

    function handlePointerUpOrLeave(event) {
        const card = event.target.closest('.item-card');
        clearTimeout(pressTimer);
        pressTimer = null;
        if (card) card.style.transform = 'scale(1)'; // Reset style
        // Important: Prevent click toggle if long press happened
        if (longPressDetected) {
            event.preventDefault(); 
            event.stopPropagation();
        }
        longPressDetected = false; // Reset for next interaction
    }

    // --- Hamburger Menu Logic --- 
    function toggleMobileNav(show) {
        if (show) {
            mobileNavPanel.classList.add('active');
            hamburgerBtn.innerHTML = '&#10005;'; // Change to Close icon (X)
        } else {
            mobileNavPanel.classList.remove('active');
            hamburgerBtn.innerHTML = '&#9776;'; // Change back to Hamburger icon
        }
    }

    hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent potential body click closing it immediately
        toggleMobileNav(!mobileNavPanel.classList.contains('active'));
    });

    // Close nav if clicking outside of it
    document.addEventListener('click', (e) => {
        if (mobileNavPanel.classList.contains('active') && !mobileNavPanel.contains(e.target) && e.target !== hamburgerBtn) {
            toggleMobileNav(false);
        }
    });

    // --- Tab Management (Modified) --- 
    function switchTab(targetTabId) {
        // Deactivate all tabs and content in both desktop and mobile navs
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Activate the target tab button (in both desktop and mobile navs)
        const targetButtons = document.querySelectorAll(`.tab-button[data-tab="${targetTabId}"]`);
        targetButtons.forEach(btn => btn.classList.add('active'));
        
        // Activate the target content pane
        const targetContentId = targetTabId === 'inputTab' ? 'inputTab' : `list-tab-content-${targetTabId.replace('list-', '')}`;
        const targetContent = document.getElementById(targetContentId);
        if (targetContent) targetContent.classList.add('active');

        // Update activeListId if switching to a list tab
        activeListId = targetTabId.startsWith('list-') ? targetTabId.replace('list-', '') : null;

        // Close mobile nav if it's open
        if (mobileNavPanel.classList.contains('active')) {
            toggleMobileNav(false);
        }
    }

    // Add event listener for static 'Manage Lists' tab in *mobile* nav
    mobileManageListsTabButton.addEventListener('click', () => switchTab('inputTab'));
    // Existing listener for desktop 'Manage Lists' tab
    manageListsTabButton.addEventListener('click', () => switchTab('inputTab'));

    // --- Rendering (Modified) --- 
    function renderTabsAndContent() {
        const previouslyActiveListId = activeListId;
        const inputTabWasActive = manageListsTabButton.classList.contains('active') || mobileManageListsTabButton.classList.contains('active');

        // Clear dynamic tabs from BOTH containers
        tabContainer.querySelectorAll('.list-tab-button').forEach(btn => btn.remove());
        mobileNavPanel.querySelectorAll('.list-tab-button').forEach(btn => btn.remove());
        
        listContentContainer.innerHTML = '';
        
        // --- Sort lists by name before rendering --- 
        const sortedLists = Object.values(shoppingLists).sort((a, b) => a.name.localeCompare(b.name));

        // Render sorted lists
        sortedLists.forEach(list => {
        // Object.values(shoppingLists).forEach(list => { // Old way
            if (list && list.id) { 
                renderListTab(list); 
                renderListContentStructure(list); 
                renderItemsForList(list.id); 
            } else { console.warn('Skipping render for invalid list object:', list); }
        });
        
        // ... (Tab activation logic remains the same) ...
        let targetTabId;
        // ... (determine targetTabId based on previouslyActiveListId, inputTabWasActive, etc.) ...
        if (inputTabWasActive) {
            targetTabId = 'inputTab';
        } else {
            targetTabId = previouslyActiveListId && shoppingLists[previouslyActiveListId] 
                          ? `list-${previouslyActiveListId}` 
                          : (Object.keys(shoppingLists).length > 0 ? `list-${sortedLists[0]?.id}` : 'inputTab'); // Use sortedLists[0] if activating first list
        }
        
        const targetButtons = document.querySelectorAll(`.tab-button[data-tab="${targetTabId}"]`);
        const targetContentId = targetTabId === 'inputTab' ? 'inputTab' : `list-tab-content-${targetTabId.replace('list-', '')}`;
        const targetContent = document.getElementById(targetContentId);
        
        if (targetButtons.length > 0 && targetContent) { switchTab(targetTabId); }
        else { switchTab('inputTab'); }
    }

    function renderListTab(list) {
        const tabId = `list-${list.id}`;

        // --- Create Desktop Tab Button --- 
        const desktopButton = document.createElement('button');
        desktopButton.classList.add('tab-button', 'list-tab-button');
        desktopButton.dataset.tab = tabId;
        desktopButton.textContent = list.name;
        desktopButton.addEventListener('click', () => switchTab(tabId));
        tabContainer.appendChild(desktopButton);

        // --- Create Mobile Tab Button --- 
        const mobileButton = document.createElement('button');
        mobileButton.classList.add('tab-button', 'mobile-tab-button', 'list-tab-button');
        mobileButton.dataset.tab = tabId;
        mobileButton.textContent = list.name;
        mobileButton.addEventListener('click', () => switchTab(tabId)); // SwitchTab will close the panel
        mobileNavPanel.appendChild(mobileButton);
    }

    function renderListContentStructure(list) {
        let contentDiv = document.getElementById(`list-tab-content-${list.id}`);
        if (!contentDiv) { 
            contentDiv = document.createElement('div');
            contentDiv.id = `list-tab-content-${list.id}`;
            contentDiv.classList.add('tab-content', 'list-tab');
            const heading = document.createElement('h2');
            heading.textContent = list.name;
            contentDiv.appendChild(heading);

            // --- Create Single Item Add Section --- 
            const singleAddSection = document.createElement('div');
            singleAddSection.classList.add('input-area', 'add-single-item-section');
            singleAddSection.dataset.listId = list.id; // Associate with list

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.placeholder = 'Item Name';
            nameInput.required = true;
            nameInput.classList.add('single-item-name-input');
            nameInput.setAttribute('list', `itemSuggestions-${list.id}`); 
            singleAddSection.appendChild(nameInput);

            const datalist = document.createElement('datalist');
            datalist.id = `itemSuggestions-${list.id}`;
            populateItemDatalist(datalist); // Populate it with items from cache
            singleAddSection.appendChild(datalist);

            const qtyInput = document.createElement('input');
            qtyInput.type = 'number';
            qtyInput.placeholder = 'Qty';
            qtyInput.min = '1';
            qtyInput.style.maxWidth = '70px'; // Keep style from example
            qtyInput.classList.add('single-item-qty-input');
            singleAddSection.appendChild(qtyInput);

            const categorySelect = document.createElement('select');
            categorySelect.classList.add('single-item-category-select');
            populateSingleItemCategorySelect(categorySelect); // Populate this specific select
            singleAddSection.appendChild(categorySelect);

            const addButton = document.createElement('button');
            addButton.textContent = '+';
            addButton.title = 'Add Item';
            addButton.classList.add('add-single-item-btn');
            // Add listener to *this* button, passing references
            addButton.addEventListener('click', () => {
                addSingleItem(list.id, nameInput, qtyInput, categorySelect);
            });

            // --- Modified Input Listener --- 
            nameInput.addEventListener('input', (e) => {
                const enteredNameLower = e.target.value.toLowerCase();
                const knownData = knownItems[enteredNameLower]; // Check cache using lowercase
                
                if (knownData !== undefined) { 
                    // Prefill category based on cached data for the exact match
                    categorySelect.value = knownData.category === null ? '' : knownData.category;
                } else {
                    // Optional: Reset category if name doesn't match anything known
                    // categorySelect.value = ''; 
                }
                // NOTE: We don't manually filter the datalist here.
                // The browser uses the input value to filter the <option>s in the linked <datalist> automatically.
            });

            // Also add via Enter key in name input for this section
            nameInput.addEventListener('keypress', (e) => {
                 if (e.key === 'Enter') {
                     e.preventDefault();
                     addSingleItem(list.id, nameInput, qtyInput, categorySelect);
                 }
             });
            singleAddSection.appendChild(addButton);
            // --- End Single Item Add Section --- 

            contentDiv.appendChild(singleAddSection); // Add section below heading

            // Active Items Section Structure
            const activeContainer = document.createElement('div');
            activeContainer.className = 'list-container';
            activeContainer.id = `activeListContainer-${list.id}`;

            // Clear previous active items
            activeContainer.innerHTML = ''; // Clear previous active items

            const activeItems = list.items.filter(item => !item.done);
            const completedItems = list.items.filter(item => item.done);

            const groupedActiveItems = activeItems.reduce((acc, item) => {
                 const categoryKey = item.category || 'default'; // Use 'default' if item.category is null/undefined
                 if (!acc[categoryKey]) acc[categoryKey] = [];
                 acc[categoryKey].push(item);
                 return acc;
             }, {});

            // --- MODIFIED CATEGORY ITERATION --- 
            // Get all category keys from current config, sort them alphabetically, 
            // ensuring 'default' comes last if present.
            const allCategoryKeys = Object.keys(currentCategoryConfig)
                .sort((a, b) => {
                    if (a === 'default') return 1; // Push default to end
                    if (b === 'default') return -1;
                    return a.localeCompare(b); // Sort others alphabetically
                });

            // Iterate over sorted keys from current config
            allCategoryKeys.forEach(categoryKey => {
                // Check if there are items for this category *in this list*
                if (groupedActiveItems[categoryKey]) { 
                    const categoryConfig = currentCategoryConfig[categoryKey]; // Get config using the key
                    if (!categoryConfig) { // Safety check, should not happen
                        console.error(`Config not found for category key: ${categoryKey}`);
                        return; 
                    }
                    const categoryHeader = document.createElement('div');
                    categoryHeader.classList.add('category-header');
                    categoryHeader.textContent = categoryConfig.name; 
                    activeContainer.appendChild(categoryHeader);
                    
                    // Render items for this specific category
                    groupedActiveItems[categoryKey].forEach(item => {
                        const card = createItemCard(item, list.id);
                        activeContainer.appendChild(card);
                    });
                }
            });

            // Render completed items
            completedItems.forEach(item => {
                const card = createItemCard(item, list.id);
                activeContainer.appendChild(card);
            });

            contentDiv.appendChild(activeContainer);

            // Completed Items Section Structure
            const completedSection = document.createElement('div');
            completedSection.classList.add('list-section', 'completed-list');
             const completedHeading = document.createElement('h3'); // Create heading explicitly
            completedHeading.textContent = 'Completed Items';
            completedSection.appendChild(completedHeading);
            const completedContainer = document.createElement('div');
            completedContainer.classList.add('list-container');
            completedContainer.id = `completedListContainer-${list.id}`;
            completedSection.appendChild(completedContainer);
            contentDiv.appendChild(completedSection);
            
            // Delete Button
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-list-btn');
            deleteBtn.dataset.listId = list.id;
            deleteBtn.textContent = 'Delete List';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                deleteList(list.id);
            });
            contentDiv.appendChild(deleteBtn);

            listContentContainer.appendChild(contentDiv);
        } else {
             console.log(`Structure already exists for list: ${list.name} (${list.id})`); // DEBUG
        }
    }
    
    function renderItemsForList(listId) {
        const list = shoppingLists[listId];
        if (!list) return;
        
        const activeContainer = document.getElementById(`activeListContainer-${listId}`);
        const completedContainer = document.getElementById(`completedListContainer-${listId}`);
        
        if (!activeContainer || !completedContainer) {
            console.error(`Containers not found for list ${listId} during item render.`);
            return; // Structure should exist, but safety check
        }

        activeContainer.innerHTML = ''; // Clear previous active items
        completedContainer.innerHTML = ''; // Clear previous completed items

        const activeItems = list.items.filter(item => !item.done);
        const completedItems = list.items.filter(item => item.done);

        const groupedActiveItems = activeItems.reduce((acc, item) => {
             const categoryKey = item.category || 'default'; // Use 'default' if item.category is null/undefined
             if (!acc[categoryKey]) acc[categoryKey] = [];
             acc[categoryKey].push(item);
             return acc;
         }, {});

        // --- MODIFIED CATEGORY ITERATION --- 
        // Get all category keys from current config, sort them alphabetically, 
        // ensuring 'default' comes last if present.
        const allCategoryKeys = Object.keys(currentCategoryConfig)
            .sort((a, b) => {
                if (a === 'default') return 1; // Push default to end
                if (b === 'default') return -1;
                return a.localeCompare(b); // Sort others alphabetically
            });

        // Iterate over sorted keys from current config
        allCategoryKeys.forEach(categoryKey => {
            // Check if there are items for this category *in this list*
            if (groupedActiveItems[categoryKey]) { 
                const categoryConfig = currentCategoryConfig[categoryKey]; // Get config using the key
                if (!categoryConfig) { // Safety check, should not happen
                    console.error(`Config not found for category key: ${categoryKey}`);
                    return; 
                }
                const categoryHeader = document.createElement('div');
                categoryHeader.classList.add('category-header');
                categoryHeader.textContent = categoryConfig.name; 
                activeContainer.appendChild(categoryHeader);
                
                // Render items for this specific category
                groupedActiveItems[categoryKey].forEach(item => {
                    const card = createItemCard(item, listId);
                    activeContainer.appendChild(card);
                });
            }
        });
        
        // Render completed items
        completedItems.forEach(item => {
            const card = createItemCard(item, listId);
            completedContainer.appendChild(card);
        });
    }

    // --- Card Creation (Modified) --- 
    function createItemCard(item, listId) { 
        const card = document.createElement('div');
        card.classList.add('item-card');
        card.dataset.itemId = item.id; 
        card.dataset.listId = listId; 
        // Use dynamic class name based on key
        const categoryClass = `category-${item.category || 'default'}`;
        card.classList.add(categoryClass);
        
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('item-name');
        nameSpan.textContent = item.name;
        card.appendChild(nameSpan);
        
        const detailsSpan = document.createElement('span');
        detailsSpan.classList.add('item-details');
        let detailsText = '';
        if (item.quantity) detailsText += `Qty: ${item.quantity}`;
        detailsSpan.textContent = detailsText;
        if (detailsText) card.appendChild(detailsSpan);

        card.addEventListener('click', (e) => {
             if (longPressDetected || e.target.closest('.change-category-btn') || e.target.closest('.category-dropdown')) {
                 e.preventDefault(); e.stopPropagation(); return;
             }
            toggleItemDone(listId, item.id); 
        });

        if (item.done) {
            card.addEventListener('pointerdown', (e) => handlePointerDown(e, listId, item.id));
            card.addEventListener('pointerup', handlePointerUpOrLeave);
            card.addEventListener('pointerleave', handlePointerUpOrLeave); 
            card.style.touchAction = 'none';
        }

        // --- Category Change UI (Desktop Only - Modified) ---
        if (window.innerWidth > 600) {
            const changeBtn = document.createElement('button');
            changeBtn.classList.add('change-category-btn');
            changeBtn.innerHTML = '&#9998;';
            changeBtn.title = 'Change category';
            
            const dropdown = document.createElement('div');
            dropdown.classList.add('category-dropdown');
            const select = document.createElement('select');
            
            console.log(`Populating category dropdown for item ${item.id}. Config:`, JSON.stringify(currentCategoryConfig)); // DEBUG
            // Populate select options from current config
            for (const catKey in currentCategoryConfig) {
                 const option = document.createElement('option');
                 option.value = catKey === 'default' ? '' : catKey; 
                 option.textContent = currentCategoryConfig[catKey].name;
                 if ((item.category || 'default') === catKey) {
                    option.selected = true;
                 }
                 select.appendChild(option);
            }

            select.addEventListener('change', (e) => {
                const newCategory = e.target.value || null; 
                updateItemCategory(listId, item.id, newCategory);
                dropdown.style.display = 'none';
            });

            dropdown.appendChild(select);
            card.appendChild(changeBtn);
            card.appendChild(dropdown);

            changeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                // Close other open dropdowns first
                 document.querySelectorAll('.category-dropdown').forEach(d => { if (d !== dropdown) d.style.display = 'none'; });
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            });

            // Modified outside click listener
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && e.target !== changeBtn) {
                    dropdown.style.display = 'none';
                }
            }, true);
        }
        return card;
    }

    // --- Event Handlers (Modified/Added) --- 
    function addItemsToList() {
        const selectedListId = targetListSelect.value;
        if (!selectedListId) { alert("Please select a list from the dropdown first!"); return; }
        const currentList = shoppingLists[selectedListId];
        if (!currentList) { alert("Selected list not found. Please refresh."); return; }

        const inputText = listInput.value;
        const itemsArray = inputText.split(/[,;\n]+/).filter(str => str.trim() !== '');
        const newItems = itemsArray.map(parseItemString).filter(item => item !== null);

        let addedCount = 0;
        newItems.forEach(newItem => {
            const exists = currentList.items.some(existingItem => 
                existingItem.name === newItem.name && 
                existingItem.category === newItem.category && 
                existingItem.quantity === newItem.quantity &&
                !existingItem.done // Added check for done status
            );
            if (!exists) {
                currentList.items.push(newItem);
                updateKnownItem(newItem); // <<< ADD THIS LINE
                addedCount++;
            } else {
                 console.log(`Skipping duplicate item from paste: ${newItem.name}`); // Optional log
             }
        });

        if (addedCount > 0) {
            renderItemsForList(selectedListId); 
            saveState(); 
        } else if (newItems.length > 0) {
            alert("All items parsed were already in the list.");
        } else {
             alert("Please enter items to add.");
             // Don't switch tab if input was empty
             return; 
        }
        
        // --- Moved Switch Tab --- 
        // Switch to the target list tab after attempting to add (unless input was empty)
        listInput.value = ''; 
        switchTab(`list-${selectedListId}`); 
    }

    function toggleItemDone(listId, itemId) {
        const list = shoppingLists[listId];
        if (!list) return;

        const itemIndex = list.items.findIndex(item => item.id === itemId);
        if (itemIndex > -1) {
            list.items[itemIndex].done = !list.items[itemIndex].done;
            renderItemsForList(listId); // Re-render items for this specific list
            saveState(); 
        }
    }

    function deleteItem(listId, itemId) {
         const list = shoppingLists[listId];
         if (!list) return;
         const itemIndex = list.items.findIndex(item => item.id === itemId);
         if (itemIndex > -1) {
             list.items.splice(itemIndex, 1); // Remove item from array
             renderItemsForList(listId); // Re-render the list
             saveState(); // Save changes
         }       
    }

    function updateItemCategory(listId, itemId, newCategory) {
        const list = shoppingLists[listId];
        if (!list) return;
        const itemIndex = list.items.findIndex(item => item.id === itemId);
        if (itemIndex > -1) {
             const item = list.items[itemIndex];
             if ((item.category || null) !== newCategory) { // Compare nulls correctly
                item.category = newCategory;
                
                const cardElement = document.querySelector(`.item-card[data-item-id="${itemId}"]`);
                if (cardElement) {
                    // Remove ALL potentially existing category-* classes
                    const classesToRemove = Array.from(cardElement.classList).filter(c => c.startsWith('category-'));
                    cardElement.classList.remove(...classesToRemove);
                    // Add new one
                    const newCategoryClass = `category-${newCategory || 'default'}`;
                    cardElement.classList.add(newCategoryClass);
                }
                renderItemsForList(listId); // Still need to re-render for grouping
                saveState(); 
             } 
        }
    }

    // --- Populate Category List (Modified) --- 
    function populateCategoryGuide() {
        categoryListElement.innerHTML = ''; // Clear existing
        for (const key in currentCategoryConfig) {
            // Exclude 'default' from the visible guide?
            if (key !== 'default') { 
                const config = currentCategoryConfig[key];
                const li = document.createElement('li');
                const span = document.createElement('span');
                // Use dynamic class generated by applyCategoryStyles
                span.classList.add(`guide-swatch-${key}`); 
                li.appendChild(span);
                li.appendChild(document.createTextNode(`${key} (${config.name})`));
                categoryListElement.appendChild(li);
            }
        }
    }

    // --- Initial Setup (Modified) --- 
    addItemsBtn.addEventListener('click', () => {
        console.log("Add Items button clicked"); // DEBUG
        addItemsToList();
    });
    listInput.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') { 
            console.log("Enter pressed in List Name input"); // DEBUG
            e.preventDefault(); 
            addItemsToList(); 
        }
    });
    
    pasteBtn.addEventListener('click', async () => {
        console.log("Paste button clicked"); // DEBUG (Confirming this works)
        if (!navigator.clipboard || !navigator.clipboard.readText) {
            alert('Clipboard API not available in this browser or context.');
            return;
        }
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                // Append to existing text or replace? Let's append for now.
                listInput.value += (listInput.value ? '\n' : '') + text;
                listInput.focus(); // Focus textarea after paste
            } else {
                alert('Clipboard is empty.');
            }
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
            alert('Failed to paste from clipboard. Check browser permissions.');
        }
    });

    toggleSettingsBtn.addEventListener('click', () => {
        const isHidden = settingsAreaWrapper.style.display === 'none';
        settingsAreaWrapper.style.display = isHidden ? 'block' : 'none';
        toggleSettingsBtn.innerHTML = isHidden ? 'Hide Category Settings &#9650;' : 'Show Category Settings &#9660;';
    });

    // Add listener for createListBtn separately to add log
    createListBtn.addEventListener('click', () => {
        console.log("Create List button clicked"); // DEBUG
        createNewList();
    });
    listNameInput.addEventListener('keypress', (e) => { 
        if (e.key === 'Enter') { 
            console.log("Enter pressed in List Name input"); // DEBUG
            e.preventDefault(); 
            createNewList(); 
        }
     });

    // --- List Creation / Deletion (Ensure this block is present) --- 
    function createNewList() {
        const listName = listNameInput.value.trim();
        if (!listName) {
            alert("Please enter a name for the new list.");
            return;
        }
        if (Object.values(shoppingLists).some(list => list.name === listName)) {
             alert(`A list named "${listName}" already exists.`);
             return;
        }

        const newListId = generateId();
        shoppingLists[newListId] = { id: newListId, name: listName, items: [] };

        renderTabsAndContent(); // Re-render UI
        updateTargetListDropdown(); // Update the dropdown
        targetListSelect.value = newListId; // Select the newly created list in dropdown
        addItemsBtn.disabled = false; // Enable add button
        saveState();
        listNameInput.value = ''; // Clear input
        listInput.focus(); // Focus on the item input area
    }

    function deleteList(listIdToDelete) {
        if (!shoppingLists[listIdToDelete]) return;

        const listName = shoppingLists[listIdToDelete].name;
        if (confirm(`Are you sure you want to delete the list "${listName}"?`)) {
            const wasActive = activeListId === listIdToDelete;
            delete shoppingLists[listIdToDelete];
            renderTabsAndContent();
            updateTargetListDropdown(); // Update dropdown after delete
            saveState();

            // Switch to 'Manage Lists' tab if the deleted list was active
            if (wasActive) switchTab('inputTab');
        }
    }

    // --- Item Parsing (Ensure this block is present) --- 
    function parseItemString(itemStr) {
        itemStr = itemStr.trim();
        if (!itemStr) return null;

        const itemRegex = /^(.*?)(?:\s+x(\d+))?(?:\s+(?:category|cat):\s*(\w+))?$/i;
        const match = itemStr.match(itemRegex);

        let baseItem = { id: generateId(), name: itemStr, quantity: null, category: null, done: false };

        if (match) {
            baseItem.name = match[1].trim();
            baseItem.quantity = match[2] ? parseInt(match[2], 10) : null;
            baseItem.category = match[3] ? match[3].toLowerCase() : null;
        }
        return baseItem;
    }

    // --- Autocomplete Cache (Split) --- 
    // Renamed function: Builds cache ONLY from lists in localStorage
    function buildKnownItemsCacheFromStorage() {
        knownItems = {}; // Reset cache
        Object.values(shoppingLists).forEach(list => {
            list.items.forEach(item => {
                if (item.name) { 
                    const lowerCaseName = item.name.toLowerCase();
                    if (!knownItems[lowerCaseName] || item.category !== null) { 
                         knownItems[lowerCaseName] = { 
                             original: item.name, 
                             category: item.category || null 
                         };
                    } else if (!knownItems[lowerCaseName].category && item.category === null) {
                        // Keep existing casing if no category info gained
                    }
                 }
            });
        });
         console.log("Built Known Items Cache (From Storage):", JSON.parse(JSON.stringify(knownItems))); // DEBUG
    }
    
    // New function: Adds default items to cache IF they don't already exist from storage
    function addDefaultItemsToCache(defaultItems) {
         if (!Array.isArray(defaultItems)) {
             console.warn("Default items data is not an array, skipping.", defaultItems);
             return;
         }
         let defaultsAdded = 0;
         defaultItems.forEach(item => {
             if (item.name) {
                 const lowerCaseName = item.name.toLowerCase();
                 // Only add if this item name wasn't already loaded from user lists
                 if (!knownItems[lowerCaseName]) { 
                     knownItems[lowerCaseName] = {
                         original: item.name,
                         category: item.category || null
                     };
                     defaultsAdded++;
                 }
             }
         });
         console.log(`Added ${defaultsAdded} default items to suggestion cache.`);
         // After adding defaults, repopulate datalists
         document.querySelectorAll('datalist[id^="itemSuggestions-"]').forEach(datalist => {
             populateItemDatalist(datalist);
         });
    }

    // Modified to use new cache structure and check for existence
    function updateKnownItem(item) {
        if (item.name) {
            const lowerCaseName = item.name.toLowerCase();
            let needsDatalistUpdate = false;
            // Update if it doesn't exist OR if the new item provides category info where previous didn't
             if (!knownItems[lowerCaseName] || (knownItems[lowerCaseName].category === null && item.category !== null)) {
                 knownItems[lowerCaseName] = { 
                     original: item.name, 
                     category: item.category || null 
                 };
                 needsDatalistUpdate = true; // New item added or updated, refresh suggestions
             } else if (knownItems[lowerCaseName].category !== null && item.category !== null && knownItems[lowerCaseName].category !== item.category) {
                 // Optional: Update category if user explicitly sets a different one? Debatable. Let's keep last known for now.
                 // knownItems[lowerCaseName].category = item.category;
             } else if (knownItems[lowerCaseName].category !== null && item.category === null) {
                 // Don't overwrite an existing category with null
             }

             // Update relevant datalists only if the cache actually changed
             if (needsDatalistUpdate) {
                 document.querySelectorAll('datalist[id^="itemSuggestions-"]').forEach(datalist => {
                     populateItemDatalist(datalist);
                 });
             }
         }
    }

    // Modified to use new cache structure
    function populateItemDatalist(datalistElement) {
        if (!datalistElement) return;
        datalistElement.innerHTML = ''; // Clear old suggestions
        // Sort known items alphabetically by original name for consistent dropdown order
        const sortedKeys = Object.keys(knownItems).sort((a, b) => 
            knownItems[a].original.localeCompare(knownItems[b].original)
        );

        sortedKeys.forEach(itemNameKey => {
            const option = document.createElement('option');
            option.value = knownItems[itemNameKey].original; // Use original case for the suggestion value
            // Browsers typically display the 'value' in the datalist suggestion
            datalistElement.appendChild(option);
        });
    }

    loadState(); // Start the loading process

    // --- PWA Service Worker Registration --- 
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
             navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered with scope:', registration.scope);
                })
                .catch(err => {
                    console.error('Service Worker registration failed:', err);
                });
        });
    }
}); 