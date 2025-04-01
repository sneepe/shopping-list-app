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

    // --- Category Definitions --- 
    const CATEGORY_CONFIG = {
        fruit: { name: 'Fruit', class: 'category-fruit' },
        dairy: { name: 'Dairy', class: 'category-dairy' },
        household: { name: 'Household', class: 'category-household' },
        meat: { name: 'Meat', class: 'category-meat' },
        snacks: { name: 'Snacks', class: 'category-snacks' },
        pantry: { name: 'Pantry', class: 'category-pantry' }, // Example extra category
        frozen: { name: 'Frozen', class: 'category-frozen' }, // Example extra category
        default: { name: 'Other', class: 'category-default' }
    };

    // --- Application State --- 
    let shoppingLists = {}; // Store lists by ID: { listId: { name: "List Name", items: [...] }, ... }
    let activeListId = null; // Track the currently viewed list tab

    // --- Local Storage --- 
    function saveLists() {
        localStorage.setItem('shoppingLists', JSON.stringify(shoppingLists));
    }

    function loadLists() {
        const savedLists = localStorage.getItem('shoppingLists');
        shoppingLists = savedLists ? JSON.parse(savedLists) : {};
        // Ensure items in loaded lists have IDs if they don't (migration)
        Object.values(shoppingLists).forEach(list => {
            list.items.forEach(item => {
                if (!item.id) {
                    item.id = generateId();
                }
            });
        });
        renderTabsAndContent(); // Render everything based on loaded data
        updateTargetListDropdown(); // Populate the dropdown
        // Try to activate the first list tab if any exist
        const firstListId = Object.keys(shoppingLists)[0];
        if (firstListId) {
            switchTab(`list-${firstListId}`);
        } else {
            switchTab('inputTab'); // Default to manage lists tab if no lists exist
        }
    }

    // --- ID Generation --- 
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    // --- Target List Dropdown --- 
    function updateTargetListDropdown() {
        const currentSelection = targetListSelect.value;
        // Clear existing options except the placeholder
        targetListSelect.innerHTML = '<option value="" disabled selected>Select list to add items to...</option>';

        const sortedLists = Object.values(shoppingLists).sort((a, b) => a.name.localeCompare(b.name));

        if (sortedLists.length === 0) {
            targetListSelect.disabled = true;
            addItemsBtn.disabled = true;
        } else {
            targetListSelect.disabled = false;
            sortedLists.forEach(list => {
                const option = document.createElement('option');
                option.value = list.id;
                option.textContent = list.name;
                targetListSelect.appendChild(option);
            });
            // Try to restore previous selection
            if (shoppingLists[currentSelection]) {
                targetListSelect.value = currentSelection;
            }
             // Enable/disable add button based on selection
            addItemsBtn.disabled = !targetListSelect.value;
        }
    }

    targetListSelect.addEventListener('change', () => {
         addItemsBtn.disabled = !targetListSelect.value; // Enable/disable on change
    });

    // --- Tab Management --- 
    function switchTab(targetTabId) {
        // Deactivate all tabs and content
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Activate the target tab button and content
        const targetButton = tabContainer.querySelector(`[data-tab="${targetTabId}"]`);
        const targetContentId = targetTabId === 'inputTab' ? 'inputTab' : `list-tab-content-${targetTabId.replace('list-', '')}`;
        const targetContent = document.getElementById(targetContentId);
        
        if (targetButton) targetButton.classList.add('active');
        if (targetContent) targetContent.classList.add('active');

        // Update activeListId if switching to a list tab
        if (targetTabId.startsWith('list-')) {
            activeListId = targetTabId.replace('list-', '');
        } else {
            activeListId = null;
        }
    }

    // Add event listener for static 'Manage Lists' tab
    manageListsTabButton.addEventListener('click', () => switchTab('inputTab'));

    // --- List Creation / Deletion --- 
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
        saveLists();
        listNameInput.value = ''; // Clear input
        listInput.focus(); // Focus on the item input area
    }

    function deleteList(listIdToDelete) {
        if (!shoppingLists[listIdToDelete]) return;

        const listName = shoppingLists[listIdToDelete].name;
        if (confirm(`Are you sure you want to delete the list "${listName}"?`)) {
            delete shoppingLists[listIdToDelete];
            renderTabsAndContent();
            updateTargetListDropdown(); // Update dropdown after delete
            saveLists();

            // Switch to 'Manage Lists' tab if the deleted list was active
            if (activeListId === listIdToDelete) {
                switchTab('inputTab');
            }
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

    // --- Item Parsing --- 
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

    // --- Rendering --- 
    function renderTabsAndContent() {
        // Clear dynamic tabs (keep 'Manage Lists') and all list content
        tabContainer.querySelectorAll('.list-tab-button').forEach(btn => btn.remove());
        listContentContainer.innerHTML = '';

        // Create tabs and content for each list
        Object.values(shoppingLists).forEach(list => {
            renderListTab(list);
            renderListContent(list);
        });
        
        // Restore active tab state if possible
        const targetTabId = activeListId ? `list-${activeListId}` : 'inputTab';
        switchTab(targetTabId);
    }

    function renderListTab(list) {
        const tabButton = document.createElement('button');
        tabButton.classList.add('tab-button', 'list-tab-button');
        tabButton.dataset.tab = `list-${list.id}`;
        tabButton.textContent = list.name;
        tabButton.addEventListener('click', () => switchTab(`list-${list.id}`));
        tabContainer.appendChild(tabButton);
    }

    function renderListContent(list) {
        const contentDiv = document.createElement('div');
        contentDiv.id = `list-tab-content-${list.id}`;
        contentDiv.classList.add('tab-content', 'list-tab'); // Add 'list-tab' for potential specific styling

        const heading = document.createElement('h2');
        heading.textContent = list.name;

        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-list-btn');
        deleteBtn.dataset.listId = list.id;
        deleteBtn.textContent = 'Delete List';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent tab switch if clicking delete button
            deleteList(list.id);
        });
        heading.appendChild(deleteBtn);

        contentDiv.appendChild(heading);

        // Active Items Section
        const activeSection = document.createElement('div');
        activeSection.classList.add('list-section', 'active-list');
        activeSection.innerHTML = '<h3>Active Items</h3>';
        const activeContainer = document.createElement('div');
        activeContainer.classList.add('list-container');
        activeContainer.id = `activeListContainer-${list.id}`;
        activeSection.appendChild(activeContainer);
        contentDiv.appendChild(activeSection);

        // Completed Items Section
        const completedSection = document.createElement('div');
        completedSection.classList.add('list-section', 'completed-list');
        completedSection.innerHTML = '<h3>Completed Items</h3>';
        const completedContainer = document.createElement('div');
        completedContainer.classList.add('list-container');
        completedContainer.id = `completedListContainer-${list.id}`;
        completedSection.appendChild(completedContainer);
        contentDiv.appendChild(completedSection);

        listContentContainer.appendChild(contentDiv);

        // Render items into the newly created containers
        renderItemsForList(list.id);
    }

    function renderItemsForList(listId) {
        const list = shoppingLists[listId];
        if (!list) return;

        const activeContainer = document.getElementById(`activeListContainer-${listId}`);
        const completedContainer = document.getElementById(`completedListContainer-${listId}`);

        if (!activeContainer || !completedContainer) return; // Safety check

        activeContainer.innerHTML = '';
        completedContainer.innerHTML = '';

        list.items.forEach(item => {
            const card = createItemCard(item, listId);
            if (item.done) {
                completedContainer.appendChild(card);
            } else {
                activeContainer.appendChild(card);
            }
        });
    }

    // --- Card Creation --- 
    function createItemCard(item, listId) { // Pass listId
        const card = document.createElement('div');
        card.classList.add('item-card');
        card.dataset.itemId = item.id; // Use item's unique ID
        card.dataset.listId = listId; // Store list ID for the click handler

        const categoryInfo = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.default;
        card.classList.add(categoryInfo.class);

        // Opacity is handled by parent container (.completed-list .item-card) in CSS now
        // if (item.done) {
        //     card.style.opacity = '0.6';
        // }

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('item-name');
        nameSpan.textContent = item.name;
        card.appendChild(nameSpan);

        const detailsSpan = document.createElement('span');
        detailsSpan.classList.add('item-details');
        let detailsText = '';
        if (item.quantity) {
            detailsText += `Qty: ${item.quantity}`;
        }
        detailsSpan.textContent = detailsText;
        if (detailsText) {
            card.appendChild(detailsSpan);
        }

        // --- Event Listener for Click --- 
        card.addEventListener('click', () => {
            toggleItemDone(listId, item.id); // Pass both IDs
        });

        return card;
    }

    // --- Event Handlers --- 
    function addItemsToList() {
        const selectedListId = targetListSelect.value;
        if (!selectedListId) {
             alert("Please select a list from the dropdown first!");
             return;
        }
        const currentList = shoppingLists[selectedListId];
        if (!currentList) { // Safety check
            alert("Selected list not found. Please refresh.");
            return;
        }

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
            renderItemsForList(selectedListId); // Re-render items for the target list
            saveLists(); 
            listInput.value = ''; // Clear input after successful add
            switchTab(`list-${selectedListId}`); // Switch to the target list tab
        } else if (newItems.length > 0) {
            alert("All items parsed were already in the list.");
            listInput.value = ''; // Clear input even if no items were added
        } else {
             // If input was empty or only whitespace
             alert("Please enter items to add.");
        }
    }

    function toggleItemDone(listId, itemId) {
        const list = shoppingLists[listId];
        if (!list) return;

        const itemIndex = list.items.findIndex(item => item.id === itemId);
        if (itemIndex > -1) {
            list.items[itemIndex].done = !list.items[itemIndex].done;
            renderItemsForList(listId); // Re-render items for this specific list
            saveLists(); 
        }
    }

    // --- Populate Category List --- 
    function populateCategoryGuide() {
        categoryListElement.innerHTML = ''; // Clear existing
        for (const key in CATEGORY_CONFIG) {
            if (key !== 'default') {
                const config = CATEGORY_CONFIG[key];
                const li = document.createElement('li');
                const span = document.createElement('span');
                // Use some inline styles for the color swatch
                span.style.display = 'inline-block';
                span.style.width = '15px';
                span.style.height = '15px';
                span.style.marginRight = '8px';
                span.style.verticalAlign = 'middle';
                span.style.borderRadius = '3px';
                span.style.backgroundColor = getCssVarFallback(`.category-${key}`, 'background-color'); // Try CSS var or class
                span.style.border = '1px solid #555'; // Add border for visibility
                
                li.appendChild(span);
                li.appendChild(document.createTextNode(`${key} (${config.name})`));
                categoryListElement.appendChild(li);
            }
        }
    }

    // Helper to get style from a class if CSS vars aren't directly available/reliable
    function getCssVarFallback(selector, property) {
        const tempElement = document.createElement('div');
        tempElement.className = selector.startsWith('.') ? selector.substring(1) : selector;
        tempElement.style.visibility = 'hidden'; // Hide instead of removing immediately
        tempElement.style.position = 'absolute'; // Prevent layout shift
        document.body.appendChild(tempElement);
        const style = getComputedStyle(tempElement)[property];
        document.body.removeChild(tempElement);
        return style || ''; // Return empty string if style is null/undefined
    }

    // --- Initial Setup --- 
    addItemsBtn.addEventListener('click', addItemsToList);
    listInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); 
            addItemsToList();
        }
    });

    populateCategoryGuide();
    loadLists(); // Load lists, render tabs/content, and set initial state
}); 