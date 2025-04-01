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

    function saveState() {
        localStorage.setItem(LISTS_STORAGE_KEY, JSON.stringify(shoppingLists));
        localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(currentCategoryConfig));
    }

    function loadState() {
        // --- Load Categories FIRST --- 
        const savedCategories = localStorage.getItem(CATEGORY_STORAGE_KEY);
        currentCategoryConfig = savedCategories ? JSON.parse(savedCategories) : JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)); // Deep copy defaults
        // Always ensure 'default' category exists
        if (!currentCategoryConfig.default) {
            currentCategoryConfig.default = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES.default));
        }

        // --- Load Lists SECOND --- 
        const savedLists = localStorage.getItem(LISTS_STORAGE_KEY);
        shoppingLists = savedLists ? JSON.parse(savedLists) : {};
        Object.values(shoppingLists).forEach(list => {
            list.items.forEach(item => {
                if (!item.id) item.id = generateId();
                // *** Now the check is safe ***
                if (item.category && !currentCategoryConfig[item.category]) {
                    console.warn(`Item "${item.name}" had invalid category "${item.category}", reverting to default.`);
                    item.category = null; // Revert to default
                }
            });
        });

        // --- Apply Styles & Render UI --- 
        applyCategoryStyles(); 
        renderTabsAndContent();
        updateTargetListDropdown(); 
        renderCategorySettings(); 
        populateCategoryGuide(); 

        // Activate first list or input tab
        const firstListId = Object.keys(shoppingLists)[0];
        if (firstListId) switchTab(`list-${firstListId}`);
        else switchTab('inputTab');
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
        saveState(); // Save both lists and new category config

        alert("Category settings saved!");
    });

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

    function switchTab(targetTabId) {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        const targetButton = tabContainer.querySelector(`[data-tab="${targetTabId}"]`);
        const targetContentId = targetTabId === 'inputTab' ? 'inputTab' : `list-tab-content-${targetTabId.replace('list-', '')}`;
        const targetContent = document.getElementById(targetContentId);
        if (targetButton) targetButton.classList.add('active');
        if (targetContent) targetContent.classList.add('active');
        activeListId = targetTabId.startsWith('list-') ? targetTabId.replace('list-', '') : null;
    }

    manageListsTabButton.addEventListener('click', () => switchTab('inputTab'));

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

    createListBtn.addEventListener('click', createNewList);
    // Add list when Enter is pressed in the name input
    listNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            createNewList();
        }
    });

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

    // --- Rendering (Modified) --- 
    function renderTabsAndContent() {
        const previouslyActiveListId = activeListId;
        const inputTabWasActive = manageListsTabButton.classList.contains('active'); // Check if input tab is active

        tabContainer.querySelectorAll('.list-tab-button').forEach(btn => btn.remove());
        listContentContainer.innerHTML = '';
        
        Object.values(shoppingLists).forEach(list => {
            if (list && list.id) { 
                renderListTab(list); 
                renderListContentStructure(list); 
                renderItemsForList(list.id); 
            } else { console.warn('Skipping render for invalid list object:', list); }
        });

        // --- Modified Tab Activation Logic --- 
        let targetTabId;
        if (inputTabWasActive) {
            targetTabId = 'inputTab'; // Stay on input tab if it was active
        } else {
            // Otherwise, try to restore previous list or first list
            targetTabId = previouslyActiveListId && shoppingLists[previouslyActiveListId] 
                          ? `list-${previouslyActiveListId}` 
                          : (Object.keys(shoppingLists).length > 0 ? `list-${Object.keys(shoppingLists)[0]}` : 'inputTab');
        }
        
        const targetButton = tabContainer.querySelector(`[data-tab="${targetTabId}"]`);
        const targetContentId = targetTabId === 'inputTab' ? 'inputTab' : `list-tab-content-${targetTabId.replace('list-', '')}`;
        const targetContent = document.getElementById(targetContentId);
        
        if (targetButton && targetContent) { switchTab(targetTabId); }
        else { switchTab('inputTab'); }
    }

    function renderListTab(list) {
        const tabButton = document.createElement('button');
        tabButton.classList.add('tab-button', 'list-tab-button');
        tabButton.dataset.tab = `list-${list.id}`;
        tabButton.textContent = list.name;
        tabButton.addEventListener('click', () => switchTab(`list-${list.id}`));
        tabContainer.appendChild(tabButton);
    }

    function renderListContentStructure(list) {
        let contentDiv = document.getElementById(`list-tab-content-${list.id}`);
        
        if (!contentDiv) { 
            console.log(`Creating structure for list: ${list.name} (${list.id})`); // DEBUG
            contentDiv = document.createElement('div');
            contentDiv.id = `list-tab-content-${list.id}`;
            contentDiv.classList.add('tab-content', 'list-tab');
            
            const heading = document.createElement('h2');
            heading.textContent = list.name;
            contentDiv.appendChild(heading);

            // Active Items Section Structure
            const activeSection = document.createElement('div');
            activeSection.classList.add('list-section', 'active-list');
            const activeHeading = document.createElement('h3'); // Create heading explicitly
            activeHeading.textContent = 'Active Items';
            activeSection.appendChild(activeHeading);
            const activeContainer = document.createElement('div');
            activeContainer.classList.add('list-container');
            activeContainer.id = `activeListContainer-${list.id}`;
            activeSection.appendChild(activeContainer);
            contentDiv.appendChild(activeSection);

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

        let activeItemsRendered = false;
        // Iterate over sorted keys from current config
        allCategoryKeys.forEach(categoryKey => {
            // Check if there are items for this category *in this list*
            if (groupedActiveItems[categoryKey]) { 
                activeItemsRendered = true;
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
        
        // Optionally hide the 'Active Items' H3 if no active items exist
        const activeSectionHeading = activeContainer.parentElement.querySelector('h3');
        if(activeSectionHeading) activeSectionHeading.style.display = activeItemsRendered ? 'block' : 'none';

        // Render completed items
        let completedItemsRendered = false;
        completedItems.forEach(item => {
            completedItemsRendered = true;
            const card = createItemCard(item, listId);
            completedContainer.appendChild(card);
        });

        // Optionally hide the 'Completed Items' H3 if no completed items exist
        const completedSectionHeading = completedContainer.parentElement.querySelector('h3');
        if(completedSectionHeading) completedSectionHeading.style.display = completedItemsRendered ? 'block' : 'none';
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
                existingItem.quantity === newItem.quantity
            );
            if (!exists) {
                currentList.items.push(newItem);
                addedCount++;
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

    // --- Initial Setup --- 
    addItemsBtn.addEventListener('click', addItemsToList);
    listInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addItemsToList(); } });
    
    // Settings Toggle Listener
    toggleSettingsBtn.addEventListener('click', () => {
        const isHidden = settingsAreaWrapper.style.display === 'none';
        settingsAreaWrapper.style.display = isHidden ? 'block' : 'none';
        toggleSettingsBtn.innerHTML = isHidden ? 'Hide Category Settings &#9650;' : 'Show Category Settings &#9660;';
    });

    loadState(); // Load lists AND categories, then render everything
}); 